'use client';

import React, { useState, useEffect } from 'react';
import { Chat } from '@/components/Chat/index';
import { TestCase as TestCaseComponent } from '@/components/TestCase';
import { DownloadButton } from '@/components/DownloadButton';
import type { Message, TestCase as TestCaseType, APIMessage } from '@/types';
import { extractPrompt } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [testCases, setTestCases] = useState<TestCaseType[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState<string>('');
  const [improvedPrompt, setImprovedPrompt] = useState<string>('');
  const [explanation, setExplanation] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [phase, setPhase] = useState<'engineering' | 'testing' | 'refining'>('engineering');
  const [isGeneratingTests, setIsGeneratingTests] = useState(false);
  const [isImprovingPrompt, setIsImprovingPrompt] = useState(false);

  // Check if all test cases are rated
  useEffect(() => {
    if (phase === 'testing' && testCases.length > 0) {
      const allRated = testCases.every((test) => test.rating !== undefined);
      if (allRated) {
        setPhase('refining');
        improvePrompt();
      }
    }
  }, [testCases, phase]);

  const handleSendMessage = async (content: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, threadId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      if (!data.messages || !Array.isArray(data.messages) || data.messages.length === 0) {
        throw new Error('Invalid response format: no messages received');
      }

      setThreadId(data.threadId);

      // Convert API messages to our Message format and filter for assistant messages
      const newMessages = (data.messages as Array<{
        id: string;
        role: 'user' | 'assistant';
        content: string;
        created_at: number;
      }>).map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.created_at * 1000),
      }));

      setMessages(newMessages);

      // Find the latest assistant message
      const latestAssistantMessage = newMessages.find(msg => msg.role === 'assistant');
      if (!latestAssistantMessage) {
        console.log('No assistant message found');
        return;
      }

      console.log('Latest assistant message:', latestAssistantMessage.content);
      
      // Check for both formats
      let promptContent = '';
      const promptMatchWithEnd = latestAssistantMessage.content.match(/PROMPT_COMPLETE\n([\s\S]*?)END_PROMPT/);
      const promptMatchSimple = latestAssistantMessage.content.match(/PROMPT_COMPLETE\n([\s\S]*?)$/);
      
      if (promptMatchWithEnd) {
        promptContent = promptMatchWithEnd[1].trim();
        console.log('Found prompt with END_PROMPT');
      } else if (promptMatchSimple && latestAssistantMessage.content.includes('PROMPT_COMPLETE')) {
        promptContent = promptMatchSimple[1].trim();
        console.log('Found prompt without END_PROMPT');
      }
      
      if (promptContent) {
        console.log('Extracted prompt:', promptContent);
        setCurrentPrompt(promptContent);
        setPhase('testing');
        await generateTestCases(promptContent);
      } else {
        console.log('No prompt found in message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const generateTestCases = async (prompt: string) => {
    setIsGeneratingTests(true);
    try {
      console.log('Starting test case generation for prompt:', prompt);
      
      const response = await fetch('/api/generate-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, threadId }),
      });

      const data = await response.json();
      console.log('Test case generation response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate test cases');
      }

      if (!data.testCases || !Array.isArray(data.testCases)) {
        throw new Error('Invalid test cases response format');
      }

      if (data.testCases.length === 0) {
        throw new Error('No test cases were generated');
      }

      console.log('Setting test cases:', data.testCases);
      setTestCases(data.testCases);
      toast.success(`Generated ${data.testCases.length} test cases`);
    } catch (error) {
      console.error('Error generating tests:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate test cases');
      // Reset phase if test generation fails
      setPhase('engineering');
    } finally {
      setIsGeneratingTests(false);
    }
  };

  const improvePrompt = async () => {
    setIsImprovingPrompt(true);
    try {
      const response = await fetch('/api/improve-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: currentPrompt,
          testCases,
          threadId,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setImprovedPrompt(data.improvedPrompt);
      setExplanation(data.explanation);
      toast.success('Prompt improved based on test results!');
    } catch (error) {
      console.error('Error improving prompt:', error);
      toast.error('Failed to improve prompt');
    } finally {
      setIsImprovingPrompt(false);
    }
  };

  const handleRateTestCase = (rating: number, comments: string, testCaseId: string) => {
    setTestCases((prev) =>
      prev.map((test) =>
        test.id === testCaseId ? { ...test, rating, comments } : test
      )
    );
  };

  const handleTestImprovedPrompt = async () => {
    if (!improvedPrompt) return;
    setCurrentPrompt(improvedPrompt);
    setImprovedPrompt('');
    setExplanation('');
    setPhase('testing');
    await generateTestCases(improvedPrompt);
  };

  return (
    <main className="container mx-auto p-4 min-h-screen flex flex-col gap-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Prompt Engineer</h1>
        <div className="flex gap-2">
          <span className={`px-3 py-1 rounded-full ${phase === 'engineering' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
            Engineering
          </span>
          <span className={`px-3 py-1 rounded-full ${phase === 'testing' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
            Testing
          </span>
          <span className={`px-3 py-1 rounded-full ${phase === 'refining' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
            Refining
          </span>
        </div>
        {currentPrompt && <DownloadButton prompt={currentPrompt} testResults={testCases} />}
      </div>

      <div className="grid grid-cols-2 gap-4 flex-1">
        <div className="flex flex-col">
          <h2 className="text-xl font-semibold mb-2">Chat</h2>
          <Chat
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            disabled={phase !== 'engineering'}
          />
        </div>

        <div className="flex flex-col">
          <h2 className="text-xl font-semibold mb-2">
            {phase === 'refining' ? 'Prompt Refinement' : 'Test Cases'}
          </h2>
          
          {phase === 'testing' && (
            <div className="space-y-4">
              {isGeneratingTests ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                </div>
              ) : testCases.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No test cases generated yet. Complete the prompt engineering phase first.
                </p>
              ) : (
                testCases.map((testCase) => (
                  <TestCaseComponent
                    key={testCase.id}
                    testCase={testCase}
                    onRate={(rating, comments) => handleRateTestCase(rating, comments, testCase.id)}
                  />
                ))
              )}
            </div>
          )}

          {phase === 'refining' && (
            <div className="space-y-4">
              {isImprovingPrompt ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                </div>
              ) : (
                <>
                  <div className="bg-white rounded-lg p-4 shadow">
                    <h3 className="font-semibold mb-2">Improved Prompt</h3>
                    <p className="whitespace-pre-wrap mb-4">{improvedPrompt}</p>
                    <button
                      onClick={handleTestImprovedPrompt}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Test This Version
                    </button>
                  </div>
                  {explanation && (
                    <div className="bg-white rounded-lg p-4 shadow">
                      <h3 className="font-semibold mb-2">Explanation of Changes</h3>
                      <p className="whitespace-pre-wrap">{explanation}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
