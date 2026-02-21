import React, { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  getLoans, createLoan, updateLoan, deleteLoan, getLoanSummary,
  getAmortization, addLoanPayment, deleteLoanPayment,
  addLoanDoc, deleteLoanDoc
} from '../utils/api';
import { fmt, fmtDate } from '../utils/helpers';
import { DocPicker, DocLink } from '../components/DocPicker';
import './Loans.css';

// ─── Config ───────────────────────────────────────────────────────────────────
const LOAN_TYPES = {
  home:       { icon: '🏠', label: 'Home Loan',       color: '#2563eb', gradient: 'linear-gradient(135deg,#1d4ed8,#3b82f6)' },
  car:        { icon: '🚗', label: 'Car Loan',         color: '#059669', gradient: 'linear-gradient(135deg,#047857,#10b981)' },
  personal:   { icon: '👤', label: 'Personal Loan',    color: '#7c3aed', gradient: 'linear-gradient(135deg,#6d28d9,#8b5cf6)' },
  education:  { icon: '🎓', label: 'Education Loan',   color: '#0891b2', gradient: 'linear-gradient(135deg,#0e7490,#06b6d4)' },
  gold:       { icon: '🥇', label: 'Gold Loan',        color: '#d97706', gradient: 'linear-gradient(135deg,#b45309,#f59e0b)' },
  business:   { icon: '💼', label: 'Business Loan',    color: '#dc2626', gradient: 'linear-gradient(135deg,#b91c1c,#ef4444)' },
  lap:        { icon: '🏢', label: 'Loan Against Prop',color: '#0d9488', gradient: 'linear-gradient(135deg,#0f766e,#14b8a6)' },
  other:      { icon: '📋', label: 'Other Loan',       color: '#6b7280', gradient: 'linear-gradient(135deg,#4b5563,#9ca3af)' },
};

// ─── Pure EMI Math (client-side, no server needed for calculator) ─────────────
function calcEMI(p, annualRate, months) {
  if (!p || !months) return 0;
  if (annualRate === 0) return Math.round(p / months);
  const r = annualRate / 12 / 100;
  return Math.round((p * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1));
}

function buildSchedule(principal, annualRate, months, emiAmt) {
  const r = annualRate / 12 / 100;
  let bal = principal;
  const rows = [];
  for (let i = 1; i <= months; i++) {
    const interest = Math.round(bal * r);
    const prinComp = Math.min(emiAmt - interest, bal);
    bal = Math.max(0, bal - prinComp);
    rows.push({ emiNumber: i, principal: prinComp, interest, closing: bal, emi: prinComp + interest });
    if (bal === 0) break;
  }
  return rows;
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e4e8f4', borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 16px rgba(15,22,41,0.1)' }}>
      {label && <div style={{ color: '#9aa3be', marginBottom: 5, fontWeight: 600 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || '#1a2560', fontWeight: 600 }}>{p.name}: {fmt(p.value)}</div>
      ))}
    </div>
  );
};

// ─── Add Loan Modal ───────────────────────────────────────────────────────────
const EMPTY_LOAN = {
  name: '', loanType: 'home', lender: '', loanAccountNumber: '', branchName: '',
  loanOfficer: '', lenderPhone: '', lenderEmail: '',
  principalAmount: '', interestRate: '', tenureMonths: '',
  disbursalDate: new Date().toISOString().split('T')[0],
  emiDay: 1, notes: '', color: ''
};

function LoanModal({ loan, onClose, onSave }) {
  const [form, setForm] = useState(loan ? {
    ...EMPTY_LOAN, ...loan,
    disbursalDate: loan.disbursalDate?.split('T')[0] || EMPTY_LOAN.disbursalDate,
    color: loan.color || LOAN_TYPES[loan.loanType]?.color || '#2563eb',
  } : { ...EMPTY_LOAN, color: '#2563eb' });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('terms');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Live EMI preview
  const previewEMI = calcEMI(+form.principalAmount, +form.interestRate, +form.tenureMonths);
  const totalPayable = previewEMI * +form.tenureMonths;
  const totalInterest = totalPayable - +form.principalAmount;
  const lt = LOAN_TYPES[form.loanType];

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...form,
        principalAmount: +form.principalAmount, interestRate: +form.interestRate,
        tenureMonths: +form.tenureMonths, emiDay: +form.emiDay || 1,
        color: form.color || lt?.color,
      };
      let saved;
      if (loan) { saved = (await updateLoan(loan._id, payload)).data; toast.success('Loan updated!'); }
      else { saved = (await createLoan(payload)).data; toast.success('Loan added! 💳'); }
      onSave(saved); onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div className="modal-title">{loan ? 'Edit Loan' : 'Add New Loan'}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {/* Loan type grid */}
          <div className="form-group">
            <label className="form-label">Loan Type *</label>
            <div className="loan-type-grid">
              {Object.entries(LOAN_TYPES).map(([key, t]) => (
                <button key={key} type="button" onClick={() => { set('loanType', key); set('color', t.color); }}
                  style={{ padding: '10px 6px', borderRadius: 10, border: `2px solid ${form.loanType === key ? t.color : 'var(--border)'}`, background: form.loanType === key ? `${t.color}12` : 'var(--surface2)', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                  <div style={{ fontSize: 20, marginBottom: 3 }}>{t.icon}</div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: form.loanType === key ? t.color : 'var(--text3)', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.2 }}>{t.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="tabs" style={{ marginBottom: 16 }}>
            {[['terms', '📋 Loan Terms'], ['lender', '🏦 Lender Details']].map(([t, label]) => (
              <button key={t} type="button" className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{label}</button>
            ))}
          </div>

          {tab === 'terms' && <>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Loan Name / Label *</label>
                <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder={`e.g. ${lt?.label} — ${form.lender || 'HDFC'}`} required />
              </div>
              <div className="form-group">
                <label className="form-label">Lender (Bank / NBFC) *</label>
                <input className="form-input" value={form.lender} onChange={e => set('lender', e.target.value)} placeholder="e.g. HDFC Bank, SBI" required />
              </div>
            </div>
            <div className="form-row-3">
              <div className="form-group">
                <label className="form-label">Loan Amount (₹) *</label>
                <input type="number" className="form-input" value={form.principalAmount} onChange={e => set('principalAmount', e.target.value)} placeholder="5000000" required />
              </div>
              <div className="form-group">
                <label className="form-label">Interest Rate (% p.a.) *</label>
                <input type="number" step="0.01" className="form-input" value={form.interestRate} onChange={e => set('interestRate', e.target.value)} placeholder="8.50" required />
              </div>
              <div className="form-group">
                <label className="form-label">Tenure (Months) *</label>
                <input type="number" className="form-input" value={form.tenureMonths} onChange={e => set('tenureMonths', e.target.value)} placeholder="240" required />
                <div className="form-hint">{form.tenureMonths ? `${Math.floor(+form.tenureMonths / 12)} yrs ${+form.tenureMonths % 12} mos` : ''}</div>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Disbursal Date *</label>
                <input type="date" className="form-input" value={form.disbursalDate} onChange={e => set('disbursalDate', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">EMI Due Day (of month)</label>
                <input type="number" min="1" max="31" className="form-input" value={form.emiDay} onChange={e => set('emiDay', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} style={{ minHeight: 60 }} placeholder="Any notes about this loan..." />
            </div>

            {/* Live EMI Preview */}
            {previewEMI > 0 && (
              <div className="loan-emi-preview" style={{ borderColor: lt?.color + '33', background: lt?.color + '08' }}>
                <div className="loan-emi-preview-title" style={{ color: lt?.color }}>📊 EMI Preview</div>
                <div className="loan-emi-preview-grid">
                  <div>
                    <div className="loan-emi-label">Monthly EMI</div>
                    <div className="loan-emi-value" style={{ color: lt?.color, fontSize: 28 }}>{fmt(previewEMI)}</div>
                  </div>
                  <div>
                    <div className="loan-emi-label">Total Payable</div>
                    <div className="loan-emi-value">{fmt(totalPayable)}</div>
                  </div>
                  <div>
                    <div className="loan-emi-label">Total Interest</div>
                    <div className="loan-emi-value" style={{ color: 'var(--red)' }}>{fmt(totalInterest)}</div>
                  </div>
                  <div>
                    <div className="loan-emi-label">Interest %</div>
                    <div className="loan-emi-value">{((totalInterest / +form.principalAmount) * 100).toFixed(1)}%</div>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 5, fontWeight: 600 }}>Principal vs Interest</div>
                  <div style={{ height: 8, borderRadius: 4, background: 'var(--bg2)', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${(+form.principalAmount / totalPayable) * 100}%`, background: lt?.gradient || lt?.color, borderRadius: '4px 0 0 4px', transition: 'width 0.4s' }} />
                    <div style={{ flex: 1, background: '#fca5a5' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', marginTop: 4, fontWeight: 600 }}>
                    <span style={{ color: lt?.color }}>Principal: {((+form.principalAmount / totalPayable) * 100).toFixed(0)}%</span>
                    <span style={{ color: 'var(--red)' }}>Interest: {((totalInterest / totalPayable) * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            )}
          </>}

          {tab === 'lender' && <>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Loan Account Number</label>
                <input className="form-input" value={form.loanAccountNumber} onChange={e => set('loanAccountNumber', e.target.value)} placeholder="Loan account / reference number" />
              </div>
              <div className="form-group">
                <label className="form-label">Branch Name</label>
                <input className="form-input" value={form.branchName} onChange={e => set('branchName', e.target.value)} placeholder="e.g. Koramangala Branch" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Loan Officer / RM Name</label>
                <input className="form-input" value={form.loanOfficer} onChange={e => set('loanOfficer', e.target.value)} placeholder="Contact person" />
              </div>
              <div className="form-group">
                <label className="form-label">Lender Phone</label>
                <input className="form-input" value={form.lenderPhone} onChange={e => set('lenderPhone', e.target.value)} placeholder="+91 9876543210" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Lender Email</label>
              <input className="form-input" value={form.lenderEmail} onChange={e => set('lenderEmail', e.target.value)} placeholder="loans@bank.com" />
            </div>
          </>}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ background: lt?.gradient, border: 'none' }}>
              {saving ? 'Saving...' : loan ? 'Update Loan' : 'Add Loan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Payment Modal ────────────────────────────────────────────────────────────
function PaymentModal({ loan, onClose, onSave }) {
  const [form, setForm] = useState({
    type: 'emi', amount: loan.currentEmi || loan.emiAmount || '',
    date: new Date().toISOString().split('T')[0], notes: '',
    receiptNumber: '', prepaymentAction: 'reduce_tenure',
  });
  const [saving, setSaving] = useState(false);
  const lt = LOAN_TYPES[loan.loanType];
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Auto-fill EMI amount when switching type
  const handleTypeChange = (t) => {
    set('type', t);
    if (t === 'emi') set('amount', loan.currentEmi || loan.emiAmount || '');
    else set('amount', '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...form, amount: +form.amount };
      const r = await addLoanPayment(loan._id, payload);
      onSave(r.data); toast.success(form.type === 'emi' ? 'EMI recorded! ✅' : 'Prepayment recorded! 🎉'); onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  const outstanding = loan.outstandingPrincipal || loan.principalAmount;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <div className="modal-title">Record Payment</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ padding: '12px 16px', borderRadius: 11, background: `${lt?.color}10`, border: `1px solid ${lt?.color}25`, marginBottom: 18 }}>
          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{loan.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>Outstanding: <strong style={{ fontFamily: 'DM Mono', color: lt?.color }}>{fmt(outstanding)}</strong> · EMI: <strong style={{ fontFamily: 'DM Mono' }}>{fmt(loan.currentEmi || loan.emiAmount)}</strong></div>
        </div>
        <form onSubmit={handleSubmit}>
          {/* Payment type */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
            {[
              ['emi', '💳 EMI', '#2563eb'],
              ['prepayment', '⚡ Prepayment', '#059669'],
              ['part_payment', '💰 Part Payment', '#7c3aed'],
            ].map(([t, label, color]) => (
              <button key={t} type="button" onClick={() => handleTypeChange(t)}
                style={{ padding: '10px 6px', borderRadius: 10, border: `2px solid ${form.type === t ? color : 'var(--border)'}`, background: form.type === t ? `${color}10` : 'var(--surface2)', color: form.type === t ? color : 'var(--text3)', fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center' }}>
                {label}
              </button>
            ))}
          </div>

          <div className="form-group">
            <label className="form-label">Amount (₹) *</label>
            <input type="number" className="form-input" value={form.amount} onChange={e => set('amount', e.target.value)} required placeholder="0"
              style={{ fontSize: 22, fontFamily: 'DM Mono', fontWeight: 600 }} autoFocus />
            {form.type === 'emi' && (
              <div className="form-hint">Standard EMI: {fmt(loan.currentEmi || loan.emiAmount)}</div>
            )}
            {(form.type === 'prepayment' || form.type === 'part_payment') && +form.amount > 0 && (
              <div style={{ fontSize: 12, marginTop: 6, color: 'var(--green)', fontWeight: 600 }}>
                This will reduce outstanding from {fmt(outstanding)} → {fmt(Math.max(0, outstanding - +form.amount))}
              </div>
            )}
          </div>

          {/* Prepayment action choice */}
          {(form.type === 'prepayment' || form.type === 'part_payment') && (
            <div className="form-group">
              <label className="form-label">After Prepayment, Prefer To</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  ['reduce_tenure', '📅 Reduce Tenure', 'Close loan faster, same EMI'],
                  ['reduce_emi', '📉 Reduce EMI', 'Lower monthly payment, same tenure'],
                ].map(([val, label, sub]) => (
                  <div key={val} onClick={() => set('prepaymentAction', val)}
                    style={{ padding: '12px', borderRadius: 10, border: `2px solid ${form.prepaymentAction === val ? '#059669' : 'var(--border)'}`, background: form.prepaymentAction === val ? 'rgba(5,150,105,0.06)' : 'var(--surface2)', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: form.prepaymentAction === val ? '#059669' : 'var(--text2)', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{sub}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input type="date" className="form-input" value={form.date} onChange={e => set('date', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Receipt / Ref Number</label>
              <input className="form-input" value={form.receiptNumber} onChange={e => set('receiptNumber', e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <input className="form-input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes" />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ background: lt?.gradient, border: 'none' }}>
              {saving ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Loan Detail Component ────────────────────────────────────────────────────
function LoanDetail({ loan: initLoan, onUpdate }) {
  const [loan, setLoan] = useState(initLoan);
  const [tab, setTab] = useState('overview');
  const [amortData, setAmortData] = useState(null);
  const [amortLoading, setAmortLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [amortPage, setAmortPage] = useState(0);
  const AMORT_PAGE_SIZE = 24;

  useEffect(() => { setLoan(initLoan); setAmortData(null); setAmortPage(0); }, [initLoan]);

  const loadAmort = useCallback(async () => {
    if (amortData) return;
    setAmortLoading(true);
    try {
      const r = await getAmortization(loan._id);
      setAmortData(r.data.schedule);
    } catch { toast.error('Failed to load schedule'); }
    finally { setAmortLoading(false); }
  }, [loan._id, amortData]);

  useEffect(() => {
    if (tab === 'amortization' || tab === 'charts') loadAmort();
  }, [tab, loadAmort]);

  const lt = LOAN_TYPES[loan.loanType] || LOAN_TYPES.other;
  const outstanding = loan.outstandingPrincipal ?? loan.principalAmount;
  const completionPct = loan.principalAmount > 0 ? Math.min(100, ((loan.principalAmount - outstanding) / loan.principalAmount) * 100) : 0;
  const totalPaid = loan.totalPaidAmount || 0;
  const monthsRemaining = loan.currentTenureMonths ?? loan.tenureMonths;
  const yearsRemaining = Math.floor(monthsRemaining / 12);
  const mosRemaining = monthsRemaining % 12;
  const isClosed = loan.status === 'closed';

  // Chart data from amortization schedule
  const chartData = useMemo(() => {
    if (!amortData) return [];
    // Yearly aggregation
    const yearly = {};
    amortData.forEach(row => {
      const yr = Math.ceil(row.emiNumber / 12);
      if (!yearly[yr]) yearly[yr] = { year: `Y${yr}`, principal: 0, interest: 0, balance: 0 };
      yearly[yr].principal += row.principal;
      yearly[yr].interest += row.interest;
      yearly[yr].balance = row.closing;
    });
    return Object.values(yearly);
  }, [amortData]);

  const pieData = [
    { name: 'Principal Paid', value: loan.totalPrincipalPaid || 0, color: lt.color },
    { name: 'Interest Paid', value: loan.totalInterestPaid || 0, color: '#fca5a5' },
    { name: 'Outstanding', value: outstanding, color: '#e4e8f4' },
  ].filter(d => d.value > 0);

  const handleSave = (updated) => { setLoan(updated); onUpdate(updated); setAmortData(null); };

  const handleDeletePayment = async (pid) => {
    if (!window.confirm('Delete this payment record?')) return;
    try {
      const r = await deleteLoanPayment(loan._id, pid);
      handleSave(r.data); toast.success('Payment deleted');
    } catch { toast.error('Failed'); }
  };

  // Link / unlink vault document to loan
  const handleLinkDoc = async (vaultDoc) => {
    try {
      const r = await addLoanDoc(loan._id, {
        name: vaultDoc.name,
        docType: vaultDoc.category,
        linkedDocId: vaultDoc._id,
        notes: '',
      });
      handleSave(r.data);
      toast.success('Document linked! 🔗');
      setShowDocPicker(false);
    } catch { toast.error('Failed to link document'); }
  };

  const handleUnlinkDoc = async (docSubId) => {
    if (!window.confirm('Remove this document link?')) return;
    try {
      const r = await deleteLoanDoc(loan._id, docSubId);
      handleSave(r.data);
      toast.success('Document unlinked');
    } catch { toast.error('Failed'); }
  };

  // Estimated closure date
  const closureDate = useMemo(() => {
    if (!monthsRemaining) return null;
    const d = new Date();
    d.setMonth(d.getMonth() + monthsRemaining);
    return d;
  }, [monthsRemaining]);

  // Interest savings from prepayments
  const interestSaved = useMemo(() => {
    if (!loan.totalPrepaid || !loan.tenureMonths || !loan.currentTenureMonths) return 0;
    const originalInterest = (loan.emiAmount * loan.tenureMonths) - loan.principalAmount;
    const projectedInterest = (loan.currentEmi * (loan.paidEmis + monthsRemaining)) - loan.principalAmount;
    return Math.max(0, originalInterest - projectedInterest);
  }, [loan, monthsRemaining]);

  return (
    <div className="loan-detail fade-in">
      {/* ── Hero ── */}
      <div className="loan-hero" style={{ background: lt.gradient }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 40, lineHeight: 1 }}>{lt.icon}</div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{lt.label}</div>
              <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>{loan.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>🏦 {loan.lender}{loan.loanAccountNumber ? ` · A/c ${loan.loanAccountNumber}` : ''}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            {isClosed ? (
              <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 100, background: 'rgba(255,255,255,0.2)', color: '#fff', backdropFilter: 'blur(4px)' }}>✅ CLOSED</span>
            ) : (
              <button className="btn btn-sm" onClick={() => setShowPaymentModal(true)} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(4px)', fontWeight: 700 }}>
                + Record Payment
              </button>
            )}
            <button className="btn btn-sm" onClick={() => setShowEditModal(true)} style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.15)' }}>✏️ Edit</button>
          </div>
        </div>

        {/* ── Completion bar ── */}
        <div style={{ marginTop: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Loan Progress</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', fontFamily: 'DM Mono' }}>{completionPct.toFixed(1)}% repaid</span>
          </div>
          <div style={{ height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${completionPct}%`, background: 'rgba(255,255,255,0.85)', borderRadius: 5, transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
          </div>
        </div>

        {/* ── Hero stats ── */}
        <div className="loan-hero-stats">
          <div>
            <div className="loan-hero-label">Outstanding</div>
            <div className="loan-hero-val" style={{ fontSize: 22, fontWeight: 700 }}>{fmt(outstanding)}</div>
          </div>
          <div>
            <div className="loan-hero-label">Monthly EMI</div>
            <div className="loan-hero-val">{fmt(loan.currentEmi || loan.emiAmount)}</div>
          </div>
          <div>
            <div className="loan-hero-label">Total Paid</div>
            <div className="loan-hero-val">{fmt(totalPaid)}</div>
          </div>
          <div>
            <div className="loan-hero-label">Tenure Left</div>
            <div className="loan-hero-val">{isClosed ? '—' : `${yearsRemaining}y ${mosRemaining}m`}</div>
          </div>
          <div>
            <div className="loan-hero-label">Rate p.a.</div>
            <div className="loan-hero-val">{loan.interestRate}%</div>
          </div>
        </div>
      </div>

      {/* ── Closure estimate & prepay savings ── */}
      {!isClosed && (
        <div style={{ display: 'grid', gridTemplateColumns: loan.totalPrepaid > 0 ? '1fr 1fr' : '1fr', gap: 14, marginTop: 18 }}>
          <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>📅</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Estimated Closure</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>{closureDate ? fmtDate(closureDate) : '—'}</div>
            </div>
          </div>
          {loan.totalPrepaid > 0 && (
            <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.18)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>💰</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Prepaid So Far</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)', marginTop: 2, fontFamily: 'DM Mono' }}>{fmt(loan.totalPrepaid)}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="tabs" style={{ marginTop: 22, overflowX: 'auto', whiteSpace: 'nowrap' }}>
        {[['overview', '📊 Overview'], ['payments', `💳 Payments (${(loan.payments || []).length})`], ['amortization', '📋 Schedule'], ['charts', '📈 Charts'], ['documents', `📎 Documents (${(loan.documents || []).length})`]].map(([t, label]) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{label}</button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {tab === 'overview' && (
        <div className="loan-overview-grid">
          {/* Key metrics */}
          <div className="card">
            <div className="section-title">Loan Summary</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                ['Original Amount', fmt(loan.principalAmount), false],
                ['Disbursed On', fmtDate(loan.disbursalDate), false],
                ['Original Tenure', `${Math.floor(loan.tenureMonths / 12)}y ${loan.tenureMonths % 12}m (${loan.tenureMonths} months)`, false],
                ['Original EMI', fmt(loan.emiAmount), false],
                ['Total Interest (original)', fmt((loan.emiAmount * loan.tenureMonths) - loan.principalAmount), false],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--bg)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{label}</span>
                  <span style={{ fontFamily: 'DM Mono', fontWeight: 500, fontSize: 13 }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Current state */}
          <div className="card">
            <div className="section-title">Current Status</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                ['Outstanding Principal', fmt(outstanding), lt.color],
                ['Current EMI', fmt(loan.currentEmi || loan.emiAmount), lt.color],
                ['EMIs Paid', `${loan.paidEmis || 0} of ${loan.tenureMonths}`, null],
                ['Principal Repaid', fmt(loan.totalPrincipalPaid || 0), '#059669'],
                ['Interest Paid', fmt(loan.totalInterestPaid || 0), '#dc2626'],
                ['Total Prepaid', fmt(loan.totalPrepaid || 0), '#7c3aed'],
              ].map(([label, val, color]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--bg)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{label}</span>
                  <span style={{ fontFamily: 'DM Mono', fontWeight: 600, fontSize: 14, color: color || 'var(--text)' }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Lender details */}
          {loan.lender && (
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <div className="section-title">Lender Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
                {[
                  ['Bank / NBFC', loan.lender],
                  ['Account Number', loan.loanAccountNumber || '—'],
                  ['Branch', loan.branchName || '—'],
                  ['Loan Officer', loan.loanOfficer || '—'],
                  ['Phone', loan.lenderPhone || '—'],
                  ['Email', loan.lenderEmail || '—'],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>{val}</div>
                  </div>
                ))}
              </div>
              {loan.notes && <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 10, fontSize: 13, color: 'var(--text2)', border: '1px solid var(--border)' }}>{loan.notes}</div>}
            </div>
          )}
        </div>
      )}

      {/* ── Payments Tab ── */}
      {tab === 'payments' && (
        <div style={{ marginTop: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Payment History ({(loan.payments || []).length})</div>
            {!isClosed && <button className="btn btn-primary btn-sm" onClick={() => setShowPaymentModal(true)}>+ Record Payment</button>}
          </div>

          {(loan.payments || []).length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 0' }}>
              <div className="empty-icon">💳</div>
              <div className="empty-title">No Payments Recorded</div>
              <div className="empty-desc">Record EMI payments and prepayments to track your loan progress.</div>
              {!isClosed && <button className="btn btn-primary" onClick={() => setShowPaymentModal(true)}>+ Record First Payment</button>}
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Principal</th>
                      <th>Interest</th>
                      <th>Outstanding After</th>
                      <th>Notes</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...loan.payments].sort((a, b) => new Date(b.date) - new Date(a.date)).map((p, i) => {
                      const typeConfig = { emi: ['💳 EMI', '#2563eb', 'rgba(37,99,235,0.09)'], prepayment: ['⚡ Prepay', '#059669', 'rgba(5,150,105,0.09)'], part_payment: ['💰 Part', '#7c3aed', 'rgba(124,58,237,0.09)'] }[p.type] || [p.type, '#6b7280', '#f4f4f4'];
                      return (
                        <tr key={p._id || i}>
                          <td style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Mono' }}>{p.emiNumber ? `EMI ${p.emiNumber}` : '—'}</td>
                          <td style={{ fontSize: 12, whiteSpace: 'nowrap', color: 'var(--text2)' }}>{fmtDate(p.date)}</td>
                          <td><span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 100, background: typeConfig[2], color: typeConfig[1] }}>{typeConfig[0]}</span></td>
                          <td style={{ fontFamily: 'DM Mono', fontWeight: 600, color: 'var(--text)' }}>{fmt(p.amount)}</td>
                          <td style={{ fontFamily: 'DM Mono', fontSize: 12, color: lt.color }}>{p.principalComponent ? fmt(p.principalComponent) : '—'}</td>
                          <td style={{ fontFamily: 'DM Mono', fontSize: 12, color: 'var(--red)' }}>{p.interestComponent ? fmt(p.interestComponent) : '—'}</td>
                          <td style={{ fontFamily: 'DM Mono', fontSize: 12, fontWeight: 600 }}>{p.outstandingAfter != null ? fmt(p.outstandingAfter) : '—'}</td>
                          <td style={{ fontSize: 12, color: 'var(--text3)' }}>{p.notes || '—'}</td>
                          <td><button className="btn btn-danger btn-icon btn-sm" style={{ width: 24, height: 24, fontSize: 10, borderRadius: 6 }} onClick={() => handleDeletePayment(p._id)}>×</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Amortization Tab ── */}
      {tab === 'amortization' && (
        <div style={{ marginTop: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div className="section-title" style={{ marginBottom: 2 }}>Amortization Schedule</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Based on current outstanding of {fmt(outstanding)} at {loan.interestRate}% p.a.</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {amortData && <span style={{ fontSize: 12, color: 'var(--text3)' }}>{amortData.length} EMIs remaining</span>}
            </div>
          </div>
          {amortLoading ? (
            <div className="loading-screen"><div className="spinner" /></div>
          ) : amortData ? (
            <>
              {/* Running totals banner */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
                {[
                  ['Total EMIs', amortData.length, 'var(--text)', false],
                  ['Total Payable', amortData.reduce((s, r) => s + r.emi, 0), lt.color, true],
                  ['Total Principal', amortData.reduce((s, r) => s + r.principal, 0), '#059669', true],
                  ['Total Interest', amortData.reduce((s, r) => s + r.interest, 0), '#dc2626', true],
                ].map(([label, val, color, isCurrency]) => (
                  <div key={label} style={{ padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
                    <div style={{ fontFamily: 'DM Mono', fontSize: 17, fontWeight: 600, color }}>{isCurrency ? fmt(val) : val}</div>
                  </div>
                ))}
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-wrap" style={{ maxHeight: 500, overflowY: 'auto' }}>
                  <table>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 5 }}>
                      <tr>
                        <th>EMI #</th>
                        <th>Principal</th>
                        <th>Interest</th>
                        <th>Total EMI</th>
                        <th>Balance</th>
                        <th>% Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {amortData.slice(amortPage * AMORT_PAGE_SIZE, (amortPage + 1) * AMORT_PAGE_SIZE).map((row, i) => {
                        const pct = outstanding > 0 ? (1 - row.closing / outstanding) * 100 : 100;
                        const isNearlyDone = row.closing < outstanding * 0.1;
                        return (
                          <tr key={i} style={{ background: isNearlyDone ? 'rgba(5,150,105,0.04)' : undefined }}>
                            <td style={{ fontFamily: 'DM Mono', fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>EMI {row.emiNumber}</td>
                            <td style={{ fontFamily: 'DM Mono', fontSize: 12, color: lt.color, fontWeight: 600 }}>{fmt(row.principal)}</td>
                            <td style={{ fontFamily: 'DM Mono', fontSize: 12, color: '#dc2626' }}>{fmt(row.interest)}</td>
                            <td style={{ fontFamily: 'DM Mono', fontSize: 13, fontWeight: 700 }}>{fmt(row.emi)}</td>
                            <td style={{ fontFamily: 'DM Mono', fontSize: 12, color: row.closing === 0 ? '#059669' : 'var(--text)' }}>{fmt(row.closing)}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                <div style={{ flex: 1, height: 5, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
                                  <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: lt.gradient, borderRadius: 3, transition: 'width 0.3s' }} />
                                </div>
                                <span style={{ fontSize: 10, fontFamily: 'DM Mono', color: 'var(--text3)', width: 34, flexShrink: 0 }}>{pct.toFixed(0)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {amortData.length > AMORT_PAGE_SIZE && (
                  <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface2)' }}>
                    <button className="btn btn-ghost btn-sm" disabled={amortPage === 0} onClick={() => setAmortPage(p => p - 1)}>← Previous</button>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>Page {amortPage + 1} of {Math.ceil(amortData.length / AMORT_PAGE_SIZE)} · {amortData.length} total EMIs</span>
                    <button className="btn btn-ghost btn-sm" disabled={(amortPage + 1) * AMORT_PAGE_SIZE >= amortData.length} onClick={() => setAmortPage(p => p + 1)}>Next →</button>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ── Charts Tab ── */}
      {tab === 'charts' && (
        <div className="loan-charts-grid">
          {/* Pie - what's been done */}
          <div className="card">
            <div className="card-header"><div className="section-title" style={{ marginBottom: 0 }}>Payment Breakdown</div></div>
            {pieData.some(d => d.value > 0) ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e4e8f4' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pieData.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{d.name}</div>
                      <div style={{ fontSize: 12, fontFamily: 'DM Mono', fontWeight: 600 }}>{fmt(d.value)}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>Start recording payments to see breakdown</div>}
          </div>

          {/* Yearly P&I chart */}
          <div className="card">
            <div className="card-header"><div className="section-title" style={{ marginBottom: 0 }}>Yearly Principal vs Interest</div></div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ left: -10 }}>
                  <CartesianGrid stroke="#f0f2fa" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#9aa3be' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9aa3be' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip content={<ChartTip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="principal" name="Principal" fill={lt.color} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="interest" name="Interest" fill="#fca5a5" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            ) : amortLoading ? <div className="loading-screen" style={{ minHeight: 200 }}><div className="spinner" /></div> : null}
          </div>

          {/* Balance over time */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header"><div className="section-title" style={{ marginBottom: 0 }}>Outstanding Balance Trend</div></div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ left: -10 }}>
                  <defs>
                    <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={lt.color} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={lt.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#f0f2fa" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#9aa3be' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9aa3be' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 100000).toFixed(1)}L`} />
                  <Tooltip formatter={(v) => [fmt(v), 'Balance']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e4e8f4' }} />
                  <Area type="monotone" dataKey="balance" name="Balance" stroke={lt.color} strokeWidth={2.5} fill="url(#balGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </div>
      )}


      {/* ── Documents Tab ── */}
      {tab === 'documents' && (
        <div style={{ marginTop: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <div className="section-title" style={{ marginBottom: 2 }}>Linked Documents ({(loan.documents || []).length})</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Loan agreements, sanction letters, NOC, statements — link any vault document here.</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowDocPicker(true)} style={{ background: 'linear-gradient(135deg,#3b56f5,#7c3aed)', border: 'none' }}>
              🔗 Link Document
            </button>
          </div>

          {(loan.documents || []).length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 0' }}>
              <div className="empty-icon">📎</div>
              <div className="empty-title">No Documents Linked</div>
              <div className="empty-desc">
                Link documents from your vault — loan agreement, sanction letter, property valuation report, insurance, NOC, account statements and more.
              </div>
              <button className="btn btn-primary" onClick={() => setShowDocPicker(true)} style={{ background: 'linear-gradient(135deg,#3b56f5,#7c3aed)', border: 'none' }}>
                🔗 Link First Document
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {loan.documents.map(d => (
                <div key={d._id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px', borderRadius: 12,
                  border: '1.5px solid rgba(59,86,245,0.18)',
                  background: 'rgba(59,86,245,0.04)',
                  transition: 'all 0.15s',
                }}>
                  {/* Icon */}
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `${lt.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                    📎
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>{d.name}</div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: 'var(--text3)' }}>
                      {d.docType && <span style={{ fontWeight: 700, color: lt.color, background: `${lt.color}12`, padding: '1px 7px', borderRadius: 100 }}>{d.docType}</span>}
                      {d.notes && <span>📝 {d.notes}</span>}
                    </div>
                  </div>
                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    {d.linkedDocId && (
                      <a
                        href={getDocumentDownloadUrl(d.linkedDocId)}
                        download
                        onClick={(e) => { e.stopPropagation(); toast.success('Downloading...'); }}
                        className="btn btn-primary btn-sm"
                        style={{ background: `linear-gradient(135deg, ${lt.color}, ${lt.color}cc)`, border: 'none', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                      >
                        ⬇ Download
                      </a>
                    )}
                    <button className="btn btn-danger btn-sm btn-icon" style={{ width: 30, height: 30 }} onClick={() => handleUnlinkDoc(d._id)}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showPaymentModal && <PaymentModal loan={loan} onClose={() => setShowPaymentModal(false)} onSave={handleSave} />}
      {showEditModal && <LoanModal loan={loan} onClose={() => setShowEditModal(false)} onSave={handleSave} />}
      {showDocPicker && (
        <DocPicker
          onSelect={handleLinkDoc}
          onClose={() => setShowDocPicker(false)}
          defaultCategory="loan"
          title="Link Document to Loan"
        />
      )}
    </div>
  );
}

// ─── Main Loans Page ──────────────────────────────────────────────────────────
export default function Loans() {
  const [loans, setLoans] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('active');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lRes, sRes] = await Promise.all([getLoans({ status: filterStatus }), getLoanSummary()]);
      setLoans(lRes.data);
      setSummary(sRes.data);
      if (lRes.data.length > 0 && !selected) setSelected(lRes.data[0]._id);
    } finally { setLoading(false); }
  }, [filterStatus]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this loan?')) return;
    await deleteLoan(id);
    toast.success('Loan removed');
    setLoans(prev => prev.filter(l => l._id !== id));
    if (selected === id) setSelected(loans.find(l => l._id !== id)?._id || null);
  };

  const handleSave = (saved) => {
    setLoans(prev => {
      const idx = prev.findIndex(l => l._id === saved._id);
      if (idx >= 0) { const n = [...prev]; n[idx] = saved; return n; }
      return [saved, ...prev];
    });
    if (!selected) setSelected(saved._id);
    getLoanSummary().then(r => setSummary(r.data));
  };

  const selectedLoan = loans.find(l => l._id === selected);

  // Summary pie data
  const summaryPieData = summary ? Object.entries(summary.byType || {}).map(([type, d]) => ({
    name: LOAN_TYPES[type]?.label || type,
    value: d.outstanding,
    color: LOAN_TYPES[type]?.color || '#6b7280',
  })) : [];

  if (loading) return <div className="page"><div className="loading-screen"><div className="spinner" /></div></div>;

  return (
    <div className="page fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">Loan Manager</h1>
          <div className="page-sub">Track EMIs, amortization schedules and prepayments</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className={`btn ${filterStatus === 'active' ? 'btn-ghost' : 'btn-primary'} btn-sm`} onClick={() => { setFilterStatus(filterStatus === 'active' ? 'all' : 'active'); setSelected(null); }}>
            {filterStatus === 'active' ? '📁 Show Closed' : '✅ Active Only'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Add Loan</button>
        </div>
      </div>

      {/* Summary stats */}
      {summary && loans.length > 0 && (
        <div className="loan-summary-grid">
          <div className="stat-card" style={{ background: 'linear-gradient(135deg,#1a2560,#2d3f99)', border: 'none' }}>
            <div className="stat-icon" style={{ opacity: 0.15 }}>💳</div>
            <div className="stat-label" style={{ color: 'rgba(255,255,255,0.45)' }}>Total Outstanding</div>
            <div style={{ fontFamily: 'DM Mono', fontSize: 26, fontWeight: 500, color: '#fff', marginTop: 6 }}>{fmt(summary.totalOutstanding)}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>{summary.activeCount} active loans</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-label">Monthly EMI Outgo</div>
            <div style={{ fontFamily: 'DM Mono', fontSize: 22, fontWeight: 600, color: 'var(--red)', marginTop: 6 }}>{fmt(summary.totalMonthlyEmi)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🏦</div>
            <div className="stat-label">Total Borrowed</div>
            <div style={{ fontFamily: 'DM Mono', fontSize: 22, fontWeight: 500, color: 'var(--text)', marginTop: 6 }}>{fmt(summary.totalBorrowed)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-label">Interest Paid</div>
            <div style={{ fontFamily: 'DM Mono', fontSize: 22, fontWeight: 500, color: 'var(--amber)', marginTop: 6 }}>{fmt(summary.totalInterestPaid)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⚡</div>
            <div className="stat-label">Total Prepaid</div>
            <div style={{ fontFamily: 'DM Mono', fontSize: 22, fontWeight: 500, color: 'var(--green)', marginTop: 6 }}>{fmt(summary.totalPrepaid)}</div>
            {summary.closedCount > 0 && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>{summary.closedCount} loans closed</div>}
          </div>
        </div>
      )}

      {loans.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💳</div>
          <div className="empty-title">No Loans Yet</div>
          <div className="empty-desc">Track all your loans — home, car, personal, education. Monitor EMIs, view amortization schedules, record payments and prepayments.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, maxWidth: 480, margin: '24px auto' }}>
            {Object.entries(LOAN_TYPES).slice(0, 4).map(([key, t]) => (
              <div key={key} onClick={() => setShowAddModal(true)}
                style={{ padding: '16px 8px', textAlign: 'center', background: `${t.color}08`, border: `1.5px solid ${t.color}25`, borderRadius: 12, cursor: 'pointer' }}>
                <div style={{ fontSize: 28, marginBottom: 5 }}>{t.icon}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.color }}>{t.label}</div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => setShowAddModal(true)}>+ Add First Loan</button>
        </div>
      ) : (
        <div className="loan-layout">
          {/* Sidebar with loan list */}
          <div className="loan-sidebar">
            <div style={{ padding: '10px 10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)' }}>My Loans</span>
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => setShowAddModal(true)}>+ Add</button>
            </div>

            {/* Mini portfolio pie */}
            {summaryPieData.length > 1 && (
              <div style={{ padding: '8px 4px 14px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
                <ResponsiveContainer width="100%" height={100}>
                  <PieChart>
                    <Pie data={summaryPieData} dataKey="value" cx="50%" cy="50%" innerRadius={28} outerRadius={44} paddingAngle={2}>
                      {summaryPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {loans.map(l => {
              const lt2 = LOAN_TYPES[l.loanType] || LOAN_TYPES.other;
              const out = l.outstandingPrincipal ?? l.principalAmount;
              const pct = l.principalAmount > 0 ? Math.min(100, ((l.principalAmount - out) / l.principalAmount) * 100) : 0;
              return (
                <div key={l._id} className={`loan-list-item ${selected === l._id ? 'active' : ''}`}
                  style={{ '--lc': lt2.color }}
                  onClick={() => setSelected(l._id)}>
                  <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1.2 }}>{lt2.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{l.lender}</div>
                      {/* Mini progress bar */}
                      <div style={{ height: 3, background: 'var(--bg2)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: lt2.gradient, borderRadius: 2 }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                        <span style={{ fontSize: 10, fontFamily: 'DM Mono', color: lt2.color, fontWeight: 600 }}>{fmt(out)}</span>
                        <span style={{ fontSize: 10, color: 'var(--text3)' }}>{pct.toFixed(0)}% paid</span>
                      </div>
                    </div>
                  </div>
                  <button className="btn btn-danger btn-icon" style={{ width: 22, height: 22, fontSize: 10, borderRadius: 5, opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 }}
                    onClick={e => { e.stopPropagation(); handleDelete(l._id); }}>×</button>
                </div>
              );
            })}
          </div>

          {/* Detail panel */}
          <div style={{ minWidth: 0 }}>
            {selectedLoan ? (
              <LoanDetail key={selected} loan={selectedLoan} onUpdate={handleSave} />
            ) : (
              <div className="empty-state"><div className="empty-icon">👈</div><div className="empty-title">Select a loan</div></div>
            )}
          </div>
        </div>
      )}

      {showAddModal && <LoanModal onClose={() => setShowAddModal(false)} onSave={saved => { handleSave(saved); setShowAddModal(false); }} />}
    </div>
  );
}
