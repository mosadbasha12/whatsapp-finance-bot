const twilio = require('twilio');

let twilioClient;

function hasMetaConfig() {
  return Boolean(process.env.META_WHATSAPP_TOKEN && process.env.META_PHONE_NUMBER_ID);
}

function getTwilioClient() {
  if (!twilioClient) {
    twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
  }
  return twilioClient;
}

function normalizeMetaRecipient(to) {
  return String(to || '')
    .replace(/^whatsapp:/, '')
    .replace(/^\+/, '');
}

async function sendViaMeta(to, message) {
  const response = await fetch(
    `https://graph.facebook.com/v20.0/${process.env.META_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.META_WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizeMetaRecipient(to),
        type: 'text',
        text: {
          preview_url: false,
          body: message
        }
      })
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Meta WhatsApp send failed: ${response.status} ${errorBody}`);
  }

  return response.json();
}

async function sendViaTwilio(to, message) {
  return getTwilioClient().messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to,
    body: message
  });
}

async function sendWhatsApp(to, message) {
  if (hasMetaConfig()) {
    return sendViaMeta(to, message);
  }

  return sendViaTwilio(to, message);
}

module.exports = {
  sendWhatsApp
};
