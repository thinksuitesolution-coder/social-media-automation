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

const FESTIVALS_2026 = [
  { name: 'New Year', date: '2026-01-01', type: 'CULTURAL', importance: 'HIGH' },
  { name: 'Lohri', date: '2026-01-13', type: 'CULTURAL', importance: 'MEDIUM' },
  { name: 'Makar Sankranti', date: '2026-01-14', type: 'RELIGIOUS', importance: 'HIGH' },
  { name: 'Republic Day', date: '2026-01-26', type: 'NATIONAL', importance: 'HIGH' },
  { name: 'Valentine\'s Day', date: '2026-02-14', type: 'CULTURAL', importance: 'HIGH' },
  { name: 'World Cancer Day', date: '2026-02-04', type: 'AWARENESS', importance: 'MEDIUM' },
  { name: 'Holi', date: '2026-03-02', type: 'RELIGIOUS', importance: 'HIGH' },
  { name: 'International Women\'s Day', date: '2026-03-08', type: 'AWARENESS', importance: 'HIGH' },
  { name: 'World Water Day', date: '2026-03-22', type: 'AWARENESS', importance: 'LOW' },
  { name: 'Ram Navami', date: '2026-03-29', type: 'RELIGIOUS', importance: 'MEDIUM' },
  { name: 'Ambedkar Jayanti', date: '2026-04-14', type: 'NATIONAL', importance: 'HIGH' },
  { name: 'Earth Day', date: '2026-04-22', type: 'AWARENESS', importance: 'MEDIUM' },
  { name: 'Mother\'s Day', date: '2026-05-10', type: 'CULTURAL', importance: 'HIGH' },
  { name: 'Eid ul Fitr', date: '2026-03-20', type: 'RELIGIOUS', importance: 'HIGH' },
  { name: 'Father\'s Day', date: '2026-06-21', type: 'CULTURAL', importance: 'HIGH' },
  { name: 'Independence Day', date: '2026-08-15', type: 'NATIONAL', importance: 'HIGH' },
  { name: 'Raksha Bandhan', date: '2026-08-23', type: 'RELIGIOUS', importance: 'HIGH' },
  { name: 'Ganesh Chaturthi', date: '2026-08-26', type: 'RELIGIOUS', importance: 'HIGH' },
  { name: 'Navratri', date: '2026-10-08', type: 'RELIGIOUS', importance: 'HIGH' },
  { name: 'Dussehra', date: '2026-10-18', type: 'RELIGIOUS', importance: 'HIGH' },
  { name: 'Diwali', date: '2026-11-01', type: 'RELIGIOUS', importance: 'HIGH' },
  { name: 'Christmas', date: '2026-12-25', type: 'CULTURAL', importance: 'HIGH' },
  { name: 'New Year Eve', date: '2026-12-31', type: 'CULTURAL', importance: 'HIGH' },
];

// GET /festival/upcoming
async function getUpcomingFestivals(req, res) {
  try {
    const { days = 30 } = req.query;
    const now = new Date();
    const future = new Date(now.getTime() + parseInt(days) * 24 * 60 * 60 * 1000);
    const upcoming = FESTIVALS_2026.filter((f) => {
      const d = new Date(f.date);
      return d >= now && d <= future;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));
    res.json(upcoming);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /festival/generate
async function generateFestivalContent(req, res) {
  try {
    const { clientId, festivalName, festivalDate } = req.body;
    if (!clientId || !festivalName) return res.status(400).json({ error: 'clientId and festivalName required' });

    const clientDoc = await db.collection('socialClients').doc(clientId).get();
    if (!clientDoc.exists) return res.status(404).json({ error: 'Client not found' });
    const client = clientDoc.data();

    const prompt = `Create festival content for:

Festival: ${festivalName}
Brand: ${client.name}
Niche: ${client.niche}
Tone: ${client.tone || 'warm and celebratory'}
Target audience: ${client.targetAudience || 'general audience'}
Brand religion sensitivity: moderate

Create a 3-post festival series:
Return ONLY JSON:
{
  "series": [
    {
      "day": "3 days before",
      "type": "TEASER",
      "caption": "",
      "imagePrompt": "",
      "contentType": "Post"
    },
    {
      "day": "1 day before",
      "type": "BUILDUP",
      "caption": "",
      "imagePrompt": "",
      "contentType": "Story"
    },
    {
      "day": "festival day",
      "type": "MAIN",
      "caption": "",
      "imagePrompt": "",
      "contentType": "Post"
    }
  ],
  "safeForBrand": true,
  "sensitivityNote": "any caution if needed"
}`;

    const raw = await gemini(prompt);
    const result = parseJSON(raw);

    const ref = await db.collection('socialFestivalContent').add({
      clientId, festivalName, festivalDate: festivalDate || null, ...result,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ id: ref.id, ...result });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /festival/client/:clientId
async function getClientFestivalContent(req, res) {
  try {
    const snap = await db.collection('socialFestivalContent')
      .where('clientId', '==', req.params.clientId)
      .orderBy('createdAt', 'desc').limit(20).get();
    res.json(snapToArr(snap));
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = { getUpcomingFestivals, generateFestivalContent, getClientFestivalContent };
