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

// POST /voice/train/:clientId
async function trainVoice(req, res) {
  try {
    const { clientId } = req.params;
    const { sampleCaptions } = req.body;
    if (!sampleCaptions || !Array.isArray(sampleCaptions) || sampleCaptions.length < 3) {
      return res.status(400).json({ error: 'Provide at least 3 sample captions' });
    }

    const clientDoc = await db.collection('socialClients').doc(clientId).get();
    if (!clientDoc.exists) return res.status(404).json({ error: 'Client not found' });

    await db.collection('socialBrandVoice').doc(clientId).set({
      clientId, trainingStatus: 'TRAINING', samplePosts: sampleCaptions,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    const prompt = `Analyze these Instagram captions from a brand and extract their exact writing style:

Captions:
${sampleCaptions.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Study everything:
- Sentence structure and length
- Emoji frequency and placement
- Punctuation habits
- Power words they use often
- Words/phrases they avoid
- How they start captions
- How they end with CTA
- Overall personality

Return ONLY JSON:
{
  "toneWords": ["word1", "word2", "word3"],
  "avoidWords": ["word1", "word2"],
  "sentenceStyle": "short/long/mixed",
  "emojiUsage": "HEAVY/MODERATE/NONE",
  "emojiPlacement": "inline/end/start",
  "punctuationStyle": "description",
  "avgCaptionLength": 120,
  "ctaStyle": "how they write CTAs",
  "openingStyle": "how they start posts",
  "personalityTraits": ["trait1", "trait2"],
  "uniquePhrases": ["phrase1", "phrase2"],
  "voicePrompt": "complete prompt to replicate this exact voice in future"
}`;

    const raw = await gemini(prompt);
    const analysis = parseJSON(raw);

    const accuracy = Math.min(100, 60 + sampleCaptions.length * 2);
    await db.collection('socialBrandVoice').doc(clientId).set({
      clientId, ...analysis, samplePosts: sampleCaptions,
      trainingStatus: 'TRAINED', accuracy,
      lastTrainedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json({ ...analysis, accuracy, trainingStatus: 'TRAINED' });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /voice/:clientId
async function getVoice(req, res) {
  try {
    const { clientId } = req.params;
    const doc = await db.collection('socialBrandVoice').doc(clientId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Not trained yet' });
    res.json(convertDoc(doc));
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /voice/test/:clientId
async function testVoice(req, res) {
  try {
    const { clientId } = req.params;
    const { topic, theme, product } = req.body;
    const voiceDoc = await db.collection('socialBrandVoice').doc(clientId).get();
    if (!voiceDoc.exists) return res.status(404).json({ error: 'Train voice first' });
    const voice = voiceDoc.data();

    const prompt = `${voice.voicePrompt}

Now write a caption for:
Topic: ${topic}
Theme: ${theme || ''}
Product/Service: ${product || ''}

Match the brand voice exactly. Return only the caption.`;

    const caption = await gemini(prompt);
    res.json({ caption: caption.trim(), voicePrompt: voice.voicePrompt });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// PUT /voice/retrain/:clientId
async function retrainVoice(req, res) {
  try {
    const { clientId } = req.params;
    const { sampleCaptions } = req.body;
    req.params.clientId = clientId;
    req.body.sampleCaptions = sampleCaptions;
    return trainVoice(req, res);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = { trainVoice, getVoice, testVoice, retrainVoice };
