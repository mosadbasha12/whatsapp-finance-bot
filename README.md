# WhatsApp Finance Bot

بوت واتساب عربي لإدارة المصروفات والدخل باستخدام Node.js و Twilio WhatsApp API و Google Sheets.

## الملفات

- `index.js`: Express server و endpoint باسم `/webhook`
- `bot.js`: منطق البوت و state machine
- `sheets.js`: دوال Google Sheets
- `twilio.js`: إرسال رسائل واتساب
- `sessions.js`: تخزين الجلسات في الذاكرة لمدة 10 دقائق
- `.env.example`: متغيرات البيئة المطلوبة

## Google Sheet

أنشئ Google Sheet يحتوي على 4 tabs بنفس الأسماء والهيدر التالي:

### Transactions

`ID, Date, Type, Amount, Category, Account, Note`

### Accounts

`Name, Type, Balance, LastUpdated`

### Categories

`Name, Type, Icon, Status`

### MonthlySummary

`Month, TotalIncome, TotalExpenses, NetFlow`

اكتب الشهر بصيغة `YYYY-MM` مثل `2026-05`.

## Google Sheets API

1. افتح [Google Cloud Console](https://console.cloud.google.com/).
2. أنشئ Project أو استخدم Project موجود.
3. فعّل Google Sheets API.
4. أنشئ Service Account.
5. أنشئ JSON key للـ Service Account.
6. شارك Google Sheet مع `client_email` الموجود في ملف الـ JSON بصلاحية Editor.
7. ضع JSON key كامل في `GOOGLE_SERVICE_ACCOUNT_KEY` داخل `.env`.

يمكنك وضع المفتاح كـ JSON عادي، أو base64 encoded JSON.

## Twilio WhatsApp Sandbox

1. افتح [Twilio Console](https://console.twilio.com/).
2. من Messaging اختر WhatsApp Sandbox.
3. اتبع تعليمات join من رقم واتساب الخاص بك.
4. ضع رقم sandbox في `TWILIO_WHATSAPP_FROM`، غالبًا:

```env
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

5. شغّل السيرفر محليًا ثم استخدم ngrok أو أي tunnel:

```bash
npm install
npm run dev
ngrok http 3000
```

6. ضع رابط الـ webhook في Twilio بهذا الشكل:

```text
https://your-ngrok-url.ngrok-free.app/webhook
```

واختر HTTP POST.

## التشغيل

انسخ ملف البيئة:

```bash
cp .env.example .env
```

ثم حدّث القيم وشغّل:

```bash
npm install
npm start
```

## النشر على Render بدون تشغيل محلي

المشروع يحتوي على `render.yaml` جاهز للنشر كـ Web Service.

1. ارفع المشروع على GitHub.
2. افتح Render ثم اختر New + Blueprint.
3. اختار GitHub repo الخاص بالمشروع.
4. Render سيقرأ `render.yaml` ويستخدم:

```text
Build Command: npm install
Start Command: npm start
Health Check: /
```

5. أضف القيم السرية في Environment Variables:

```env
TWILIO_SID=...
TWILIO_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
GOOGLE_SHEET_ID=...
GOOGLE_SERVICE_ACCOUNT_KEY=...
```

6. بعد اكتمال النشر، استخدم رابط Render في Twilio:

```text
https://your-render-service.onrender.com/webhook
```

واختر HTTP POST.

## أمثلة رسائل

عرض القائمة:

```text
قائمة
```

تسجيل مصروف مباشر:

```text
صرفت 100 مواصلات
```

تسجيل دخل:

```text
جالي فلوس
```

## القائمة الرئيسية

```text
1️⃣ المصروفات
2️⃣ الدخل
3️⃣ المبيعات
4️⃣ الحسابات
5️⃣ التقارير
0️⃣ إعدادات
```

## ملاحظات

- الجلسات محفوظة في الذاكرة وتنتهي بعد 10 دقائق من عدم النشاط.
- في حالة فشل Google Sheets أو Twilio، يرسل البوت: `حصل خطأ، حاول تاني`.
- كل ردود المستخدمين داخل البوت باللغة العربية.
