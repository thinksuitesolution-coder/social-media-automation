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

// POST /crisis/analyze/:clientId
async function analyzeCrisis(req, res) {
  try {
    const { clientId } = req.params;
    const { negativeComments, volume, hours, normalRate } = req.body;

    const clientDoc = await db.collection('socialClients').doc(clientId).get();
    if (!clientDoc.exists) return res.status(404).json({ error: 'Client not found' });
    const client = clientDoc.data();

    const prompt = `Analyze this brand situation for crisis level:

Brand: ${client.name}
Niche: ${client.niche}
Recent negative comments: ${Array.isArray(negativeComments) ? negativeComments.join('\n') : negativeComments || 'None provided'}
Complaint volume: ${volume || 0} in last ${hours || 24} hours
Normal complaint rate: ${normalRate || 2} per day

Assess crisis and provide strategy.
Return ONLY JSON:
{
  "crisisLevel": "NONE",
  "crisisType": "what kind of crisis if any",
  "rootCause": "likely reason",
  "immediateActions": [
    "action to do right now"
  ],
  "postingRecommendation": "CONTINUE",
  "prStatement": "ready to post official statement if needed",
  "responseTemplates": [
    {
      "situation": "angry customer",
      "response": "template response"
    }
  ],
  "timeToResolve": "estimated time"
}`;

    const raw = await gemini(prompt);
    const analysis = parseJSON(raw);

    const severity = analysis.crisisLevel;
    const isAlert = ['MEDIUM', 'HIGH', 'CRITICAL'].includes(severity);

    if (isAlert) {
      await db.collection('socialCrisisAlerts').add({
        clientId, type: analysis.crisisType, severity,
        description: analysis.rootCause,
        aiStrategy: JSON.stringify(analysis),
        status: 'ACTIVE',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    res.json({ ...analysis, alertCreated: isAlert });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /crisis/:clientId
async function getActiveAlerts(req, res) {
  try {
    const snap = await db.collection('socialCrisisAlerts')
      .where('clientId', '==', req.params.clientId)
      .where('status', '==', 'ACTIVE')
      .orderBy('createdAt', 'desc').get();
    res.json(snapToArr(snap));
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /crisis/resolve/:alertId
async function resolveAlert(req, res) {
  try {
    await db.collection('socialCrisisAlerts').doc(req.params.alertId).update({
      status: 'RESOLVED', resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /crisis/history/:clientId
async function getCrisisHistory(req, res) {
  try {
    const snap = await db.collection('socialCrisisAlerts')
      .where('clientId', '==', req.params.clientId)
      .orderBy('createdAt', 'desc').limit(20).get();
    res.json(snapToArr(snap));
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /crisis/mention
async function addMention(req, res) {
  try {
    const { clientId, platform, content, authorName, authorHandle } = req.body;

    const clientDoc = await db.collection('socialClients').doc(clientId).get();
    const client = clientDoc.exists ? clientDoc.data() : {};

    const sentimentPrompt = `Analyze the sentiment of this brand mention:
Content: "${content}"
Brand: ${client.name || 'Brand'}

Return ONLY JSON: {"sentiment": "POSITIVE/NEGATIVE/NEUTRAL", "severity": "LOW/MEDIUM/HIGH/CRITICAL", "summary": "one line"}`;

    const raw = await gemini(sentimentPrompt);
    const sentiment = parseJSON(raw);

    const ref = await db.collection('socialBrandMentions').add({
      clientId, platform, content, authorName, authorHandle,
      ...sentiment, status: 'NEW',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ id: ref.id, ...sentiment });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = { analyzeCrisis, getActiveAlerts, resolveAlert, getCrisisHistory, addMention };
