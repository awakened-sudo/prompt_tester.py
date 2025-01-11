import { useState } from 'react';
import toast from 'react-hot-toast';

export interface TestCase {
  id: string;
  question: string;
  difficulty: number;
  testingAspect: string;
  expectedBehavior: string;
  actualResponse: string;
  rating?: number;
  comments?: string;
}

interface TestCaseProps {
  testCase: TestCase;
  prompt: string;
  onRate: (testCaseId: string, rating: number, comments: string) => Promise<void>;
}

export function TestCase({ testCase, prompt, onRate }: TestCaseProps) {
  const [rating, setRating] = useState<number | null>(testCase.rating || null);
  const [comments, setComments] = useState<string>(testCase.comments || '');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(!!testCase.rating);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [response, setResponse] = useState<string>(testCase.actualResponse || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating !== null) {
      await onRate(testCase.id, rating, comments);
      setIsSubmitted(true);
    }
  };

  const executeTest = async () => {
    setIsExecuting(true);
    try {
      const res = await fetch('/api/execute-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, testCase }),
      });

      if (!res.ok) {
        throw new Error('Failed to execute test');
      }

      const data = await res.json();
      setResponse(data.testCase.actualResponse);
    } catch (error) {
      console.error('Error executing test:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to execute test');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">{testCase.question}</h3>
        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
          Difficulty: {testCase.difficulty}/10
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-gray-600">
          <strong>Testing:</strong> {testCase.testingAspect}
        </p>
        <p className="text-gray-600">
          <strong>Expected:</strong> {testCase.expectedBehavior}
        </p>
      </div>

      {!testCase.actualResponse && !response && (
        <button
          onClick={executeTest}
          disabled={isExecuting}
          className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          {isExecuting ? 'Running Test...' : 'Run Test'}
        </button>
      )}

      {(testCase.actualResponse || response) && (
        <div className="bg-gray-50 p-3 rounded">
          <strong>Response:</strong>
          <p className="mt-1 whitespace-pre-wrap">{testCase.actualResponse || response}</p>
        </div>
      )}

      {(testCase.actualResponse || response) && !isSubmitted && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Rating (1-10)
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={rating || ''}
              onChange={(e) => setRating(e.target.value ? Number(e.target.value) : null)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Comments
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              rows={3}
              placeholder="Add your feedback about the response..."
              required
            />
          </div>

          <button
            type="submit"
            className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Submit Evaluation
          </button>
        </form>
      )}

      {isSubmitted && (
        <div className="text-green-500 font-medium text-center">
          ✓ Evaluation submitted
        </div>
      )}
    </div>
  );
}
