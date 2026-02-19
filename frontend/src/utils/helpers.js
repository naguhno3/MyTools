export const fmt = (n, currency = 'INR') => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency, maximumFractionDigits: 0
}).format(n || 0);

export const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fmtShortDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

export const monthName = (m) => ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1];

export const ACCOUNT_TYPES = {
  savings:      { label: 'Savings',      icon: '🏦', color: '#2563eb' },
  checking:     { label: 'Checking',     icon: '💳', color: '#7c3aed' },
  credit_card:  { label: 'Credit Card',  icon: '💴', color: '#dc2626' },
  cash:         { label: 'Cash',         icon: '💵', color: '#059669' },
  investment:   { label: 'Investment',   icon: '📈', color: '#d97706' },
  wallet:       { label: 'Wallet',       icon: '👛', color: '#0d9488' },
  other:        { label: 'Other',        icon: '📂', color: '#6b7280' },
  pf:           { label: 'PF',           icon: '🏛', color: '#4f46e5', isRetirement: true },
  ppf:          { label: 'PPF',          icon: '🏅', color: '#0891b2', isRetirement: true },
  nps:          { label: 'NPS',          icon: '🎯', color: '#7c3aed', isRetirement: true },
};

export const RETIREMENT_TYPES = ['pf', 'ppf', 'nps'];

export const RETIREMENT_INFO = {
  pf: {
    fullName: 'Provident Fund',
    description: 'Employee & Employer monthly contributions',
    currentRate: 8.25,
    rateNote: 'FY 2023-24',
    colorGradient: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
  },
  ppf: {
    fullName: 'Public Provident Fund',
    description: 'Government-backed long-term savings with tax benefits',
    currentRate: 7.1,
    rateNote: 'Q1 FY 2024-25',
    colorGradient: 'linear-gradient(135deg, #0891b2 0%, #0d9488 100%)',
  },
  nps: {
    fullName: 'National Pension System',
    description: 'Market-linked pension with equity + debt allocation',
    currentRate: null,
    rateNote: 'Market linked returns',
    colorGradient: 'linear-gradient(135deg, #7c3aed 0%, #4f72ff 100%)',
  },
};

export const ACCOUNT_COLORS = [
  '#2563eb','#7c3aed','#059669','#dc2626','#d97706','#0d9488','#4f72ff','#ec4899','#0ea5e9','#84cc16',
];

export const RETIREMENT_COLORS = ['#4f46e5','#0891b2','#7c3aed'];

export const CHART_COLORS = ['#4f72ff','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16'];

export const isRetirementType = (type) => RETIREMENT_TYPES.includes(type);

export const ASSET_CLASSES = {
  stocks:        { label: 'Stocks',         icon: '📈', color: '#2563eb', gradient: 'linear-gradient(135deg, #1d4ed8, #3b82f6)' },
  mutual_funds:  { label: 'Mutual Funds',   icon: '🏛', color: '#7c3aed', gradient: 'linear-gradient(135deg, #6d28d9, #8b5cf6)' },
  fixed_deposit: { label: 'Fixed Deposit',  icon: '🏦', color: '#059669', gradient: 'linear-gradient(135deg, #047857, #10b981)' },
  gold:          { label: 'Gold',           icon: '🥇', color: '#d97706', gradient: 'linear-gradient(135deg, #b45309, #f59e0b)' },
  bonds:         { label: 'Bonds',          icon: '📜', color: '#0891b2', gradient: 'linear-gradient(135deg, #0e7490, #06b6d4)' },
  crypto:        { label: 'Crypto',         icon: '₿',  color: '#ea580c', gradient: 'linear-gradient(135deg, #c2410c, #f97316)' },
  real_estate:   { label: 'Real Estate',    icon: '🏘️', color: '#64748b', gradient: 'linear-gradient(135deg, #475569, #94a3b8)' },
  other:         { label: 'Other',          icon: '💎', color: '#6b7280', gradient: 'linear-gradient(135deg, #4b5563, #9ca3af)' },
};

export const ASSET_SUBTYPES = {
  stocks:        ['Large Cap', 'Mid Cap', 'Small Cap', 'Micro Cap', 'ETF', 'REITs', 'International'],
  mutual_funds:  ['Large Cap', 'Mid Cap', 'Small Cap', 'Flexi Cap', 'ELSS', 'Debt', 'Liquid', 'Index Fund', 'Hybrid', 'International'],
  fixed_deposit: ['Bank FD', 'Corporate FD', 'Post Office FD', 'Recurring Deposit'],
  gold:          ['Physical Gold', 'Gold ETF', 'Sovereign Gold Bond (SGB)', 'Gold Fund', 'Digital Gold'],
  bonds:         ['Government Bonds', 'Corporate Bonds', 'NCD', 'Debentures', 'RBI Bonds'],
  crypto:        ['Bitcoin', 'Ethereum', 'Altcoins', 'Stablecoins', 'DeFi Tokens'],
  real_estate:   ['Residential', 'Commercial', 'Land', 'REIT'],
  other:         ['P2P Lending', 'Startup Investment', 'Art', 'Collectibles'],
};

export const getMonthOptions = () => {
  const opts = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({ value: `${d.getMonth() + 1}-${d.getFullYear()}`, label: `${monthName(d.getMonth() + 1)} ${d.getFullYear()}`, month: d.getMonth() + 1, year: d.getFullYear() });
  }
  return opts;
};
