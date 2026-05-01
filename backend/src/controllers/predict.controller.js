const { db, admin, convertDoc } = require('../utils/firebase');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function gemini(prompt) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  const r = await model.generateContent(prompt);
  return r.response.text();
}

// POST /predict/:postId
async function predictPost(req, res) {
  try {
    const { postId } = req.params;
    const postDoc = await db.collection('socialPosts').doc(postId).get();
    if (!postDoc.exists) return res.status(404).json({ error: 'Post not found' });
    const post = postDoc.data();

    const clientDoc = await db.collection('socialClients').doc(post.clientId).get();
    const client = clientDoc.exists ? clientDoc.data() : {};

    const prompt = `Analyze this Instagram post and predict its performance.
Caption: ${post.caption}
Hashtags: ${post.hashtags || ''}
Topic: ${post.topic}
Posting Time: ${post.postingTime || '18:00'}
Brand Niche: ${client.niche || 'general'}
Target Audience: ${client.targetAudience || 'general audience'}
Past avg engagement rate: 3%

Return ONLY JSON:
{"viralScore":0-100,"captionScore":0-100,"hashtagScore":0-100,"timeScore":0-100,"suggestions":["specific improvement 1","specific improvement 2","specific improvement 3"],"predictedReach":number,"predictedLikes":number,"predictedComments":number,"verdict":"one line honest assessment","improvedCaption":"rewritten better caption"}`;

    const raw = await gemini(prompt);
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);

    // Save prediction
    await db.collection('socialPostPredictions').doc(postId).set({
      postId, ...result,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /predict/:postId
async function getPrediction(req, res) {
  try {
    const { postId } = req.params;
    const doc = await db.collection('socialPostPredictions').doc(postId).get();
    if (!doc.exists) return res.status(404).json({ error: 'No prediction found' });
    res.json(convertDoc(doc));
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /predict/improve/:postId
async function improvePost(req, res) {
  try {
    const { postId } = req.params;
    const predDoc = await db.collection('socialPostPredictions').doc(postId).get();
    if (!predDoc.exists) return res.status(404).json({ error: 'Run prediction first' });
    const pred = predDoc.data();

    if (pred.improvedCaption) {
      await db.collection('socialPosts').doc(postId).update({ caption: pred.improvedCaption });
      return res.json({ improvedCaption: pred.improvedCaption, captionScore: pred.captionScore });
    }

    const postDoc = await db.collection('socialPosts').doc(postId).get();
    const post = postDoc.data();
    const clientDoc = await db.collection('socialClients').doc(post.clientId).get();
    const client = clientDoc.exists ? clientDoc.data() : {};

    const prompt = `Rewrite this Instagram caption to make it more engaging and viral.
Original: ${post.caption}
Brand niche: ${client.niche}
Tone: ${client.tone}
Improvements needed: ${(pred.suggestions || []).join(', ')}

Return ONLY the improved caption text. No explanation.`;

    const improved = await gemini(prompt);
    await db.collection('socialPosts').doc(postId).update({ caption: improved.trim() });
    await db.collection('socialPostPredictions').doc(postId).update({ improvedCaption: improved.trim() });

    res.json({ improvedCaption: improved.trim() });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = { predictPost, getPrediction, improvePost };
