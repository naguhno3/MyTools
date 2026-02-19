import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getAccounts, createTransaction, getTransactions } from '../utils/api';
import { fmt, fmtDate, ACCOUNT_TYPES } from '../utils/helpers';

export default function Transfer() {
  const [accounts, setAccounts] = useState([]);
  const [recentTransfers, setRecentTransfers] = useState([]);
  const [form, setForm] = useState({
    fromAccount: '', toAccount: '', amount: '',
    description: 'Fund Transfer', date: new Date().toISOString().split('T')[0], notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    Promise.all([
      getAccounts(),
      getTransactions({ type: 'transfer', limit: 10 })
    ]).then(([a, t]) => {
      setAccounts(a.data);
      setRecentTransfers(t.data.transactions);
    }).finally(() => setLoadingData(false));
  }, []);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const fromAcc = accounts.find(a => a._id === form.fromAccount);
  const toAcc = accounts.find(a => a._id === form.toAccount);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.fromAccount === form.toAccount) return toast.error('Cannot transfer to the same account');
    if (+form.amount <= 0) return toast.error('Amount must be greater than 0');
    if (fromAcc && +form.amount > fromAcc.balance) {
      if (!window.confirm(`⚠️ Transfer amount (${fmt(+form.amount)}) exceeds ${fromAcc.name}'s balance (${fmt(fromAcc.balance)}). Continue?`)) return;
    }
    setLoading(true);
    try {
      const payload = {
        type: 'transfer', amount: +form.amount,
        description: form.description, date: form.date,
        account: form.fromAccount, toAccount: form.toAccount, notes: form.notes
      };
      await createTransaction(payload);
      toast.success(`✅ Transferred ${fmt(+form.amount)} from ${fromAcc?.name} to ${toAcc?.name}`);
      setForm(p => ({ ...p, amount: '', notes: '', description: 'Fund Transfer' }));
      // Refresh
      const [a, t] = await Promise.all([getAccounts(), getTransactions({ type: 'transfer', limit: 10 })]);
      setAccounts(a.data);
      setRecentTransfers(t.data.transactions);
    } catch (err) { toast.error(err.response?.data?.error || 'Transfer failed'); }
    finally { setLoading(false); }
  };

  if (loadingData) return <div className="page"><div className="loading-screen"><div className="spinner" /></div></div>;

  return (
    <div className="page fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 className="page-title">Transfer Funds</h1>
        <div className="page-sub">Move money between your accounts</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>
        {/* Transfer Form */}
        <div>
          <div className="card">
            <form onSubmit={handleSubmit}>
              {/* Account Selector Visual */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24 }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">From Account *</label>
                  <select className="form-select" value={form.fromAccount} onChange={e => set('fromAccount', e.target.value)} required style={{ fontSize: 14, fontWeight: 600 }}>
                    <option value="">Select source...</option>
                    {accounts.map(a => <option key={a._id} value={a._id}>{a.icon || ACCOUNT_TYPES[a.type]?.icon} {a.name} · {fmt(a.balance)}</option>)}
                  </select>
                </div>

                {/* Arrow */}
                <div style={{ padding: '20px 0 0', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-light)', border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 18, fontWeight: 700 }}>⇄</div>
                </div>

                <div style={{ flex: 1 }}>
                  <label className="form-label">To Account *</label>
                  <select className="form-select" value={form.toAccount} onChange={e => set('toAccount', e.target.value)} required style={{ fontSize: 14, fontWeight: 600 }}>
                    <option value="">Select destination...</option>
                    {accounts.filter(a => a._id !== form.fromAccount).map(a => <option key={a._id} value={a._id}>{a.icon || ACCOUNT_TYPES[a.type]?.icon} {a.name} · {fmt(a.balance)}</option>)}
                  </select>
                </div>
              </div>

              {/* Account Cards Preview */}
              {(fromAcc || toAcc) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 22 }}>
                  {fromAcc ? (
                    <div style={{ padding: '14px 16px', background: `${fromAcc.color}10`, borderRadius: 12, border: `1.5px solid ${fromAcc.color}25` }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>From</div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>{fromAcc.name}</div>
                      <div style={{ fontFamily: 'DM Mono', fontSize: 18, color: fromAcc.balance < 0 ? 'var(--red)' : fromAcc.color, fontWeight: 500 }}>{fmt(fromAcc.balance)}</div>
                      {+form.amount > 0 && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4, fontWeight: 600 }}>→ After: {fmt(fromAcc.balance - +form.amount)}</div>}
                    </div>
                  ) : <div style={{ padding: '14px', background: 'var(--bg)', borderRadius: 12, border: '1.5px dashed var(--border)' }}><div style={{ color: 'var(--text3)', fontSize: 13 }}>Select source account</div></div>}

                  {toAcc ? (
                    <div style={{ padding: '14px 16px', background: `${toAcc.color}10`, borderRadius: 12, border: `1.5px solid ${toAcc.color}25` }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>To</div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>{toAcc.name}</div>
                      <div style={{ fontFamily: 'DM Mono', fontSize: 18, color: toAcc.color, fontWeight: 500 }}>{fmt(toAcc.balance)}</div>
                      {+form.amount > 0 && <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 4, fontWeight: 600 }}>→ After: {fmt(toAcc.balance + +form.amount)}</div>}
                    </div>
                  ) : <div style={{ padding: '14px', background: 'var(--bg)', borderRadius: 12, border: '1.5px dashed var(--border)' }}><div style={{ color: 'var(--text3)', fontSize: 13 }}>Select destination account</div></div>}
                </div>
              )}

              {/* Amount - Big input */}
              <div className="form-group">
                <label className="form-label">Transfer Amount (₹) *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 20, color: 'var(--text3)', fontFamily: 'DM Mono' }}>₹</span>
                  <input type="number" className="form-input" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" required min="0.01" step="0.01"
                    style={{ paddingLeft: 36, fontSize: 24, fontFamily: 'DM Mono', fontWeight: 500, height: 60, letterSpacing: '-0.02em' }} />
                </div>
                {fromAcc && <div className="form-hint">Available: {fmt(fromAcc.balance)}</div>}
              </div>

              <div className="form-row">
                <div className="form-group"><label className="form-label">Description</label><input className="form-input" value={form.description} onChange={e => set('description', e.target.value)} placeholder="e.g. Savings transfer" /></div>
                <div className="form-group"><label className="form-label">Date *</label><input type="date" className="form-input" value={form.date} onChange={e => set('date', e.target.value)} required /></div>
              </div>
              <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes..." style={{ minHeight: 60 }} /></div>

              <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
                {loading ? 'Processing...' : `⇄ Transfer ${+form.amount > 0 ? fmt(+form.amount) : 'Funds'}`}
              </button>
            </form>
          </div>
        </div>

        {/* Right Panel */}
        <div>
          {/* Account Balances */}
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="section-title">Account Balances</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {accounts.map(acc => {
                const tc = ACCOUNT_TYPES[acc.type];
                return (
                  <div key={acc._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: `${acc.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>{acc.icon || tc?.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{acc.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{tc?.label}</div>
                    </div>
                    <div style={{ fontFamily: 'DM Mono', fontSize: 14, fontWeight: 500, color: acc.balance >= 0 ? 'var(--text)' : 'var(--red)' }}>{fmt(acc.balance)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Transfers */}
          <div className="card">
            <div className="section-title">Recent Transfers</div>
            {recentTransfers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text3)', fontSize: 13 }}>No transfers yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recentTransfers.map(tx => (
                  <div key={tx._id} style={{ padding: '10px 12px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{tx.description}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{tx.account?.name} → {tx.toAccount?.name} · {fmtDate(tx.date)}</div>
                      </div>
                      <div style={{ fontFamily: 'DM Mono', fontSize: 14, fontWeight: 600, color: 'var(--blue)' }}>{fmt(tx.amount)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
