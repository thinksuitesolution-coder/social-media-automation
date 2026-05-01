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

// POST /comments/generate
async function generateComments(req, res) {
  try {
    const { clientId, postContent, accountType, goal } = req.body;
    if (!clientId || !postContent) return res.status(400).json({ error: 'clientId and postContent required' });

    const clientDoc = await db.collection('socialClients').doc(clientId).get();
    if (!clientDoc.exists) return res.status(404).json({ error: 'Client not found' });
    const client = clientDoc.data();

    const prompt = `Generate strategic engagement comments for a ${client.niche} brand named "${client.name}".

Target post content: ${postContent}
Target account type: ${accountType || 'COMPETITOR'}
Brand tone: ${client.tone || 'professional'}
Goal: ${goal || 'brand awareness'}

Write 5 comment options.
Return ONLY JSON:
{
  "comments": [
    {
      "text": "comment text",
      "strategy": "why this comment works",
      "riskLevel": "LOW",
      "expectedResponse": "what might happen"
    }
  ],
  "bestComment": 0,
  "avoid": "what not to say"
}`;

    const raw = await gemini(prompt);
    const result = parseJSON(raw);

    await db.collection('socialCommentStrategies').add({
      clientId, postContent, accountType, goal, ...result,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /comments/log
async function logComment(req, res) {
  try {
    const { clientId, platform, targetPost, comment } = req.body;
    const ref = await db.collection('socialCommentLogs').add({
      clientId, platform, targetPost, comment, likes: 0,
      postedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ id: ref.id, success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /comments/:clientId
async function getCommentStrategies(req, res) {
  try {
    const snap = await db.collection('socialCommentStrategies')
      .where('clientId', '==', req.params.clientId)
      .orderBy('createdAt', 'desc').limit(20).get();
    res.json(snapToArr(snap));
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /comments/logs/:clientId
async function getCommentLogs(req, res) {
  try {
    const snap = await db.collection('socialCommentLogs')
      .where('clientId', '==', req.params.clientId)
      .orderBy('postedAt', 'desc').limit(50).get();
    res.json(snapToArr(snap));
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = { generateComments, logComment, getCommentStrategies, getCommentLogs };
