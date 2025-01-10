import { NextResponse } from 'next/server';
import { openai, ASSISTANTS } from '@/lib/openai';
import { TestCase } from '@/types';

export async function POST(req: Request) {
  try {
    const { prompt, threadId } = await req.json();
    
    console.log('Generating tests for prompt:', prompt);
    console.log('Using assistant ID:', ASSISTANTS.TEST_GENERATOR);

    if (!ASSISTANTS.TEST_GENERATOR) {
      throw new Error('TEST_GENERATOR_ASSISTANT_ID not configured');
    }

    // Create a new thread if threadId is not provided
    const thread = threadId
      ? await openai.beta.threads.retrieve(threadId)
      : await openai.beta.threads.create();

    console.log('Thread created/retrieved:', thread.id);

    // Add the message to the thread with specific instructions for JSON format
    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: `Create 5 test cases for this prompt. Return ONLY a JSON array with no additional text.

Test Case Format:
{
  "id": "test-1",
  "question": "Test scenario description",
  "difficulty": 5,
  "testingAspect": "What aspect this tests",
  "expectedBehavior": "What the AI should do",
  "actualResponse": ""
}

Example Response:
[
  {
    "id": "test-1",
    "question": "Test basic functionality",
    "difficulty": 5,
    "testingAspect": "Core functionality",
    "expectedBehavior": "Should respond with...",
    "actualResponse": ""
  }
]

Prompt to test:
${prompt}`
    });

    console.log('Test request message created');

    // Run the assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANTS.TEST_GENERATOR,
      instructions: "Generate exactly 5 diverse test cases. Return ONLY a valid JSON array of test cases. The response must start with '[' and end with ']'. Do not include any explanatory text."
    });

    console.log('Run created:', run.id);

    // Poll for completion
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    console.log('Initial run status:', runStatus.status);

    while (runStatus.status === 'in_progress' || runStatus.status === 'queued') {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      console.log('Updated run status:', runStatus.status);
    }

    if (runStatus.status === 'failed') {
      throw new Error(`Run failed: ${runStatus.last_error?.message || 'Unknown error'}`);
    }

    // Get the messages
    const messages = await openai.beta.threads.messages.list(thread.id);
    console.log('Messages retrieved:', messages.data.length);

    const lastMessage = messages.data[0];
    console.log('Last message content:', lastMessage.content);

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

    console.log('Raw response:', textContent);

    // Try to find and parse JSON content
    const jsonMatch = textContent.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }

    let testCases: TestCase[];
    try {
      testCases = JSON.parse(jsonMatch[0]);
      console.log('Parsed test cases:', testCases);
      
      // Validate the test cases structure
      if (!Array.isArray(testCases)) {
        throw new Error('Response is not an array of test cases');
      }

      if (testCases.length !== 5) {
        console.warn(`Expected 5 test cases, got ${testCases.length}`);
      }

      // Validate and fix each test case
      testCases = testCases.map((testCase, index) => {
        const validatedCase = {
          id: testCase.id || `test-${index + 1}`,
          question: testCase.question || `Test Case ${index + 1}`,
          difficulty: typeof testCase.difficulty === 'number' ? 
            Math.min(Math.max(Math.round(testCase.difficulty), 1), 10) : 5,
          testingAspect: testCase.testingAspect || 'General functionality',
          expectedBehavior: testCase.expectedBehavior || 'Expected behavior not specified',
          actualResponse: '',
        };
        return validatedCase;
      });

      // Ensure we have exactly 5 test cases
      while (testCases.length < 5) {
        testCases.push({
          id: `test-${testCases.length + 1}`,
          question: `Additional Test Case ${testCases.length + 1}`,
          difficulty: 5,
          testingAspect: 'General functionality',
          expectedBehavior: 'Expected behavior not specified',
          actualResponse: '',
        });
      }
      testCases = testCases.slice(0, 5);

    } catch (parseError) {
      console.error('Error parsing test cases:', parseError);
      throw new Error('Failed to parse test cases JSON');
    }

    console.log('Returning test cases:', testCases);

    return NextResponse.json({
      threadId: thread.id,
      testCases,
    });
  } catch (error) {
    console.error('Error generating test cases:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate test cases' },
      { status: 500 }
    );
  }
}
