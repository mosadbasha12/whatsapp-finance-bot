require('dotenv').config();

const express = require('express');
const { handleIncomingMessage } = require('./bot');
const { sendMetaTemplate, sendWhatsApp } = require('./whatsapp');

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'whatsapp-finance-bot'
  });
});

app.get('/privacy', (_req, res) => {
  res.type('html').send(`
    <!doctype html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>SCORPION Privacy Policy</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.7; max-width: 760px; margin: 40px auto; padding: 0 20px; color: #111; }
          h1 { color: #111; }
        </style>
      </head>
      <body>
        <h1>سياسة الخصوصية - SCORPION</h1>
        <p>يستخدم SCORPION Bot رسائل واتساب التي يرسلها المستخدم لتسجيل المصروفات والدخل والحسابات في Google Sheets الخاص بالمستخدم.</p>
        <p>لا نبيع أو نشارك بيانات المستخدمين مع أطراف خارجية. يتم استخدام البيانات فقط لتنفيذ أوامر المستخدم داخل البوت.</p>
        <p>قد يتم تخزين بيانات المعاملات مثل المبلغ، النوع، الحساب، التصنيف، والملاحظات داخل Google Sheet الذي يملكه المستخدم.</p>
        <p>يمكن للمستخدم إيقاف استخدام البوت في أي وقت بعدم إرسال رسائل جديدة أو بحذف صلاحيات الوصول من Google Cloud / Meta.</p>
        <p>للتواصل بخصوص الخصوصية: 2020anamedo2020@gmail.com</p>
      </body>
    </html>
  `);
});

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

app.get('/send-test', async (req, res) => {
  const secret = req.query.secret;
  const to = req.query.to || process.env.TEST_WHATSAPP_TO;

  if (!process.env.TEST_SEND_SECRET || secret !== process.env.TEST_SEND_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!to) {
    return res.status(400).json({ error: 'Missing to' });
  }

  try {
    const result = await sendMetaTemplate(to);
    return res.json({ ok: true, result });
  } catch (error) {
    console.error('Test send error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

app.post('/webhook', async (req, res) => {
  const metaMessage = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  const from = req.body.From || req.body.from || metaMessage?.from;
  const body = req.body.Body || req.body.body || metaMessage?.text?.body || '';

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
