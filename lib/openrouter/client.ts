// OpenRouter API client for DeepSeek AI
// Primary: DeepSeek V3 (deepseek/deepseek-chat)
// Fallback: Gemini 2.0 Flash (google/gemini-2.0-flash-exp:free)

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OpenRouterResponse {
  id: string;
  choices: {
    message: Message;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function generateCompletion(
  messages: Message[],
  model: string = 'deepseek/deepseek-chat',
  temperature: number = 0.7
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('OPENROUTER_API_KEY is required in production.');
    }
    console.log('OpenRouter not configured, returning development placeholder response.');
    return 'AI is not configured in this development environment.';
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Favor International Portal',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.statusText}`);
  }

  const data: OpenRouterResponse = await response.json();
  return data.choices[0]?.message?.content || '';
}

export async function getCourseRecommendations(
  userInterests: string[],
  completedCourses: string[],
  userType: string
): Promise<string[]> {
  const systemPrompt = `You are an AI assistant for Favor International, a nonprofit organization focused on education, healthcare, and discipleship in Africa. 
Your task is to recommend courses from the Favor learning management system based on the user's interests and profile.

Available courses:
1. Africa Programs Overview - Deep dive into Favor's four core program areas
2. Vision and Great Commission - Carol Ward teaching on Favor's unique model
3. Favor US Introduction - US team and domestic opportunities

Respond with a JSON array of course IDs in order of recommendation, like: ["course-1", "course-2"]`;

  const userPrompt = `User type: ${userType}
Interests: ${userInterests.join(', ')}
Completed courses: ${completedCourses.join(', ') || 'None'}

Recommend courses for this user.`;

  try {
    const response = await generateCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    const trimmed = response.trim();
    if (!trimmed.startsWith('[')) {
      return ['b2c3d4e5-f6a7-8901-bcde-f12345678901', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'];
    }

    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      return ['b2c3d4e5-f6a7-8901-bcde-f12345678901', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'];
    }

    return parsed.filter((entry): entry is string => typeof entry === 'string');
  } catch (error) {
    console.error('Failed to get recommendations:', error);
    // Fallback recommendations
    return ['b2c3d4e5-f6a7-8901-bcde-f12345678901', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'];
  }
}

export async function answerFavorQuestion(question: string): Promise<string> {
  const systemPrompt = `You are a helpful AI assistant for Favor International, a nonprofit organization.
Key facts about Favor:
- Founded by Carol Ward
- Mission: Transformed Hearts Transform Nations
- Focus: Education, healthcare, community development, and discipleship in Africa
- Philosophy: Indigenous leadership model, not Western-managed
- US Mailing Address: Valrico, FL
- Unique approach: Multiplication and discipleship following Jesus' model

Answer questions accurately and warmly. If you don't know something specific, suggest contacting Favor directly.`;

  return generateCompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: question },
  ]);
}

// Free tier model for simple tasks
export async function generateSimpleCompletion(prompt: string): Promise<string> {
  return generateCompletion(
    [{ role: 'user', content: prompt }],
    'google/gemini-2.0-flash-exp:free'
  );
}
