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

// POST /persona/build/:clientId
async function buildPersona(req, res) {
  try {
    const { clientId } = req.params;
    const { product, priceRange, location, topContent } = req.body;
    const clientDoc = await db.collection('socialClients').doc(clientId).get();
    if (!clientDoc.exists) return res.status(404).json({ error: 'Client not found' });
    const client = clientDoc.data();

    const prompt = `Build a detailed audience persona for:

Brand: ${client.name}
Niche: ${client.niche}
Product/Service: ${product || client.services || 'Not specified'}
Price range: ${priceRange || 'Not specified'}
Location: ${location || 'India'}
Past top performing content: ${topContent || 'Not available'}

Create the most accurate buyer persona.
Return ONLY JSON:
{
  "personaName": "Give persona a name",
  "age": "25-35",
  "gender": "primarily female",
  "location": ["Mumbai", "Delhi"],
  "occupation": ["entrepreneur", "homemaker"],
  "incomeLevel": "MIDDLE",
  "interests": ["fitness", "lifestyle"],
  "painPoints": ["pain1", "pain2"],
  "goals": ["goal1", "goal2"],
  "contentPreference": ["Reels", "Carousel"],
  "activeHours": ["7-9am", "8-10pm"],
  "platforms": ["Instagram", "Facebook"],
  "buyingBehavior": "impulse",
  "language": "Hinglish",
  "whatMotivatesThem": "paragraph about motivation",
  "howToReachThem": "paragraph about reaching them",
  "contentAngles": ["angle that works for this persona"]
}`;

    const raw = await gemini(prompt);
    const persona = parseJSON(raw);

    const ref = await db.collection('socialAudiencePersonas').add({
      clientId, ...persona,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ id: ref.id, ...persona });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /persona/:clientId
async function getPersonas(req, res) {
  try {
    const snap = await db.collection('socialAudiencePersonas')
      .where('clientId', '==', req.params.clientId)
      .orderBy('createdAt', 'desc').get();
    res.json(snapToArr(snap));
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// DELETE /persona/:personaId
async function deletePersona(req, res) {
  try {
    await db.collection('socialAudiencePersonas').doc(req.params.personaId).delete();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = { buildPersona, getPersonas, deletePersona };
