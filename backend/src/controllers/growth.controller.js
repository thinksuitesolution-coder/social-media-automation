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

// POST /growth/advise/:clientId
async function generateAdvice(req, res) {
  try {
    const { clientId } = req.params;
    const { followers, reach, engagementRate, topContent, weakArea, goals } = req.body;

    const clientDoc = await db.collection('socialClients').doc(clientId).get();
    if (!clientDoc.exists) return res.status(404).json({ error: 'Client not found' });
    const client = clientDoc.data();

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const monthName = now.toLocaleString('default', { month: 'long' });

    const prompt = `You are an expert social media growth strategist.
Analyze this brand and give a complete growth plan:

Brand: ${client.name}
Niche: ${client.niche}
Current followers: ${followers || 'Unknown'}
Monthly reach: ${reach || 'Unknown'}
Avg engagement rate: ${engagementRate || 3}%
Top content type: ${topContent || 'Mixed'}
Weakest area: ${weakArea || 'Consistency'}
Competitors avg ER: 4%
Month: ${monthName} ${year}
Goals: ${goals || 'Grow followers and engagement'}

Create actionable 30-day growth plan.
Return ONLY JSON:
{
  "currentScore": 65,
  "benchmarkVsIndustry": "below average",
  "biggestOpportunity": "one key opportunity",
  "biggestThreat": "one key threat",
  "monthlyGoal": {
    "followers": "realistic target",
    "reach": "realistic target",
    "engagement": "realistic target"
  },
  "weeklyPlan": [
    {
      "week": 1,
      "focus": "main focus area",
      "actions": ["action1", "action2", "action3"],
      "contentStrategy": "what to post this week"
    }
  ],
  "contentMix": {
    "reels": "40%",
    "carousels": "30%",
    "posts": "20%",
    "stories": "10%"
  },
  "quickWins": ["thing that will show results fast"],
  "longTermPlays": ["thing that builds over time"],
  "avoid": ["what not to do this month"]
}`;

    const raw = await gemini(prompt);
    const advice = parseJSON(raw);

    const ref = await db.collection('socialGrowthAdvice').add({
      clientId, month, year, ...advice,
      currentState: { followers, reach, engagementRate, topContent, weakArea, goals },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ id: ref.id, month, year, ...advice });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /growth/:clientId
async function getAdvice(req, res) {
  try {
    const snap = await db.collection('socialGrowthAdvice')
      .where('clientId', '==', req.params.clientId)
      .orderBy('createdAt', 'desc').limit(6).get();
    res.json(snapToArr(snap));
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /growth/latest/:clientId
async function getLatestAdvice(req, res) {
  try {
    const snap = await db.collection('socialGrowthAdvice')
      .where('clientId', '==', req.params.clientId)
      .orderBy('createdAt', 'desc').limit(1).get();
    if (snap.empty) return res.status(404).json({ error: 'No growth advice yet' });
    res.json(snapToArr(snap)[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = { generateAdvice, getAdvice, getLatestAdvice };
