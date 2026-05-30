const twilio = require('twilio');

let twilioClient;

function getTwilioClient() {
  if (!twilioClient) {
    twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
  }
  return twilioClient;
}

async function sendWhatsApp(to, message) {
  return getTwilioClient().messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to,
    body: message
  });
}

module.exports = {
  sendWhatsApp
};
