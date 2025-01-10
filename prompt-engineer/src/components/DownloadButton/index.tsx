import React from 'react';
import { Download } from 'lucide-react';
import { formatPromptForMarkdown } from '@/lib/utils';
import type { TestCase } from '@/types';

export interface DownloadButtonProps {
  prompt: string;
  testResults: TestCase[];
  disabled?: boolean;
}

export const DownloadButton = ({
  prompt,
  testResults,
  disabled = false,
}: DownloadButtonProps) => {
  const handleDownload = () => {
    const markdown = formatPromptForMarkdown(prompt, testResults);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prompt-engineering-results.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleDownload}
      disabled={disabled || !testResults.length}
      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
    >
      <Download className="w-4 h-4" />
      Download Results
    </button>
  );
};
