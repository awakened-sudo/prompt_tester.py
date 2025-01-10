import { NextResponse } from 'next/server';
import { openai, ASSISTANTS } from '@/lib/openai';
import { APIError } from 'openai';

export async function POST(req: Request) {
  try {
    const { message, threadId } = await req.json();

    console.log('OpenAI Config:', {
      apiKey: process.env.OPENAI_API_KEY?.slice(0, 10) + '...',
      orgId: process.env.OPENAI_ORG_ID,
      assistantId: ASSISTANTS.PROMPT_ENGINEER,
    });

    // Create a new thread if threadId is not provided
    const thread = threadId
      ? await openai.beta.threads.retrieve(threadId)
      : await openai.beta.threads.create();

    console.log('Thread created/retrieved:', thread.id);

    // Add the message to the thread
    const createdMessage = await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: message,
    });

    console.log('Message created:', createdMessage.id);

    // Run the assistant with specific instructions
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANTS.PROMPT_ENGINEER || '',
      instructions: `When providing a prompt, follow these rules EXACTLY:

1. If the user asks to "just do" or similar, create a prompt immediately without asking questions
2. Format your response EXACTLY like this:

PROMPT_COMPLETE
[Your prompt content here]
END_PROMPT

3. The prompt must start with EXACTLY "PROMPT_COMPLETE" followed by a newline
4. The prompt must end with EXACTLY "END_PROMPT" on a new line
5. Do not include ANY text before PROMPT_COMPLETE or after END_PROMPT
6. Do not ask any questions after providing the prompt
7. Do not ask if they want to generate test cases or make modifications`
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

    // Get the messages
    const messages = await openai.beta.threads.messages.list(thread.id);
    console.log('Messages retrieved:', messages.data.length);

    // Process messages to get only text content
    const processedMessages = messages.data.map(msg => ({
      ...msg,
      content: msg.content.reduce((acc: string, c) => {
        if (c.type === 'text') {
          return acc + c.text.value;
        }
        return acc;
      }, '')
    }));

    return NextResponse.json({
      threadId: thread.id,
      messages: processedMessages,
    });
  } catch (error) {
    console.error('Error in chat route:', error);
    
    if (error instanceof APIError) {
      console.error('OpenAI API Error details:', {
        name: error.name,
        message: error.message,
        code: error.code,
        type: error.type,
        status: error.status,
        headers: error.headers,
      });
    } else {
      console.error('Unknown error:', error);
    }

    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
