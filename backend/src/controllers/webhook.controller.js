const { db, convertDoc }              = require('../utils/firebase');
const instagramService                = require('../services/instagram.service');
const whatsappService                 = require('../services/whatsapp.service');
const geminiService                   = require('../services/gemini.service');
const cloudinaryService               = require('../services/cloudinary.service');
const { generateImageWithFallback }   = require('../utils/imageGenerator');
const logger                          = require('../utils/logger');

function verifyWebhook(req, res) {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.status(403).json({ error: 'Forbidden' });
}

async function handleWebhook(req, res) {
  res.status(200).json({ received: true });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (body.object !== 'whatsapp_business_account') return;

    const changes = body.entry?.[0]?.changes?.[0]?.value;
    if (!changes?.messages) return;
    const message = changes.messages[0];
    const from    = message.from;

    // Interactive reply (button inside regular interactive message)
    if (message.type === 'interactive') {
      const buttonId = message.interactive?.button_reply?.id;
      if (!buttonId) return;
      if (buttonId.startsWith('APPROVE_'))
        await handleApproval(buttonId.replace('APPROVE_', ''), from);
      else if (buttonId.startsWith('REJECT_'))
        await handleRejection(buttonId.replace('REJECT_', ''), from);

    // Template quick-reply button (payload set when template was sent)
    } else if (message.type === 'button') {
      const payload = message.button?.payload;
      if (!payload) return;
      if (payload.startsWith('APPROVE_'))
        await handleApproval(payload.replace('APPROVE_', ''), from);
      else if (payload.startsWith('REJECT_'))
        await handleRejection(payload.replace('REJECT_', ''), from);

    // Free-text feedback after rejection
    } else if (message.type === 'text') {
      const text = message.text?.body?.trim();
      if (text) await handleFeedbackText(from, text);
    }
  } catch (err) {
    logger.error('Webhook error:', err);
  }
}

/* ─── APPROVE ─────────────────────────────────────────────────────────────── */
async function handleApproval(postId, from) {
  const postDoc = await db.collection('socialPosts').doc(postId).get();
  if (!postDoc.exists) return logger.warn(`Webhook: Post ${postId} not found`);
  const post = convertDoc(postDoc);

  await db.collection('socialPosts').doc(postId).update({
    status: 'APPROVED', updatedAt: new Date().toISOString(),
  });

  const clientDoc = await db.collection('socialClients').doc(post.clientId).get();
  if (!clientDoc.exists) return;
  const client = convertDoc(clientDoc);

  await recordApproval(post.clientId, {
    imagePrompt: post.imagePrompt, imageProvider: post.imageProvider,
    topic: post.topic,
  });

  if (client.instagramAccountId && client.instagramToken) {
    try {
      const result = await instagramService.uploadToInstagram({
        igAccountId:  client.instagramAccountId,
        accessToken:  client.instagramToken,
        imageUrl:     post.imageUrl,
        caption:      post.caption,
        hashtags:     post.hashtags,
      });
      await db.collection('socialPosts').doc(postId).update({
        status: 'POSTED',
        instagramPostId: result.instagramPostId,
        instagramUrl:    result.instagramUrl,
        postedAt:        result.postedAt.toISOString(),
        updatedAt:       new Date().toISOString(),
      });
      await whatsappService.sendTextMessage(
        from,
        `✅ Post published to Instagram!\n🔗 ${result.instagramUrl}`
      );
    } catch (err) {
      logger.error('Auto Instagram upload failed:', err.message);
      await whatsappService.sendTextMessage(
        from,
        '✅ Post approved! There was an issue publishing to Instagram — please check your account connection.'
      );
    }
  } else {
    await whatsappService.sendTextMessage(from, '✅ Post approved!');
  }
}

/* ─── REJECT → ask for feedback ───────────────────────────────────────────── */
async function handleRejection(postId, from) {
  await db.collection('socialPosts').doc(postId).update({
    status: 'AWAITING_FEEDBACK', updatedAt: new Date().toISOString(),
  });
  await whatsappService.sendTextMessage(
    from,
    `❌ Post rejected.\n\nPlease tell me what changes you'd like:\n• Different colors or style?\n• Different caption tone?\n• Different concept or angle?\n• Anything specific?\n\nJust reply with your feedback and I'll create a new version! 🎨`
  );
}

/* ─── FEEDBACK TEXT → regenerate post ─────────────────────────────────────── */
async function handleFeedbackText(from, feedbackText) {
  const clientSnap = await db.collection('socialClients')
    .where('whatsappNumber', '==', from).limit(1).get();
  if (clientSnap.empty) return;
  const client = convertDoc(clientSnap.docs[0]);

  const postSnap = await db.collection('socialPosts')
    .where('clientId', '==', client.id)
    .where('status', '==', 'AWAITING_FEEDBACK')
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .get();
  if (postSnap.empty) return;
  const post = convertDoc(postSnap.docs[0]);

  try {
    await whatsappService.sendTextMessage(
      from,
      '🔄 Got your feedback! Creating a new version… (this takes ~30 seconds)'
    );

    await recordRejection(post.clientId, {
      imagePrompt: post.imagePrompt, feedback: feedbackText, topic: post.topic,
    });

    const learning       = await getClientLearning(post.clientId);
    const approvedStyles = learning.approvedStyles || [];

    const [newImagePrompt, newCaption, newHashtags] = await Promise.all([
      geminiService.generateImagePromptWithFeedback({
        brandName: client.name, niche: client.niche,
        topic: post.topic, theme: post.topic, tone: client.tone,
        feedback: feedbackText, previousPrompt: post.imagePrompt,
        approvedStyles,
      }),
      geminiService.generateCaptionWithFeedback({
        brandName: client.name, niche: client.niche,
        tone: client.tone, targetAudience: client.targetAudience,
        topic: post.topic, feedback: feedbackText, previousCaption: post.caption,
      }),
      geminiService.generateHashtags({ niche: client.niche, topic: post.topic }),
    ]);

    // Fallback chain: preferred provider → DALLE → Replicate → Imagen
    const preferredProvider = post.imageProvider || client.defaultImageProvider || 'DALLE';
    const { url: newImageUrl, provider: usedProvider } =
      await generateImageWithFallback(newImagePrompt, preferredProvider, post.id);

    await db.collection('socialPosts').doc(post.id).update({
      caption:       newCaption.trim(),
      hashtags:      newHashtags.trim(),
      imageUrl:      newImageUrl,
      imagePrompt:   newImagePrompt,
      imageProvider: usedProvider,
      lastFeedback:  feedbackText,
      status:        'SENT_FOR_APPROVAL',
      updatedAt:     new Date().toISOString(),
    });

    const dateStr = new Date(post.date).toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    await whatsappService.sendApprovalButtons(from, {
      postId:   post.id,
      caption:  newCaption,
      hashtags: newHashtags,
      date:     dateStr,
      imageUrl: newImageUrl,
    });
  } catch (err) {
    logger.error('Feedback regeneration failed:', err.message);
    await whatsappService.sendTextMessage(
      from,
      '❌ Sorry, something went wrong creating the new version. Please try again in a moment.'
    );
  }
}

/* ─── LEARNING SYSTEM ──────────────────────────────────────────────────────── */
async function recordApproval(clientId, data) {
  try {
    const ref      = db.collection('socialClientLearning').doc(clientId);
    const doc      = await ref.get();
    const existing = doc.exists ? (doc.data().approvedStyles || []) : [];
    existing.push({
      imagePrompt:   data.imagePrompt,
      imageProvider: data.imageProvider,
      topic:         data.topic,
      approvedAt:    new Date().toISOString(),
    });
    await ref.set(
      { approvedStyles: existing.slice(-15), updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch (err) {
    logger.error('Learning record (approval) failed:', err.message);
  }
}

async function recordRejection(clientId, data) {
  try {
    const ref      = db.collection('socialClientLearning').doc(clientId);
    const doc      = await ref.get();
    const existing = doc.exists ? (doc.data().rejectedStyles || []) : [];
    existing.push({
      imagePrompt: data.imagePrompt,
      feedback:    data.feedback,
      topic:       data.topic,
      rejectedAt:  new Date().toISOString(),
    });
    await ref.set(
      { rejectedStyles: existing.slice(-15), updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch (err) {
    logger.error('Learning record (rejection) failed:', err.message);
  }
}

async function getClientLearning(clientId) {
  try {
    const doc = await db.collection('socialClientLearning').doc(clientId).get();
    return doc.exists ? doc.data() : { approvedStyles: [], rejectedStyles: [] };
  } catch {
    return { approvedStyles: [], rejectedStyles: [] };
  }
}

module.exports = { verifyWebhook, handleWebhook };
