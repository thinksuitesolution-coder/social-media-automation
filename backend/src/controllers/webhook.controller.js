const { db, convertDoc } = require('../utils/firebase');
const instagramService  = require('../services/instagram.service');
const whatsappService   = require('../services/whatsapp.service');
const geminiService     = require('../services/gemini.service');
const cloudinaryService = require('../services/cloudinary.service');
const dalleService      = require('../services/dalle.service');
const replicateService  = require('../services/replicate.service');
const logger = require('../utils/logger');

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
    const from = message.from;

    if (message.type === 'interactive') {
      const buttonId = message.interactive?.button_reply?.id;
      if (!buttonId) return;
      if (buttonId.startsWith('APPROVE_'))
        await handleApproval(buttonId.replace('APPROVE_', ''), from);
      else if (buttonId.startsWith('REJECT_'))
        await handleRejection(buttonId.replace('REJECT_', ''), from);

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

  // Learn from this approval
  await recordApproval(post.clientId, {
    imagePrompt: post.imagePrompt,
    imageProvider: post.imageProvider,
    topic: post.topic,
    theme: post.topic,
  });

  if (client.instagramAccountId && client.instagramToken) {
    try {
      const result = await instagramService.uploadToInstagram({
        igAccountId: client.instagramAccountId,
        accessToken: client.instagramToken,
        imageUrl: post.imageUrl,
        caption: post.caption,
        hashtags: post.hashtags,
      });
      await db.collection('socialPosts').doc(postId).update({
        status: 'POSTED',
        instagramPostId: result.instagramPostId,
        instagramUrl: result.instagramUrl,
        postedAt: result.postedAt.toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await whatsappService.sendTextMessage(
        from,
        `✅ Post approved and published to Instagram!\n🔗 ${result.instagramUrl}`
      );
    } catch (err) {
      logger.error('Auto Instagram upload failed:', err.message);
      await whatsappService.sendTextMessage(from, '✅ Post approved! Publishing to Instagram shortly.');
    }
  } else {
    await whatsappService.sendTextMessage(from, '✅ Post approved!');
  }
}

/* ─── REJECT → ask for feedback ───────────────────────────────────────────── */
async function handleRejection(postId, from) {
  await db.collection('socialPosts').doc(postId).update({
    status: 'AWAITING_FEEDBACK',
    updatedAt: new Date().toISOString(),
  });

  await whatsappService.sendTextMessage(
    from,
    `❌ Post rejected.\n\nPlease tell me what changes you'd like:\n• Different colors or style?\n• Different caption tone?\n• Different concept or angle?\n• Anything specific?\n\nJust reply with your feedback and I'll create a new version! 🎨`
  );
}

/* ─── FEEDBACK TEXT → regenerate post ─────────────────────────────────────── */
async function handleFeedbackText(from, feedbackText) {
  // Find client by WhatsApp number
  const clientSnap = await db.collection('socialClients')
    .where('whatsappNumber', '==', from)
    .limit(1)
    .get();

  if (clientSnap.empty) return; // not our client's number
  const client = convertDoc(clientSnap.docs[0]);

  // Find post awaiting feedback for this client
  const postSnap = await db.collection('socialPosts')
    .where('clientId', '==', client.id)
    .where('status', '==', 'AWAITING_FEEDBACK')
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .get();

  if (postSnap.empty) return; // no post waiting for feedback
  const post = convertDoc(postSnap.docs[0]);

  try {
    await whatsappService.sendTextMessage(
      from,
      '🔄 Got your feedback! Creating a new version... (this takes ~30 seconds)'
    );

    // Record rejection + feedback for learning
    await recordRejection(post.clientId, {
      imagePrompt: post.imagePrompt,
      feedback: feedbackText,
      topic: post.topic,
    });

    // Get client's learned preferences
    const learning = await getClientLearning(post.clientId);

    // Regenerate caption, hashtags, and image prompt with feedback + learning
    const [newImagePrompt, newCaption, newHashtags] = await Promise.all([
      geminiService.generateImagePromptWithFeedback({
        brandName: client.name, niche: client.niche,
        topic: post.topic, theme: post.topic, tone: client.tone,
        feedback: feedbackText,
        previousPrompt: post.imagePrompt,
        approvedStyles: learning.approvedStyles || [],
      }),
      geminiService.generateCaptionWithFeedback({
        brandName: client.name, niche: client.niche,
        tone: client.tone, targetAudience: client.targetAudience,
        topic: post.topic, feedback: feedbackText,
        previousCaption: post.caption,
      }),
      geminiService.generateHashtags({ niche: client.niche, topic: post.topic }),
    ]);

    // Generate new image
    const provider = post.imageProvider || 'DALLE';
    let newImageUrl;
    if (provider === 'REPLICATE') {
      newImageUrl = await cloudinaryService.uploadImage(
        await replicateService.generateWithReplicate(newImagePrompt), post.id
      );
    } else {
      newImageUrl = await cloudinaryService.uploadImage(
        await dalleService.generateWithDalle(newImagePrompt), post.id
      );
    }

    // Update post with new content
    await db.collection('socialPosts').doc(post.id).update({
      caption: newCaption.trim(),
      hashtags: newHashtags.trim(),
      imageUrl: newImageUrl,
      imagePrompt: newImagePrompt,
      lastFeedback: feedbackText,
      status: 'SENT_FOR_APPROVAL',
      updatedAt: new Date().toISOString(),
    });

    // Send new approval request
    const dateStr = new Date(post.date).toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    await whatsappService.sendApprovalButtons(from, {
      postId: post.id,
      caption: newCaption,
      hashtags: newHashtags,
      date: dateStr,
      imageUrl: newImageUrl,
    });

  } catch (err) {
    logger.error('Feedback regeneration failed:', err.message);
    await whatsappService.sendTextMessage(
      from,
      '❌ Sorry, something went wrong creating the new version. Please try again.'
    );
  }
}

/* ─── LEARNING SYSTEM ──────────────────────────────────────────────────────── */
async function recordApproval(clientId, data) {
  try {
    const ref = db.collection('socialClientLearning').doc(clientId);
    const doc = await ref.get();
    const existing = doc.exists ? (doc.data().approvedStyles || []) : [];
    existing.push({
      imagePrompt: data.imagePrompt,
      imageProvider: data.imageProvider,
      topic: data.topic,
      approvedAt: new Date().toISOString(),
    });
    // Keep only last 15 approved styles
    await ref.set({
      approvedStyles: existing.slice(-15),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    logger.error('Learning record (approval) failed:', err.message);
  }
}

async function recordRejection(clientId, data) {
  try {
    const ref = db.collection('socialClientLearning').doc(clientId);
    const doc = await ref.get();
    const existing = doc.exists ? (doc.data().rejectedStyles || []) : [];
    existing.push({
      imagePrompt: data.imagePrompt,
      feedback: data.feedback,
      topic: data.topic,
      rejectedAt: new Date().toISOString(),
    });
    await ref.set({
      rejectedStyles: existing.slice(-15),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
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
