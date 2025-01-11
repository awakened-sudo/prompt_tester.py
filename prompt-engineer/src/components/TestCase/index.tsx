import React, { useState } from 'react';
import { TestCase as TestCaseType } from '@/types';
import toast from 'react-hot-toast';

interface TestCaseProps {
  testCase: TestCaseType;
  prompt: string;
  onRate: (rating: number, comments: string, testCaseId: string) => Promise<void>;
}

export function TestCase({ testCase, prompt, onRate }: TestCaseProps) {
  const [rating, setRating] = useState<number>(testCase.rating || 0);
  const [comments, setComments] = useState<string>(testCase.comments || '');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(!!testCase.rating);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [response, setResponse] = useState<string>(testCase.actualResponse || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onRate(rating, comments, testCase.id);
    setIsSubmitted(true);
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
    <div className="bg-white rounded-lg p-4 shadow space-y-4">
      <div>
        <h3 className="font-semibold text-lg">{testCase.question}</h3>
        <p className="text-sm text-gray-500">Testing: {testCase.testingAspect}</p>
        <p className="text-sm text-gray-500">Difficulty: {testCase.difficulty}/10</p>
      </div>

      <div className="space-y-2">
        <p className="font-medium">Expected Behavior:</p>
        <p className="text-gray-700">{testCase.expectedBehavior}</p>
      </div>

      {!response && (
        <button
          onClick={executeTest}
          disabled={isExecuting}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          {isExecuting ? 'Running Test...' : 'Run Test'}
        </button>
      )}

      {response && (
        <div className="space-y-2">
          <p className="font-medium">Actual Response:</p>
          <p className="text-gray-700">{response}</p>
        </div>
      )}

      {response && !isSubmitted && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-medium mb-1">Rating (1-10):</label>
            <input
              type="number"
              min="1"
              max="10"
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="w-24 p-2 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
              disabled={isSubmitted}
            />
          </div>

          <div>
            <label className="block font-medium mb-1">Comments:</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="w-full p-2 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={3}
              placeholder="Add any comments about the test case..."
              disabled={isSubmitted}
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Submit Evaluation
          </button>
        </form>
      )}

      {isSubmitted && (
        <div className="text-green-500 font-medium">
          ✓ Evaluation submitted
        </div>
      )}
    </div>
  );
}
