const cron = require('node-cron');
const { db, convertDoc, snapToArr } = require('./firebase');
const instagramService = require('../services/instagram.service');
const whatsappService = require('../services/whatsapp.service');
const logger = require('./logger');

function startOfHour(date) {
  const d = new Date(date); d.setMinutes(0, 0, 0); return d.toISOString();
}
function endOfHour(date) {
  const d = new Date(date); d.setMinutes(59, 59, 999); return d.toISOString();
}

async function autoPublishApprovedPosts() {
  const now = new Date();
  if (![9, 12, 18].includes(now.getHours())) return;

  const snap = await db.collection('socialPosts')
    .where('status', '==', 'APPROVED')
    .where('scheduledTime', '>=', startOfHour(now))
    .where('scheduledTime', '<=', endOfHour(now))
    .get();

  logger.info(`Scheduler: ${snap.size} posts to publish`);

  for (const postDoc of snap.docs) {
    const post = convertDoc(postDoc);
    try {
      const clientDoc = await db.collection('socialClients').doc(post.clientId).get();
      const client = convertDoc(clientDoc);
      if (!client.instagramAccountId || !client.instagramToken) continue;

      const result = await instagramService.uploadToInstagram({
        igAccountId: client.instagramAccountId, accessToken: client.instagramToken,
        imageUrl: post.imageUrl, caption: post.caption, hashtags: post.hashtags,
      });

      await db.collection('socialPosts').doc(post.id).update({
        status: 'POSTED', instagramPostId: result.instagramPostId,
        instagramUrl: result.instagramUrl, postedAt: result.postedAt.toISOString(),
        updatedAt: new Date().toISOString(),
      });
      logger.info(`Scheduler: Published post ${post.id}`);
    } catch (err) {
      logger.error(`Scheduler: Failed post ${post.id}:`, err.message);
    }
  }
}

async function sendPendingReminders() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const snap = await db.collection('socialPosts')
    .where('status', '==', 'SENT_FOR_APPROVAL')
    .where('updatedAt', '<=', twentyFourHoursAgo)
    .where('reminderSentAt', '==', null)
    .get();

  for (const postDoc of snap.docs) {
    const post = convertDoc(postDoc);
    try {
      const clientDoc = await db.collection('socialClients').doc(post.clientId).get();
      const client = convertDoc(clientDoc);
      const dateStr = new Date(post.scheduledTime || post.date).toLocaleDateString('en-IN', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
      await whatsappService.sendReminder(client.whatsappNumber, { postId: post.id, caption: post.caption, date: dateStr });
      await db.collection('socialPosts').doc(post.id).update({ reminderSentAt: new Date().toISOString() });
      logger.info(`Scheduler: Reminder sent for post ${post.id}`);
    } catch (err) {
      logger.error(`Scheduler: Reminder failed for ${post.id}:`, err.message);
    }
  }
}

function initScheduler() {
  cron.schedule('0 * * * *', autoPublishApprovedPosts);
  cron.schedule('0 */2 * * *', sendPendingReminders);
  logger.info('Scheduler initialized');
}

module.exports = { initScheduler };
