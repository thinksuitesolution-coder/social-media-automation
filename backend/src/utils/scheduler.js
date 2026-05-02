const cron             = require('node-cron');
const { db, convertDoc, snapToArr } = require('./firebase');
const instagramService = require('../services/instagram.service');
const whatsappService  = require('../services/whatsapp.service');
const logger           = require('./logger');

function startOfHour(date) {
  const d = new Date(date); d.setMinutes(0, 0, 0); return d.toISOString();
}
function endOfHour(date) {
  const d = new Date(date); d.setMinutes(59, 59, 999); return d.toISOString();
}

/* ─── Auto-publish approved posts at 9/12/18 ───────────────────────────────── */
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
      logger.error(`Scheduler: Failed post ${post.id}: ${err.message}`);
    }
  }
}

/* ─── Send reminders for pending posts > 24h ───────────────────────────────── */
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
      await whatsappService.sendReminder(client.whatsappNumber, {
        postId: post.id, caption: post.caption, date: dateStr,
      });
      await db.collection('socialPosts').doc(post.id).update({
        reminderSentAt: new Date().toISOString(),
      });
      logger.info(`Scheduler: Reminder sent for post ${post.id}`);
    } catch (err) {
      logger.error(`Scheduler: Reminder failed for ${post.id}: ${err.message}`);
    }
  }
}

/* ─── Weekly token auto-refresh (every Sunday at 3am UTC) ──────────────────── */
// Refreshes any Instagram token expiring within 30 days.
// Also syncs the new token to the socialClients document.
async function refreshExpiringTokens() {
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const snap = await db.collection('socialAccounts')
    .where('platform', '==', 'INSTAGRAM')
    .where('isActive', '==', true)
    .get();

  let refreshed = 0;
  for (const doc of snap.docs) {
    const account = convertDoc(doc);
    if (!account.tokenExpiry || account.tokenExpiry > thirtyDaysFromNow) continue;

    try {
      const result = await instagramService.refreshLongLivedToken(account.accessToken);
      const newExpiry = new Date();
      newExpiry.setSeconds(newExpiry.getSeconds() + (result.expires_in || 5184000));

      await db.collection('socialAccounts').doc(account.id).update({
        accessToken:  result.access_token,
        tokenExpiry:  newExpiry.toISOString(),
        updatedAt:    new Date().toISOString(),
      });

      // Sync to any client that uses this Instagram account
      const clientsSnap = await db.collection('socialClients')
        .where('instagramAccountId', '==', account.accountId)
        .get();
      for (const clientDoc of clientsSnap.docs) {
        await db.collection('socialClients').doc(clientDoc.id).update({
          instagramToken: result.access_token,
          updatedAt:      new Date().toISOString(),
        });
      }

      refreshed++;
      logger.info(`Scheduler: Token refreshed for account ${account.id}`);
    } catch (err) {
      logger.error(`Scheduler: Token refresh failed for ${account.id}: ${err.message}`);
    }
  }
  logger.info(`Scheduler: Token refresh run complete — ${refreshed} refreshed`);
}

/* ─── Init ──────────────────────────────────────────────────────────────────── */
function initScheduler() {
  cron.schedule('0 * * * *',   autoPublishApprovedPosts);  // every hour
  cron.schedule('0 */2 * * *', sendPendingReminders);      // every 2 hours
  cron.schedule('0 3 * * 0',   refreshExpiringTokens);     // every Sunday 3am UTC
  logger.info('Scheduler initialized (auto-publish + reminders + token refresh)');
}

module.exports = { initScheduler };
