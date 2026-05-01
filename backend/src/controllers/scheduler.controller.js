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

// POST /scheduler/optimize/:clientId
async function optimizeSchedule(req, res) {
  try {
    const { clientId } = req.params;
    const { platform, upcomingEvents } = req.body;

    const clientDoc = await db.collection('socialClients').doc(clientId).get();
    if (!clientDoc.exists) return res.status(404).json({ error: 'Client not found' });
    const client = clientDoc.data();

    // Fetch recent post performance data
    const postsSnap = await db.collection('socialPosts')
      .where('clientId', '==', clientId)
      .where('status', '==', 'POSTED')
      .orderBy('scheduledAt', 'desc').limit(30).get();

    const posts = snapToArr(postsSnap);
    const performanceData = posts.map((p) => ({
      day: new Date(p.scheduledAt || p.createdAt).toLocaleDateString('en-US', { weekday: 'long' }),
      time: p.postingTime || '18:00',
      engagement: p.engagementRate || 3,
    }));

    const prompt = `Analyze posting performance data and recommend optimal schedule:

Client: ${client.name}
Niche: ${client.niche}
Platform: ${platform || 'instagram'}
Target audience: ${client.targetAudience || 'general audience'}
Location: India

Historical performance:
${JSON.stringify(performanceData.slice(0, 10))}

Upcoming events/festivals: ${upcomingEvents || 'None specified'}

Return ONLY JSON:
{
  "bestTimes": [
    {
      "day": "Monday",
      "time": "09:00",
      "reason": "why this time works",
      "expectedEngagement": "HIGH"
    }
  ],
  "worstTimes": ["Sunday 2pm", "Tuesday 3am"],
  "weeklySchedule": {
    "Monday": "09:00",
    "Tuesday": "18:00",
    "Wednesday": "12:00",
    "Thursday": "09:00",
    "Friday": "18:00",
    "Saturday": "10:00",
    "Sunday": "11:00"
  },
  "specialNotes": "any special recommendations",
  "postingFrequency": "how many times per week recommended"
}`;

    const raw = await gemini(prompt);
    const schedule = parseJSON(raw);

    await db.collection('socialSmartSchedules').doc(`${clientId}_${platform || 'instagram'}`).set({
      clientId, platform: platform || 'instagram', ...schedule,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json(schedule);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /scheduler/:clientId
async function getSchedule(req, res) {
  try {
    const { clientId } = req.params;
    const { platform = 'instagram' } = req.query;
    const doc = await db.collection('socialSmartSchedules').doc(`${clientId}_${platform}`).get();
    if (!doc.exists) return res.status(404).json({ error: 'No schedule found. Run optimize first.' });
    res.json(convertDoc(doc));
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /scheduler/pattern/:clientId
async function recordPattern(req, res) {
  try {
    const { clientId } = req.params;
    const { platform, dayOfWeek, hourOfDay, engagementRate } = req.body;

    const patternId = `${clientId}_${platform}_${dayOfWeek}_${hourOfDay}`;
    const existing = await db.collection('socialPostingPatterns').doc(patternId).get();

    if (existing.exists) {
      const d = existing.data();
      const newAvg = (d.avgEngagement * d.postCount + engagementRate) / (d.postCount + 1);
      await db.collection('socialPostingPatterns').doc(patternId).update({
        avgEngagement: newAvg, postCount: d.postCount + 1,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      await db.collection('socialPostingPatterns').doc(patternId).set({
        clientId, platform, dayOfWeek, hourOfDay, avgEngagement: engagementRate, postCount: 1,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = { optimizeSchedule, getSchedule, recordPattern };
