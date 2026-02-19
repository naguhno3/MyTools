import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getTransactions, createTransaction, deleteTransaction, getAccounts, getCategories } from '../utils/api';
import { fmt, fmtDate, RETIREMENT_TYPES } from '../utils/helpers';

const defaultForm = {
  type: 'expense', amount: '', description: '', date: new Date().toISOString().split('T')[0],
  account: '', toAccount: '', category: '', notes: '', tags: '',
  employeeContrib: '', employerContrib: ''
};

const TYPE_CONFIG = {
  expense:      { label: '↓ Expense',      color: 'var(--red)',    bg: 'rgba(220,38,38,0.08)',   border: 'var(--red)' },
  income:       { label: '↑ Income',       color: 'var(--green)',  bg: 'rgba(5,150,105,0.08)',   border: 'var(--green)' },
  transfer:     { label: '⇄ Transfer',     color: 'var(--blue)',   bg: 'rgba(37,99,235,0.08)',   border: 'var(--blue)' },
  contribution: { label: '🏛 Contribution', color: '#4f46e5',       bg: 'rgba(79,70,229,0.08)',   border: '#4f46e5' },
  interest:     { label: '% Interest',     color: '#0891b2',       bg: 'rgba(8,145,178,0.08)',   border: '#0891b2' },
};

function TxModal({ accounts, categories, onClose, onSave }) {
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const regularAccounts = accounts.filter(a => !a.isRetirement);
  const retirementAccounts = accounts.filter(a => a.isRetirement);

  // Which accounts are valid for the chosen type
  const sourceAccounts = ['contribution','interest'].includes(form.type) ? retirementAccounts
    : form.type === 'expense' ? regularAccounts
    : accounts;

  const filteredCats = categories.filter(c => c.type === (form.type === 'income' ? 'income' : 'expense'));
  const showCategory = ['income','expense'].includes(form.type);
  const isPF = form.account && retirementAccounts.find(a => a._id === form.account)?.type === 'pf';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...form, amount: +form.amount,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        category: showCategory && form.category ? form.category : undefined,
        toAccount: form.type === 'transfer' ? form.toAccount : undefined,
        contributionBreakdown: form.type === 'contribution' && isPF ? {
          employee: +form.employeeContrib || 0,
          employer: +form.employerContrib || 0,
        } : undefined
      };
      const r = await createTransaction(payload);
      onSave(r.data);
      toast.success('Transaction added!');
      onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">New Transaction</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {/* Type switcher */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 7, marginBottom: 20 }}>
            {Object.entries(TYPE_CONFIG).map(([t, conf]) => (
              <button key={t} type="button"
                style={{ padding: '9px 4px', borderRadius: 9, border: `1.5px solid ${form.type === t ? conf.border : 'var(--border)'}`, background: form.type === t ? conf.bg : 'var(--surface2)', color: form.type === t ? conf.color : 'var(--text3)', fontWeight: 700, fontSize: 11, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'DM Sans', textAlign: 'center', lineHeight: 1.3 }}
                onClick={() => { set('type', t); set('account', ''); }}>
                {conf.label}
              </button>
            ))}
          </div>

          {['contribution','interest'].includes(form.type) && (
            <div style={{ background: 'rgba(79,70,229,0.06)', border: '1px solid rgba(79,70,229,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#4f46e5', fontWeight: 500 }}>
              {form.type === 'contribution' ? '🏛 Contributions will be added to the selected retirement account balance.' : '% Interest earned will be credited to the selected retirement account.'}
            </div>
          )}

          <div className="form-row">
            <div className="form-group"><label className="form-label">Amount (₹) *</label>
              <input type="number" className="form-input" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" required min="0.01" step="0.01" /></div>
            <div className="form-group"><label className="form-label">Date *</label>
              <input type="date" className="form-input" value={form.date} onChange={e => set('date', e.target.value)} required /></div>
          </div>

          <div className="form-group"><label className="form-label">Description *</label>
            <input className="form-input" value={form.description} onChange={e => set('description', e.target.value)} placeholder="What was this?" required /></div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{form.type === 'transfer' ? 'From Account *' : form.type === 'contribution' ? 'Retirement Account *' : form.type === 'interest' ? 'Retirement Account *' : 'Account *'}</label>
              <select className="form-select" value={form.account} onChange={e => set('account', e.target.value)} required>
                <option value="">Select account...</option>
                {sourceAccounts.map(a => <option key={a._id} value={a._id}>{ACCOUNT_TYPES_ICON(a)} {a.name} ({fmt(a.balance)})</option>)}
              </select>
            </div>
            {form.type === 'transfer' ? (
              <div className="form-group">
                <label className="form-label">To Account *</label>
                <select className="form-select" value={form.toAccount} onChange={e => set('toAccount', e.target.value)} required>
                  <option value="">Select account...</option>
                  {accounts.filter(a => a._id !== form.account).map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                </select>
              </div>
            ) : showCategory ? (
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category} onChange={e => set('category', e.target.value)}>
                  <option value="">Select category...</option>
                  {filteredCats.map(c => <option key={c._id} value={c._id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
            ) : null}
          </div>

          {/* PF contribution breakdown */}
          {form.type === 'contribution' && isPF && (
            <div className="form-row">
              <div className="form-group"><label className="form-label">Employee Share (₹)</label>
                <input type="number" className="form-input" value={form.employeeContrib} onChange={e => set('employeeContrib', e.target.value)} placeholder="0" /></div>
              <div className="form-group"><label className="form-label">Employer Share (₹)</label>
                <input type="number" className="form-input" value={form.employerContrib} onChange={e => set('employerContrib', e.target.value)} placeholder="0" /></div>
            </div>
          )}

          <div className="form-group"><label className="form-label">Tags (comma separated)</label>
            <input className="form-input" value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="food, weekend, personal" /></div>
          <div className="form-group"><label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} style={{ minHeight: 56 }} /></div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Add Transaction'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Helper to show icon from account type
function ACCOUNT_TYPES_ICON(a) {
  const icons = { pf: '🏛', ppf: '🏅', nps: '🎯', savings: '🏦', checking: '💳', credit_card: '💴', cash: '💵', investment: '📈', wallet: '👛', other: '📂' };
  return icons[a.type] || '🏦';
}

const TX_COLOR = { income: 'var(--green)', expense: 'var(--red)', transfer: 'var(--blue)', contribution: '#4f46e5', interest: '#0891b2' };
const TX_SIGN = { income: '+', expense: '−', transfer: '⇄', contribution: '+', interest: '+' };

export default function Transactions() {
  const [data, setData] = useState({ transactions: [], total: 0 });
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters] = useState({ type: '', accountId: '', categoryId: '', search: '', page: 1 });

  const fetchTx = useCallback(() => {
    const params = { ...filters, limit: 40 };
    Object.keys(params).forEach(k => !params[k] && delete params[k]);
    setLoading(true);
    getTransactions(params).then(r => setData(r.data)).finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => { fetchTx(); }, [fetchTx]);
  useEffect(() => {
    getAccounts().then(r => setAccounts(r.data));
    getCategories().then(r => setCategories(r.data));
  }, []);

  const setFilter = (k, v) => setFilters(p => ({ ...p, [k]: v, page: 1 }));
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transaction? Account balance will be reversed.')) return;
    await deleteTransaction(id);
    toast.success('Deleted');
    fetchTx();
  };

  const { transactions, total } = data;
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalContrib = transactions.filter(t => t.type === 'contribution').reduce((s, t) => s + t.amount, 0);
  const totalInterest = transactions.filter(t => t.type === 'interest').reduce((s, t) => s + t.amount, 0);

  return (
    <div className="page fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div><h1 className="page-title">Transactions</h1><div className="page-sub">{total} total transactions</div></div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Transaction</button>
      </div>

      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Shown Income', val: totalIncome, color: 'var(--green)' },
          { label: 'Shown Expense', val: totalExpense, color: 'var(--red)' },
          { label: 'Contributions', val: totalContrib, color: '#4f46e5' },
          { label: 'Interest', val: totalInterest, color: '#0891b2' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 18px' }}>
            <div className="stat-label">{s.label}</div>
            <div style={{ fontFamily: 'DM Mono', fontSize: 17, fontWeight: 500, color: s.color }}>{fmt(s.val)}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 18, padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="form-input" style={{ maxWidth: 200 }} value={filters.search} onChange={e => setFilter('search', e.target.value)} placeholder="🔍 Search..." />
          <select className="form-select" style={{ maxWidth: 160 }} value={filters.type} onChange={e => setFilter('type', e.target.value)}>
            <option value="">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
            <option value="contribution">Contribution</option>
            <option value="interest">Interest</option>
          </select>
          <select className="form-select" style={{ maxWidth: 180 }} value={filters.accountId} onChange={e => setFilter('accountId', e.target.value)}>
            <option value="">All accounts</option>
            {accounts.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
          </select>
          <select className="form-select" style={{ maxWidth: 200 }} value={filters.categoryId} onChange={e => setFilter('categoryId', e.target.value)}>
            <option value="">All categories</option>
            {categories.map(c => <option key={c._id} value={c._id}>{c.icon} {c.name}</option>)}
          </select>
          {(filters.search || filters.type || filters.accountId || filters.categoryId) && (
            <button className="btn btn-ghost btn-sm" onClick={() => setFilters({ type: '', accountId: '', categoryId: '', search: '', page: 1 })}>✕ Clear</button>
          )}
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)' }}>{transactions.length} shown</div>
        </div>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : transactions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">↕</div>
          <div className="empty-title">No transactions found</div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add First Transaction</button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Description</th><th>Category</th><th>Account</th><th>Type</th><th style={{ textAlign: 'right' }}>Amount</th><th></th></tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx._id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text3)' }}>{fmtDate(tx.date)}</td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{tx.description}</div>
                      {tx.contributionBreakdown && (tx.contributionBreakdown.employee > 0 || tx.contributionBreakdown.employer > 0) && (
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                          Employee: {fmt(tx.contributionBreakdown.employee)} · Employer: {fmt(tx.contributionBreakdown.employer)}
                        </div>
                      )}
                      {tx.tags?.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
                          {tx.tags.map(tag => <span key={tag} style={{ fontSize: 10, padding: '1px 6px', background: 'var(--bg2)', borderRadius: 100, color: 'var(--text3)' }}>#{tag}</span>)}
                        </div>
                      )}
                    </td>
                    <td>
                      {tx.category && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '3px 9px', background: `${tx.category.color}12`, color: tx.category.color, borderRadius: 100, fontWeight: 600 }}>
                          {tx.category.icon} {tx.category.name}
                        </span>
                      )}
                      {tx.account?.isRetirement && !tx.category && (
                        <span style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(79,70,229,0.1)', color: '#4f46e5', borderRadius: 100, fontWeight: 600 }}>
                          {tx.account?.type?.toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {tx.account?.name}
                      {tx.type === 'transfer' && tx.toAccount && <span style={{ color: 'var(--text3)' }}> → {tx.toAccount.name}</span>}
                    </td>
                    <td>
                      <span className={`type-pill`} style={{ background: `${TX_COLOR[tx.type]}18`, color: TX_COLOR[tx.type], border: `1px solid ${TX_COLOR[tx.type]}30` }}>
                        {tx.type}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'DM Mono', fontWeight: 500, fontSize: 14, color: TX_COLOR[tx.type] || 'var(--text)', whiteSpace: 'nowrap' }}>
                      {TX_SIGN[tx.type] || ''}{fmt(tx.amount)}
                    </td>
                    <td><button className="btn btn-danger btn-sm" onClick={() => handleDelete(tx._id)}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {showModal && <TxModal accounts={accounts} categories={categories} onClose={() => setShowModal(false)} onSave={fetchTx} />}
    </div>
  );
}
