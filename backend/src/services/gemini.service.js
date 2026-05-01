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

async function generateCalendar({ brandName, niche, tone, targetAudience, month, year, brandInfo }) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });

  const brandContext = brandInfo ? `
Brand services/products: ${brandInfo.services || 'Not specified'}
Business goals: ${brandInfo.goals || 'Brand awareness & engagement'}
Content preference: ${brandInfo.contentPreference || 'Mix of all types'}
Campaigns/special topics: ${brandInfo.campaigns || 'None specified'}
Website: ${brandInfo.websiteUrl || 'Not provided'}` : '';

  const contentMixRule = brandInfo?.contentPreference
    ? `Content type distribution based on client preference (${brandInfo.contentPreference}):
   - If they want mostly Carousel: 50% Carousel, 25% Reel, 15% Post, 10% Story
   - If they want mostly Static/Post: 40% Post, 30% Carousel, 20% Reel, 10% Story
   - If they want a mix: 35% Carousel, 30% Reel, 25% Post, 10% Story`
    : `Default content mix: 35% Carousel, 30% Reel, 25% Post, 10% Story`;

  const prompt = `You are an expert Instagram growth strategist who deeply understands the Instagram algorithm.
Generate a content calendar for the month of ${monthName} ${year}
for a ${niche} brand named "${brandName}".
Target audience: ${targetAudience}
Brand tone: ${tone}
${brandContext}

INSTAGRAM ALGORITHM RULES — apply these strictly:
1. Carousels: Get 3x more reach — use for educational content, tips, step-by-step guides (algorithm rewards saves & multiple swipes)
2. Reels: Best for reaching NEW non-followers — use for trends, entertaining, behind-the-scenes (highest discovery rate)
3. Static Posts: Good for announcements, quotes, product shots — gets fewer saves but builds brand identity
4. Stories: Daily touchpoints — use for polls, Q&A, quick updates (not in main calendar but add some)
5. Best posting times (IST): 09:00 (morning commute), 12:00 (lunch break), 18:00 (post-work), 20:00 (prime time)
6. Content mix per week (30 days): 30% educational (saves), 30% entertaining (shares), 20% promotional (sales), 20% behind-the-scenes (trust)
7. Do NOT schedule posts daily — 4-5 posts per week is optimal. Leave some days empty (null days are fine)

${contentMixRule}

For each posting day from ${startDate} to ${endDate}, provide:
- date (YYYY-MM-DD)
- topic (short, specific — tied to brand services if available)
- theme (one sentence describing the post idea)
- contentType (Post or Reel or Carousel or Story)
- postingTime (09:00 or 12:00 or 18:00 or 20:00)

Return ONLY a valid JSON array of 20-22 days (not all 30 — skip rest days). No explanation. No markdown. No code blocks.
Example format:
[
  {
    "date": "2024-01-01",
    "topic": "New Year Motivation",
    "theme": "Inspire audience with a powerful new year quote",
    "contentType": "Carousel",
    "postingTime": "09:00"
  }
]`;

  const raw = await generateWithGemini(prompt);
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

async function generateChatResponse({ brandName, niche, chatHistory, userMessage }) {
  const conversationText = chatHistory.map((m) => `${m.role === 'user' ? 'Client' : 'Assistant'}: ${m.content}`).join('\n');
  const turnCount = chatHistory.filter((m) => m.role === 'user').length;

  const prompt = `You are a friendly brand onboarding specialist helping set up an Instagram content strategy for "${brandName}" (niche: ${niche}).
Your job: collect 5 pieces of brand information through natural conversation. Ask ONE question at a time, keep it short and friendly.

Information to collect (in order):
1. Services/products they offer
2. Content type preference: Static Posts, Carousels, Reels, or a mix (and approximate ratio)
3. Business goal: Brand awareness / Sales / Engagement / All three
4. Top 2-3 competitors (can be skipped if they say "skip" or "none")
5. Any specific campaigns, events, or topics they want to highlight this month

Conversation so far:
${conversationText || 'No conversation yet — this is the first message.'}

Client just said: "${userMessage}"

Current turn: ${turnCount + 1} of 5

${turnCount >= 4 ? `
You now have enough information. Respond with a brief friendly summary of what you collected, then output the marker BRAND_INFO_READY followed by a JSON object on its own line:
BRAND_INFO_READY
{"services":"...","contentPreference":"...","goals":"...","competitors":"...","campaigns":"..."}
` : 'Ask the next question in the sequence. Be warm, concise, max 2 sentences.'}

Return only your conversational reply (and the JSON block if complete). Do not explain your reasoning.`;

  const raw = await generateWithGemini(prompt);

  if (raw.includes('BRAND_INFO_READY')) {
    const parts = raw.split('BRAND_INFO_READY');
    const replyText = parts[0].trim();
    const jsonStr = parts[1].trim().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try {
      const brandInfo = JSON.parse(jsonStr);
      return { reply: replyText, brandInfo, isComplete: true };
    } catch {
      return { reply: replyText, brandInfo: null, isComplete: false };
    }
  }

  return { reply: raw.trim(), brandInfo: null, isComplete: false };
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
  generateChatResponse,
};
