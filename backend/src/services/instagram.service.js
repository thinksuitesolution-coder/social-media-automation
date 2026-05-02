const axios = require('axios');
const logger = require('../utils/logger');

const IG_BASE = 'https://graph.facebook.com/v18.0';

// Scopes required for Instagram Content Publishing
const IG_SCOPES = [
  'instagram_content_publish',
  'instagram_manage_comments',
  'instagram_manage_insights',
  'pages_show_list',
  'pages_read_engagement',
  'public_profile',
].join(',');

function getOAuthURL(redirectUri, state) {
  const params = new URLSearchParams({
    client_id:     process.env.FACEBOOK_APP_ID,
    redirect_uri:  redirectUri,
    scope:         IG_SCOPES,
    response_type: 'code',
    state:         state || 'instagram_oauth',
  });
  return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
}

async function exchangeCodeForToken(code, redirectUri) {
  // Step 1: Short-lived user token
  const shortRes = await axios.get(`${IG_BASE}/oauth/access_token`, {
    params: {
      client_id:     process.env.FACEBOOK_APP_ID,
      client_secret: process.env.FACEBOOK_APP_SECRET,
      redirect_uri:  redirectUri,
      code,
    },
  });
  const shortToken = shortRes.data.access_token;

  // Step 2: Long-lived token (~60 days)
  const longRes = await axios.get(`${IG_BASE}/oauth/access_token`, {
    params: {
      grant_type:       'fb_exchange_token',
      client_id:        process.env.FACEBOOK_APP_ID,
      client_secret:    process.env.FACEBOOK_APP_SECRET,
      fb_exchange_token: shortToken,
    },
  });
  const longToken  = longRes.data.access_token;
  const expiresIn  = longRes.data.expires_in || 5184000; // default 60 days

  // Step 3: Get Facebook Pages the user manages
  const pagesRes = await axios.get(`${IG_BASE}/me/accounts`, {
    params: { access_token: longToken },
  });
  const pages = pagesRes.data.data || [];

  // Step 4: Find Instagram Business Account linked to each Page
  const instagramAccounts = [];
  for (const page of pages) {
    try {
      const igLinkRes = await axios.get(`${IG_BASE}/${page.id}`, {
        params: { fields: 'instagram_business_account', access_token: page.access_token },
      });
      const igId = igLinkRes.data.instagram_business_account?.id;
      if (!igId) continue;

      const igInfoRes = await axios.get(`${IG_BASE}/${igId}`, {
        params: {
          fields:       'name,username,profile_picture_url,followers_count',
          access_token: page.access_token,
        },
      });
      instagramAccounts.push({
        igAccountId:      igId,
        pageId:           page.id,
        pageName:         page.name,
        pageAccessToken:  page.access_token,
        username:         igInfoRes.data.username,
        name:             igInfoRes.data.name,
        profilePic:       igInfoRes.data.profile_picture_url,
        followersCount:   igInfoRes.data.followers_count,
      });
    } catch (err) {
      logger.warn(`Instagram lookup failed for page ${page.id}: ${err.message}`);
    }
  }

  const tokenExpiry = new Date();
  tokenExpiry.setSeconds(tokenExpiry.getSeconds() + expiresIn);

  return { longToken, tokenExpiry: tokenExpiry.toISOString(), instagramAccounts };
}


async function uploadToInstagram({ igAccountId, accessToken, imageUrl, caption, hashtags }) {
  // Fallback to global credentials if client has none
  igAccountId = igAccountId || process.env.INSTAGRAM_ACCOUNT_ID;
  accessToken = accessToken || process.env.INSTAGRAM_ACCESS_TOKEN;
  const fullCaption = `${caption}\n\n${hashtags}`;

  // Step 1: Create media container
  const containerRes = await axios.post(`${IG_BASE}/${igAccountId}/media`, {
    image_url: imageUrl,
    caption: fullCaption.substring(0, 2200),
    access_token: accessToken,
  });
  const creationId = containerRes.data.id;

  // Step 2: Wait for container to be ready
  await waitForContainer(igAccountId, creationId, accessToken);

  // Step 3: Publish the container
  const publishRes = await axios.post(`${IG_BASE}/${igAccountId}/media_publish`, {
    creation_id: creationId,
    access_token: accessToken,
  });
  const igPostId = publishRes.data.id;

  // Step 4: Get post permalink
  const postData = await axios.get(`${IG_BASE}/${igPostId}`, {
    params: { fields: 'permalink,timestamp', access_token: accessToken },
  });

  return {
    instagramPostId: igPostId,
    instagramUrl: postData.data.permalink,
    postedAt: new Date(postData.data.timestamp || Date.now()),
  };
}

async function waitForContainer(igAccountId, creationId, accessToken, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const statusRes = await axios.get(`${IG_BASE}/${creationId}`, {
      params: { fields: 'status_code,status', access_token: accessToken },
    });
    const { status_code } = statusRes.data;
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') {
      throw new Error(`Media container failed with status: ${status_code}`);
    }
  }
  throw new Error('Media container timed out');
}

async function getAccountInfo(igAccountId, accessToken) {
  const res = await axios.get(`${IG_BASE}/${igAccountId}`, {
    params: { fields: 'name,username,followers_count,media_count,profile_picture_url', access_token: accessToken },
  });
  return res.data;
}

async function refreshLongLivedToken(shortToken) {
  const res = await axios.get(`${IG_BASE}/oauth/access_token`, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: process.env.FACEBOOK_APP_ID,
      client_secret: process.env.FACEBOOK_APP_SECRET,
      fb_exchange_token: shortToken,
    },
  });
  return res.data;
}

module.exports = { uploadToInstagram, getAccountInfo, refreshLongLivedToken, getOAuthURL, exchangeCodeForToken };
