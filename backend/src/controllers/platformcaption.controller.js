const { db, admin } = require('../utils/firebase');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function gemini(prompt) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  const r = await model.generateContent(prompt);
  return r.response.text();
}

function parseJSON(raw) {
  return JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
}

// POST /platform-caption/generate
async function generateMultiPlatform(req, res) {
  try {
    const { clientId, topic, coreMessage, tone } = req.body;
    if (!clientId || !topic) return res.status(400).json({ error: 'clientId and topic required' });

    const clientDoc = await db.collection('socialClients').doc(clientId).get();
    if (!clientDoc.exists) return res.status(404).json({ error: 'Client not found' });
    const client = clientDoc.data();

    let voicePrompt = '';
    const voiceDoc = await db.collection('socialBrandVoice').doc(clientId).get();
    if (voiceDoc.exists) voicePrompt = voiceDoc.data().voicePrompt || '';

    const prompt = `Write platform-optimized captions for:

Brand: ${client.name}
Topic: ${topic}
Core message: ${coreMessage || topic}
Tone: ${tone || client.tone || 'professional'}
Brand voice: ${voicePrompt || 'professional and engaging'}

Create versions for all platforms.
Return ONLY JSON:
{
  "instagram": {
    "caption": "full instagram caption with emojis and line breaks",
    "hashtags": "#hashtag1 #hashtag2 #hashtag3",
    "characterCount": 280
  },
  "facebook": {
    "caption": "facebook optimized conversational version with question",
    "characterCount": 350
  },
  "twitter": {
    "caption": "280 char punchy version",
    "characterCount": 240
  },
  "twitterThread": {
    "tweets": ["tweet1 with hook", "tweet2 with detail", "tweet3 with CTA"]
  },
  "linkedin": {
    "caption": "professional linkedin version with value and personal story",
    "characterCount": 800
  }
}`;

    const raw = await gemini(prompt);
    const result = parseJSON(raw);

    await db.collection('socialPlatformCaptions').add({
      clientId, topic, coreMessage, ...result,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /platform-caption/adapt
async function adaptCaption(req, res) {
  try {
    const { clientId, originalCaption, targetPlatforms } = req.body;
    if (!clientId || !originalCaption) return res.status(400).json({ error: 'clientId and originalCaption required' });

    const clientDoc = await db.collection('socialClients').doc(clientId).get();
    const client = clientDoc.exists ? clientDoc.data() : {};

    const platforms = targetPlatforms || ['instagram', 'facebook', 'twitter', 'linkedin'];

    const prompt = `Adapt this caption for different social media platforms:

Original: ${originalCaption}
Brand: ${client.name || 'Brand'}
Niche: ${client.niche || 'general'}

Platforms needed: ${platforms.join(', ')}

Return ONLY JSON with adapted versions for each requested platform:
{
  "instagram": "adapted instagram version",
  "facebook": "adapted facebook version",
  "twitter": "max 280 chars punchy version",
  "linkedin": "professional linkedin version"
}`;

    const raw = await gemini(prompt);
    const result = parseJSON(raw);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = { generateMultiPlatform, adaptCaption };
