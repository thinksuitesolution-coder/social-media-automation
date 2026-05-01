const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateWithGemini(prompt, retries = 3) {
  const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
  for (let i = 0; i < retries; i++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

async function generateCalendar({ brandName, niche, tone, targetAudience, month, year }) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });

  const prompt = `You are an expert social media strategist.
Generate a content calendar for the month of ${monthName} ${year}
for a ${niche} brand named "${brandName}".
Target audience: ${targetAudience}
Brand tone: ${tone}

For each day from ${startDate} to ${endDate}, provide:
- date (YYYY-MM-DD)
- topic (short, specific)
- theme (one sentence describing the post idea)
- contentType (Post or Reel or Carousel or Story)
- postingTime (09:00 or 12:00 or 18:00)

Return ONLY a valid JSON array. No explanation. No markdown. No code blocks.
Example format:
[
  {
    "date": "2024-01-01",
    "topic": "New Year Motivation",
    "theme": "Inspire audience with a powerful new year quote",
    "contentType": "Post",
    "postingTime": "09:00"
  }
]`;

  const raw = await generateWithGemini(prompt);
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

async function generateCaption({ brandName, niche, tone, targetAudience, topic, theme, platform = 'instagram' }) {
  const platformRules = {
    instagram: 'Maximum 150 words. Include 1 strong call to action at the end. Use line breaks for readability. Casual tone with hashtags omitted.',
    linkedin: 'Professional tone. Maximum 300 words. Include 1 business-focused call to action. Use paragraphs.',
    twitter: 'Maximum 240 characters total. Punchy and direct. End with a call to action.',
    facebook: 'Conversational. Maximum 200 words. Include a question to encourage engagement.',
  };

  const prompt = `Write an engaging ${platform} caption for a ${niche} brand named "${brandName}".
Topic: ${topic}
Theme: ${theme}
Tone: ${tone}
Target audience: ${targetAudience}

Rules:
- ${platformRules[platform] || platformRules.instagram}
- Do NOT include hashtags
- Return only the caption text, nothing else`;

  return generateWithGemini(prompt);
}

async function generateHashtags({ niche, topic }) {
  const prompt = `Generate exactly 28 Instagram hashtags for this post.
Brand niche: ${niche}
Post topic: ${topic}

Rules:
- Mix: 8 high competition + 12 medium + 8 niche/low competition
- All lowercase
- No spaces within hashtags
- Return as single line, hashtags separated by spaces
- Return ONLY hashtags, nothing else`;

  const result = await generateWithGemini(prompt);
  return result.trim();
}

async function generateImagePrompt({ brandName, niche, topic, theme, tone }) {
  const prompt = `Generate a detailed AI image generation prompt for an Instagram post.
Brand: ${brandName}
Niche: ${niche}
Topic: ${topic}
Theme: ${theme}
Tone: ${tone}

Rules:
- Professional, eye-catching, Instagram-worthy
- Square composition (1:1 ratio)
- Describe: subject, style, colors, mood, lighting
- Max 80 words
- Return only the image prompt, nothing else`;

  return generateWithGemini(prompt);
}

async function generateImagePromptWithFeedback({ brandName, niche, topic, theme, tone, feedback, previousPrompt, approvedStyles = [] }) {
  const stylesContext = approvedStyles.length > 0
    ? `\nClient's previously APPROVED image styles (follow similar aesthetic):\n${approvedStyles.slice(-5).map((s, i) => `${i + 1}. ${s.imagePrompt}`).join('\n')}`
    : '';

  const prompt = `Generate a new AI image generation prompt for an Instagram post.
Brand: ${brandName}
Niche: ${niche}
Topic: ${topic}
Theme: ${theme}
Tone: ${tone}

Previous image prompt that was REJECTED: ${previousPrompt}
Client feedback on why it was rejected: "${feedback}"
${stylesContext}

Rules:
- Directly incorporate the client's feedback
- Make it clearly different from the rejected version
- Professional, eye-catching, Instagram-worthy
- Square composition (1:1 ratio)
- Describe: subject, style, colors, mood, lighting
- Max 80 words
- Return only the image prompt, nothing else`;

  return generateWithGemini(prompt);
}

async function generateCaptionWithFeedback({ brandName, niche, tone, targetAudience, topic, feedback, previousCaption }) {
  const prompt = `Write a new Instagram caption for a ${niche} brand named "${brandName}".
Topic: ${topic}
Tone: ${tone}
Target audience: ${targetAudience}

Previous caption that was REJECTED: ${previousCaption}
Client feedback: "${feedback}"

Rules:
- Directly incorporate the client's feedback to improve the caption
- Maximum 150 words
- Include 1 strong call to action at the end
- Use line breaks for readability
- Do NOT include hashtags
- Return only the caption text, nothing else`;

  return generateWithGemini(prompt);
}

async function adaptCaptionForPlatform({ caption, platform, niche, brandName }) {
  const prompt = `Adapt this social media caption for ${platform}.

Original caption: ${caption}
Brand niche: ${niche}
Brand: ${brandName}

Platform-specific rules:
- instagram: Casual, max 150 words, no hashtags included
- linkedin: Professional tone, max 300 words, business-focused CTA
- twitter: Max 240 characters, punchy and direct
- facebook: Conversational, max 200 words, include engagement question

Return only the adapted caption for ${platform}, nothing else.`;

  return generateWithGemini(prompt);
}

async function generateViralScore({ topic, caption, niche }) {
  const prompt = `Analyze this social media post and give it a viral potential score.
Niche: ${niche}
Topic: ${topic}
Caption: ${caption}

Return ONLY a JSON object like:
{
  "score": 78,
  "reasoning": "Strong hook, trending topic, clear CTA",
  "improvements": ["Add urgency", "Use more emotional language"]
}`;

  const raw = await generateWithGemini(prompt);
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

module.exports = {
  generateCalendar,
  generateCaption,
  generateHashtags,
  generateImagePrompt,
  generateImagePromptWithFeedback,
  generateCaptionWithFeedback,
  adaptCaptionForPlatform,
  generateViralScore,
};
