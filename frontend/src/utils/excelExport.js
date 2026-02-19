import * as XLSX from 'xlsx';

const fmtN = (n) => (n == null ? 0 : +n || 0);

// ── Styling helpers (openpyxl-style via SheetJS cell metadata) ────────────────
const HDR = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1A2560' }, patternType: 'solid' }, alignment: { horizontal: 'center' } };
const HDRL = { ...HDR, alignment: { horizontal: 'left' } };
const GREEN_HDR = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '059669' }, patternType: 'solid' }, alignment: { horizontal: 'center' } };
const PURPLE_HDR = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '4F46E5' }, patternType: 'solid' }, alignment: { horizontal: 'center' } };
const AMBER_HDR = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: 'D97706' }, patternType: 'solid' }, alignment: { horizontal: 'center' } };
const NUM_FMT = '₹#,##0;(₹#,##0);"-"';
const PCT_FMT = '0.00%';
const DATE_FMT = 'dd-mmm-yyyy';
const ALT_ROW = { fill: { fgColor: { rgb: 'F4F6FB' }, patternType: 'solid' } };
const GREEN_NUM = { font: { color: { rgb: '059669' }, bold: true }, numFmt: NUM_FMT };
const RED_NUM = { font: { color: { rgb: 'DC2626' }, bold: true }, numFmt: NUM_FMT };
const TOTAL_STYLE = { font: { bold: true }, fill: { fgColor: { rgb: 'EEF0F8' }, patternType: 'solid' } };

function applyStyles(ws, styleMap) {
  Object.entries(styleMap).forEach(([addr, style]) => {
    if (!ws[addr]) ws[addr] = { t: 'z' };
    ws[addr].s = style;
  });
}

function setColWidths(ws, widths) {
  ws['!cols'] = widths.map(w => ({ wch: w }));
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function monthLabel(m) {
  const [y, mo] = m.split('-');
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+mo - 1] + ' ' + y;
}

// ── Sheet: Summary Dashboard ──────────────────────────────────────────────────
function buildSummarySheet(data) {
  const { accounts, investments, transactions } = data;

  const regularAccounts = accounts.filter(a => !a.isRetirement);
  const retAccounts = accounts.filter(a => a.isRetirement);
  const totalLiquid = regularAccounts.reduce((s, a) => s + a.balance, 0);
  const totalRetirement = retAccounts.reduce((s, a) => s + a.balance, 0);

  const thisMonth = new Date();
  const tmStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);
  const tmTransactions = transactions.filter(t => new Date(t.date) >= tmStart);
  const tmIncome = tmTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const tmExpense = tmTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const activeInvestments = (investments || []).filter(i => i.status === 'active');
  const totalInvested = activeInvestments.reduce((s, i) => s + fmtN(i.totalInvested), 0);
  const totalCurrentValue = activeInvestments.reduce((s, i) => s + fmtN(i.currentValue), 0);
  const totalNetWorth = totalLiquid + totalRetirement + totalCurrentValue;

  const rows = [
    ['FinFlow — Financial Summary', '', new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })],
    [],
    ['NET WORTH BREAKDOWN', '', ''],
    ['Category', 'Amount (₹)', 'Notes'],
    ['Liquid Accounts', totalLiquid, `${regularAccounts.length} accounts`],
    ['Retirement Corpus', totalRetirement, `${retAccounts.length} accounts (PF/PPF/NPS)`],
    ['Investment Portfolio', totalCurrentValue, `${activeInvestments.length} active investments`],
    ['TOTAL NET WORTH', totalNetWorth, ''],
    [],
    ['THIS MONTH', '', ''],
    ['Metric', 'Amount (₹)', ''],
    ['Income', tmIncome, ''],
    ['Expenses', tmExpense, ''],
    ['Savings', tmIncome - tmExpense, `${tmIncome > 0 ? ((tmIncome - tmExpense) / tmIncome * 100).toFixed(1) : 0}% savings rate`],
    [],
    ['INVESTMENT SUMMARY', '', ''],
    ['Metric', 'Amount (₹)', ''],
    ['Total Invested', totalInvested, ''],
    ['Current Value', totalCurrentValue, ''],
    ['Unrealized Gain/Loss', totalCurrentValue - totalInvested, `${totalInvested > 0 ? (((totalCurrentValue - totalInvested) / totalInvested) * 100).toFixed(2) : 0}% return`],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [28, 18, 32]);

  // Apply styles
  const styles = {
    A1: { font: { bold: true, sz: 16, color: { rgb: '1A2560' } } },
    A3: { ...HDRL, fill: { fgColor: { rgb: '1A2560' }, patternType: 'solid' } },
    B3: HDR, C3: HDR,
    A4: HDRL, B4: HDR, C4: HDR,
    A8: { ...TOTAL_STYLE, numFmt: NUM_FMT, font: { bold: true } },
    B8: { ...TOTAL_STYLE, numFmt: NUM_FMT },
    A10: { ...HDRL, fill: { fgColor: { rgb: '059669' }, patternType: 'solid' } },
    B10: GREEN_HDR, C10: GREEN_HDR,
    A11: HDRL, B11: HDR, C11: HDR,
    A16: { ...HDRL, fill: { fgColor: { rgb: '4F46E5' }, patternType: 'solid' } },
    B16: PURPLE_HDR, C16: PURPLE_HDR,
    A17: HDRL, B17: HDR, C17: HDR,
  };

  // Format currency cells
  [5,6,7,8,12,13,14,18,19,20].forEach(row => {
    const cell = `B${row}`;
    if (ws[cell]) { ws[cell].t = 'n'; ws[cell].s = { numFmt: NUM_FMT }; }
  });

  // Color gain/loss
  if (ws['B14']) ws['B14'].s = { ...((tmIncome - tmExpense) >= 0 ? GREEN_NUM : RED_NUM) };
  if (ws['B20']) ws['B20'].s = { ...((totalCurrentValue - totalInvested) >= 0 ? GREEN_NUM : RED_NUM) };
  if (ws['B8']) ws['B8'].s = { ...TOTAL_STYLE, numFmt: NUM_FMT, font: { bold: true, sz: 12 } };

  applyStyles(ws, styles);
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  return ws;
}

// ── Sheet: Accounts ───────────────────────────────────────────────────────────
function buildAccountsSheet(accounts) {
  const headers = ['Account Name', 'Type', 'Bank / Institution', 'Account No', 'Balance (₹)', 'Opening Balance (₹)', 'Gain/Loss (₹)', 'Category', 'Interest Rate %', 'Maturity Date', 'Notes'];
  const rows = accounts.map((a, i) => [
    a.name, a.type?.replace('_', ' ').toUpperCase(), a.bankName || '', a.accountNumber || '',
    fmtN(a.balance), fmtN(a.initialBalance), fmtN(a.balance) - fmtN(a.initialBalance),
    a.isRetirement ? 'Retirement' : 'Regular',
    a.interestRate || '', a.maturityDate ? fmtDate(a.maturityDate) : '',
    a.notes || ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  setColWidths(ws, [24, 14, 20, 14, 16, 18, 14, 12, 12, 14, 24]);

  headers.forEach((_, i) => {
    const cell = XLSX.utils.encode_cell({ r: 0, c: i });
    if (ws[cell]) ws[cell].s = HDR;
  });

  rows.forEach((_, ri) => {
    const row = ri + 1;
    const style = ri % 2 === 1 ? ALT_ROW : {};
    [4, 5, 6].forEach(ci => {
      const cell = XLSX.utils.encode_cell({ r: row, c: ci });
      if (ws[cell]) ws[cell].s = { ...style, numFmt: NUM_FMT };
    });
    const gainCell = XLSX.utils.encode_cell({ r: row, c: 6 });
    if (ws[gainCell]) ws[gainCell].s = { ...(rows[ri][6] >= 0 ? { font: { color: { rgb: '059669' }, bold: true } } : { font: { color: { rgb: 'DC2626' }, bold: true } }), numFmt: NUM_FMT };
  });

  // Total row
  const totalRow = ['TOTAL', '', '', '', accounts.reduce((s, a) => s + fmtN(a.balance), 0), accounts.reduce((s, a) => s + fmtN(a.initialBalance), 0), '', '', '', '', ''];
  XLSX.utils.sheet_add_aoa(ws, [totalRow], { origin: -1 });
  const lastRow = rows.length + 1;
  [0, 4, 5].forEach(ci => {
    const cell = XLSX.utils.encode_cell({ r: lastRow, c: ci });
    if (ws[cell]) ws[cell].s = { ...TOTAL_STYLE, numFmt: ci > 0 ? NUM_FMT : undefined };
  });

  return ws;
}

// ── Sheet: Transactions ───────────────────────────────────────────────────────
function buildTransactionsSheet(transactions) {
  const headers = ['Date', 'Description', 'Type', 'Category', 'Account', 'To Account', 'Amount (₹)', 'Notes', 'Tags'];
  const rows = transactions.map(t => [
    fmtDate(t.date), t.description, t.type,
    t.category?.name || '',
    t.account?.name || '',
    t.toAccount?.name || '',
    fmtN(t.amount),
    t.notes || '',
    (t.tags || []).join(', ')
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  setColWidths(ws, [14, 30, 12, 18, 20, 20, 14, 24, 18]);

  headers.forEach((_, i) => {
    const cell = XLSX.utils.encode_cell({ r: 0, c: i });
    if (ws[cell]) ws[cell].s = HDR;
  });

  rows.forEach((row, ri) => {
    const r = ri + 1;
    const isIncome = row[2] === 'income' || row[2] === 'contribution' || row[2] === 'interest';
    const isExpense = row[2] === 'expense';
    const alt = ri % 2 === 1 ? { fill: { fgColor: { rgb: 'F4F6FB' }, patternType: 'solid' } } : {};

    const amtCell = XLSX.utils.encode_cell({ r, c: 6 });
    if (ws[amtCell]) {
      ws[amtCell].s = {
        ...alt,
        numFmt: NUM_FMT,
        font: isIncome ? { color: { rgb: '059669' }, bold: true } : isExpense ? { color: { rgb: 'DC2626' } } : { color: { rgb: '2563EB' } }
      };
    }

    const typeCell = XLSX.utils.encode_cell({ r, c: 2 });
    if (ws[typeCell]) ws[typeCell].s = { ...alt, font: { bold: true } };
  });

  return ws;
}

// ── Sheet: Investments ────────────────────────────────────────────────────────
function buildInvestmentsSheet(investments) {
  const headers = [
    'Name', 'Asset Class', 'Sub-Type', 'Institution', 'Ticker/Folio',
    'Purchase Date', 'Units', 'Buy Price (₹)', 'Total Invested (₹)',
    'Current Price (₹)', 'Current Value (₹)', 'Gain/Loss (₹)', 'Return %',
    'Dividend (₹)', 'XIRR %', 'Status', 'Interest Rate %', 'Maturity Date',
    'Maturity Value (₹)', 'Tags', 'Notes'
  ];

  const rows = investments.map(inv => {
    const gain = fmtN(inv.currentValue) - fmtN(inv.totalInvested);
    const pct = fmtN(inv.totalInvested) > 0 ? gain / fmtN(inv.totalInvested) : 0;
    return [
      inv.name, (inv.assetClass || '').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      inv.subType || '', inv.institution || '', inv.ticker || inv.folioNumber || '',
      fmtDate(inv.purchaseDate), fmtN(inv.units), fmtN(inv.purchasePrice),
      fmtN(inv.totalInvested), fmtN(inv.currentPrice), fmtN(inv.currentValue),
      gain, pct,
      fmtN(inv.dividendReceived), inv.xirr || '', inv.status || 'active',
      inv.interestRate || '', inv.maturityDate ? fmtDate(inv.maturityDate) : '',
      fmtN(inv.maturityValue), (inv.tags || []).join(', '), inv.notes || ''
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  setColWidths(ws, [24, 14, 14, 16, 14, 14, 8, 14, 16, 14, 16, 14, 10, 14, 8, 10, 12, 14, 16, 18, 20]);

  headers.forEach((_, i) => {
    const cell = XLSX.utils.encode_cell({ r: 0, c: i });
    if (ws[cell]) ws[cell].s = PURPLE_HDR;
  });

  const currencyCols = [7, 8, 9, 10, 11, 13, 18];
  rows.forEach((row, ri) => {
    const r = ri + 1;
    const alt = ri % 2 === 1 ? ALT_ROW : {};
    const gain = row[11];
    const pct = row[12];

    currencyCols.forEach(ci => {
      const cell = XLSX.utils.encode_cell({ r, c: ci });
      if (ws[cell]) ws[cell].s = { ...alt, numFmt: NUM_FMT };
    });

    const gainCell = XLSX.utils.encode_cell({ r, c: 11 });
    if (ws[gainCell]) ws[gainCell].s = { ...((gain >= 0) ? { font: { color: { rgb: '059669' }, bold: true } } : { font: { color: { rgb: 'DC2626' }, bold: true } }), numFmt: NUM_FMT };

    const pctCell = XLSX.utils.encode_cell({ r, c: 12 });
    if (ws[pctCell]) { ws[pctCell].t = 'n'; ws[pctCell].v = pct; ws[pctCell].s = { ...((pct >= 0) ? { font: { color: { rgb: '059669' }, bold: true } } : { font: { color: { rgb: 'DC2626' }, bold: true } }), numFmt: '0.00%' }; }
  });

  // Summary totals row
  const totalInvested = investments.reduce((s, i) => s + fmtN(i.totalInvested), 0);
  const totalValue = investments.filter(i => i.status === 'active').reduce((s, i) => s + fmtN(i.currentValue), 0);
  const totalGain = totalValue - totalInvested;
  const totRow = ['TOTAL', '', '', '', '', '', '', '', totalInvested, '', totalValue, totalGain, totalInvested > 0 ? totalGain / totalInvested : 0, '', '', '', '', '', '', '', ''];
  XLSX.utils.sheet_add_aoa(ws, [totRow], { origin: -1 });
  const lr = rows.length + 1;
  [8, 10, 11].forEach(ci => {
    const cell = XLSX.utils.encode_cell({ r: lr, c: ci });
    if (ws[cell]) ws[cell].s = { ...TOTAL_STYLE, numFmt: NUM_FMT };
  });

  return ws;
}

// ── Sheet: Budget ─────────────────────────────────────────────────────────────
function buildBudgetSheet(budgets, budgetItems, transactions) {
  const rows = [['Month', 'Budget Name', 'Category', 'Planned (₹)', 'Spent (₹)', 'Remaining (₹)', 'Usage %']];

  budgets.forEach(b => {
    const items = budgetItems.filter(i => i.budget?.toString() === b._id?.toString() || i.budget === b._id);
    const startDate = new Date(b.year, b.month - 1, 1);
    const endDate = new Date(b.year, b.month, 0);
    const monthName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][b.month - 1];

    items.forEach(item => {
      const catName = item.category?.name || 'Unknown';
      const catId = item.category?._id;
      const spent = transactions.filter(t =>
        t.type === 'expense' &&
        new Date(t.date) >= startDate &&
        new Date(t.date) <= endDate &&
        (t.category?._id?.toString() === catId?.toString() || t.category === catId)
      ).reduce((s, t) => s + fmtN(t.amount), 0);

      const remaining = fmtN(item.plannedAmount) - spent;
      const pct = fmtN(item.plannedAmount) > 0 ? spent / fmtN(item.plannedAmount) : 0;
      rows.push([`${monthName} ${b.year}`, b.name, catName, fmtN(item.plannedAmount), spent, remaining, pct]);
    });
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [14, 22, 20, 15, 15, 15, 10]);

  [0,1,2,3,4,5,6].forEach(ci => {
    const cell = XLSX.utils.encode_cell({ r: 0, c: ci });
    if (ws[cell]) ws[cell].s = AMBER_HDR;
  });

  for (let r = 1; r < rows.length; r++) {
    const alt = r % 2 === 1 ? ALT_ROW : {};
    [3, 4, 5].forEach(ci => {
      const cell = XLSX.utils.encode_cell({ r, c: ci });
      if (ws[cell]) ws[cell].s = { ...alt, numFmt: NUM_FMT };
    });
    const remCell = XLSX.utils.encode_cell({ r, c: 5 });
    if (ws[remCell]) {
      const rem = rows[r][5];
      ws[remCell].s = { ...((rem >= 0) ? { font: { color: { rgb: '059669' } } } : { font: { color: { rgb: 'DC2626' }, bold: true } }), numFmt: NUM_FMT };
    }
    const pctCell = XLSX.utils.encode_cell({ r, c: 6 });
    if (ws[pctCell]) {
      const pct = rows[r][6];
      ws[pctCell].t = 'n';
      ws[pctCell].v = pct;
      ws[pctCell].s = { numFmt: '0.0%', ...alt, font: pct > 1 ? { color: { rgb: 'DC2626' }, bold: true } : pct > 0.8 ? { color: { rgb: 'D97706' } } : {} };
    }
  }

  return ws;
}

// ── Main Export Function ───────────────────────────────────────────────────────
export function exportToExcel(data) {
  const { investments = [], transactions = [], accounts = [], budgets = [], budgetItems = [] } = data;

  const wb = XLSX.utils.book_new();

  // Summary sheet
  XLSX.utils.book_append_sheet(wb, buildSummarySheet(data), '📊 Summary');

  // Accounts
  XLSX.utils.book_append_sheet(wb, buildAccountsSheet(accounts), '🏦 Accounts');

  // Transactions
  XLSX.utils.book_append_sheet(wb, buildTransactionsSheet(transactions), '↕ Transactions');

  // Investments (all, then by class)
  if (investments.length > 0) {
    XLSX.utils.book_append_sheet(wb, buildInvestmentsSheet(investments), '📈 All Investments');

    // Per asset class sheets
    const classes = [...new Set(investments.map(i => i.assetClass))];
    classes.forEach(cls => {
      const clsInvestments = investments.filter(i => i.assetClass === cls);
      if (clsInvestments.length > 0) {
        const labelMap = { stocks: 'Stocks', mutual_funds: 'MF', fixed_deposit: 'FD', gold: 'Gold', bonds: 'Bonds', crypto: 'Crypto', real_estate: 'RE', other: 'Other' };
        XLSX.utils.book_append_sheet(wb, buildInvestmentsSheet(clsInvestments), `${labelMap[cls] || cls}`);
      }
    });
  }

  // Budget
  if (budgets.length > 0) {
    XLSX.utils.book_append_sheet(wb, buildBudgetSheet(budgets, budgetItems, transactions), '◎ Budget');
  }

  // Generate filename with date
  const today = new Date().toISOString().split('T')[0];
  const filename = `FinFlow_Export_${today}.xlsx`;

  XLSX.writeFile(wb, filename, { bookType: 'xlsx', type: 'binary', cellStyles: true });
  return filename;
}
