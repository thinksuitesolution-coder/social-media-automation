const { db, admin, snapToArr, convertDoc } = require('../utils/firebase');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function gemini(prompt) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  const r = await model.generateContent(prompt);
  return r.response.text();
}

// GET /crm/contacts/:clientId
async function getContacts(req, res) {
  try {
    const { clientId } = req.params;
    const { userId } = req.user;
    const snap = await db.collection('socialCRMContacts')
      .where('clientId', '==', clientId)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    res.json({ contacts: snapToArr(snap) });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /crm/contacts
async function createContact(req, res) {
  try {
    const { userId } = req.user;
    const { clientId, name, handle, platform, email, phone, notes } = req.body;
    const docRef = await db.collection('socialCRMContacts').add({
      clientId, userId, name, handle: handle || '',
      platform: platform || 'INSTAGRAM',
      email: email || null, phone: phone || null,
      notes: notes || '', stage: 'FOLLOWER',
      totalMessages: 0, totalOrders: 0, totalSpend: 0,
      tags: [], aiScore: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastInteraction: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ id: docRef.id, success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// PUT /crm/contacts/:id
async function updateContact(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;
    delete updates.userId; delete updates.clientId;
    await db.collection('socialCRMContacts').doc(id).update(updates);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /crm/score/:id
async function scoreContact(req, res) {
  try {
    const { id } = req.params;
    const doc = await db.collection('socialCRMContacts').doc(id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Contact not found' });
    const contact = doc.data();

    // Get client info
    const clientDoc = await db.collection('socialClients').doc(contact.clientId).get();
    const client = clientDoc.exists ? clientDoc.data() : {};

    // Get interactions
    const intSnap = await db.collection('socialCRMInteractions')
      .where('contactId', '==', id)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();
    const interactions = snapToArr(intSnap);

    const prompt = `Analyze this social media contact and score their purchase likelihood.

Contact: ${contact.name} | Platform: ${contact.platform} | Stage: ${contact.stage}
Messages sent: ${contact.totalMessages} | Total spend: ₹${contact.totalSpend || 0}
Recent interactions: ${interactions.map((i) => i.content).join('; ') || 'None'}
Brand niche: ${client.niche || 'general'}

Return ONLY JSON:
{"score":0-100,"stage":"FOLLOWER/LEAD/PROSPECT/CUSTOMER","buyingIntent":"HIGH/MEDIUM/LOW","nextAction":"what to do next","summary":"one line contact summary"}`;

    const raw = await gemini(prompt);
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);

    await db.collection('socialCRMContacts').doc(id).update({
      aiScore: result.score,
      stage: result.stage,
      buyingIntent: result.buyingIntent,
      nextAction: result.nextAction,
      aiSummary: result.summary,
    });

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /crm/deals/:clientId
async function getDeals(req, res) {
  try {
    const { clientId } = req.params;
    const { userId } = req.user;
    const snap = await db.collection('socialCRMDeals')
      .where('clientId', '==', clientId)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    res.json({ deals: snapToArr(snap) });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /crm/deals
async function createDeal(req, res) {
  try {
    const { userId } = req.user;
    const { contactId, clientId, title, value, notes } = req.body;
    const docRef = await db.collection('socialCRMDeals').add({
      contactId, clientId, userId,
      title, value: value || 0, notes: notes || '',
      stage: 'NEW', aiNextStep: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ id: docRef.id, success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// PUT /crm/deals/:id
async function updateDeal(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;
    await db.collection('socialCRMDeals').doc(id).update(updates);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = { getContacts, createContact, updateContact, scoreContact, getDeals, createDeal, updateDeal };
