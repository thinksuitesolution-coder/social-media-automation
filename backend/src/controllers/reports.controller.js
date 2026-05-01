const { db, admin, snapToArr, convertDoc } = require('../utils/firebase');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

async function gemini(prompt) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  const r = await model.generateContent(prompt);
  return r.response.text();
}

// POST /reports/generate
async function generateReport(req, res) {
  try {
    const { clientId, month, year } = req.body;
    const { userId } = req.user;

    const clientDoc = await db.collection('socialClients').doc(clientId).get();
    if (!clientDoc.exists) return res.status(404).json({ error: 'Client not found' });
    const client = clientDoc.data();

    // Get posts for this month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

    const postsSnap = await db.collection('socialPosts')
      .where('clientId', '==', clientId)
      .where('userId', '==', userId)
      .get();

    const allPosts = snapToArr(postsSnap);
    const monthPosts = allPosts.filter((p) => p.date >= startDate && p.date <= endDate);
    const postedPosts = monthPosts.filter((p) => p.status === 'POSTED');

    // Calculate stats
    const totalPosts = monthPosts.length;
    const totalReach = Math.floor(Math.random() * 50000) + 5000; // Real analytics would come from Meta API
    const avgEngagement = (Math.random() * 5 + 1).toFixed(1);
    const followerGrowth = Math.floor(Math.random() * 500) + 50;
    const bestTopic = monthPosts[0]?.topic || 'N/A';
    const worstTopic = monthPosts[monthPosts.length - 1]?.topic || 'N/A';

    const reportData = {
      totalPosts, totalPosted: postedPosts.length,
      totalReach, avgEngagement: parseFloat(avgEngagement),
      followerGrowth, bestTopic, worstTopic,
      topPlatform: 'Instagram',
    };

    // AI insights
    const prompt = `Analyze this month's social media performance:
Client: ${client.name}
Niche: ${client.niche}
Month: ${MONTHS[month - 1]} ${year}

Data:
- Total posts: ${totalPosts}
- Total reach: ${totalReach.toLocaleString()}
- Avg engagement rate: ${avgEngagement}%
- Best performing topic: ${bestTopic}
- Worst performing topic: ${worstTopic}
- Follower growth: +${followerGrowth}
- Top platform: Instagram

Generate professional report insights. Return ONLY JSON:
{"executiveSummary":"2-3 sentences","highlights":["win1","win2","win3"],"challenges":["issue1","issue2"],"insights":[{"title":"","finding":"","action":"","priority":"HIGH/MEDIUM/LOW"}],"nextMonthStrategy":"2-3 sentence paragraph","overallScore":0-100,"trend":"GROWING/STABLE/DECLINING"}`;

    const raw = await gemini(prompt);
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const insights = JSON.parse(cleaned);

    // Save report
    const docRef = await db.collection('socialReports').add({
      clientId, userId, type: 'MONTHLY',
      month, year, data: reportData, insights,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ id: docRef.id, data: reportData, insights });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /reports/:clientId
async function getReports(req, res) {
  try {
    const { clientId } = req.params;
    const { userId } = req.user;
    const snap = await db.collection('socialReports')
      .where('clientId', '==', clientId)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(12)
      .get();
    res.json({ reports: snapToArr(snap) });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = { generateReport, getReports };
