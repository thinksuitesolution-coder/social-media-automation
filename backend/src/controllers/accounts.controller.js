const { db, convertDoc, snapToArr } = require('../utils/firebase');
const instagramService = require('../services/instagram.service');

async function addAccount(req, res, next) {
  try {
    const { clientId, platform, accountId, accountName, profilePic, accessToken, refreshToken, tokenExpiry } = req.body;
    if (!clientId || !platform || !accountId || !accountName || !accessToken) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const docId = `${clientId}_${platform}_${accountId}`;
    await db.collection('socialAccounts').doc(docId).set({
      id: docId, clientId, platform, accountId, accountName,
      profilePic: profilePic || null, accessToken, refreshToken: refreshToken || null,
      tokenExpiry: tokenExpiry || null, isActive: true, createdAt: new Date().toISOString(),
    }, { merge: true });

    const doc = await db.collection('socialAccounts').doc(docId).get();
    res.status(201).json(convertDoc(doc));
  } catch (err) { next(err); }
}

async function getAccounts(req, res, next) {
  try {
    const snap = await db.collection('socialAccounts')
      .where('clientId', '==', req.params.clientId)
      .orderBy('createdAt', 'desc')
      .get();
    res.json(snapToArr(snap));
  } catch (err) { next(err); }
}

async function toggleAccount(req, res, next) {
  try {
    const ref = db.collection('socialAccounts').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Account not found' });
    await ref.update({ isActive: !doc.data().isActive, updatedAt: new Date().toISOString() });
    res.json(convertDoc(await ref.get()));
  } catch (err) { next(err); }
}

async function deleteAccount(req, res, next) {
  try {
    const ref = db.collection('socialAccounts').doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: 'Account not found' });
    await ref.delete();
    res.json({ message: 'Account removed' });
  } catch (err) { next(err); }
}

async function checkHealth(req, res, next) {
  try {
    const doc = await db.collection('socialAccounts').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Account not found' });
    const account = convertDoc(doc);

    const now = new Date();
    let tokenStatus = 'VALID';
    let daysUntilExpiry = null;
    if (account.tokenExpiry) {
      const diff = new Date(account.tokenExpiry) - now;
      daysUntilExpiry = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (diff < 0) tokenStatus = 'EXPIRED';
      else if (daysUntilExpiry < 7) tokenStatus = 'EXPIRING_SOON';
    }

    let accountInfo = null;
    if (account.platform === 'INSTAGRAM' && tokenStatus !== 'EXPIRED') {
      try {
        accountInfo = await instagramService.getAccountInfo(account.accountId, account.accessToken);
      } catch { tokenStatus = 'INVALID'; }
    }

    res.json({ account, tokenStatus, daysUntilExpiry, accountInfo });
  } catch (err) { next(err); }
}

async function refreshToken(req, res, next) {
  try {
    const doc = await db.collection('socialAccounts').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Account not found' });
    const account = convertDoc(doc);

    if (account.platform === 'INSTAGRAM') {
      const result = await instagramService.refreshLongLivedToken(account.accessToken);
      const tokenExpiry = new Date();
      tokenExpiry.setSeconds(tokenExpiry.getSeconds() + result.expires_in);
      await db.collection('socialAccounts').doc(account.id).update({
        accessToken: result.access_token, tokenExpiry: tokenExpiry.toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return res.json(convertDoc(await db.collection('socialAccounts').doc(account.id).get()));
    }
    res.status(400).json({ error: `Token refresh not supported for ${account.platform}` });
  } catch (err) { next(err); }
}

module.exports = { addAccount, getAccounts, toggleAccount, deleteAccount, checkHealth, refreshToken };
