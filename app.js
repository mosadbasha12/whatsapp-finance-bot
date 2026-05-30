require('dotenv').config();

const express = require('express');
const { handleIncomingMessage } = require('./bot');
const { sendWhatsApp } = require('./twilio');

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'whatsapp-finance-bot'
  });
});

app.post('/webhook', async (req, res) => {
  const from = req.body.From || req.body.from;
  const body = req.body.Body || req.body.body || '';

  if (!from) {
    return res.status(400).json({ error: 'Missing sender' });
  }

  try {
    const reply = await handleIncomingMessage(from, body);
    await sendWhatsApp(from, reply);
    return res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);

    try {
      await sendWhatsApp(from, 'حصل خطأ، حاول تاني');
    } catch (sendError) {
      console.error('Failed to send error message:', sendError);
    }

    return res.status(200).send('OK');
  }
});

module.exports = app;
