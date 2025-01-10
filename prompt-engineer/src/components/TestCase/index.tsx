import React, { useState } from 'react';
import { TestCase as TestCaseType } from '@/types';

interface TestCaseProps {
  testCase: TestCaseType;
  onRate: (testCaseId: string, rating: number, comments: string) => void;
}

export function TestCase({ testCase, onRate }: TestCaseProps) {
  const [rating, setRating] = useState<number>(testCase.rating || 0);
  const [comments, setComments] = useState<string>(testCase.comments || '');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(!!testCase.rating);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRate(testCase.id, rating, comments);
    setIsSubmitted(true);
  };

  return (
    <div className="bg-white rounded-lg p-4 shadow space-y-4">
      <div>
        <h3 className="font-semibold text-lg">{testCase.question}</h3>
        <p className="text-sm text-gray-500">Testing: {testCase.testingAspect}</p>
      </div>

      <div className="space-y-2">
        <p className="font-medium">Expected Behavior:</p>
        <p className="text-gray-700">{testCase.expectedBehavior}</p>
      </div>

      <div className="space-y-2">
        <p className="font-medium">Actual Response:</p>
        <p className="text-gray-700">{testCase.actualResponse}</p>
      </div>

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

        {!isSubmitted && (
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Submit Rating
          </button>
        )}

        {isSubmitted && (
          <div className="text-green-500 font-medium">
            ✓ Rating submitted
          </div>
        )}
      </form>
    </div>
  );
}
