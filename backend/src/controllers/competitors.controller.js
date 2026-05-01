const { db, admin, snapToArr, convertDoc } = require('../utils/firebase');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function gemini(prompt) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  const r = await model.generateContent(prompt);
  return r.response.text();
}

// GET /competitors/:clientId
async function getCompetitors(req, res) {
  try {
    const { clientId } = req.params;
    const { userId } = req.user;
    const snap = await db.collection('socialCompetitors')
      .where('clientId', '==', clientId)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    const competitors = snapToArr(snap);

    // Attach latest insights
    const withInsights = await Promise.all(competitors.map(async (comp) => {
      const insSnap = await db.collection('socialCompetitorInsights')
        .where('competitorId', '==', comp.id)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
      const insights = snapToArr(insSnap);
      return { ...comp, latestInsights: insights[0]?.insights || null };
    }));

    res.json({ competitors: withInsights });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /competitors
async function addCompetitor(req, res) {
  try {
    const { userId } = req.user;
    const { clientId, name, platform, handle, followerCount, samplePosts } = req.body;
    const docRef = await db.collection('socialCompetitors').add({
      clientId, userId, name,
      platform: platform || 'INSTAGRAM',
      handle, followerCount: followerCount || 0,
      samplePosts: samplePosts || '',
      avgEngagement: 0, postFrequency: null,
      lastFetched: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ id: docRef.id, success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /competitors/analyze/:id
async function analyzeCompetitor(req, res) {
  try {
    const { id } = req.params;
    const compDoc = await db.collection('socialCompetitors').doc(id).get();
    if (!compDoc.exists) return res.status(404).json({ error: 'Competitor not found' });
    const comp = compDoc.data();

    const clientDoc = await db.collection('socialClients').doc(comp.clientId).get();
    const client = clientDoc.exists ? clientDoc.data() : {};

    const prompt = `Analyze these competitor social media posts and provide strategic insights.

Competitor: ${comp.name} (@${comp.handle}) on ${comp.platform}
Followers: ${comp.followerCount.toLocaleString()}
Niche: ${client.niche || 'general'}
Our brand: ${client.name || 'our brand'}

Their known topics/content: ${comp.samplePosts || 'fitness, lifestyle, motivation, product promotion'}

Return ONLY JSON:
{"topTopics":["topic1","topic2","topic3"],"postingFrequency":"X posts per week","bestContentType":"Post/Reel/Carousel","contentGaps":["gap1","gap2"],"opportunities":["opp1","opp2"],"threats":["threat1"],"recommendations":["specific action 1","specific action 2","specific action 3"],"contentIdeasToSteal":[{"topic":"","ourAngle":"","expectedPerformance":"HIGH/MEDIUM"}]}`;

    const raw = await gemini(prompt);
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const insights = JSON.parse(cleaned);

    // Save insights
    await db.collection('socialCompetitorInsights').add({
      competitorId: id,
      clientId: comp.clientId,
      insights,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection('socialCompetitors').doc(id).update({
      lastFetched: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json(insights);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// DELETE /competitors/:id
async function deleteCompetitor(req, res) {
  try {
    const { id } = req.params;
    await db.collection('socialCompetitors').doc(id).delete();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = { getCompetitors, addCompetitor, analyzeCompetitor, deleteCompetitor };
