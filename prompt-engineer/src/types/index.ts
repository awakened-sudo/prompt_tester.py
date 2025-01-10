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

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface APIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: number;
  thread_id: string;
  assistant_id?: string;
  run_id?: string;
  metadata?: Record<string, unknown>;
}

export interface Prompt {
  id: string;
  content: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  testCases: TestCase[];
}
