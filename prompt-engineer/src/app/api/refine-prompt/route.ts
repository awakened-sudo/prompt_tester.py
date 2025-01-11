import { NextResponse } from 'next/server';
import { openai, ASSISTANTS } from '@/lib/openai';
import { TestCase } from '@/types';

export async function POST(req: Request) {
  try {
    const { originalPrompt, testCases } = await req.json();
    
    if (!originalPrompt || !testCases || !Array.isArray(testCases)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create a new thread for prompt refinement
    const thread = await openai.beta.threads.create();

    // Prepare the evaluation summary
    const evaluationSummary = testCases.map((test: TestCase) => ({
      question: test.question,
      rating: test.rating || 0,
      comments: test.comments || 'No comments provided',
      expectedBehavior: test.expectedBehavior,
      actualResponse: test.actualResponse
    }));

    // Send the request for prompt refinement
    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: `Please analyze this prompt and its test results, then provide an improved version.

Original Prompt:
${originalPrompt}

Test Results:
${JSON.stringify(evaluationSummary, null, 2)}

Please provide an improved version of the prompt that addresses the issues identified in the test results. Focus on:
1. Areas where the actual responses didn't meet expectations
2. Test cases with low ratings
3. Specific issues mentioned in comments

Return ONLY the improved prompt text with no additional explanation.`
    });

    // Run the assistant
    if (!ASSISTANTS.TEST_GENERATOR) {
      throw new Error('TEST_GENERATOR_ASSISTANT_ID not configured');
    }

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANTS.TEST_GENERATOR,
      instructions: "Analyze the test results and provide an improved version of the prompt. Return ONLY the improved prompt text."
    });

    // Poll for completion
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    
    while (runStatus.status === 'in_progress' || runStatus.status === 'queued') {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    if (runStatus.status === 'failed') {
      throw new Error(`Run failed: ${runStatus.last_error?.message || 'Unknown error'}`);
    }

    // Get the refined prompt
    const messages = await openai.beta.threads.messages.list(thread.id);
    const lastMessage = messages.data[0];

    // Extract text content
    const refinedPrompt = lastMessage.content.reduce((acc: string, c) => {
      if (c.type === 'text') {
        return acc + c.text.value;
      }
      return acc;
    }, '');

    return NextResponse.json({
      success: true,
      refinedPrompt,
      originalPrompt,
    });
  } catch (error) {
    console.error('Error refining prompt:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to refine prompt' },
      { status: 500 }
    );
  }
}
