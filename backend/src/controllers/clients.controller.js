const { db, convertDoc, snapToArr } = require('../utils/firebase');

async function createClient(req, res, next) {
  try {
    const uid = req.user.uid;
    const { name, niche, tone, targetAudience, whatsappNumber, instagramAccountId, instagramToken, defaultImageProvider } = req.body;
    if (!name || !niche || !tone || !targetAudience || !whatsappNumber) {
      return res.status(400).json({ error: 'Required fields missing' });
    }
    const ref = await db.collection('socialClients').add({
      userId: uid, name, niche, tone, targetAudience, whatsappNumber,
      instagramAccountId: instagramAccountId || '',
      instagramToken: instagramToken || '',
      defaultImageProvider: defaultImageProvider || 'DALLE',
      createdAt: new Date().toISOString(),
    });
    const doc = await ref.get();
    res.status(201).json(convertDoc(doc));
  } catch (err) { next(err); }
}

async function getClients(req, res, next) {
  try {
    const uid = req.user.uid;
    const snap = await db.collection('socialClients')
      .where('userId', '==', uid)
      .orderBy('createdAt', 'desc')
      .get();
    const clients = snapToArr(snap);

    const clientsWithCounts = await Promise.all(clients.map(async (c) => {
      const [postsSnap, accountsSnap] = await Promise.all([
        db.collection('socialPosts').where('clientId', '==', c.id).where('userId', '==', uid).get(),
        db.collection('socialAccounts').where('clientId', '==', c.id).where('userId', '==', uid).get(),
      ]);
      return { ...c, _count: { posts: postsSnap.size, socialAccounts: accountsSnap.size } };
    }));

    res.json({ clients: clientsWithCounts });
  } catch (err) { next(err); }
}

async function getClient(req, res, next) {
  try {
    const uid = req.user.uid;
    const doc = await db.collection('socialClients').doc(req.params.id).get();
    if (!doc.exists || doc.data().userId !== uid) return res.status(404).json({ error: 'Client not found' });
    const client = convertDoc(doc);

    const [postsSnap, accountsSnap] = await Promise.all([
      db.collection('socialPosts').where('clientId', '==', client.id).where('userId', '==', uid).get(),
      db.collection('socialAccounts').where('clientId', '==', client.id).where('userId', '==', uid).where('isActive', '==', true).get(),
    ]);

    res.json({ ...client, socialAccounts: snapToArr(accountsSnap), _count: { posts: postsSnap.size } });
  } catch (err) { next(err); }
}

async function updateClient(req, res, next) {
  try {
    const uid = req.user.uid;
    const ref = db.collection('socialClients').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists || doc.data().userId !== uid) return res.status(404).json({ error: 'Client not found' });
    const { userId, createdAt, ...allowed } = req.body; // prevent overwriting userId
    await ref.update({ ...allowed, updatedAt: new Date().toISOString() });
    res.json(convertDoc(await ref.get()));
  } catch (err) { next(err); }
}

async function deleteClient(req, res, next) {
  try {
    const uid = req.user.uid;
    const { id } = req.params;
    const clientDoc = await db.collection('socialClients').doc(id).get();
    if (!clientDoc.exists || clientDoc.data().userId !== uid) return res.status(404).json({ error: 'Client not found' });

    const [postsSnap, accountsSnap, calendarsSnap] = await Promise.all([
      db.collection('socialPosts').where('clientId', '==', id).where('userId', '==', uid).get(),
      db.collection('socialAccounts').where('clientId', '==', id).where('userId', '==', uid).get(),
      db.collection('socialCalendars').where('clientId', '==', id).where('userId', '==', uid).get(),
    ]);

    const batch = db.batch();
    postsSnap.docs.forEach((d) => batch.delete(d.ref));
    accountsSnap.docs.forEach((d) => batch.delete(d.ref));
    calendarsSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(db.collection('socialClients').doc(id));
    await batch.commit();

    for (const cal of calendarsSnap.docs) {
      const daysSnap = await db.collection('socialCalendarDays').where('calendarId', '==', cal.id).get();
      const b = db.batch();
      daysSnap.docs.forEach((d) => b.delete(d.ref));
      await b.commit();
    }

    res.json({ message: 'Client deleted' });
  } catch (err) { next(err); }
}

async function getDashboardStats(req, res, next) {
  try {
    const uid = req.user.uid;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [clientsSnap, monthPostsSnap, pendingSnap, todaySnap, recentSnap] = await Promise.all([
      db.collection('socialClients').where('userId', '==', uid).get(),
      db.collection('socialPosts').where('userId', '==', uid).where('date', '>=', startOfMonth).get(),
      db.collection('socialPosts').where('userId', '==', uid).where('status', '==', 'SENT_FOR_APPROVAL').get(),
      db.collection('socialPosts').where('userId', '==', uid).where('status', '==', 'POSTED').where('postedAt', '>=', startOfToday).get(),
      db.collection('socialPosts').where('userId', '==', uid).orderBy('updatedAt', 'desc').limit(10).get(),
    ]);

    const recentPosts = await Promise.all(snapToArr(recentSnap).map(async (post) => {
      const clientDoc = await db.collection('socialClients').doc(post.clientId).get();
      return { ...post, client: clientDoc.exists ? { name: clientDoc.data().name } : { name: 'Unknown' } };
    }));

    res.json({
      totalClients: clientsSnap.size,
      postsThisMonth: monthPostsSnap.size,
      pendingApprovals: pendingSnap.size,
      postedToday: todaySnap.size,
      recentPosts,
    });
  } catch (err) { next(err); }
}

module.exports = { createClient, getClients, getClient, updateClient, deleteClient, getDashboardStats };
