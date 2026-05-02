const { db, convertDoc, snapToArr }       = require('../utils/firebase');
const geminiService                        = require('../services/gemini.service');
const whatsappService                      = require('../services/whatsapp.service');
const instagramService                     = require('../services/instagram.service');
const { generateImageWithFallback }        = require('../utils/imageGenerator');

async function getClientLearning(clientId) {
  try {
    const doc = await db.collection('socialClientLearning').doc(clientId).get();
    return doc.exists ? doc.data() : { approvedStyles: [], rejectedStyles: [] };
  } catch {
    return { approvedStyles: [], rejectedStyles: [] };
  }
}

// POST /api/social/posts/generate
// Body: { clientId, calendarId, dayId, date, topic, theme, imageProvider }
async function generatePost(req, res, next) {
  try {
    const uid = req.user.uid;
    const { clientId, calendarId, dayId, date, topic, theme, imageProvider } = req.body;
    if (!clientId || !topic) return res.status(400).json({ error: 'clientId and topic required' });

    const clientDoc = await db.collection('socialClients').doc(clientId).get();
    if (!clientDoc.exists || clientDoc.data().userId !== uid) return res.status(404).json({ error: 'Client not found' });
    const client = convertDoc(clientDoc);

    const provider = imageProvider || client.defaultImageProvider || 'DALLE';
    const postDocId = dayId || `${uid}_${clientId}_${Date.now()}`;

    // Load client's learned preferences to generate better images
    const learning = await getClientLearning(clientId);
    const approvedStyles = learning.approvedStyles || [];

    // Use learning-aware image prompt if client has history
    const imagePromptFn = approvedStyles.length > 0
      ? geminiService.generateImagePromptWithFeedback({
          brandName: client.name, niche: client.niche, topic, theme: theme || topic, tone: client.tone,
          feedback: 'Generate a fresh post in the brand style',
          previousPrompt: '',
          approvedStyles,
        })
      : geminiService.generateImagePrompt({ brandName: client.name, niche: client.niche, topic, theme: theme || topic, tone: client.tone });

    const [imagePrompt, caption, hashtags] = await Promise.all([
      imagePromptFn,
      geminiService.generateCaption({ brandName: client.name, niche: client.niche, tone: client.tone, targetAudience: client.targetAudience, topic, theme: theme || topic }),
      geminiService.generateHashtags({ niche: client.niche, topic }),
    ]);

    const { url: imageUrl, provider: usedProvider } =
      await generateImageWithFallback(imagePrompt, provider, postDocId);
    const now = new Date().toISOString();

    const postData = {
      id: postDocId, userId: uid, clientId,
      calendarId: calendarId || null, calendarDayId: dayId || null,
      date: date || now, topic,
      caption: caption.trim(), hashtags: hashtags.trim(),
      imageUrl, imagePrompt, imageProvider: usedProvider,
      status: 'PENDING',
      scheduledTime: null, whatsappMessageId: null,
      instagramPostId: null, instagramUrl: null,
      postedAt: null, reminderSentAt: null,
      createdAt: now, updatedAt: now,
    };

    await db.collection('socialPosts').doc(postDocId).set(postData);
    res.status(201).json(postData);
  } catch (err) { next(err); }
}

async function regenerateCaption(req, res, next) {
  try {
    const uid = req.user.uid;
    const postDoc = await db.collection('socialPosts').doc(req.params.id).get();
    if (!postDoc.exists || postDoc.data().userId !== uid) return res.status(404).json({ error: 'Post not found' });
    const post = convertDoc(postDoc);

    const clientDoc = await db.collection('socialClients').doc(post.clientId).get();
    const client = convertDoc(clientDoc);

    const caption = await geminiService.generateCaption({
      brandName: client.name, niche: client.niche, tone: client.tone,
      targetAudience: client.targetAudience, topic: post.topic, theme: post.topic,
    });

    await db.collection('socialPosts').doc(post.id).update({ caption: caption.trim(), updatedAt: new Date().toISOString() });
    res.json({ caption: caption.trim() });
  } catch (err) { next(err); }
}

async function regenerateImage(req, res, next) {
  try {
    const uid = req.user.uid;
    const { imageProvider } = req.body;
    const postDoc = await db.collection('socialPosts').doc(req.params.id).get();
    if (!postDoc.exists || postDoc.data().userId !== uid) return res.status(404).json({ error: 'Post not found' });
    const post = convertDoc(postDoc);

    const clientDoc = await db.collection('socialClients').doc(post.clientId).get();
    const client = convertDoc(clientDoc);
    const provider = imageProvider || post.imageProvider || client.defaultImageProvider;

    const { url: imageUrl, provider: usedProvider } =
      await generateImageWithFallback(post.imagePrompt, provider, post.id);
    await db.collection('socialPosts').doc(post.id).update({
      imageUrl, imageProvider: usedProvider, updatedAt: new Date().toISOString(),
    });
    res.json({ imageUrl });
  } catch (err) { next(err); }
}

async function regenerateHashtags(req, res, next) {
  try {
    const uid = req.user.uid;
    const postDoc = await db.collection('socialPosts').doc(req.params.id).get();
    if (!postDoc.exists || postDoc.data().userId !== uid) return res.status(404).json({ error: 'Post not found' });
    const post = convertDoc(postDoc);
    const clientDoc = await db.collection('socialClients').doc(post.clientId).get();
    const client = convertDoc(clientDoc);

    const hashtags = await geminiService.generateHashtags({ niche: client.niche, topic: post.topic });
    await db.collection('socialPosts').doc(post.id).update({ hashtags: hashtags.trim(), updatedAt: new Date().toISOString() });
    res.json({ hashtags: hashtags.trim() });
  } catch (err) { next(err); }
}

async function sendToWhatsApp(req, res, next) {
  try {
    const uid = req.user.uid;
    const postDoc = await db.collection('socialPosts').doc(req.params.id).get();
    if (!postDoc.exists || postDoc.data().userId !== uid) return res.status(404).json({ error: 'Post not found' });
    const post = convertDoc(postDoc);
    const clientDoc = await db.collection('socialClients').doc(post.clientId).get();
    const client = convertDoc(clientDoc);

    const dateStr = new Date(post.scheduledTime || post.date).toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const result = await whatsappService.sendApprovalButtons(client.whatsappNumber, {
      postId: post.id, caption: post.caption, hashtags: post.hashtags, date: dateStr, imageUrl: post.imageUrl,
    });

    await db.collection('socialPosts').doc(post.id).update({
      status: 'SENT_FOR_APPROVAL',
      whatsappMessageId: result.messages?.[0]?.id || null,
      updatedAt: new Date().toISOString(),
    });
    res.json({ success: true, status: 'SENT_FOR_APPROVAL' });
  } catch (err) { next(err); }
}

async function approvePost(req, res, next) {
  try {
    const uid = req.user.uid;
    const ref = db.collection('socialPosts').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists || doc.data().userId !== uid) return res.status(404).json({ error: 'Post not found' });
    await ref.update({ status: 'APPROVED', updatedAt: new Date().toISOString() });
    res.json({ success: true, status: 'APPROVED' });
  } catch (err) { next(err); }
}

async function rejectPost(req, res, next) {
  try {
    const uid = req.user.uid;
    const ref = db.collection('socialPosts').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists || doc.data().userId !== uid) return res.status(404).json({ error: 'Post not found' });
    await ref.update({ status: 'REJECTED', updatedAt: new Date().toISOString() });
    res.json({ success: true, status: 'REJECTED' });
  } catch (err) { next(err); }
}

async function uploadToInstagram(req, res, next) {
  try {
    const uid = req.user.uid;
    const postDoc = await db.collection('socialPosts').doc(req.params.id).get();
    if (!postDoc.exists || postDoc.data().userId !== uid) return res.status(404).json({ error: 'Post not found' });
    const post = convertDoc(postDoc);
    const clientDoc = await db.collection('socialClients').doc(post.clientId).get();
    const client = convertDoc(clientDoc);

    if (!client.instagramAccountId || !client.instagramToken) {
      return res.status(400).json({ error: 'Client has no Instagram credentials' });
    }

    const result = await instagramService.uploadToInstagram({
      igAccountId: client.instagramAccountId, accessToken: client.instagramToken,
      imageUrl: post.imageUrl, caption: post.caption, hashtags: post.hashtags,
    });

    await db.collection('socialPosts').doc(post.id).update({
      status: 'POSTED', instagramPostId: result.instagramPostId,
      instagramUrl: result.instagramUrl, postedAt: result.postedAt.toISOString(),
      updatedAt: new Date().toISOString(),
    });
    res.json({ success: true, status: 'POSTED', instagramUrl: result.instagramUrl });
  } catch (err) { next(err); }
}

async function getPosts(req, res, next) {
  try {
    const uid = req.user.uid;
    const { clientId } = req.params;
    const { status, page = 1, limit = 24 } = req.query;

    let query = db.collection('socialPosts').where('userId', '==', uid).where('clientId', '==', clientId).orderBy('date', 'asc');
    if (status && status !== 'ALL') query = query.where('status', '==', status);

    const snap = await query.get();
    const all = snapToArr(snap);
    const skip = (Number(page) - 1) * Number(limit);

    res.json({ posts: all.slice(skip, skip + Number(limit)), total: all.length });
  } catch (err) { next(err); }
}

async function getPost(req, res, next) {
  try {
    const uid = req.user.uid;
    const doc = await db.collection('socialPosts').doc(req.params.id).get();
    if (!doc.exists || doc.data().userId !== uid) return res.status(404).json({ error: 'Post not found' });
    res.json(convertDoc(doc));
  } catch (err) { next(err); }
}

module.exports = {
  generatePost, regenerateCaption, regenerateImage, regenerateHashtags,
  sendToWhatsApp, approvePost, rejectPost, uploadToInstagram,
  getPosts, getPost,
};
