const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
let sheetsClient;

function getServiceAccountKey() {
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!rawKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is required');
  }

  try {
    const decoded = Buffer.from(rawKey, 'base64').toString('utf8');
    if (decoded.trim().startsWith('{')) {
      return JSON.parse(decoded);
    }
  } catch (_) {
    // The key is probably plain JSON, not base64.
  }

  const parsed = JSON.parse(rawKey);
  if (parsed.private_key) {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }
  return parsed;
}

function getSheetsClient() {
  if (sheetsClient) {
    return sheetsClient;
  }

  const auth = new google.auth.GoogleAuth({
    credentials: getServiceAccountKey(),
    scopes: SCOPES
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

async function appendToSheet(tabName, rowData) {
  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${tabName}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [rowData]
    }
  });
}

async function getSheetData(tabName) {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${tabName}!A:Z`
  });

  const rows = response.data.values || [];
  if (rows.length === 0) {
    return [];
  }

  const [headers, ...records] = rows;
  return records.map((row) => {
    return headers.reduce((record, header, index) => {
      record[header] = row[index] || '';
      return record;
    }, {});
  });
}

module.exports = {
  appendToSheet,
  getSheetData
};
