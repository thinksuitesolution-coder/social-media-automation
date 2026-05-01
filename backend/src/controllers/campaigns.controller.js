const { db, admin, snapToArr, convertDoc } = require('../utils/firebase');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function gemini(prompt) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  const r = await model.generateContent(prompt);
  return r.response.text();
}

// GET /campaigns/:clientId
async function getCampaigns(req, res) {
  try {
    const { clientId } = req.params;
    const { userId } = req.user;
    const snap = await db.collection('socialCampaigns')
      .where('clientId', '==', clientId)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    res.json({ campaigns: snapToArr(snap) });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /campaigns/generate
async function generateCampaign(req, res) {
  try {
    const { userId } = req.user;
    const { clientId, name, type, startDate, endDate, goal } = req.body;

    const clientDoc = await db.collection('socialClients').doc(clientId).get();
    const client = clientDoc.exists ? clientDoc.data() : {};

    const prompt = `Create a complete ${type} campaign for ${client.name || 'the brand'} in ${client.niche || 'general'} niche.
Campaign: ${name}
Goal: ${goal}
Duration: ${startDate} to ${endDate}
Target audience: ${client.targetAudience || 'general audience'}
Brand tone: ${client.tone || 'professional'}

Generate complete day-by-day content plan. Return ONLY a JSON array:
[{"date":"YYYY-MM-DD","phase":"TEASER/LAUNCH/ENGAGEMENT/CLOSING","topic":"","theme":"","contentType":"Post/Reel/Carousel/Story","caption":"full caption text","urgencyLevel":"LOW/MEDIUM/HIGH","cta":"specific call to action","imagePrompt":"detailed image generation prompt"}]

Include all days from ${startDate} to ${endDate}. Max 30 days.`;

    const raw = await gemini(prompt);
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let aiPlan;
    try { aiPlan = JSON.parse(cleaned); } catch { aiPlan = []; }

    const docRef = await db.collection('socialCampaigns').add({
      clientId, userId, name, type,
      startDate, endDate, goal,
      aiPlan, status: 'DRAFT',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const doc = await docRef.get();
    res.json(convertDoc(doc));
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /campaigns/:id/activate
async function activateCampaign(req, res) {
  try {
    const { id } = req.params;
    const { userId } = req.user;
    const campaignDoc = await db.collection('socialCampaigns').doc(id).get();
    if (!campaignDoc.exists) return res.status(404).json({ error: 'Campaign not found' });
    const campaign = campaignDoc.data();

    if (!campaign.aiPlan || campaign.aiPlan.length === 0) {
      return res.status(400).json({ error: 'Campaign has no AI plan' });
    }

    // Get client + calendar
    const clientDoc = await db.collection('socialClients').doc(campaign.clientId).get();
    const client = clientDoc.exists ? clientDoc.data() : {};

    // Create posts for each day in the plan
    const batch = db.batch();
    const postIds = [];

    for (const day of campaign.aiPlan) {
      const postRef = db.collection('socialPosts').doc();
      postIds.push(postRef.id);
      batch.set(postRef, {
        clientId: campaign.clientId,
        userId,
        campaignId: id,
        topic: day.topic,
        theme: day.theme,
        date: day.date,
        caption: day.caption,
        hashtags: '',
        imageUrl: null,
        imagePrompt: day.imagePrompt || '',
        status: 'PENDING',
        contentType: day.contentType,
        postingTime: '18:00',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    await db.collection('socialCampaigns').doc(id).update({ status: 'ACTIVE', postIds });

    res.json({ success: true, postsCreated: postIds.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = { getCampaigns, generateCampaign, activateCampaign };
