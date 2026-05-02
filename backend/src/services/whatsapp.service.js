const axios  = require('axios');
const logger = require('../utils/logger');

const WA_BASE = 'https://graph.facebook.com/v18.0';
const PHONE_ID = () => process.env.WHATSAPP_PHONE_NUMBER_ID;
const TOKEN    = () => process.env.WHATSAPP_API_TOKEN;

function waHeaders() {
  return { Authorization: `Bearer ${TOKEN()}`, 'Content-Type': 'application/json' };
}

async function sendImage(to, imageUrl) {
  const res = await axios.post(
    `${WA_BASE}/${PHONE_ID()}/messages`,
    { messaging_product: 'whatsapp', to, type: 'image', image: { link: imageUrl } },
    { headers: waHeaders() }
  );
  return res.data;
}

// Template-based approval — works for business-initiated messages (outside 24h window).
// Requires an approved Meta template named via WHATSAPP_APPROVAL_TEMPLATE_NAME env var.
//
// Expected template structure:
//   Header  : image (1 variable — post image URL)
//   Body    : "📅 {{1}}\n\n{{2}}\n\nPlease review and approve this post:"
//   Buttons : Quick Reply 0 = "✅ Approve", Quick Reply 1 = "❌ Reject"
//             (payloads are set dynamically to APPROVE_<postId> / REJECT_<postId>)
async function sendApprovalTemplate(to, { postId, caption, date, imageUrl }) {
  const templateName = process.env.WHATSAPP_APPROVAL_TEMPLATE_NAME;
  if (!templateName) throw new Error('WHATSAPP_APPROVAL_TEMPLATE_NAME not set');

  const preview = caption.length > 200 ? caption.substring(0, 197) + '…' : caption;

  const res = await axios.post(
    `${WA_BASE}/${PHONE_ID()}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name:     templateName,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'en' },
        components: [
          {
            type: 'header',
            parameters: [{ type: 'image', image: { link: imageUrl } }],
          },
          {
            type: 'body',
            parameters: [
              { type: 'text', text: date },
              { type: 'text', text: preview },
            ],
          },
          {
            type: 'button', sub_type: 'quick_reply', index: '0',
            parameters: [{ type: 'payload', payload: `APPROVE_${postId}` }],
          },
          {
            type: 'button', sub_type: 'quick_reply', index: '1',
            parameters: [{ type: 'payload', payload: `REJECT_${postId}` }],
          },
        ],
      },
    },
    { headers: waHeaders() }
  );
  return res.data;
}

// Interactive approval (works inside the 24h customer-service window).
// Falls back automatically if template is not configured.
async function sendApprovalButtons(to, { postId, caption, hashtags, date, imageUrl }) {
  // Try template first (works anytime), fallback to interactive (24h window only)
  if (process.env.WHATSAPP_APPROVAL_TEMPLATE_NAME) {
    try {
      return await sendApprovalTemplate(to, { postId, caption, date, imageUrl });
    } catch (err) {
      logger.warn(`Template send failed, falling back to interactive: ${err.message}`);
    }
  }

  await sendImage(to, imageUrl);

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

// Reminder — uses template if available, else interactive buttons
async function sendReminder(to, { postId, caption, date }) {
  const reminderTemplate = process.env.WHATSAPP_REMINDER_TEMPLATE_NAME;

  if (reminderTemplate) {
    try {
      const preview = caption.length > 100 ? caption.substring(0, 97) + '…' : caption;
      const res = await axios.post(
        `${WA_BASE}/${PHONE_ID()}/messages`,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name:     reminderTemplate,
            language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'en' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: date },
                  { type: 'text', text: preview },
                ],
              },
              {
                type: 'button', sub_type: 'quick_reply', index: '0',
                parameters: [{ type: 'payload', payload: `APPROVE_${postId}` }],
              },
              {
                type: 'button', sub_type: 'quick_reply', index: '1',
                parameters: [{ type: 'payload', payload: `REJECT_${postId}` }],
              },
            ],
          },
        },
        { headers: waHeaders() }
      );
      return res.data;
    } catch (err) {
      logger.warn(`Reminder template failed, falling back to interactive: ${err.message}`);
    }
  }

  // Fallback interactive
  const res = await axios.post(
    `${WA_BASE}/${PHONE_ID()}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: `⏰ *Reminder* — Pending post approval for *${date}*\n\nTopic: ${caption.substring(0, 100)}...\n\nPlease approve or reject:`,
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
    { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } },
    { headers: waHeaders() }
  );
  return res.data;
}

module.exports = { sendImage, sendApprovalButtons, sendApprovalTemplate, sendReminder, sendTextMessage };
