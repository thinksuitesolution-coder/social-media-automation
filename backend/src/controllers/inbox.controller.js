const { db, admin, snapToArr, convertDoc, toTimestamp } = require('../utils/firebase');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function gemini(prompt) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function analyzeMessage(content) {
  const prompt = `Analyze sentiment of this social media message:
"${content}"
Return ONLY JSON:
{"sentiment":"POSITIVE/NEGATIVE/NEUTRAL","priority":"HIGH/MEDIUM/LOW","category":"COMPLAINT/QUERY/COMPLIMENT/SPAM","suggestedAction":"one line action"}`;
  try {
    const raw = await gemini(prompt);
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return { sentiment: 'NEUTRAL', priority: 'NORMAL', category: 'QUERY', suggestedAction: 'Review and respond' };
  }
}

// GET /inbox/:clientId
async function getMessages(req, res) {
  try {
    const { clientId } = req.params;
    const { userId } = req.user;
    const snap = await db.collection('socialInboxMessages')
      .where('clientId', '==', clientId)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    const messages = snapToArr(snap);
    const total = messages.length;
    const replied = messages.filter((m) => m.isReplied).length;
    res.json({ messages, stats: { total, replied, avgResponseTime: '< 2h' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /inbox/message (called by webhooks/external)
async function saveMessage(req, res) {
  try {
    const { clientId, userId, platform, messageId, senderName, senderHandle, senderAvatar, messageType, content } = req.body;
    const analysis = await analyzeMessage(content);
    const docRef = await db.collection('socialInboxMessages').add({
      clientId, userId, platform, messageId,
      senderName, senderHandle, senderAvatar: senderAvatar || null,
      messageType: messageType || 'DM',
      content, isRead: false, isReplied: false,
      assignedTo: null,
      priority: analysis.priority || 'NORMAL',
      sentiment: analysis.sentiment,
      category: analysis.category,
      suggestedAction: analysis.suggestedAction,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ id: docRef.id, ...analysis });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /inbox/suggest-reply/:messageId
async function suggestReply(req, res) {
  try {
    const { messageId } = req.params;
    const msgDoc = await db.collection('socialInboxMessages').doc(messageId).get();
    if (!msgDoc.exists) return res.status(404).json({ error: 'Message not found' });
    const msg = msgDoc.data();

    // Get client brand info
    const clientDoc = await db.collection('socialClients').doc(msg.clientId).get();
    const client = clientDoc.exists ? clientDoc.data() : {};

    const prompt = `You are a social media manager for ${client.name || 'a brand'}.
Brand tone: ${client.tone || 'professional'}
Brand niche: ${client.niche || 'general'}

A ${msg.platform} user sent this message:
"${msg.content}"

Write a professional, on-brand reply. Max 100 words. Return only the reply text.`;

    const reply = await gemini(prompt);
    res.json({ reply: reply.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /inbox/reply/:messageId
async function sendReply(req, res) {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const { userId } = req.user;
    await db.collection('socialInboxReplies').add({
      messageId, userId, content,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await db.collection('socialInboxMessages').doc(messageId).update({
      isReplied: true,
      repliedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PUT /inbox/read/:messageId
async function markRead(req, res) {
  try {
    const { messageId } = req.params;
    await db.collection('socialInboxMessages').doc(messageId).update({ isRead: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PUT /inbox/assign/:messageId
async function assignMessage(req, res) {
  try {
    const { messageId } = req.params;
    const { assignedTo } = req.body;
    await db.collection('socialInboxMessages').doc(messageId).update({ assignedTo });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getMessages, saveMessage, suggestReply, sendReply, markRead, assignMessage };
