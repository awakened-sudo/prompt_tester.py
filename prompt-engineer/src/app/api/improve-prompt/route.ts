import { NextResponse } from 'next/server';
import { openai, ASSISTANTS } from '@/lib/openai';
import type { TestCase } from '@/types';

export async function POST(req: Request) {
  try {
    const { currentPrompt, testResults } = await req.json();

    // Create a new thread
    const thread = await openai.beta.threads.create();

    // Format test case results for the assistant
    const formattedTestResults = testResults
      .map((test: TestCase) => {
        if (test.rating === undefined) return null;
        return `Test: ${test.question}
Rating: ${test.rating}/10
Comments: ${test.comments || 'No comments'}
Testing Aspect: ${test.testingAspect}
Expected Behavior: ${test.expectedBehavior}
Actual Response: ${test.actualResponse}`;
      })
      .filter(Boolean)
      .join('\n\n');

    // Add the message to the thread
    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: `You are a prompt engineering expert. Your task is to analyze test results and suggest improvements to the prompt.

Current prompt:
${currentPrompt}

Test Results:
${formattedTestResults}

Instructions:
1. Analyze the test results carefully
2. Identify areas where the prompt could be improved
3. Create an improved version of the prompt that:
   - Addresses any failed test cases
   - Improves clarity and specificity
   - Adds missing constraints or requirements
   - Maintains successful aspects

Your response MUST follow this EXACT format (do not use markdown code blocks or any other formatting):

IMPROVED_PROMPT
[Place your improved prompt here exactly as it should be used]
END_PROMPT

[Then provide your explanation of the changes]

IMPORTANT: Do not use any markdown formatting, code blocks, or special characters around the prompt. The markers IMPROVED_PROMPT and END_PROMPT must be on their own lines without any additional formatting.`,
    });

    // Run the assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANTS.EVALUATOR || '',
    });

    // Wait for the run to complete
    let completedRun = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    while (completedRun.status !== 'completed') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      completedRun = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      
      if (completedRun.status === 'failed') {
        throw new Error('Assistant run failed');
      }
    }

    // Get the assistant's response
    const messages = await openai.beta.threads.messages.list(thread.id);
    const lastMessage = messages.data[0];

    // Extract the improved prompt
    const messageContent = lastMessage.content[0];
    if (messageContent.type !== 'text') {
      throw new Error('Unexpected message content type');
    }
    
    const content = messageContent.text.value;
    console.log('Assistant response:', content); // Debug log

    // Remove any markdown code blocks
    const cleanedContent = content.replace(/```[^`]*```/g, '');
    
    // Try to extract the prompt
    const improvedPromptMatch = cleanedContent.match(/IMPROVED_PROMPT\n([\s\S]*?)\nEND_PROMPT/);
    
    if (!improvedPromptMatch) {
      console.error('Failed to extract prompt. Full response:', content);
      throw new Error('Could not extract improved prompt from response');
    }

    const improvedPrompt = improvedPromptMatch[1].trim();
    
    // Validate that we got a non-empty prompt
    if (!improvedPrompt) {
      throw new Error('Extracted prompt is empty');
    }

    return NextResponse.json({ improvedPrompt });
  } catch (error) {
    console.error('Error in improve-prompt:', error);
    return NextResponse.json(
      { error: 'Failed to improve prompt' },
      { status: 500 }
    );
  }
}
