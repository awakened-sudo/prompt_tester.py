import { NextResponse } from 'next/server';
import { openai, ASSISTANTS } from '@/lib/openai';
import type { TestCase } from '@/types';

export async function POST(req: Request) {
  try {
    const { prompt, testCases, threadId } = await req.json();

    // Create a new thread if threadId is not provided
    const thread = threadId
      ? await openai.beta.threads.retrieve(threadId)
      : await openai.beta.threads.create();

    // Format test case results for the assistant
    const testResults = testCases
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
      content: `Here is the current prompt:
${prompt}

Here are the test results:
${testResults}

Please analyze these test results and suggest improvements to the prompt. Focus on:
1. Addressing any failed test cases
2. Improving clarity and specificity
3. Adding any missing constraints or requirements
4. Maintaining the successful aspects of the current prompt

Provide the improved prompt in this format:
IMPROVED_PROMPT
[Your improved prompt here]
END_PROMPT

Then explain your changes and reasoning.`,
    });

    // Run the assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANTS.EVALUATOR || '',
    });

    // Poll for completion
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    while (runStatus.status === 'in_progress' || runStatus.status === 'queued') {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    // Get the messages
    const messages = await openai.beta.threads.messages.list(thread.id);
    const lastMessage = messages.data[0];

    // Get text content from the message
    const textContent = lastMessage.content.reduce((acc: string, c) => {
      if (c.type === 'text') {
        return acc + c.text.value;
      }
      return acc;
    }, '');

    if (!textContent) {
      throw new Error('No text content found in response');
    }

    // Extract the improved prompt
    const improvedPromptMatch = textContent.match(/IMPROVED_PROMPT\n([\s\S]*?)\nEND_PROMPT/);
    const improvedPrompt = improvedPromptMatch ? improvedPromptMatch[1].trim() : null;

    if (!improvedPrompt) {
      throw new Error('No improved prompt found in response');
    }

    // Extract the explanation (everything after END_PROMPT)
    const explanation = textContent.split('END_PROMPT')[1]?.trim() || '';

    return NextResponse.json({
      threadId: thread.id,
      improvedPrompt,
      explanation,
    });
  } catch (error) {
    console.error('Error improving prompt:', error);
    return NextResponse.json(
      { error: 'Failed to improve prompt' },
      { status: 500 }
    );
  }
}
