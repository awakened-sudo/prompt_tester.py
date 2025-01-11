import React from 'react';

interface PromptDiffProps {
  originalPrompt: string;
  refinedPrompt: string;
}

interface DiffSegment {
  text: string;
  type: 'same' | 'removed' | 'added';
}

export function PromptDiff({ originalPrompt, refinedPrompt }: PromptDiffProps) {
  const createUnifiedDiff = (original: string, refined: string): DiffSegment[] => {
    const result: DiffSegment[] = [];
    const originalWords = original.split(/(\s+)/);
    const refinedWords = refined.split(/(\s+)/);
    let i = 0;
    
    while (i < Math.max(originalWords.length, refinedWords.length)) {
      if (i < originalWords.length && i < refinedWords.length) {
        if (originalWords[i] === refinedWords[i]) {
          // Words are identical, keep as is
          result.push({ text: originalWords[i], type: 'same' });
        } else {
          // Words differ, show both versions inline
          if (originalWords[i].match(/\S/)) {
            result.push({ text: originalWords[i], type: 'removed' });
          }
          if (refinedWords[i].match(/\S/)) {
            result.push({ text: refinedWords[i], type: 'added' });
          } else if (originalWords[i].match(/\s/)) {
            // Preserve whitespace from original
            result.push({ text: originalWords[i], type: 'same' });
          }
        }
      } else if (i < originalWords.length) {
        // Remaining original words
        result.push({ text: originalWords[i], type: 'removed' });
      } else if (i < refinedWords.length) {
        // Additional refined words
        result.push({ text: refinedWords[i], type: 'added' });
      }
      i++;
    }
    return result;
  };

  const diff = createUnifiedDiff(originalPrompt, refinedPrompt);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Prompt Changes</h2>
      <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm">
        <div className="whitespace-pre-wrap leading-relaxed">
          {diff.map((segment, index) => (
            <span
              key={index}
              className={
                segment.type === 'added'
                  ? 'bg-green-100 text-green-800'
                  : segment.type === 'removed'
                  ? 'bg-red-100 text-red-800'
                  : ''
              }
            >
              {segment.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
