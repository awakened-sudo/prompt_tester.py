import { NextResponse } from 'next/server';
import { openai, ASSISTANTS } from '@/lib/openai';

type AssistantKey = keyof typeof ASSISTANTS;

export async function POST(req: Request) {
  try {
    const { assistantId, instructions } = await req.json();
    
    if (!Object.keys(ASSISTANTS).includes(assistantId)) {
      throw new Error(`${assistantId} not configured`);
    }

    const typedAssistantId = assistantId as AssistantKey;
    const assistantValue = ASSISTANTS[typedAssistantId];

    if (!assistantValue) {
      throw new Error(`${assistantId} ID not found`);
    }

    // Update the assistant's instructions
    await openai.beta.assistants.update(
      assistantValue,
      {
        instructions,
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Assistant instructions updated successfully',
    });
  } catch (error) {
    console.error('Error updating assistant:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update assistant' },
      { status: 500 }
    );
  }
}
