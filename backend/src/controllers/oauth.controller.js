const instagramService = require('../services/instagram.service');
const { db }           = require('../utils/firebase');
const logger           = require('../utils/logger');

// GET /auth/instagram?clientId=xxx   (requires JWT auth)
async function initiateInstagramOAuth(req, res, next) {
  try {
    const { clientId } = req.query;
    if (!clientId) return res.status(400).json({ error: 'clientId is required' });

    // Verify client belongs to this user
    const clientDoc = await db.collection('socialClients').doc(clientId).get();
    if (!clientDoc.exists || clientDoc.data().userId !== req.user.uid) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const redirectUri = `${process.env.BACKEND_URL}/auth/instagram/callback`;
    const state = Buffer.from(
      JSON.stringify({ clientId, userId: req.user.uid, ts: Date.now() })
    ).toString('base64url');

    const oauthUrl = instagramService.getOAuthURL(redirectUri, state);
    res.json({ oauthUrl });
  } catch (err) { next(err); }
}

// GET /auth/instagram/callback   (called by Meta — no JWT, uses state param)
async function handleInstagramCallback(req, res) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const { code, state, error, error_description } = req.query;

  if (error) {
    logger.warn(`Instagram OAuth error: ${error} — ${error_description}`);
    return res.redirect(
      `${frontendUrl}/accounts?oauth=error&msg=${encodeURIComponent(error_description || error)}`
    );
  }

  if (!code || !state) {
    return res.redirect(`${frontendUrl}/accounts?oauth=error&msg=missing_params`);
  }

  let stateData;
  try {
    stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
  } catch {
    return res.redirect(`${frontendUrl}/accounts?oauth=error&msg=invalid_state`);
  }

  const { clientId, userId } = stateData;
  const redirectUri = `${process.env.BACKEND_URL}/auth/instagram/callback`;

  try {
    const tokenData = await instagramService.exchangeCodeForToken(code, redirectUri);

    if (!tokenData.instagramAccounts.length) {
      return res.redirect(
        `${frontendUrl}/accounts?oauth=error&msg=no_instagram_business_account`
      );
    }

    // Save all linked Instagram accounts; use the first one for this client
    for (const igAccount of tokenData.instagramAccounts) {
      const docId = `${clientId}_INSTAGRAM_${igAccount.igAccountId}`;
      await db.collection('socialAccounts').doc(docId).set({
        id:           docId,
        clientId,
        userId,
        platform:     'INSTAGRAM',
        accountId:    igAccount.igAccountId,
        accountName:  igAccount.username || igAccount.name,
        profilePic:   igAccount.profilePic || null,
        accessToken:  igAccount.pageAccessToken,
        tokenExpiry:  tokenData.tokenExpiry,
        isActive:     true,
        createdAt:    new Date().toISOString(),
        updatedAt:    new Date().toISOString(),
      }, { merge: true });
    }

    // Update client record with primary Instagram credentials
    const primary = tokenData.instagramAccounts[0];
    await db.collection('socialClients').doc(clientId).update({
      instagramAccountId:  primary.igAccountId,
      instagramToken:      primary.pageAccessToken,
      instagramUsername:   primary.username || null,
      instagramProfilePic: primary.profilePic || null,
      updatedAt:           new Date().toISOString(),
    });

    logger.info(`Instagram OAuth success for client ${clientId} — @${primary.username}`);
    return res.redirect(
      `${frontendUrl}/accounts?oauth=success&platform=instagram&username=${encodeURIComponent(primary.username || '')}`
    );
  } catch (err) {
    logger.error(`Instagram OAuth callback failed: ${err.message}`);
    return res.redirect(
      `${frontendUrl}/accounts?oauth=error&msg=${encodeURIComponent(err.message)}`
    );
  }
}

module.exports = { initiateInstagramOAuth, handleInstagramCallback };
