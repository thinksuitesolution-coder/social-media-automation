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

// POST /abtest/create
async function createTest(req, res) {
  try {
    const { clientId, postId, testType, variantA, variantB } = req.body;
    if (!clientId || !testType || !variantA || !variantB) {
      return res.status(400).json({ error: 'clientId, testType, variantA, variantB required' });
    }

    const ref = await db.collection('socialABTests').add({
      clientId, postId: postId || null, testType, variantA, variantB,
      status: 'RUNNING', winnerId: null, insights: null,
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create variant records
    const batch = db.batch();
    const varARef = db.collection('socialABVariants').doc();
    const varBRef = db.collection('socialABVariants').doc();

    batch.set(varARef, { testId: ref.id, variant: 'A', content: variantA, reach: 0, likes: 0, comments: 0, engagementRate: 0 });
    batch.set(varBRef, { testId: ref.id, variant: 'B', content: variantB, reach: 0, likes: 0, comments: 0, engagementRate: 0 });
    await batch.commit();

    res.json({ id: ref.id, variantAId: varARef.id, variantBId: varBRef.id, status: 'RUNNING' });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /abtest/results/:testId
async function submitResults(req, res) {
  try {
    const { testId } = req.params;
    const { variantAMetrics, variantBMetrics } = req.body;

    const testDoc = await db.collection('socialABTests').doc(testId).get();
    if (!testDoc.exists) return res.status(404).json({ error: 'Test not found' });
    const test = testDoc.data();

    const clientDoc = await db.collection('socialClients').doc(test.clientId).get();
    const client = clientDoc.exists ? clientDoc.data() : {};

    const prompt = `Analyze these A/B test results:

Test type: ${test.testType}
Brand: ${client.name || 'Brand'}
Niche: ${client.niche || 'general'}

Variant A:
Content: ${JSON.stringify(test.variantA)}
Results: Reach=${variantAMetrics.reach}, Likes=${variantAMetrics.likes}, Comments=${variantAMetrics.comments}, ER=${variantAMetrics.engagementRate}%

Variant B:
Content: ${JSON.stringify(test.variantB)}
Results: Reach=${variantBMetrics.reach}, Likes=${variantBMetrics.likes}, Comments=${variantBMetrics.comments}, ER=${variantBMetrics.engagementRate}%

Declare winner and explain why.
Return ONLY JSON:
{
  "winner": "A",
  "confidence": "HIGH",
  "winnerReason": "why this won",
  "keyLearning": "what to apply going forward",
  "futureRecommendation": "how to use this insight",
  "applyToFuturePosts": true
}`;

    const raw = await gemini(prompt);
    const analysis = parseJSON(raw);

    await db.collection('socialABTests').doc(testId).update({
      status: 'COMPLETED', winnerId: analysis.winner,
      insights: JSON.stringify(analysis),
      endedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update variant metrics
    const variantsSnap = await db.collection('socialABVariants').where('testId', '==', testId).get();
    const batch = db.batch();
    variantsSnap.docs.forEach((doc) => {
      const metrics = doc.data().variant === 'A' ? variantAMetrics : variantBMetrics;
      batch.update(doc.ref, metrics);
    });
    await batch.commit();

    res.json({ ...analysis, testId, status: 'COMPLETED' });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /abtest/:clientId
async function getTests(req, res) {
  try {
    const snap = await db.collection('socialABTests')
      .where('clientId', '==', req.params.clientId)
      .orderBy('startedAt', 'desc').limit(20).get();
    res.json(snapToArr(snap));
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /abtest/generate-variants/:clientId
async function generateVariants(req, res) {
  try {
    const { clientId } = req.params;
    const { topic, testType } = req.body;

    const clientDoc = await db.collection('socialClients').doc(clientId).get();
    if (!clientDoc.exists) return res.status(404).json({ error: 'Client not found' });
    const client = clientDoc.data();

    const prompt = `Generate 2 different variants for A/B testing:

Brand: ${client.name}
Niche: ${client.niche}
Topic: ${topic}
Test type: ${testType || 'CAPTION'}
Tone: ${client.tone || 'professional'}

Create clearly different variants so we can test which performs better.
Return ONLY JSON:
{
  "variantA": {
    "label": "Version A - Emotional Angle",
    "caption": "caption version A",
    "hashtags": "#tag1 #tag2",
    "strategy": "why this approach"
  },
  "variantB": {
    "label": "Version B - Educational Angle",
    "caption": "caption version B",
    "hashtags": "#tag1 #tag2",
    "strategy": "why this approach"
  },
  "whatWeAreTesting": "what difference between A and B",
  "expectedWinner": "A or B",
  "reason": "why you think that variant will win"
}`;

    const raw = await gemini(prompt);
    const result = parseJSON(raw);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = { createTest, submitResults, getTests, generateVariants };
