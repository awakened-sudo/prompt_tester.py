import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY environment variable');
}

if (!process.env.OPENAI_ORG_ID) {
  throw new Error('Missing OPENAI_ORG_ID environment variable');
}

// Initialize the OpenAI client
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  defaultHeaders: {
    'OpenAI-Organization': process.env.OPENAI_ORG_ID,
  },
});

// Assistant IDs
export const ASSISTANTS = {
  PROMPT_ENGINEER: process.env.PROMPT_ENGINEER_ASSISTANT_ID,
  TEST_GENERATOR: process.env.TEST_GENERATOR_ASSISTANT_ID,
  EVALUATOR: process.env.EVALUATOR_ASSISTANT_ID,
  TEST_EXECUTOR: process.env.TEST_EXECUTOR_ASSISTANT_ID,
} as const;