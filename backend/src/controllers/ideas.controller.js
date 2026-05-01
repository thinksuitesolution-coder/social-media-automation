const { db, admin, snapToArr, convertDoc } = require('../utils/firebase');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function gemini(prompt) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  const r = await model.generateContent(prompt);
  return r.response.text();
}

// POST /ideas/generate
async function generateIdeas(req, res) {
  try {
    const { clientId, topicFocus } = req.body;
    const { userId } = req.user;

    const clientDoc = await db.collection('socialClients').doc(clientId).get();
    const client = clientDoc.exists ? clientDoc.data() : {};

    // Get already used topics
    const bankSnap = await db.collection('socialIdeaBank')
      .where('clientId', '==', clientId)
      .where('status', '==', 'USED')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    const usedTopics = snapToArr(bankSnap).map((i) => i.title).join(', ');

    const prompt = `Generate 20 unique content ideas for:
Brand: ${client.name || 'Brand'}
Niche: ${client.niche || 'general'}
Target audience: ${client.targetAudience || 'general audience'}
Tone: ${client.tone || 'professional'}
Platforms: Instagram, Facebook
${topicFocus ? `Topic focus: ${topicFocus}` : ''}
${usedTopics ? `Avoid these already used topics: ${usedTopics}` : ''}

Return ONLY a JSON array:
[{"title":"catchy idea title","description":"what the post will be about","topic":"main topic","contentType":"Post/Reel/Carousel/Story","platform":["instagram","facebook"],"viralPotential":"HIGH/MEDIUM/LOW","effort":"LOW/MEDIUM/HIGH","pillar":"Educational/Entertaining/Promotional/Inspirational/Behind-the-Scenes"}]`;

    const raw = await gemini(prompt);
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const ideas = JSON.parse(cleaned);

    res.json({ ideas });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /ideas/:clientId
async function getIdeas(req, res) {
  try {
    const { clientId } = req.params;
    const { userId } = req.user;
    const snap = await db.collection('socialIdeaBank')
      .where('clientId', '==', clientId)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    res.json({ ideas: snapToArr(snap) });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /ideas
async function saveIdea(req, res) {
  try {
    const { userId } = req.user;
    const { clientId, title, description, topic, contentType, platform, viralPotential, effort, pillar } = req.body;
    const docRef = await db.collection('socialIdeaBank').add({
      clientId, userId, title, description,
      topic: topic || '', contentType: contentType || 'Post',
      platform: platform || ['instagram'],
      viralPotential: viralPotential || 'MEDIUM',
      effort: effort || 'MEDIUM',
      pillar: pillar || 'General',
      tags: [], aiScore: 0,
      status: 'SAVED',
      usedAt: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ id: docRef.id, success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// PUT /ideas/:id
async function updateIdea(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updates = { status };
    if (status === 'USED') updates.usedAt = admin.firestore.FieldValue.serverTimestamp();
    await db.collection('socialIdeaBank').doc(id).update(updates);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = { generateIdeas, getIdeas, saveIdea, updateIdea };
