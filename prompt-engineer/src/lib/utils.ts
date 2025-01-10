import { TestCase } from '@/types';

export function extractPrompt(message: string): string {
  const match = message.match(/PROMPT_COMPLETE\n([\s\S]*?)(?:END_PROMPT|$)/);
  if (!match) {
    // Try alternative format without END_PROMPT
    const simpleMatch = message.match(/PROMPT_COMPLETE\n([\s\S]*?)$/);
    return simpleMatch ? simpleMatch[1].trim() : '';
  }
  return match[1].trim();
}

export function parseTestCases(testCasesData: any): TestCase[] {
  try {
    // If testCasesData is already an array, process it directly
    const testCases = Array.isArray(testCasesData) ? testCasesData : [testCasesData];
    
    return testCases.map((testCase: any) => ({
      id: testCase.id || Math.random().toString(36).substring(7),
      question: testCase.question || '',
      difficulty: typeof testCase.difficulty === 'number' ? testCase.difficulty : 5,
      testingAspect: testCase.testingAspect || '',
      expectedBehavior: testCase.expectedBehavior || '',
      actualResponse: testCase.actualResponse || '',
      rating: testCase.rating,
      comments: testCase.comments || ''
    }));
  } catch (error) {
    console.error('Error parsing test cases:', error);
    return [];
  }
}

export function formatPromptForMarkdown(prompt: string, testCases: TestCase[]): string {
  const testCaseMarkdown = testCases
    .map(
      (test) => `
### Test Case: ${test.question}
- Testing Aspect: ${test.testingAspect}
- Difficulty: ${test.difficulty}
- Expected Behavior: ${test.expectedBehavior}
${test.actualResponse ? `- Actual Response: ${test.actualResponse}` : ''}
${test.rating ? `- Rating: ${test.rating}/10` : ''}
${test.comments ? `- Comments: ${test.comments}` : ''}`
    )
    .join('\n\n');

  return `# Prompt
${prompt}

# Test Cases
${testCaseMarkdown}`;
}

function calculateAverageRating(testResults: TestCase[]): number {
  const ratings = testResults.map(test => test.rating).filter((r): r is number => r !== null);
  return ratings.length > 0
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
    : 0;
}

function summarizeTestCoverage(testResults: TestCase[]): string {
  const aspects = new Set(testResults.map(test => test.testingAspect));
  return Array.from(aspects).join(', ');
}
