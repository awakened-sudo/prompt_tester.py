const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is required');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface AssistantInstructions {
  [key: string]: string;
}

async function createAssistants() {
  try {
    // Read instructions file
    const instructions = fs.readFileSync(
      path.join(__dirname, '../assistant-instructions.md'),
      'utf-8'
    );

    // Split instructions into sections
    const sections = instructions.split('## ').filter(Boolean);
    const assistantInstructions: AssistantInstructions = {};
    
    sections.forEach((section: string) => {
      const lines = section.split('\n');
      const title = lines[0].trim();
      const content = lines.slice(1).join('\n').trim();
      assistantInstructions[title] = content;
    });

    // Create Prompt Engineer Assistant
    console.log('Creating Prompt Engineer Assistant...');
    const promptEngineer = await openai.beta.assistants.create({
      name: 'Prompt Engineer',
      instructions: assistantInstructions['Prompt Engineer Assistant'],
      model: 'gpt-4o-mini',
      tools: [{ type: 'code_interpreter' }],
    });

    // Create Test Generator Assistant
    console.log('Creating Test Generator Assistant...');
    const testGenerator = await openai.beta.assistants.create({
      name: 'Test Generator',
      instructions: assistantInstructions['Test Generator Assistant'],
      model: 'gpt-4o-mini',
      tools: [{ type: 'code_interpreter' }],
    });

    // Create Evaluator Assistant
    console.log('Creating Evaluator Assistant...');
    const evaluator = await openai.beta.assistants.create({
      name: 'Evaluator',
      instructions: assistantInstructions['Evaluator Assistant'],
      model: 'gpt-4o-mini',
      tools: [{ type: 'code_interpreter' }],
    });

    // Create or update .env file with assistant IDs
    const envContent = `OPENAI_API_KEY=${process.env.OPENAI_API_KEY}
PROMPT_ENGINEER_ASSISTANT_ID=${promptEngineer.id}
TEST_GENERATOR_ASSISTANT_ID=${testGenerator.id}
EVALUATOR_ASSISTANT_ID=${evaluator.id}
`;

    fs.writeFileSync(path.join(__dirname, '../.env'), envContent);

    console.log('\nAssistants created successfully!');
    console.log('\nAssistant IDs:');
    console.log(`Prompt Engineer: ${promptEngineer.id}`);
    console.log(`Test Generator: ${testGenerator.id}`);
    console.log(`Evaluator: ${evaluator.id}`);
    console.log('\nIDs have been saved to .env file');

  } catch (error) {
    console.error('Error creating assistants:', error);
  }
}

createAssistants();
