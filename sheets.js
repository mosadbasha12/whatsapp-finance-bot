const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const DEFAULT_SHEET_ID = '1WrulIWkcdLDtrqaa2ZBZALiQOtVRUSNvaT88YAHgI40';
const REQUIRED_TABS = {
  Transactions: ['ID', 'Date', 'Type', 'Amount', 'Category', 'Account', 'Note'],
  Accounts: ['Name', 'Type', 'Balance', 'LastUpdated'],
  Categories: ['Name', 'Type', 'Icon', 'Status'],
  MonthlySummary: ['Month', 'TotalIncome', 'TotalExpenses', 'NetFlow']
};

let sheetsClient;
let isSheetReady = false;

function getSpreadsheetId() {
  return process.env.GOOGLE_SHEET_ID || DEFAULT_SHEET_ID;
}

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

async function ensureSheetStructure() {
  if (isSheetReady) {
    return;
  }

  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTabs = new Set(spreadsheet.data.sheets.map((sheet) => sheet.properties.title));
  const missingTabs = Object.keys(REQUIRED_TABS).filter((tabName) => !existingTabs.has(tabName));

  if (missingTabs.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: missingTabs.map((tabName) => ({
          addSheet: {
            properties: {
              title: tabName
            }
          }
        }))
      }
    });
  }

  for (const [tabName, headers] of Object.entries(REQUIRED_TABS)) {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!1:1`
    });

    if (!response.data.values || response.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tabName}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [headers]
        }
      });
    }
  }

  const accounts = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Accounts!A2:D'
  });

  if (!accounts.data.values || accounts.data.values.length === 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Accounts!A:D',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [['كاش', 'cash', 0, new Date().toISOString().slice(0, 10)]]
      }
    });
  }

  isSheetReady = true;
}

async function appendToSheet(tabName, rowData) {
  const sheets = getSheetsClient();
  await ensureSheetStructure();

  await sheets.spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
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
  await ensureSheetStructure();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
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
  getSheetData,
  ensureSheetStructure
};
