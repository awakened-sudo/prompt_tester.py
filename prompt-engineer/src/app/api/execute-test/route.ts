import { NextResponse } from 'next/server';
import { openai } from '@/lib/openai';
import type { TestCase } from '@/types';

export async function POST(req: Request) {
  try {
    const { prompt, testCase } = await req.json();
    
    if (!process.env.TEST_EXECUTOR_ASSISTANT_ID) {
      throw new Error('TEST_EXECUTOR_ASSISTANT_ID not configured');
    }

    // Create a thread for this test execution
    const thread = await openai.beta.threads.create();

    // Add the test case as a message
    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: testCase.question,
    });

    // Run the assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: process.env.TEST_EXECUTOR_ASSISTANT_ID,
      instructions: `Please provide a response that is 500 tokens or less. Be concise and direct in your answer.`,
    });

    // Poll for completion
    let completedRun;
    while (true) {
      const runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      if (runStatus.status === 'completed') {
        completedRun = runStatus;
        break;
      } else if (runStatus.status === 'failed') {
        throw new Error('Run failed');
      }
      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Get messages
    const messages = await openai.beta.threads.messages.list(thread.id);
    const lastMessage = messages.data
      .filter(message => message.role === 'assistant')
      .pop();

    if (!lastMessage) {
      throw new Error('No response received');
    }

    // Get the text content from the message
    let response = '';
    for (const content of lastMessage.content) {
      if (content.type === 'text') {
        response = content.text.value;
        break;
      }
    }

    if (!response) {
      throw new Error('No text content in response');
    }

    // Update the test case with the response
    const updatedTestCase = {
      ...testCase,
      actualResponse: response
    };

    return NextResponse.json({
      success: true,
      testCase: updatedTestCase,
      threadId: thread.id
    });
  } catch (error) {
    console.error('Error executing test:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute test' },
      { status: 500 }
    );
  }
}
