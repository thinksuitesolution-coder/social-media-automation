const { db, admin, convertDoc } = require('../utils/firebase');
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

// POST /visual-style/train/:clientId
async function trainVisualStyle(req, res) {
  try {
    const { clientId } = req.params;
    const { imageUrls, referenceDescription } = req.body;
    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length < 2) {
      return res.status(400).json({ error: 'Provide at least 2 image URLs or descriptions' });
    }

    const clientDoc = await db.collection('socialClients').doc(clientId).get();
    if (!clientDoc.exists) return res.status(404).json({ error: 'Client not found' });
    const client = clientDoc.data();

    const prompt = `Analyze these brand image descriptions/URLs and extract the visual identity and style guide:

Images/Descriptions: ${imageUrls.join('\n')}
${referenceDescription ? `Additional context: ${referenceDescription}` : ''}
Brand niche: ${client.niche || 'general'}
Brand name: ${client.name}

Analyze:
- Dominant and accent colors
- Visual mood and atmosphere
- Image composition style
- Lighting style
- Common elements/objects
- Things never shown
- Overall aesthetic

Return ONLY JSON:
{
  "primaryColors": ["#hex1", "#hex2"],
  "secondaryColors": ["#hex1"],
  "visualMood": "BRIGHT",
  "imageStyle": "REALISTIC",
  "compositionStyle": "centered",
  "lightingStyle": "natural",
  "mustInclude": ["element1", "element2"],
  "avoidElements": ["element1", "element2"],
  "colorDescription": "warm earth tones with golden accents",
  "masterImagePrompt": "complete reusable style prompt to prepend to all image prompts"
}`;

    const raw = await gemini(prompt);
    const analysis = parseJSON(raw);

    await db.collection('socialVisualStyle').doc(clientId).set({
      clientId, ...analysis,
      referenceImages: imageUrls,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json(analysis);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /visual-style/:clientId
async function getVisualStyle(req, res) {
  try {
    const doc = await db.collection('socialVisualStyle').doc(req.params.clientId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Not trained yet' });
    res.json(convertDoc(doc));
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /visual-style/generate/:clientId
async function generateBrandedImagePrompt(req, res) {
  try {
    const { clientId } = req.params;
    const { topicPrompt } = req.body;
    const styleDoc = await db.collection('socialVisualStyle').doc(clientId).get();
    if (!styleDoc.exists) return res.status(404).json({ error: 'Train visual style first' });
    const style = styleDoc.data();

    const fullPrompt = `${style.masterImagePrompt}, ${topicPrompt}`;
    res.json({ imagePrompt: fullPrompt, masterPrompt: style.masterImagePrompt });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = { trainVisualStyle, getVisualStyle, generateBrandedImagePrompt };
