import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  getAccounts, createAccount, updateAccount, deleteAccount,
  createTransaction, deleteTransaction, getAccountTransactions, getRetirementSummary
} from '../utils/api';
import { fmt, fmtDate, fmtShortDate, monthName, ACCOUNT_TYPES, RETIREMENT_INFO, RETIREMENT_TYPES, ACCOUNT_COLORS } from '../utils/helpers';
import './Retirement.css';

/* ─── Tooltip ─────────────────────────────────────────────── */
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e4e8f4', borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 16px rgba(15,22,41,0.1)' }}>
      <div style={{ color: '#9aa3be', marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {fmt(p.value)}</div>
      ))}
    </div>
  );
};

/* ─── Account creation/edit modal ─────────────────────────── */
const RETIRE_TYPES_LIST = [
  ['pf',  '🏛', 'PF',  '#4f46e5'],
  ['ppf', '🏅', 'PPF', '#0891b2'],
  ['nps', '🎯', 'NPS', '#7c3aed'],
];

function AccountModal({ account, onClose, onSave }) {
  const initType = account?.type || 'pf';
  const info = RETIREMENT_INFO[initType] || {};
  const [form, setForm] = useState({
    name: account?.name || '',
    type: initType,
    balance: account?.balance ?? '',
    bankName: account?.bankName || '',
    accountNumber: account?.accountNumber || '',
    interestRate: account?.interestRate || info.currentRate || '',
    maturityDate: account?.maturityDate ? account.maturityDate.split('T')[0] : '',
    employeeContribution: account?.employeeContribution || '',
    employerContribution: account?.employerContribution || '',
    notes: account?.notes || '',
    color: account?.color || '#4f46e5',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Auto-update rate hint & color when type changes
  const onTypeChange = (t) => {
    const inf = RETIREMENT_INFO[t];
    set('type', t);
    set('color', RETIRE_TYPES_LIST.find(r => r[0] === t)?.[3] || '#4f46e5');
    if (!account) set('interestRate', inf?.currentRate || '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        balance: +form.balance,
        initialBalance: !account ? +form.balance : undefined,
        isRetirement: true,
        icon: RETIRE_TYPES_LIST.find(r => r[0] === form.type)?.[1] || '🏛',
        interestRate: form.interestRate ? +form.interestRate : undefined,
        employeeContribution: form.employeeContribution ? +form.employeeContribution : 0,
        employerContribution: form.employerContribution ? +form.employerContribution : 0,
      };
      let saved;
      if (account) { saved = (await updateAccount(account._id, payload)).data; toast.success('Account updated!'); }
      else          { saved = (await createAccount(payload)).data;              toast.success('Account created!'); }
      onSave(saved);
      onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  const currentInfo = RETIREMENT_INFO[form.type] || {};

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{account ? 'Edit Account' : 'Add Retirement Account'}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {/* Type selector */}
          <div className="form-group">
            <label className="form-label">Account Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {RETIRE_TYPES_LIST.map(([key, icon, label, color]) => (
                <button key={key} type="button"
                  style={{ padding: '14px 8px', borderRadius: 12, border: `2px solid ${form.type === key ? color : 'var(--border)'}`, background: form.type === key ? `${color}10` : 'var(--surface2)', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center' }}
                  onClick={() => onTypeChange(key)}>
                  <div style={{ fontSize: 26, marginBottom: 4 }}>{icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: form.type === key ? color : 'var(--text3)', fontFamily: 'DM Sans, sans-serif' }}>{label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{RETIREMENT_INFO[key]?.fullName}</div>
                </button>
              ))}
            </div>
            {currentInfo.currentRate && (
              <div style={{ marginTop: 8, fontSize: 11, color: '#0891b2', background: 'rgba(8,145,178,0.07)', padding: '6px 10px', borderRadius: 7, fontWeight: 600 }}>
                ℹ️ Current rate: {currentInfo.currentRate}% p.a. ({currentInfo.rateNote})
              </div>
            )}
            {!currentInfo.currentRate && form.type === 'nps' && (
              <div style={{ marginTop: 8, fontSize: 11, color: '#7c3aed', background: 'rgba(124,58,237,0.07)', padding: '6px 10px', borderRadius: 7, fontWeight: 600 }}>
                📊 NPS returns are market-linked — track actual corpus growth manually.
              </div>
            )}
          </div>

          <div className="form-group"><label className="form-label">Account Name *</label>
            <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)}
              placeholder={form.type === 'pf' ? 'e.g. EPFO PF Account' : form.type === 'ppf' ? 'e.g. SBI PPF Account' : 'e.g. HDFC Pension NPS'} required />
          </div>

          <div className="form-row">
            <div className="form-group"><label className="form-label">{account ? 'Current Balance (₹)' : 'Opening Balance (₹)'} *</label>
              <input type="number" className="form-input" value={form.balance} onChange={e => set('balance', e.target.value)} placeholder="0" required /></div>
            <div className="form-group"><label className="form-label">Fund House / Bank</label>
              <input className="form-input" value={form.bankName} onChange={e => set('bankName', e.target.value)}
                placeholder={form.type === 'pf' ? 'e.g. EPFO' : form.type === 'ppf' ? 'e.g. SBI / Post Office' : 'e.g. HDFC Pension'} /></div>
          </div>

          <div className="form-row">
            <div className="form-group"><label className="form-label">{form.type === 'pf' ? 'UAN Number' : form.type === 'nps' ? 'PRAN Number' : 'Account Number'}</label>
              <input className="form-input" value={form.accountNumber} onChange={e => set('accountNumber', e.target.value)}
                placeholder={form.type === 'pf' ? 'UAN (12 digits)' : form.type === 'nps' ? 'PRAN number' : 'Account number'} /></div>
            <div className="form-group"><label className="form-label">Interest / Return Rate (% p.a.)</label>
              <input type="number" step="0.01" className="form-input" value={form.interestRate}
                onChange={e => set('interestRate', e.target.value)}
                placeholder={form.type === 'pf' ? '8.25' : form.type === 'ppf' ? '7.1' : 'e.g. 10.5'} /></div>
          </div>

          {form.type === 'ppf' && (
            <div className="form-group"><label className="form-label">PPF Maturity Date</label>
              <input type="date" className="form-input" value={form.maturityDate} onChange={e => set('maturityDate', e.target.value)} />
              <div className="form-hint">PPF has a 15-year lock-in from account opening</div>
            </div>
          )}

          {form.type === 'pf' && (
            <div className="form-row">
              <div className="form-group"><label className="form-label">Monthly Employee Contribution (₹)</label>
                <input type="number" className="form-input" value={form.employeeContribution} onChange={e => set('employeeContribution', e.target.value)} placeholder="e.g. 1800" /></div>
              <div className="form-group"><label className="form-label">Monthly Employer Contribution (₹)</label>
                <input type="number" className="form-input" value={form.employerContribution} onChange={e => set('employerContribution', e.target.value)} placeholder="e.g. 1800" /></div>
            </div>
          )}

          <div className="form-group"><label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} style={{ minHeight: 60 }} /></div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : account ? 'Update' : 'Add Account'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Add transaction modal (contribution / interest / income) ─ */
function AddEntryModal({ account, onClose, onSave }) {
  const [form, setForm] = useState({
    type: 'contribution',
    amount: '',
    description: account.type === 'pf' ? 'Monthly PF Contribution' : account.type === 'ppf' ? 'PPF Deposit' : 'NPS Contribution',
    date: new Date().toISOString().split('T')[0],
    employeeContrib: account.employeeContribution || '',
    employerContrib: account.employerContribution || '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Auto-calculate total when breakdown changes (PF only)
  useEffect(() => {
    if (form.type === 'contribution' && account.type === 'pf') {
      const total = (+form.employeeContrib || 0) + (+form.employerContrib || 0);
      if (total > 0) set('amount', total);
    }
  }, [form.employeeContrib, form.employerContrib, form.type, account.type]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        type: form.type,
        amount: +form.amount,
        description: form.description,
        date: form.date,
        account: account._id,
        notes: form.notes,
        contributionBreakdown: form.type === 'contribution' && account.type === 'pf' ? {
          employee: +form.employeeContrib || 0,
          employer: +form.employerContrib || 0,
        } : undefined
      };
      const r = await createTransaction(payload);
      onSave(r.data);
      toast.success(form.type === 'interest' ? '📈 Interest credited!' : '✅ Contribution recorded!');
      onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  const typeColor = form.type === 'interest' ? '#0891b2' : '#4f46e5';
  const typeBg   = form.type === 'interest' ? 'rgba(8,145,178,0.07)' : 'rgba(79,70,229,0.07)';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Add Entry — {account.name}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {/* Type switcher */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
            {[
              ['contribution', '🏛 Contribution', '#4f46e5', 'rgba(79,70,229,0.08)'],
              ['interest',     '% Interest',       '#0891b2', 'rgba(8,145,178,0.08)'],
              ['income',       '↑ Income',         '#059669', 'rgba(5,150,105,0.08)'],
            ].map(([t, label, color, bg]) => (
              <button key={t} type="button"
                style={{ padding: '10px 6px', borderRadius: 10, border: `1.5px solid ${form.type === t ? color : 'var(--border)'}`, background: form.type === t ? bg : 'var(--surface2)', color: form.type === t ? color : 'var(--text3)', fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'DM Sans' }}
                onClick={() => set('type', t)}>{label}</button>
            ))}
          </div>

          {/* PF breakdown */}
          {form.type === 'contribution' && account.type === 'pf' && (
            <div style={{ background: 'rgba(79,70,229,0.06)', border: '1px solid rgba(79,70,229,0.18)', borderRadius: 10, padding: '14px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#4f46e5', marginBottom: 10 }}>PF Contribution Breakdown</div>
              <div className="form-row">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Employee Share (₹)</label>
                  <input type="number" className="form-input" value={form.employeeContrib} onChange={e => set('employeeContrib', e.target.value)} placeholder="0" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Employer Share (₹)</label>
                  <input type="number" className="form-input" value={form.employerContrib} onChange={e => set('employerContrib', e.target.value)} placeholder="0" />
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#4f46e5', marginTop: 8, fontWeight: 600 }}>
                Total auto-calculated: {fmt((+form.employeeContrib || 0) + (+form.employerContrib || 0))}
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                {form.type === 'interest' ? 'Interest Amount (₹) *' : form.type === 'contribution' && account.type === 'pf' ? 'Total Amount (₹)' : 'Amount (₹) *'}
              </label>
              <input type="number" className="form-input" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" required min="0.01" step="0.01"
                readOnly={form.type === 'contribution' && account.type === 'pf' && ((+form.employeeContrib || 0) + (+form.employerContrib || 0)) > 0} />
            </div>
            <div className="form-group"><label className="form-label">Date *</label>
              <input type="date" className="form-input" value={form.date} onChange={e => set('date', e.target.value)} required /></div>
          </div>

          <div className="form-group"><label className="form-label">Description *</label>
            <input className="form-input" value={form.description} onChange={e => set('description', e.target.value)} required /></div>

          <div className="form-group"><label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} style={{ minHeight: 56 }} /></div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : `Add ${form.type === 'interest' ? 'Interest' : form.type === 'income' ? 'Income' : 'Contribution'}`}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Individual account detail panel ──────────────────────── */
function AccountDetail({ account, onRefresh }) {
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      getRetirementSummary(account._id),
      getAccountTransactions(account._id, { limit: 50 })
    ]).then(([s, t]) => {
      setSummary(s.data);
      setTransactions(t.data.transactions);
    }).finally(() => setLoading(false));
  }, [account._id]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (txId) => {
    if (!window.confirm('Delete this entry? The account balance will be reversed.')) return;
    await deleteTransaction(txId);
    toast.success('Entry deleted');
    load();
    onRefresh();
  };

  // Build chart data from monthly summary
  const chartData = [];
  if (summary?.monthly) {
    const map = {};
    summary.monthly.forEach(m => {
      const key = `${m._id.year}-${String(m._id.month).padStart(2,'0')}`;
      if (!map[key]) map[key] = { name: `${monthName(m._id.month)} '${String(m._id.year).slice(2)}`, contribution: 0, interest: 0 };
      map[key][m._id.type] = m.total;
    });
    Object.values(map).sort((a, b) => a.name.localeCompare(b.name)).forEach(v => chartData.push(v));
  }

  const tc = ACCOUNT_TYPES[account.type] || {};
  const info = RETIREMENT_INFO[account.type] || {};
  const acColor = account.color || tc.color || '#4f46e5';

  const totalGrowth = account.balance - account.initialBalance;
  const growthPct = account.initialBalance > 0 ? ((totalGrowth / account.initialBalance) * 100).toFixed(1) : 0;

  // PPF maturity countdown
  let maturityDays = null;
  if (account.maturityDate) {
    maturityDays = Math.ceil((new Date(account.maturityDate) - new Date()) / (1000 * 60 * 60 * 24));
  }

  const txColor = { contribution: '#4f46e5', interest: '#0891b2', income: '#059669' };
  const txSign  = { contribution: '+', interest: '+', income: '+', expense: '−', transfer: '⇄' };

  return (
    <div className="ret-detail slide-up">
      {/* Account hero */}
      <div className="ret-hero" style={{ background: info.colorGradient || `linear-gradient(135deg, ${acColor} 0%, ${acColor}bb 100%)` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 4 }}>
              {info.fullName || tc.label}
              {account.bankName && ` · ${account.bankName}`}
            </div>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 22, fontWeight: 800, color: '#fff' }}>{account.name}</div>
            {account.accountNumber && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>#{account.accountNumber}</div>}
          </div>
          <div style={{ fontSize: 32 }}>{account.icon || tc.icon}</div>
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Current Corpus</div>
          <div style={{ fontFamily: 'DM Mono', fontSize: 34, fontWeight: 500, color: '#fff', letterSpacing: '-0.02em' }}>{fmt(account.balance)}</div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
              Opening: <strong style={{ color: '#fff' }}>{fmt(account.initialBalance)}</strong>
            </div>
            <div style={{ fontSize: 12, color: totalGrowth >= 0 ? '#6ee7b7' : '#fca5a5' }}>
              {totalGrowth >= 0 ? '▲' : '▼'} {fmt(Math.abs(totalGrowth))} ({growthPct}%)
            </div>
          </div>
        </div>

        {/* Quick meta */}
        <div style={{ display: 'flex', gap: 20, marginTop: 16, flexWrap: 'wrap' }}>
          {account.interestRate && (
            <div style={{ fontSize: 12 }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Rate: </span>
              <strong style={{ color: '#fff' }}>{account.interestRate}% p.a.</strong>
            </div>
          )}
          {maturityDays !== null && (
            <div style={{ fontSize: 12 }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Matures: </span>
              <strong style={{ color: maturityDays < 365 ? '#fde68a' : '#fff' }}>
                {fmtDate(account.maturityDate)} {maturityDays > 0 ? `(${maturityDays}d)` : '(Matured)'}
              </strong>
            </div>
          )}
          {account.type === 'pf' && account.employeeContribution > 0 && (
            <div style={{ fontSize: 12 }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Monthly: </span>
              <strong style={{ color: '#fff' }}>{fmt(account.employeeContribution + account.employerContribution)}</strong>
            </div>
          )}
        </div>

        <button className="btn" style={{ marginTop: 20, background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowAdd(true)}>
          + Add Contribution / Interest
        </button>
      </div>

      {loading ? (
        <div className="loading-screen" style={{ minHeight: 200 }}><div className="spinner" /></div>
      ) : (
        <>
          {/* Stats row */}
          <div className="ret-stats">
            <div className="ret-stat-card">
              <div className="stat-label">Total Contributions</div>
              <div style={{ fontFamily: 'DM Mono', fontSize: 20, fontWeight: 500, color: '#4f46e5', marginTop: 4 }}>{fmt(summary?.totalContributions)}</div>
            </div>
            <div className="ret-stat-card">
              <div className="stat-label">Total Interest Earned</div>
              <div style={{ fontFamily: 'DM Mono', fontSize: 20, fontWeight: 500, color: '#0891b2', marginTop: 4 }}>{fmt(summary?.totalInterest)}</div>
            </div>
            <div className="ret-stat-card">
              <div className="stat-label">Interest % of Corpus</div>
              <div style={{ fontFamily: 'DM Mono', fontSize: 20, fontWeight: 500, color: '#059669', marginTop: 4 }}>
                {account.balance > 0 ? ((summary?.totalInterest / account.balance) * 100).toFixed(1) : 0}%
              </div>
            </div>
            <div className="ret-stat-card">
              <div className="stat-label">Corpus Growth</div>
              <div style={{ fontFamily: 'DM Mono', fontSize: 20, fontWeight: 500, color: totalGrowth >= 0 ? '#059669' : 'var(--red)', marginTop: 4 }}>
                {totalGrowth >= 0 ? '+' : ''}{growthPct}%
              </div>
            </div>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="card" style={{ marginTop: 18, padding: '20px 22px' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: 'var(--text)' }}>Monthly Contributions & Interest</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ left: -10 }}>
                  <CartesianGrid stroke="#f0f2fa" strokeDasharray="0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9aa3be', fontFamily: 'DM Sans' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9aa3be' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip content={<ChartTip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontFamily: 'DM Sans' }} />
                  <Bar dataKey="contribution" name="Contribution" fill="#4f46e5" radius={[4,4,0,0]} maxBarSize={36} />
                  <Bar dataKey="interest" name="Interest" fill="#0891b2" radius={[4,4,0,0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Transaction History */}
          <div className="card" style={{ marginTop: 18, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Transaction History ({transactions.length})</div>
            </div>
            {transactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>📋</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>No entries yet</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Add your first contribution or interest entry above.</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Notes</th><th style={{ textAlign: 'right' }}>Amount</th><th></th></tr></thead>
                  <tbody>
                    {transactions.map(tx => (
                      <tr key={tx._id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text3)' }}>{fmtDate(tx.date)}</td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{tx.description}</div>
                          {tx.contributionBreakdown && (tx.contributionBreakdown.employee > 0 || tx.contributionBreakdown.employer > 0) && (
                            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                              Employee: {fmt(tx.contributionBreakdown.employee)} · Employer: {fmt(tx.contributionBreakdown.employer)}
                            </div>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 100, background: `${txColor[tx.type] || '#6b7280'}14`, color: txColor[tx.type] || '#6b7280', border: `1px solid ${txColor[tx.type] || '#6b7280'}28` }}>
                            {tx.type}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text3)', maxWidth: 160 }}>{tx.notes || '—'}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'DM Mono', fontWeight: 500, fontSize: 14, color: txColor[tx.type] || 'var(--text)', whiteSpace: 'nowrap' }}>
                          +{fmt(tx.amount)}
                        </td>
                        <td><button className="btn btn-danger btn-sm" style={{ fontSize: 11 }} onClick={() => handleDelete(tx._id)}>×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {showAdd && <AddEntryModal account={account} onClose={() => setShowAdd(false)} onSave={() => { load(); onRefresh(); }} />}
    </div>
  );
}

/* ─── Main Retirement Page ─────────────────────────────────── */
export default function Retirement() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editAccount, setEditAccount] = useState(null);
  const [retirementStats, setRetirementStats] = useState(null);
  const [portfolioTrend, setPortfolioTrend] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadAccounts = useCallback(() => {
    getAccounts({ isRetirement: true }).then(r => {
      setAccounts(r.data);
      if (r.data.length > 0 && !selected) setSelected(r.data[0]._id);
    }).finally(() => setLoading(false));
  }, []); // eslint-disable-line

  useEffect(() => { loadAccounts(); }, [loadAccounts, refreshKey]);

  // Compute portfolio-wide stats
  useEffect(() => {
    if (accounts.length === 0) return;
    const total = accounts.reduce((s, a) => s + a.balance, 0);
    const totalInitial = accounts.reduce((s, a) => s + a.initialBalance, 0);
    setRetirementStats({
      total,
      totalInitial,
      growth: total - totalInitial,
      growthPct: totalInitial > 0 ? (((total - totalInitial) / totalInitial) * 100).toFixed(1) : 0,
      byType: {
        pf: accounts.filter(a => a.type === 'pf').reduce((s, a) => s + a.balance, 0),
        ppf: accounts.filter(a => a.type === 'ppf').reduce((s, a) => s + a.balance, 0),
        nps: accounts.filter(a => a.type === 'nps').reduce((s, a) => s + a.balance, 0),
      }
    });
  }, [accounts]);

  const handleAccountSave = (acc) => {
    setAccounts(prev => {
      const idx = prev.findIndex(a => a._id === acc._id);
      if (idx >= 0) { const n = [...prev]; n[idx] = acc; return n; }
      return [...prev, acc];
    });
    setSelected(acc._id);
  };

  const handleDeleteAccount = async (id) => {
    if (!window.confirm('Deactivate this retirement account?')) return;
    await deleteAccount(id);
    setAccounts(prev => prev.filter(a => a._id !== id));
    if (selected === id) setSelected(accounts.find(a => a._id !== id)?._id || null);
    toast.success('Account removed');
  };

  const selectedAccount = accounts.find(a => a._id === selected);

  if (loading) return <div className="page"><div className="loading-screen"><div className="spinner" /></div></div>;

  return (
    <div className="page fade-in">
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">Retirement Portfolio</h1>
          <div className="page-sub">Track your PF, PPF & NPS corpus — contributions and interest</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditAccount(null); setShowAccountModal(true); }}>+ Add Account</button>
      </div>

      {accounts.length === 0 ? (
        /* Empty state */
        <div className="ret-empty">
          <div className="ret-empty-icons">🏛🏅🎯</div>
          <div className="empty-title" style={{ marginTop: 16 }}>No retirement accounts yet</div>
          <div className="empty-desc">Start tracking your PF, PPF, and NPS accounts. Add contributions, interest credits, and watch your retirement corpus grow.</div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, margin: '28px 0', maxWidth: 560 }}>
            {[
              { type: 'pf', color: '#4f46e5', title: 'Provident Fund', desc: 'Employee + Employer contributions' },
              { type: 'ppf', color: '#0891b2', title: 'Public Provident Fund', desc: '15-year tax-exempt savings' },
              { type: 'nps', color: '#7c3aed', title: 'National Pension System', desc: 'Market-linked pension corpus' },
            ].map(({ type, color, title, desc }) => (
              <div key={type} onClick={() => { setEditAccount(null); setShowAccountModal(true); }}
                style={{ padding: '20px', background: `${color}08`, border: `1.5px solid ${color}22`, borderRadius: 14, cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center' }}
                className="hover-card">
                <div style={{ fontSize: 30, marginBottom: 8 }}>{ACCOUNT_TYPES[type]?.icon}</div>
                <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 800, fontSize: 14, color }}>{title}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{desc}</div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => setShowAccountModal(true)}>+ Add First Retirement Account</button>
        </div>
      ) : (
        <>
          {/* Portfolio summary bar */}
          {retirementStats && (
            <div className="ret-summary-bar">
              <div className="ret-summary-main">
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>Total Retirement Corpus</div>
                <div style={{ fontFamily: 'DM Mono', fontSize: 36, fontWeight: 500, color: '#fff', letterSpacing: '-0.02em' }}>{fmt(retirementStats.total)}</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>Opening: <strong style={{ color: '#fff' }}>{fmt(retirementStats.totalInitial)}</strong></span>
                  <span style={{ fontSize: 12, color: retirementStats.growth >= 0 ? '#6ee7b7' : '#fca5a5' }}>
                    {retirementStats.growth >= 0 ? '▲' : '▼'} {fmt(Math.abs(retirementStats.growth))} ({retirementStats.growthPct}%)
                  </span>
                </div>
              </div>
              <div className="ret-summary-breakdown">
                {[
                  { label: 'PF', val: retirementStats.byType.pf, color: '#818cf8' },
                  { label: 'PPF', val: retirementStats.byType.ppf, color: '#38bdf8' },
                  { label: 'NPS', val: retirementStats.byType.nps, color: '#c084fc' },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>{s.label}</div>
                    <div style={{ fontFamily: 'DM Mono', fontSize: 15, fontWeight: 600, color: s.color }}>{fmt(s.val)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Two-column layout */}
          <div className="ret-layout">
            {/* Sidebar – account list */}
            <div className="ret-sidebar">
              <div className="ret-sidebar-header">
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)' }}>Accounts</span>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => { setEditAccount(null); setShowAccountModal(true); }}>+ Add</button>
              </div>

              {RETIREMENT_TYPES.map(type => {
                const typeAccounts = accounts.filter(a => a.type === type);
                if (typeAccounts.length === 0) return null;
                const tc = ACCOUNT_TYPES[type];
                const info = RETIREMENT_INFO[type];
                return (
                  <div key={type} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: tc.color, padding: '6px 10px 3px', display: 'flex', alignItems: 'center', gap: 5 }}>
                      {tc.icon} {tc.label}
                    </div>
                    {typeAccounts.map(acc => (
                      <div key={acc._id}
                        className={`ret-account-item ${selected === acc._id ? 'active' : ''}`}
                        style={{ '--acc-color': acc.color || tc.color }}
                        onClick={() => setSelected(acc._id)}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: selected === acc._id ? acc.color || tc.color : 'var(--text)' }}>{acc.name}</div>
                          <div style={{ fontFamily: 'DM Mono', fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>{fmt(acc.balance)}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, opacity: 0, transition: 'opacity 0.15s' }} className="account-actions">
                          <button className="btn btn-ghost btn-icon" style={{ width: 26, height: 26, fontSize: 11, borderRadius: 7 }}
                            onClick={e => { e.stopPropagation(); setEditAccount(acc); setShowAccountModal(true); }}>✏️</button>
                          <button className="btn btn-danger btn-icon" style={{ width: 26, height: 26, fontSize: 11, borderRadius: 7 }}
                            onClick={e => { e.stopPropagation(); handleDeleteAccount(acc._id); }}>×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Detail panel */}
            <div className="ret-detail-wrap">
              {selectedAccount ? (
                <AccountDetail
                  key={selected}
                  account={selectedAccount}
                  onRefresh={() => setRefreshKey(k => k + 1)}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>👈</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Select an account to view details</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {showAccountModal && (
        <AccountModal
          account={editAccount}
          onClose={() => { setShowAccountModal(false); setEditAccount(null); }}
          onSave={handleAccountSave}
        />
      )}
    </div>
  );
}
