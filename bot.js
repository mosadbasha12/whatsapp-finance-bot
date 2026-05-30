const { appendToSheet, getSheetData } = require('./sheets');
const { getSession, resetSession, updateSession } = require('./sessions');

const MAIN_MENU = [
  'أهلًا بيك في SCORPION 🦂',
  'مساعدك المالي لتسجيل المصروفات والدخل بسرعة.',
  '',
  'اختار من القائمة:',
  '',
  '1️⃣ المصروفات',
  '2️⃣ الدخل',
  '3️⃣ المبيعات',
  '4️⃣ الحسابات',
  '5️⃣ التقارير',
  '0️⃣ إعدادات'
].join('\n');

const INCOME_TYPES = ['مرتب', 'بيع منتج', 'دين اتسدد', 'غير ذلك'];
const SETTINGS_MESSAGE = '⚙️ الإعدادات متاحة قريبًا.\nاكتب "قائمة" للرجوع للقائمة الرئيسية.';

function normalizeArabicDigits(text) {
  const map = {
    '٠': '0',
    '١': '1',
    '٢': '2',
    '٣': '3',
    '٤': '4',
    '٥': '5',
    '٦': '6',
    '٧': '7',
    '٨': '8',
    '٩': '9',
    '۰': '0',
    '۱': '1',
    '۲': '2',
    '۳': '3',
    '۴': '4',
    '۵': '5',
    '۶': '6',
    '۷': '7',
    '۸': '8',
    '۹': '9'
  };

  return text.replace(/[٠-٩۰-۹]/g, (digit) => map[digit]);
}

function toArabicDigits(value) {
  const digits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(value).replace(/\d/g, (digit) => digits[Number(digit)]);
}

function formatCurrency(amount) {
  const number = Number(amount) || 0;
  const formatted = new Intl.NumberFormat('ar-EG', {
    maximumFractionDigits: 2
  }).format(number);

  return `${formatted} جنيه`;
}

function parseAmount(text) {
  const normalized = normalizeArabicDigits(text).replace(/,/g, '');
  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function parseExpense(text) {
  const normalized = normalizeArabicDigits(text).trim();
  const match = normalized.match(/^صرفت\s+(\d+(?:[.,]\d+)?)\s*(.*)$/i);

  if (!match) {
    return null;
  }

  return {
    amount: Number(match[1].replace(',', '.')),
    category: match[2] ? match[2].trim() : 'مصروفات',
    note: match[2] ? match[2].trim() : ''
  };
}

function isMainMenuTrigger(text) {
  const normalized = text.trim().toLowerCase();
  return ['menu', 'قائمة', 'القائمة'].includes(normalized);
}

function getTodayDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function getCurrentMonth() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit'
  }).format(new Date());
}

function makeTransactionId() {
  return `TX-${Date.now()}`;
}

async function getActiveAccounts() {
  const accounts = await getSheetData('Accounts');
  return accounts.filter((account) => account.Name);
}

function formatAccountList(accounts) {
  if (accounts.length === 0) {
    return 'مفيش حسابات متسجلة في شيت Accounts.';
  }

  return accounts
    .map((account, index) => {
      const balance = account.Balance ? ` - الرصيد: ${formatCurrency(account.Balance)}` : '';
      return `${toArabicDigits(index + 1)}. ${account.Name}${balance}`;
    })
    .join('\n');
}

async function askForAccount(phone, nextState, data) {
  const accounts = await getActiveAccounts();
  updateSession(phone, {
    state: nextState,
    data: {
      ...data,
      accounts
    }
  });

  return `اختار الحساب:\n${formatAccountList(accounts)}`;
}

function buildIncomeTypesMessage() {
  return [
    'نوع الدخل؟',
    ...INCOME_TYPES.map((type, index) => `${toArabicDigits(index + 1)}. ${type}`)
  ].join('\n');
}

async function logTransaction({ type, amount, category, account, note }) {
  const row = [
    makeTransactionId(),
    getTodayDate(),
    type,
    amount,
    category,
    account,
    note || ''
  ];

  await appendToSheet('Transactions', row);
}

function getSelectedByNumber(text, items) {
  const index = Number(normalizeArabicDigits(text).trim()) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= items.length) {
    return null;
  }
  return items[index];
}

async function handleExpenseAccountSelection(phone, text, session) {
  const account = getSelectedByNumber(text, session.data.accounts || []);

  if (!account) {
    return 'اختيار غير صحيح. ابعت رقم الحساب من القائمة.';
  }

  await logTransaction({
    type: 'expense',
    amount: session.data.amount,
    category: session.data.category || 'مصروفات',
    account: account.Name,
    note: session.data.note || ''
  });

  resetSession(phone);
  return `✅ تم تسجيل ${formatCurrency(session.data.amount)} - ${session.data.category || 'مصروفات'} في ${account.Name}`;
}

async function handleIncomeAccountSelection(phone, text, session) {
  const account = getSelectedByNumber(text, session.data.accounts || []);

  if (!account) {
    return 'اختيار غير صحيح. ابعت رقم الحساب من القائمة.';
  }

  await logTransaction({
    type: 'income',
    amount: session.data.amount,
    category: session.data.category,
    account: account.Name,
    note: session.data.note || ''
  });

  resetSession(phone);
  return [
    '✅ تم تسجيل الدخل',
    `المبلغ: ${formatCurrency(session.data.amount)}`,
    `النوع: ${session.data.category}`,
    `الحساب: ${account.Name}`
  ].join('\n');
}

async function buildDailyReport() {
  const transactions = await getSheetData('Transactions');
  const today = getTodayDate();
  const todayTransactions = transactions.filter((row) => row.Date === today);

  const totals = todayTransactions.reduce(
    (acc, row) => {
      const amount = Number(row.Amount) || 0;
      if (row.Type === 'income') acc.income += amount;
      if (row.Type === 'expense') acc.expense += amount;
      return acc;
    },
    { income: 0, expense: 0 }
  );

  return [
    '📊 تقرير اليوم',
    `📅 ${today}`,
    `💰 الدخل: ${formatCurrency(totals.income)}`,
    `💸 المصروفات: ${formatCurrency(totals.expense)}`,
    `🧾 الصافي: ${formatCurrency(totals.income - totals.expense)}`
  ].join('\n');
}

async function buildMonthlyReport() {
  const summaries = await getSheetData('MonthlySummary');
  const currentMonth = getCurrentMonth();
  const summary = summaries.find((row) => row.Month === currentMonth);

  if (!summary) {
    return `📅 مفيش ملخص شهري لشهر ${currentMonth} في شيت MonthlySummary.`;
  }

  return [
    `📆 تقرير شهر ${currentMonth}`,
    `💰 إجمالي الدخل: ${formatCurrency(summary.TotalIncome)}`,
    `💸 إجمالي المصروفات: ${formatCurrency(summary.TotalExpenses)}`,
    `🧾 صافي التدفق: ${formatCurrency(summary.NetFlow)}`
  ].join('\n');
}

async function buildAccountsReport() {
  const accounts = await getActiveAccounts();
  return `🏦 الحسابات:\n${formatAccountList(accounts)}`;
}

async function handleReportsMenu(phone) {
  updateSession(phone, { state: 'REPORTS_MENU', data: {} });
  return ['اختار التقرير:', '1. تقرير اليوم', '2. تقرير الشهر', '0. القائمة الرئيسية'].join('\n');
}

async function handleReportsSelection(phone, text) {
  const choice = normalizeArabicDigits(text).trim();

  if (choice === '1') {
    resetSession(phone);
    return buildDailyReport();
  }

  if (choice === '2') {
    resetSession(phone);
    return buildMonthlyReport();
  }

  if (choice === '0') {
    resetSession(phone);
    return MAIN_MENU;
  }

  return 'اختيار غير صحيح. ابعت 1 لتقرير اليوم أو 2 لتقرير الشهر.';
}

async function handleIncomingMessage(phone, rawText) {
  const text = (rawText || '').trim();

  if (!text || isMainMenuTrigger(text)) {
    resetSession(phone);
    return MAIN_MENU;
  }

  const directExpense = parseExpense(text);
  if (directExpense) {
    return askForAccount(phone, 'EXPENSE_ACCOUNT', directExpense);
  }

  const normalized = normalizeArabicDigits(text).toLowerCase();
  const session = getSession(phone);

  if (['جالي فلوس', 'جالى فلوس'].includes(text)) {
    updateSession(phone, { state: 'INCOME_AMOUNT', data: {} });
    return 'تمام، جالك كام؟';
  }

  if (session.state === 'EXPENSE_AMOUNT') {
    const amount = parseAmount(text);
    if (!amount) {
      return 'ابعت المبلغ بصيغة واضحة، مثال: صرفت 100 مواصلات';
    }

    const category = text.replace(/[٠-٩۰-۹\d.,]+/, '').trim() || 'مصروفات';
    return askForAccount(phone, 'EXPENSE_ACCOUNT', {
      amount,
      category,
      note: category === 'مصروفات' ? '' : category
    });
  }

  if (session.state === 'EXPENSE_ACCOUNT') {
    return handleExpenseAccountSelection(phone, text, session);
  }

  if (session.state === 'INCOME_AMOUNT') {
    const amount = parseAmount(text);
    if (!amount) {
      return 'ابعت مبلغ صحيح، مثال: 5000';
    }

    if (session.data.category) {
      return askForAccount(phone, 'INCOME_ACCOUNT', {
        ...session.data,
        amount
      });
    }

    updateSession(phone, {
      state: 'INCOME_TYPE',
      data: {
        ...session.data,
        amount
      }
    });
    return buildIncomeTypesMessage();
  }

  if (session.state === 'INCOME_TYPE') {
    const selectedType = getSelectedByNumber(text, INCOME_TYPES) || text;

    return askForAccount(phone, 'INCOME_ACCOUNT', {
      ...session.data,
      category: selectedType
    });
  }

  if (session.state === 'INCOME_ACCOUNT') {
    return handleIncomeAccountSelection(phone, text, session);
  }

  if (session.state === 'REPORTS_MENU') {
    return handleReportsSelection(phone, text);
  }

  if (normalized === '1') {
    updateSession(phone, { state: 'EXPENSE_AMOUNT', data: {} });
    return 'اكتب المبلغ والوصف، مثال: صرفت 100 مواصلات';
  }

  if (normalized === '2') {
    updateSession(phone, { state: 'INCOME_AMOUNT', data: {} });
    return 'جالك كام؟';
  }

  if (normalized === '3') {
    updateSession(phone, {
      state: 'INCOME_AMOUNT',
      data: { category: 'بيع منتج' }
    });
    return 'قيمة البيع كام؟';
  }

  if (normalized === '4') {
    return buildAccountsReport();
  }

  if (normalized === '5') {
    return handleReportsMenu(phone);
  }

  if (normalized === '0') {
    resetSession(phone);
    return SETTINGS_MESSAGE;
  }

  return `مش فاهم الرسالة دي.\nاكتب "قائمة" لعرض الاختيارات.`;
}

module.exports = {
  handleIncomingMessage,
  formatCurrency
};
