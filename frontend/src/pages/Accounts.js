import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getAccounts, createAccount, updateAccount, deleteAccount } from '../utils/api';
import { fmt, ACCOUNT_TYPES, ACCOUNT_COLORS, RETIREMENT_TYPES, fmtDate } from '../utils/helpers';

const REGULAR_TYPES = Object.entries(ACCOUNT_TYPES).filter(([k]) => !RETIREMENT_TYPES.includes(k));
const RETIRE_TYPES = Object.entries(ACCOUNT_TYPES).filter(([k]) => RETIREMENT_TYPES.includes(k));

const defaultForm = {
  name: '', type: 'savings', balance: '', bankName: '', accountNumber: '',
  color: '#2563eb', icon: '', currency: 'INR', notes: '',
  interestRate: '', maturityDate: '', employerContribution: '', employeeContribution: ''
};

function AccountModal({ account, defaultType, onClose, onSave }) {
  const initType = account?.type || defaultType || 'savings';
  const [form, setForm] = useState(account ? {
    ...defaultForm, ...account, balance: account.balance,
    maturityDate: account.maturityDate ? account.maturityDate.split('T')[0] : '',
    interestRate: account.interestRate || '',
    employerContribution: account.employerContribution || '',
    employeeContribution: account.employeeContribution || '',
  } : { ...defaultForm, type: initType, icon: ACCOUNT_TYPES[initType]?.icon || '', color: ACCOUNT_TYPES[initType]?.color || '#2563eb' });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const isRetire = RETIREMENT_TYPES.includes(form.type);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...form,
        balance: +form.balance,
        initialBalance: !account ? +form.balance : undefined,
        interestRate: form.interestRate ? +form.interestRate : undefined,
        employerContribution: form.employerContribution ? +form.employerContribution : 0,
        employeeContribution: form.employeeContribution ? +form.employeeContribution : 0,
      };
      if (account) { const r = await updateAccount(account._id, payload); onSave(r.data); toast.success('Account updated!'); }
      else { const r = await createAccount(payload); onSave(r.data); toast.success('Account created!'); }
      onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{account ? 'Edit Account' : isRetire ? 'Add Retirement Account' : 'Add Account'}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Account Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {(isRetire ? RETIRE_TYPES : REGULAR_TYPES).map(([key, conf]) => (
                <button key={key} type="button"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 4px', background: form.type === key ? 'var(--accent-light)' : 'var(--surface2)', border: `1.5px solid ${form.type === key ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s' }}
                  onClick={() => { set('type', key); set('icon', conf.icon); set('color', conf.color); }}>
                  <span style={{ fontSize: 20 }}>{conf.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: form.type === key ? 'var(--accent)' : 'var(--text3)' }}>{conf.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group"><label className="form-label">Account Name *</label>
            <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder={isRetire ? 'e.g. My PF Account (EPFO)' : 'e.g. HDFC Salary Account'} required />
          </div>

          <div className="form-row">
            <div className="form-group"><label className="form-label">{account ? 'Current Balance (₹)' : 'Opening Balance (₹)'} *</label>
              <input type="number" className="form-input" value={form.balance} onChange={e => set('balance', e.target.value)} placeholder="0" required /></div>
            <div className="form-group"><label className="form-label">{isRetire ? 'Fund House / Employer' : 'Bank Name'}</label>
              <input className="form-input" value={form.bankName} onChange={e => set('bankName', e.target.value)} placeholder={isRetire ? 'e.g. EPFO / SBI / HDFC' : 'e.g. HDFC Bank'} /></div>
          </div>

          <div className="form-row">
            <div className="form-group"><label className="form-label">{isRetire ? 'UAN / PRAN / Account No.' : 'Last 4 Digits'}</label>
              <input className="form-input" value={form.accountNumber} onChange={e => set('accountNumber', e.target.value)} placeholder={isRetire ? 'Account / PRAN number' : 'XXXX'} maxLength={isRetire ? 20 : 4} /></div>
            {!isRetire && (
              <div className="form-group">
                <label className="form-label">Accent Color</label>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 2 }}>
                  {ACCOUNT_COLORS.map(c => (
                    <div key={c} onClick={() => set('color', c)} style={{ width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer', border: form.color === c ? '3px solid var(--text)' : '3px solid transparent', transition: 'border 0.15s' }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {isRetire && (
            <>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Interest / Return Rate (%)</label>
                  <input type="number" step="0.01" className="form-input" value={form.interestRate} onChange={e => set('interestRate', e.target.value)} placeholder={form.type === 'pf' ? '8.25' : form.type === 'ppf' ? '7.1' : 'Market linked'} /></div>
                <div className="form-group"><label className="form-label">Maturity Date</label>
                  <input type="date" className="form-input" value={form.maturityDate} onChange={e => set('maturityDate', e.target.value)} /></div>
              </div>
              {form.type === 'pf' && (
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Monthly Employee Contribution (₹)</label>
                    <input type="number" className="form-input" value={form.employeeContribution} onChange={e => set('employeeContribution', e.target.value)} placeholder="e.g. 1800" /></div>
                  <div className="form-group"><label className="form-label">Monthly Employer Contribution (₹)</label>
                    <input type="number" className="form-input" value={form.employerContribution} onChange={e => set('employerContribution', e.target.value)} placeholder="e.g. 1800" /></div>
                </div>
              )}
            </>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : account ? 'Update' : 'Create Account'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editAccount, setEditAccount] = useState(null);
  const [defaultType, setDefaultType] = useState('savings');
  const [tab, setTab] = useState('regular');

  useEffect(() => {
    getAccounts().then(r => setAccounts(r.data)).finally(() => setLoading(false));
  }, []);

  const handleSave = (acc) => {
    setAccounts(prev => {
      const idx = prev.findIndex(a => a._id === acc._id);
      if (idx >= 0) { const n = [...prev]; n[idx] = acc; return n; }
      return [...prev, acc];
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deactivate this account?')) return;
    await deleteAccount(id);
    setAccounts(prev => prev.filter(a => a._id !== id));
    toast.success('Account removed');
  };

  const openAdd = (type = 'savings') => {
    setEditAccount(null);
    setDefaultType(type);
    setShowModal(true);
  };

  const regularAccounts = accounts.filter(a => !a.isRetirement);
  const retirementAccounts = accounts.filter(a => a.isRetirement);
  const regularBalance = regularAccounts.reduce((s, a) => s + a.balance, 0);
  const retirementBalance = retirementAccounts.reduce((s, a) => s + a.balance, 0);
  const shown = tab === 'regular' ? regularAccounts : retirementAccounts;

  if (loading) return <div className="page"><div className="loading-screen"><div className="spinner" /></div></div>;

  return (
    <div className="page fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">Accounts</h1>
          <div className="page-sub">{accounts.length} accounts · Net worth: <strong style={{ color: 'var(--blue)' }}>{fmt(regularBalance + retirementBalance)}</strong></div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => openAdd('pf')}>+ Retirement Account</button>
          <button className="btn btn-primary" onClick={() => openAdd('savings')}>+ Regular Account</button>
        </div>
      </div>

      {/* Summary Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: '18px 22px', borderLeft: '4px solid var(--accent)' }}>
          <div className="stat-label">Regular Accounts Balance</div>
          <div style={{ fontFamily: 'DM Mono', fontSize: 26, color: regularBalance >= 0 ? 'var(--text)' : 'var(--red)', marginTop: 4 }}>{fmt(regularBalance)}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{regularAccounts.length} account{regularAccounts.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="card" style={{ padding: '18px 22px', borderLeft: '4px solid #4f46e5' }}>
          <div className="stat-label">Retirement Portfolio</div>
          <div style={{ fontFamily: 'DM Mono', fontSize: 26, color: '#4f46e5', marginTop: 4 }}>{fmt(retirementBalance)}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{retirementAccounts.length} account{retirementAccounts.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'regular' ? 'active' : ''}`} onClick={() => setTab('regular')}>Regular Accounts ({regularAccounts.length})</button>
        <button className={`tab ${tab === 'retirement' ? 'active' : ''}`} onClick={() => setTab('retirement')}>Retirement Accounts ({retirementAccounts.length})</button>
      </div>

      {shown.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">{tab === 'retirement' ? '🏛' : '🏦'}</div>
          <div className="empty-title">{tab === 'retirement' ? 'No retirement accounts' : 'No regular accounts'}</div>
          <div className="empty-desc">{tab === 'retirement' ? 'Add your PF, PPF or NPS accounts to track your retirement corpus.' : 'Add savings, checking or credit card accounts.'}</div>
          <button className="btn btn-primary btn-lg" onClick={() => openAdd(tab === 'retirement' ? 'pf' : 'savings')}>
            {tab === 'retirement' ? '+ Add Retirement Account' : '+ Add Account'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
          {shown.map(acc => {
            const tc = ACCOUNT_TYPES[acc.type];
            return (
              <div key={acc._id} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: acc.color || tc?.color }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `${acc.color || tc?.color}15`, border: `1px solid ${acc.color || tc?.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                      {acc.icon || tc?.icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{acc.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>
                        {tc?.label}{acc.bankName ? ` · ${acc.bankName}` : ''}{acc.accountNumber ? ` · ${acc.accountNumber}` : ''}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setEditAccount(acc); setShowModal(true); }}>✏️</button>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(acc._id)}>×</button>
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Balance</div>
                  <div style={{ fontFamily: 'DM Mono', fontSize: 26, fontWeight: 500, color: acc.isRetirement ? (acc.color || tc?.color) : acc.balance >= 0 ? 'var(--text)' : 'var(--red)' }}>{fmt(acc.balance)}</div>
                </div>

                {/* Retirement extras */}
                {acc.isRetirement && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    {acc.interestRate && (
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rate</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>{acc.interestRate}% p.a.</div>
                      </div>
                    )}
                    {acc.maturityDate && (
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Matures</div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{fmtDate(acc.maturityDate)}</div>
                      </div>
                    )}
                    {acc.type === 'pf' && acc.employeeContribution > 0 && (
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Employee</div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{fmt(acc.employeeContribution)}/mo</div>
                      </div>
                    )}
                    {acc.type === 'pf' && acc.employerContribution > 0 && (
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Employer</div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{fmt(acc.employerContribution)}/mo</div>
                      </div>
                    )}
                  </div>
                )}

                {acc.initialBalance !== acc.balance && (
                  <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text3)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Opening: {fmt(acc.initialBalance)}</span>
                    <span style={{ color: acc.balance >= acc.initialBalance ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                      {acc.balance >= acc.initialBalance ? '+' : ''}{fmt(acc.balance - acc.initialBalance)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <AccountModal
          account={editAccount}
          defaultType={defaultType}
          onClose={() => { setShowModal(false); setEditAccount(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
