const { db, admin, snapToArr } = require('../utils/firebase');
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

async function repurposeContent({ clientId, sourceType, content, sourceUrl }) {
  const clientDoc = await db.collection('socialClients').doc(clientId).get();
  const client = clientDoc.exists ? clientDoc.data() : {};

  const prompt = `Repurpose this content for social media:

Source type: ${sourceType}
Content: ${content}
Brand: ${client.name || 'Brand'}
Niche: ${client.niche || 'general'}
Tone: ${client.tone || 'professional'}
Target audience: ${client.targetAudience || 'general audience'}

Generate all these outputs:
Return ONLY JSON:
{
  "instagramPost": {
    "caption": "",
    "imagePrompt": ""
  },
  "instagramCarousel": {
    "slides": [
      {"title": "", "content": "", "imagePrompt": ""}
    ]
  },
  "twitterThread": {
    "tweets": ["tweet1", "tweet2", "tweet3"]
  },
  "linkedinPost": {
    "caption": ""
  },
  "facebookPost": {
    "caption": ""
  },
  "instagramStory": {
    "slides": [
      {"text": "", "type": "TEXT"}
    ]
  },
  "reelScript": {
    "hook": "",
    "body": "",
    "cta": "",
    "duration": "30 seconds"
  }
}`;

  const raw = await gemini(prompt);
  return parseJSON(raw);
}

// POST /repurpose/text
async function repurposeText(req, res) {
  try {
    const { clientId, content } = req.body;
    if (!clientId || !content) return res.status(400).json({ error: 'clientId and content required' });

    const outputs = await repurposeContent({ clientId, sourceType: 'POST', content });

    const ref = await db.collection('socialRepurposedContent').add({
      clientId, sourceType: 'POST', sourceContent: content,
      outputs, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ id: ref.id, ...outputs });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /repurpose/blog
async function repurposeBlog(req, res) {
  try {
    const { clientId, content, sourceUrl } = req.body;
    if (!clientId || !content) return res.status(400).json({ error: 'clientId and content required' });

    const outputs = await repurposeContent({ clientId, sourceType: 'BLOG', content, sourceUrl });

    const ref = await db.collection('socialRepurposedContent').add({
      clientId, sourceType: 'BLOG', sourceContent: content, sourceUrl: sourceUrl || null,
      outputs, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ id: ref.id, ...outputs });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /repurpose/old-post
async function refreshOldPost(req, res) {
  try {
    const { clientId, originalCaption, originalImagePrompt } = req.body;
    if (!clientId || !originalCaption) return res.status(400).json({ error: 'clientId and originalCaption required' });

    const clientDoc = await db.collection('socialClients').doc(clientId).get();
    const client = clientDoc.exists ? clientDoc.data() : {};

    const prompt = `This old post went viral. Refresh it with a new angle while keeping the same core message:

Brand: ${client.name || 'Brand'}
Niche: ${client.niche || 'general'}
Original caption: ${originalCaption}
Original image description: ${originalImagePrompt || ''}

Return ONLY JSON:
{
  "updatedCaption": "fresh updated caption with new angle",
  "newImagePrompt": "fresh visual concept different from original",
  "twitterVersion": "punchy 280 char version",
  "linkedinVersion": "professional version",
  "storySlides": ["slide1", "slide2", "slide3"],
  "whyItWentViral": "analysis of why original worked",
  "newAngle": "what angle we used in refresh"
}`;

    const raw = await gemini(prompt);
    const result = parseJSON(raw);

    const ref = await db.collection('socialRepurposedContent').add({
      clientId, sourceType: 'OLD_POST', sourceContent: originalCaption,
      outputs: result, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ id: ref.id, ...result });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /repurpose/:clientId
async function getRepurposed(req, res) {
  try {
    const snap = await db.collection('socialRepurposedContent')
      .where('clientId', '==', req.params.clientId)
      .orderBy('createdAt', 'desc').limit(20).get();
    res.json(snapToArr(snap));
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = { repurposeText, repurposeBlog, refreshOldPost, getRepurposed };
