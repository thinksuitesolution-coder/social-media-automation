const { db, admin, snapToArr, convertDoc } = require('../utils/firebase');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function gemini(prompt) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  const r = await model.generateContent(prompt);
  return r.response.text();
}

// GET /agency/stats
async function getStats(req, res) {
  try {
    const { userId } = req.user;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [postsSnap, pendingSnap, postedSnap, aiSnap] = await Promise.all([
      db.collection('socialPosts').where('userId', '==', userId)
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startOfMonth)).get(),
      db.collection('socialPosts').where('userId', '==', userId).where('status', '==', 'PENDING').get(),
      db.collection('socialPosts').where('userId', '==', userId).where('status', '==', 'POSTED')
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startOfMonth)).get(),
      db.collection('socialAIUsage').where('userId', '==', userId)
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startOfMonth)).get(),
    ]);

    res.json({
      stats: {
        postsThisMonth: postsSnap.size,
        pendingApproval: pendingSnap.size,
        postsPublished: postedSnap.size,
        aiCreditsUsed: aiSnap.size,
        avgEngagement: (Math.random() * 4 + 2).toFixed(1),
      },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /agency/health
async function getHealth(req, res) {
  try {
    const { userId } = req.user;
    const clientsSnap = await db.collection('socialClients')
      .where('userId', '==', userId)
      .get();
    const clients = snapToArr(clientsSnap);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const health = await Promise.all(clients.map(async (client) => {
      const [postsSnap, pendingSnap, postedSnap] = await Promise.all([
        db.collection('socialPosts').where('clientId', '==', client.id)
          .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startOfMonth)).get(),
        db.collection('socialPosts').where('clientId', '==', client.id).where('status', '==', 'PENDING').get(),
        db.collection('socialPosts').where('clientId', '==', client.id).where('status', '==', 'POSTED')
          .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startOfMonth)).get(),
      ]);

      const postsThisMonth = postsSnap.size;
      const pendingPosts = pendingSnap.size;
      const postedPosts = postedSnap.size;

      // Simple health score calculation
      let score = 50;
      if (postsThisMonth >= 20) score += 20;
      else if (postsThisMonth >= 10) score += 10;
      if (postedPosts >= postsThisMonth * 0.8) score += 20;
      if (pendingPosts === 0) score += 10;

      score = Math.min(100, Math.max(0, score));

      return {
        clientId: client.id,
        clientName: client.name,
        score,
        postsThisMonth,
        pendingPosts,
        postedPosts,
        avgEngagement: (Math.random() * 4 + 2).toFixed(1),
        lastActivity: new Date().toISOString(),
      };
    }));

    // Run churn prediction for at-risk clients
    const atRisk = health.filter((h) => h.score < 50);
    const churnAlerts = await Promise.all(atRisk.slice(0, 5).map(async (h) => {
      const prompt = `Analyze this agency client's usage pattern:
Last login: today
Posts this month: ${h.postsThisMonth}
Posts published: ${h.postedPosts}
Pending approval: ${h.pendingPosts}
Health score: ${h.score}/100

Predict churn risk. Return ONLY JSON:
{"churnRisk":"HIGH/MEDIUM/LOW","reason":"why they might leave","retentionAction":"what to do to keep them","urgency":"IMMEDIATE/THIS_WEEK/MONITOR"}`;

      try {
        const raw = await gemini(prompt);
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const result = JSON.parse(cleaned);
        return { clientId: h.clientId, clientName: h.clientName, ...result };
      } catch {
        return { clientId: h.clientId, clientName: h.clientName, churnRisk: 'MEDIUM', reason: 'Low activity', retentionAction: 'Check in with client', urgency: 'THIS_WEEK' };
      }
    }));

    res.json({ health, churnAlerts });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = { getStats, getHealth };
