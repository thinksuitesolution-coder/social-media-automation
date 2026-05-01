const { db, admin, snapToArr, convertDoc } = require('../utils/firebase');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function gemini(prompt) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  const r = await model.generateContent(prompt);
  return r.response.text();
}

// GET /linkbio/:clientId
async function getBios(req, res) {
  try {
    const { clientId } = req.params;
    const { userId } = req.user;
    const snap = await db.collection('socialLinkBios')
      .where('clientId', '==', clientId)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const bios = await Promise.all(snapToArr(snap).map(async (bio) => {
      const linksSnap = await db.collection('socialBioLinks')
        .where('bioId', '==', bio.id)
        .orderBy('order', 'asc')
        .get();
      return { ...bio, links: snapToArr(linksSnap) };
    }));

    res.json({ bios });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /linkbio/single/:id
async function getSingleBio(req, res) {
  try {
    const { id } = req.params;
    const doc = await db.collection('socialLinkBios').doc(id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found' });
    const bio = convertDoc(doc);
    const linksSnap = await db.collection('socialBioLinks')
      .where('bioId', '==', id)
      .orderBy('order', 'asc')
      .get();
    res.json({ bio: { ...bio, links: snapToArr(linksSnap) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /linkbio/public/:slug (no auth)
async function getPublicBio(req, res) {
  try {
    const { slug } = req.params;
    const snap = await db.collection('socialLinkBios')
      .where('slug', '==', slug)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    if (snap.empty) return res.status(404).json({ error: 'Page not found' });
    const bio = convertDoc(snap.docs[0]);
    const linksSnap = await db.collection('socialBioLinks')
      .where('bioId', '==', bio.id)
      .where('isActive', '==', true)
      .orderBy('order', 'asc')
      .get();
    res.json({ bio: { ...bio, links: snapToArr(linksSnap) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /linkbio
async function createBio(req, res) {
  try {
    const { userId } = req.user;
    const { clientId, title, description, slug, theme, primaryColor } = req.body;

    // Check slug uniqueness
    const existing = await db.collection('socialLinkBios').where('slug', '==', slug).limit(1).get();
    if (!existing.empty) return res.status(400).json({ error: 'Slug already taken. Try another.' });

    const docRef = await db.collection('socialLinkBios').add({
      clientId, userId, title,
      description: description || '', slug,
      theme: theme || 'DEFAULT',
      primaryColor: primaryColor || '#7c3aed',
      isActive: true, totalClicks: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ id: docRef.id, success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// PUT /linkbio/:id
async function updateBio(req, res) {
  try {
    const { id } = req.params;
    await db.collection('socialLinkBios').doc(id).update(req.body);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /linkbio/ai-copy
async function aiCopy(req, res) {
  try {
    const { clientId } = req.body;
    const clientDoc = await db.collection('socialClients').doc(clientId).get();
    const client = clientDoc.exists ? clientDoc.data() : {};

    const prompt = `Write a compelling Link in Bio page for this brand:
Brand: ${client.name || 'Brand'}
Niche: ${client.niche || 'general'}
Target audience: ${client.targetAudience || 'general audience'}
Tone: ${client.tone || 'professional'}
Main goal: Get more customers and leads

Return ONLY JSON:
{"title":"catchy brand tagline max 6 words","description":"2 line engaging bio description","ctaText":"main button text","welcomeMessage":"WhatsApp welcome message 1 line"}`;

    const raw = await gemini(prompt);
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    res.json(JSON.parse(cleaned));
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /linkbio/:id/links
async function addLink(req, res) {
  try {
    const { id } = req.params;
    const { title, url, icon, order } = req.body;
    const docRef = await db.collection('socialBioLinks').add({
      bioId: id, title, url,
      icon: icon || '🔗',
      order: order || 1,
      clicks: 0, isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ id: docRef.id, success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// DELETE /linkbio/:id/links/:linkId
async function deleteLink(req, res) {
  try {
    const { linkId } = req.params;
    await db.collection('socialBioLinks').doc(linkId).delete();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /linkbio/click/:slug/:linkId (public, track click)
async function trackClick(req, res) {
  try {
    const { linkId } = req.params;
    await db.collection('socialBioLinks').doc(linkId).update({
      clicks: admin.firestore.FieldValue.increment(1),
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = { getBios, getSingleBio, getPublicBio, createBio, updateBio, aiCopy, addLink, deleteLink, trackClick };
