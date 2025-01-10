import { useState } from 'react';
import { TestCase as TestCaseType } from '@/types';

interface TestCaseProps {
  testCase: TestCaseType;
  onRate: (rating: number, comments: string) => void;
}

export function TestCase({ testCase, onRate }: TestCaseProps) {
  const [rating, setRating] = useState<number | null>(testCase.rating);
  const [comments, setComments] = useState(testCase.comments);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating !== null) {
      onRate(rating, comments);
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
        <div className="bg-gray-50 p-3 rounded">
          <strong>Response:</strong>
          <p className="mt-1">{testCase.actualResponse}</p>
        </div>
      </div>

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
            onChange={(e) => setRating(Number(e.target.value))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Comments
          </label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            rows={3}
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50"
          disabled={rating === null}
        >
          Submit Evaluation
        </button>
      </form>
    </div>
  );
}
