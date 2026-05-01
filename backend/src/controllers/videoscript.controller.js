const { db, admin, convertDoc, snapToArr } = require('../utils/firebase');
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

// POST /video-script/generate
async function generateScript(req, res) {
  try {
    const { clientId, topic, duration, platform } = req.body;
    if (!clientId || !topic) return res.status(400).json({ error: 'clientId and topic required' });

    const clientDoc = await db.collection('socialClients').doc(clientId).get();
    if (!clientDoc.exists) return res.status(404).json({ error: 'Client not found' });
    const client = clientDoc.data();

    const dur = duration || 30;
    const plat = platform || 'instagram';

    const prompt = `Write a viral short video script for:

Brand: ${client.name}
Niche: ${client.niche}
Topic: ${topic}
Duration: ${dur} seconds
Platform: ${plat}
Tone: ${client.tone || 'engaging'}
Target audience: ${client.targetAudience || 'general audience'}

Rules:
- First 3 seconds = STRONG HOOK (stop scroll)
- Clear story arc
- On-screen text that works without sound
- Strong CTA at end

Return ONLY JSON:
{
  "hook": "first 3 seconds script",
  "hookOnScreen": "text shown on screen for hook",
  "scenes": [
    {
      "timeStamp": "0-3 sec",
      "voiceover": "what to say",
      "onScreenText": "text overlay",
      "visualDescription": "what to show",
      "transition": "cut"
    }
  ],
  "cta": "last 3 seconds CTA text",
  "musicMood": "upbeat",
  "totalDuration": ${dur},
  "viralHooks": [
    "alternative hook option 1",
    "alternative hook option 2"
  ],
  "thumbnailText": "text for thumbnail/cover"
}`;

    const raw = await gemini(prompt);
    const script = parseJSON(raw);

    const ref = await db.collection('socialVideoScripts').add({
      clientId, topic, duration: dur, platform: plat, ...script,
      status: 'DRAFT', createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ id: ref.id, ...script });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /video-script/:clientId
async function getScripts(req, res) {
  try {
    const snap = await db.collection('socialVideoScripts')
      .where('clientId', '==', req.params.clientId)
      .orderBy('createdAt', 'desc').limit(20).get();
    res.json(snapToArr(snap));
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /video-script/single/:scriptId
async function getScript(req, res) {
  try {
    const doc = await db.collection('socialVideoScripts').doc(req.params.scriptId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Script not found' });
    res.json(convertDoc(doc));
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = { generateScript, getScripts, getScript };
