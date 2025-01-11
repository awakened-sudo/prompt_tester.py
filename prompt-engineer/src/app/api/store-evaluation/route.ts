import { NextResponse } from 'next/server';
import { TestCase } from '@/types';

export async function POST(req: Request) {
  try {
    const { threadId, testCase } = await req.json();
    
    if (!threadId || !testCase) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Here you would typically store the evaluation in a database
    // For now, we'll just return success
    // TODO: Implement database storage

    return NextResponse.json({
      success: true,
      testCase
    });
  } catch (error) {
    console.error('Error storing evaluation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to store evaluation' },
      { status: 500 }
    );
  }
}
