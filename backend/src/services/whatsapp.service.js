const axios = require('axios');
const logger = require('../utils/logger');

const WA_BASE = 'https://graph.facebook.com/v18.0';
const PHONE_ID = () => process.env.WHATSAPP_PHONE_NUMBER_ID;
const TOKEN = () => process.env.WHATSAPP_API_TOKEN;

function waHeaders() {
  return { Authorization: `Bearer ${TOKEN()}`, 'Content-Type': 'application/json' };
}

async function sendImage(to, imageUrl) {
  const res = await axios.post(
    `${WA_BASE}/${PHONE_ID()}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'image',
      image: { link: imageUrl },
    },
    { headers: waHeaders() }
  );
  return res.data;
}

async function sendApprovalButtons(to, { postId, caption, hashtags, date, imageUrl }) {
  // First send the image
  await sendImage(to, imageUrl);

  // Then send interactive approval message
  const bodyText = `🗓 *${date}*\n\n${caption}\n\n${hashtags}\n\n📋 Please review and approve this post:`;

  const res = await axios.post(
    `${WA_BASE}/${PHONE_ID()}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText.substring(0, 1024) },
        action: {
          buttons: [
            { type: 'reply', reply: { id: `APPROVE_${postId}`, title: '✅ Approve' } },
            { type: 'reply', reply: { id: `REJECT_${postId}`, title: '❌ Reject' } },
          ],
        },
      },
    },
    { headers: waHeaders() }
  );
  return res.data;
}

async function sendReminder(to, { postId, caption, date }) {
  const res = await axios.post(
    `${WA_BASE}/${PHONE_ID()}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: `⏰ *Reminder* - Pending post approval for *${date}*\n\nTopic: ${caption.substring(0, 100)}...\n\nPlease approve or reject:`,
        },
        action: {
          buttons: [
            { type: 'reply', reply: { id: `APPROVE_${postId}`, title: '✅ Approve' } },
            { type: 'reply', reply: { id: `REJECT_${postId}`, title: '❌ Reject' } },
          ],
        },
      },
    },
    { headers: waHeaders() }
  );
  return res.data;
}

async function sendTextMessage(to, text) {
  const res = await axios.post(
    `${WA_BASE}/${PHONE_ID()}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    },
    { headers: waHeaders() }
  );
  return res.data;
}

module.exports = { sendImage, sendApprovalButtons, sendReminder, sendTextMessage };
