'use client';

import React, { useState, useEffect } from 'react';
import { Chat } from '@/components/Chat/index';
import { TestCase as TestCaseComponent } from '@/components/TestCase';
import { DownloadButton } from '@/components/DownloadButton';
import { PromptDiff } from '@/components/PromptDiff';
import type { Message, APIMessage } from '@/types';
import { extractPrompt } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [testCases, setTestCases] = useState<TestCaseComponent[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState<string>('');
  const [improvedPrompt, setImprovedPrompt] = useState<string>('');
  const [explanation, setExplanation] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [phase, setPhase] = useState<'engineering' | 'testing' | 'refining'>('engineering');
  const [isGeneratingTests, setIsGeneratingTests] = useState(false);
  const [isImprovingPrompt, setIsImprovingPrompt] = useState(false);
  const [showImprovePromptButton, setShowImprovePromptButton] = useState(false);

  // Check if all test cases are rated
  useEffect(() => {
    if (phase === 'testing' && testCases.length > 0) {
      const allRated = testCases.every((test) => test.rating !== undefined);
      if (allRated) {
        setShowImprovePromptButton(true);
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

        // Update TEST_EXECUTOR assistant with the new prompt
        try {
          const updateResponse = await fetch('/api/update-assistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              assistantId: 'TEST_EXECUTOR',
              instructions: `You are an AI assistant that executes test prompts. When given a prompt, respond naturally as if you were directly responding to that prompt. Do not mention that you are testing or evaluating - just respond to the prompt itself.

Current Prompt:
${promptContent}`,
            }),
          });

          if (!updateResponse.ok) {
            throw new Error('Failed to update assistant instructions');
          }

          console.log('Updated TEST_EXECUTOR with new prompt');
          setPhase('testing');
          await generateTestCases(promptContent);
        } catch (error) {
          console.error('Error updating TEST_EXECUTOR:', error);
          toast.error('Failed to update test executor. Tests may not reflect the current prompt.');
        }
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

  const handleRateTestCase = async (testCaseId: string, rating: number, comments: string) => {
    try {
      // Update local state
      setTestCases(prev => prev.map(test => 
        test.id === testCaseId ? { ...test, rating, comments } : test
      ));

      // Store evaluation
      const response = await fetch('/api/store-evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          threadId,
          testCase: testCases.find(t => t.id === testCaseId) 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to store evaluation');
      }

      // Check if all test cases are rated
      const updatedTests = testCases.map(test => 
        test.id === testCaseId ? { ...test, rating, comments } : test
      );
      
      if (updatedTests.every(test => test.rating !== undefined)) {
        setShowImprovePromptButton(true);
      }
    } catch (error) {
      console.error('Error rating test case:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to rate test case');
    }
  };

  const handleImprovePrompt = async () => {
    setIsImprovingPrompt(true);
    setShowImprovePromptButton(false);
    try {
      const response = await fetch('/api/improve-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPrompt,
          testResults: testCases
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to improve prompt');
      }

      const { improvedPrompt: newImprovedPrompt } = await response.json();
      setImprovedPrompt(newImprovedPrompt);
      setPhase('refining'); 
      toast.success('Prompt improved successfully');
    } catch (error) {
      console.error('Error improving prompt:', error);
      toast.error('Failed to improve prompt');
    } finally {
      setIsImprovingPrompt(false);
    }
  };

  const handleDownloadAndFinish = () => {
    const content = {
      finalPrompt: currentPrompt,
      testResults: testCases.map(tc => ({
        question: tc.question,
        expectedBehavior: tc.expectedBehavior,
        actualResponse: tc.actualResponse,
        rating: tc.rating,
        comments: tc.comments
      })),
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `prompt-engineering-results-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setShowImprovePromptButton(false);
    toast.success('Results downloaded successfully');
  };

  const runAllTests = async () => {
    try {
      const promises = testCases.map(async (testCase) => {
        const response = await fetch('/api/execute-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: currentPrompt, testCase }),
        });

        if (!response.ok) {
          throw new Error(`Failed to execute test ${testCase.id}`);
        }

        const data = await response.json();
        return data.testCase;
      });

      const updatedTestCases = await Promise.all(promises);
      setTestCases(updatedTestCases);
      toast.success('All tests completed!');
    } catch (error) {
      console.error('Error running all tests:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to run all tests');
    }
  };

  const handleTestImprovedPrompt = async () => {
    if (!improvedPrompt) return;
    setCurrentPrompt(improvedPrompt);
    setImprovedPrompt('');
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
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Test Cases</h2>
                <button
                  onClick={runAllTests}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Run All Tests
                </button>
              </div>
              <div className="grid gap-6">
                {testCases.map((testCase) => (
                  <TestCaseComponent
                    key={testCase.id}
                    testCase={testCase}
                    prompt={currentPrompt}
                    onRate={handleRateTestCase}
                  />
                ))}
              </div>

              {showImprovePromptButton && (
                <div className="mt-8 flex flex-col items-center">
                  <h3 className="text-xl font-medium text-gray-700 mb-6">
                    What would you like to do with the test results?
                  </h3>
                  <div className="flex flex-col gap-4 w-full max-w-md">
                    <button
                      onClick={handleImprovePrompt}
                      className="w-full py-3 px-6 bg-[#4ADE80] hover:bg-[#22C55E] text-white font-semibold rounded-lg text-lg transition-colors"
                      disabled={isImprovingPrompt}
                    >
                      {isImprovingPrompt ? 'Improving...' : 'Improve Prompt'}
                    </button>
                    <button
                      onClick={handleDownloadAndFinish}
                      className="w-full py-3 px-6 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold rounded-lg text-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <span>Download & Finish</span>
                      <svg 
                        className="w-5 h-5" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {phase === 'refining' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Prompt Refinement</h2>
              <PromptDiff 
                originalPrompt={currentPrompt}
                refinedPrompt={improvedPrompt}
              />
              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => {
                    setCurrentPrompt(improvedPrompt);
                    setImprovedPrompt('');
                    setPhase('testing');
                    generateTestCases(improvedPrompt);
                  }}
                  className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  Use Refined Prompt
                </button>
                <button
                  onClick={() => {
                    setImprovedPrompt('');
                    setPhase('testing');
                  }}
                  className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Keep Original
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
