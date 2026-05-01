const { db, admin, convertDoc } = require('../utils/firebase');
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

// POST /quality/check/:postId
async function checkQuality(req, res) {
  try {
    const { postId } = req.params;
    const postDoc = await db.collection('socialPosts').doc(postId).get();
    if (!postDoc.exists) return res.status(404).json({ error: 'Post not found' });
    const post = postDoc.data();

    const clientDoc = await db.collection('socialClients').doc(post.clientId).get();
    const client = clientDoc.exists ? clientDoc.data() : {};

    const prompt = `Quality check this social media post:

Brand: ${client.name || 'Unknown'}
Niche: ${client.niche || 'general'}
Platform: ${post.platform || 'instagram'}
Caption: ${post.caption || ''}
Hashtags: ${post.hashtags || ''}

Check everything:
Return ONLY JSON:
{
  "grammarScore": 85,
  "clarityScore": 80,
  "brandAlignScore": 90,
  "spamScore": 10,
  "sensitivityScore": 95,
  "overallScore": 85,
  "passed": true,
  "criticalIssues": [],
  "minorIssues": ["suggestion1"],
  "suggestions": ["improvement1"],
  "spamWords": [],
  "sensitiveWords": [],
  "fixedCaption": "auto corrected version if needed"
}`;

    const raw = await gemini(prompt);
    const result = parseJSON(raw);

    // Auto action based on score
    let autoStatus = 'PENDING_REVIEW';
    if (result.overallScore >= 80) autoStatus = 'QUALITY_APPROVED';
    else if (result.overallScore < 60) autoStatus = 'QUALITY_REJECTED';

    await db.collection('socialQualityChecks').doc(postId).set({
      postId, ...result, autoStatus,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update post status if auto-approved
    if (autoStatus === 'QUALITY_APPROVED') {
      await db.collection('socialPosts').doc(postId).update({ qualityScore: result.overallScore });
    }

    res.json({ ...result, autoStatus });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /quality/:postId
async function getQualityCheck(req, res) {
  try {
    const doc = await db.collection('socialQualityChecks').doc(req.params.postId).get();
    if (!doc.exists) return res.status(404).json({ error: 'No quality check found' });
    res.json(convertDoc(doc));
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /quality/check-text
async function checkText(req, res) {
  try {
    const { caption, hashtags, platform, clientId } = req.body;
    let client = {};
    if (clientId) {
      const clientDoc = await db.collection('socialClients').doc(clientId).get();
      if (clientDoc.exists) client = clientDoc.data();
    }

    const prompt = `Quality check this social media post:

Brand: ${client.name || 'Unknown'}
Niche: ${client.niche || 'general'}
Platform: ${platform || 'instagram'}
Caption: ${caption || ''}
Hashtags: ${hashtags || ''}

Return ONLY JSON:
{
  "grammarScore": 85,
  "clarityScore": 80,
  "brandAlignScore": 90,
  "spamScore": 10,
  "sensitivityScore": 95,
  "overallScore": 85,
  "passed": true,
  "criticalIssues": [],
  "minorIssues": [],
  "suggestions": [],
  "spamWords": [],
  "sensitiveWords": [],
  "fixedCaption": "corrected caption"
}`;

    const raw = await gemini(prompt);
    const result = parseJSON(raw);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = { checkQuality, getQualityCheck, checkText };
