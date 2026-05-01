const { db, admin, snapToArr, convertDoc } = require('../utils/firebase');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function gemini(prompt) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  const r = await model.generateContent(prompt);
  return r.response.text();
}

// POST /hashtags/generate
async function generateHashtags(req, res) {
  try {
    const { clientId, topic, niche } = req.body;
    const { userId } = req.user;

    const clientDoc = await db.collection('socialClients').doc(clientId).get();
    const client = clientDoc.exists ? clientDoc.data() : {};
    const brandNiche = niche || client.niche || 'general';

    const prompt = `Generate 28 Instagram hashtags for:
Brand niche: ${brandNiche}
Topic: ${topic}
Target audience: ${client.targetAudience || 'general audience'}

Rules:
- 8 high competition (10M+ posts)
- 12 medium competition (1M-10M posts)
- 8 low/niche competition (under 1M posts)
- No banned hashtags
- All lowercase, no spaces
- Maximum relevance to topic

Return ONLY JSON:
{"hashtags":{"high":["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8"],"medium":["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10","tag11","tag12"],"low":["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8"]},"combined":"space separated all 28 tags with # prefix","banned":[]}`;

    const raw = await gemini(prompt);
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /hashtags/groups/:clientId
async function getGroups(req, res) {
  try {
    const { clientId } = req.params;
    const { userId } = req.user;
    const snap = await db.collection('socialHashtagGroups')
      .where('clientId', '==', clientId)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    res.json({ groups: snapToArr(snap) });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /hashtags/groups
async function saveGroup(req, res) {
  try {
    const { userId } = req.user;
    const { clientId, name, hashtags } = req.body;
    const docRef = await db.collection('socialHashtagGroups').add({
      clientId, userId, name,
      hashtags: hashtags || [],
      useCount: 0, avgReach: 0, lastUsed: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ id: docRef.id, success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// DELETE /hashtags/groups/:id
async function deleteGroup(req, res) {
  try {
    const { id } = req.params;
    await db.collection('socialHashtagGroups').doc(id).delete();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = { generateHashtags, getGroups, saveGroup, deleteGroup };
