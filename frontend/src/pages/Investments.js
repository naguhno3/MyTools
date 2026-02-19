import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import {
  getInvestments, createInvestment, updateInvestment, deleteInvestment,
  addPriceSnapshot, sellInvestment, getPortfolioSummary
} from '../utils/api';
import { fmt, fmtDate, monthName, ASSET_CLASSES, ASSET_SUBTYPES } from '../utils/helpers';
import './Investments.css';

// ── Tooltip ──────────────────────────────────────────────────────────────────
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e4e8f4', borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 16px rgba(15,22,41,0.1)' }}>
      {label && <div style={{ color: '#9aa3be', marginBottom: 5, fontWeight: 600 }}>{label}</div>}
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color || '#1a2560', fontWeight: 600 }}>{p.name}: {typeof p.value === 'number' && p.name !== 'Allocation %' ? fmt(p.value) : `${typeof p.value === 'number' ? p.value.toFixed(1) : p.value}%`}</div>
      ))}
    </div>
  );
};

// ── Add/Edit Modal ────────────────────────────────────────────────────────────
const defaultForm = {
  name: '', assetClass: 'stocks', subType: '', institution: '', ticker: '',
  folioNumber: '', purchaseDate: new Date().toISOString().split('T')[0],
  units: '', purchasePrice: '', totalInvested: '',
  currentPrice: '', currentValue: '',
  maturityDate: '', interestRate: '', maturityValue: '',
  goldWeight: '', goldPurity: '24K',
  dividendReceived: '', xirr: '', notes: '', tags: '', color: ''
};

function InvestmentModal({ investment, onClose, onSave }) {
  const [form, setForm] = useState(investment ? {
    ...defaultForm,
    ...investment,
    purchaseDate: investment.purchaseDate ? investment.purchaseDate.split('T')[0] : defaultForm.purchaseDate,
    maturityDate: investment.maturityDate ? investment.maturityDate.split('T')[0] : '',
    tags: (investment.tags || []).join(', '),
    color: investment.color || ASSET_CLASSES[investment.assetClass]?.color || '#2563eb'
  } : { ...defaultForm, color: '#2563eb' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const ac = ASSET_CLASSES[form.assetClass];
  const subtypes = ASSET_SUBTYPES[form.assetClass] || [];
  const isFD = form.assetClass === 'fixed_deposit' || form.assetClass === 'bonds';
  const isGold = form.assetClass === 'gold';
  const isMF = form.assetClass === 'mutual_funds';
  const isStock = form.assetClass === 'stocks';

  // Auto-calculate totals
  const autoCalc = (k, v) => {
    set(k, v);
    const u = k === 'units' ? +v : +form.units;
    const pp = k === 'purchasePrice' ? +v : +form.purchasePrice;
    const cp = k === 'currentPrice' ? +v : +form.currentPrice;
    if (k === 'units' || k === 'purchasePrice') {
      if (u > 0 && pp > 0) set('totalInvested', (u * pp).toFixed(2));
    }
    if (k === 'units' || k === 'currentPrice') {
      if (u > 0 && cp > 0) set('currentValue', (u * cp).toFixed(2));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        units: form.units ? +form.units : undefined,
        purchasePrice: form.purchasePrice ? +form.purchasePrice : undefined,
        currentPrice: form.currentPrice ? +form.currentPrice : undefined,
        totalInvested: +form.totalInvested,
        currentValue: form.currentValue ? +form.currentValue : +form.totalInvested,
        interestRate: form.interestRate ? +form.interestRate : undefined,
        maturityValue: form.maturityValue ? +form.maturityValue : undefined,
        goldWeight: form.goldWeight ? +form.goldWeight : undefined,
        dividendReceived: form.dividendReceived ? +form.dividendReceived : 0,
        xirr: form.xirr ? +form.xirr : undefined,
        color: form.color || ac?.color,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        maturityDate: form.maturityDate || undefined,
      };
      let saved;
      if (investment) {
        saved = (await updateInvestment(investment._id, payload)).data;
        toast.success('Investment updated!');
      } else {
        saved = (await createInvestment(payload)).data;
        toast.success('Investment added! 📈');
      }
      onSave(saved);
      onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxHeight: '88vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div className="modal-title">{investment ? 'Edit Investment' : 'Add Investment'}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>

          {/* Asset class grid */}
          <div className="form-group">
            <label className="form-label">Asset Class *</label>
            <div className="inv-asset-grid">
              {Object.entries(ASSET_CLASSES).map(([key, conf]) => (
                <button key={key} type="button"
                  style={{
                    padding: '12px 8px', borderRadius: 11, border: `2px solid ${form.assetClass === key ? conf.color : 'var(--border)'}`,
                    background: form.assetClass === key ? `${conf.color}10` : 'var(--surface2)',
                    cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center'
                  }}
                  onClick={() => { set('assetClass', key); set('color', conf.color); set('subType', ''); }}>
                  <div style={{ fontSize: 22, marginBottom: 3 }}>{conf.icon}</div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: form.assetClass === key ? conf.color : 'var(--text3)', fontFamily: 'Syne, sans-serif', lineHeight: 1.2 }}>{conf.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Investment Name *</label>
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)}
                placeholder={isStock ? 'e.g. Reliance Industries' : isMF ? 'e.g. Parag Parikh Flexi Cap' : isFD ? 'e.g. SBI FD 7.5%' : isGold ? 'e.g. SGB 2024 Series I' : 'Name'} required />
            </div>
            <div className="form-group">
              <label className="form-label">Sub-Type</label>
              <select className="form-select" value={form.subType} onChange={e => set('subType', e.target.value)}>
                <option value="">Select sub-type...</option>
                {subtypes.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{isStock ? 'Broker' : isMF ? 'Fund House / Platform' : isFD ? 'Bank / NBFC' : isGold ? 'Platform / Jeweller' : 'Institution'}</label>
              <input className="form-input" value={form.institution} onChange={e => set('institution', e.target.value)}
                placeholder={isStock ? 'e.g. Zerodha' : isMF ? 'e.g. Groww / HDFC AMC' : isFD ? 'e.g. SBI' : 'e.g. MMTC-PAMP'} />
            </div>
            <div className="form-group">
              <label className="form-label">{isStock ? 'Ticker / Symbol' : isMF ? 'Folio Number' : isFD ? 'FD Account Number' : isGold ? 'Folio / Certificate No' : 'Identifier'}</label>
              <input className="form-input"
                value={isStock || form.assetClass === 'crypto' ? form.ticker : form.folioNumber}
                onChange={e => isStock || form.assetClass === 'crypto' ? set('ticker', e.target.value) : set('folioNumber', e.target.value)}
                placeholder={isStock ? 'e.g. RELIANCE.NSE' : isMF ? 'e.g. 1234567890' : 'Optional'} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Purchase Date</label>
              <input type="date" className="form-input" value={form.purchaseDate} onChange={e => set('purchaseDate', e.target.value)} />
            </div>
            {/* Units field for stocks/MF/gold */}
            {(isStock || isMF || isGold || form.assetClass === 'crypto') && (
              <div className="form-group">
                <label className="form-label">{isGold ? 'Quantity (grams / units)' : 'Units / Shares'}</label>
                <input type="number" step="0.001" className="form-input" value={form.units} onChange={e => autoCalc('units', e.target.value)} placeholder="0" />
              </div>
            )}
            {isFD && (
              <div className="form-group">
                <label className="form-label">Maturity Date</label>
                <input type="date" className="form-input" value={form.maturityDate} onChange={e => set('maturityDate', e.target.value)} />
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{isFD ? 'Invested Amount (₹) *' : isGold ? 'Avg Buy Price per unit (₹)' : 'Buy Price / NAV per unit (₹)'}</label>
              {isFD ? (
                <input type="number" step="0.01" className="form-input" value={form.totalInvested} onChange={e => set('totalInvested', e.target.value)} placeholder="0" required />
              ) : (
                <input type="number" step="0.01" className="form-input" value={form.purchasePrice} onChange={e => autoCalc('purchasePrice', e.target.value)} placeholder="0" />
              )}
            </div>
            <div className="form-group">
              <label className="form-label">{isFD ? 'Interest Rate (% p.a.)' : 'Current Price / NAV per unit (₹)'}</label>
              {isFD ? (
                <input type="number" step="0.01" className="form-input" value={form.interestRate} onChange={e => set('interestRate', e.target.value)} placeholder="e.g. 7.5" />
              ) : (
                <input type="number" step="0.01" className="form-input" value={form.currentPrice} onChange={e => autoCalc('currentPrice', e.target.value)} placeholder="0" />
              )}
            </div>
          </div>

          <div className="form-row">
            {!isFD && (
              <div className="form-group">
                <label className="form-label">Total Invested (₹) *</label>
                <input type="number" step="0.01" className="form-input" value={form.totalInvested} onChange={e => set('totalInvested', e.target.value)} placeholder="0" required />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">{isFD ? 'Current / Maturity Value (₹)' : 'Current Value (₹)'}</label>
              <input type="number" step="0.01" className="form-input" value={form.currentValue} onChange={e => set('currentValue', e.target.value)} placeholder="0" />
            </div>
            {isFD && (
              <div className="form-group">
                <label className="form-label">Maturity Value (₹)</label>
                <input type="number" step="0.01" className="form-input" value={form.maturityValue} onChange={e => set('maturityValue', e.target.value)} placeholder="0" />
              </div>
            )}
          </div>

          {/* Gold extras */}
          {isGold && (
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Gold Purity</label>
                <select className="form-select" value={form.goldPurity} onChange={e => set('goldPurity', e.target.value)}>
                  {['24K', '22K', '18K', 'SGB', 'Digital Gold', 'Gold ETF'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Weight (grams)</label>
                <input type="number" step="0.001" className="form-input" value={form.goldWeight} onChange={e => set('goldWeight', e.target.value)} placeholder="0" />
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Dividend / Interest Received (₹)</label>
              <input type="number" step="0.01" className="form-input" value={form.dividendReceived} onChange={e => set('dividendReceived', e.target.value)} placeholder="0" />
            </div>
            <div className="form-group">
              <label className="form-label">XIRR / Returns (% p.a.) — optional</label>
              <input type="number" step="0.01" className="form-input" value={form.xirr} onChange={e => set('xirr', e.target.value)} placeholder="e.g. 14.5" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tags (comma separated)</label>
              <input className="form-input" value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="e.g. tax-saver, long-term, SIP" />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes" />
            </div>
          </div>

          {/* Live P&L preview */}
          {(+form.totalInvested > 0 || +form.currentValue > 0) && (
            <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', marginBottom: 4, display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Invested</div>
                <div style={{ fontFamily: 'DM Mono', fontWeight: 600, fontSize: 16 }}>{fmt(+form.totalInvested)}</div>
              </div>
              <div style={{ fontSize: 20, color: 'var(--text3)' }}>→</div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Current</div>
                <div style={{ fontFamily: 'DM Mono', fontWeight: 600, fontSize: 16 }}>{fmt(+form.currentValue || +form.totalInvested)}</div>
              </div>
              <div style={{ fontSize: 20, color: 'var(--text3)' }}>=</div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Gain / Loss</div>
                <div style={{ fontFamily: 'DM Mono', fontWeight: 700, fontSize: 18, color: (+form.currentValue - +form.totalInvested) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {(+form.currentValue - +form.totalInvested) >= 0 ? '+' : ''}{fmt(+form.currentValue - +form.totalInvested)}
                  {+form.totalInvested > 0 && <span style={{ fontSize: 12, marginLeft: 6 }}>({(((+form.currentValue - +form.totalInvested) / +form.totalInvested) * 100).toFixed(1)}%)</span>}
                </div>
              </div>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ background: ac?.gradient, border: 'none' }}>
              {saving ? 'Saving...' : investment ? 'Update Investment' : '+ Add Investment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Price Update Modal ────────────────────────────────────────────────────────
function PriceModal({ investment, onClose, onSave }) {
  const [form, setForm] = useState({ price: investment.currentPrice || '', date: new Date().toISOString().split('T')[0], note: '' });
  const [saving, setSaving] = useState(false);
  const units = investment.units || 1;
  const totalVal = (+form.price * units).toFixed(2);
  const ac = ASSET_CLASSES[investment.assetClass];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await addPriceSnapshot(investment._id, { price: +form.price, totalValue: +totalVal, date: form.date, note: form.note });
      onSave(r.data);
      toast.success('Price updated! 📊');
      onClose();
    } catch (err) { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Update Price</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ marginBottom: 16, padding: '12px 14px', background: `${ac?.color}10`, borderRadius: 10, border: `1px solid ${ac?.color}25` }}>
          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{investment.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{investment.units} units · Previous: {fmt(investment.currentPrice || 0)} / unit</div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">New Price per unit (₹) *</label>
            <input type="number" step="0.01" className="form-input" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="0.00" required autoFocus style={{ fontSize: 20, fontFamily: 'DM Mono' }} />
            {+form.price > 0 && <div style={{ fontSize: 12, marginTop: 6, color: 'var(--text2)' }}>New total value: <strong style={{ fontFamily: 'DM Mono', color: ac?.color }}>{fmt(+totalVal)}</strong></div>}
          </div>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input type="date" className="form-input" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Note (optional)</label>
            <input className="form-input" value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} placeholder="e.g. Quarterly NAV update" />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ background: ac?.gradient, border: 'none' }}>{saving ? '...' : 'Update Price'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Sell Modal ────────────────────────────────────────────────────────────────
function SellModal({ investment, onClose, onSave }) {
  const [form, setForm] = useState({ sellDate: new Date().toISOString().split('T')[0], sellPrice: investment.currentPrice || '', sellValue: '' });
  const [saving, setSaving] = useState(false);
  const units = investment.units || 1;
  const totalSell = form.sellValue || (form.sellPrice ? (+form.sellPrice * units).toFixed(2) : '');
  const gain = totalSell ? +totalSell - investment.totalInvested : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await sellInvestment(investment._id, { sellDate: form.sellDate, sellPrice: +form.sellPrice, sellValue: +totalSell });
      onSave(r.data);
      toast.success(`Sold ${investment.name}! ${gain >= 0 ? '🎉' : '📉'}`);
      onClose();
    } catch (err) { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Mark as Sold</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ marginBottom: 16, padding: '12px 14px', background: 'rgba(220,38,38,0.06)', borderRadius: 10, border: '1px solid rgba(220,38,38,0.15)' }}>
          <div style={{ fontWeight: 700 }}>{investment.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Invested: {fmt(investment.totalInvested)} · Units: {investment.units || '—'}</div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Sell Price per unit (₹)</label>
              <input type="number" step="0.01" className="form-input" value={form.sellPrice} onChange={e => setForm(p => ({ ...p, sellPrice: e.target.value, sellValue: '' }))} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Total Sale Value (₹) *</label>
              <input type="number" step="0.01" className="form-input" value={totalSell} onChange={e => setForm(p => ({ ...p, sellValue: e.target.value }))} placeholder="0.00" required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Sale Date</label>
            <input type="date" className="form-input" value={form.sellDate} onChange={e => setForm(p => ({ ...p, sellDate: e.target.value }))} />
          </div>
          {gain !== null && (
            <div style={{ padding: '12px 14px', borderRadius: 10, background: gain >= 0 ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.08)', border: `1px solid ${gain >= 0 ? 'rgba(5,150,105,0.2)' : 'rgba(220,38,38,0.2)'}`, marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: gain >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {gain >= 0 ? '🎉 Profit:' : '📉 Loss:'} {fmt(Math.abs(gain))}
                {investment.totalInvested > 0 && <span style={{ fontSize: 11, marginLeft: 6 }}>({((Math.abs(gain) / investment.totalInvested) * 100).toFixed(1)}%)</span>}
              </div>
            </div>
          )}
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-danger" disabled={saving}>{saving ? '...' : 'Confirm Sale'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Investment Card ───────────────────────────────────────────────────────────
function InvCard({ inv, onEdit, onUpdatePrice, onSell, onDelete }) {
  const ac = ASSET_CLASSES[inv.assetClass];
  const gain = inv.currentValue - inv.totalInvested;
  const pct = inv.totalInvested > 0 ? (gain / inv.totalInvested) * 100 : 0;
  const isSold = inv.status === 'sold';

  return (
    <div className={`inv-card ${isSold ? 'inv-card--sold' : ''}`} style={{ '--ac': ac?.color || '#6366f1' }}>
      <div className="inv-card-top">
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: ac?.gradient || '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, boxShadow: `0 4px 12px ${ac?.color}30` }}>
            {ac?.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', fontFamily: 'Syne, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ color: ac?.color, fontWeight: 700 }}>{ac?.label}</span>
              {inv.subType && <span>· {inv.subType}</span>}
              {inv.institution && <span>· {inv.institution}</span>}
            </div>
            {isSold && <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 4, background: 'rgba(100,116,139,0.12)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>SOLD</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          {!isSold && <button className="btn btn-ghost btn-sm btn-icon" title="Update price" onClick={() => onUpdatePrice(inv)}>📊</button>}
          <button className="btn btn-ghost btn-sm btn-icon" title="Edit" onClick={() => onEdit(inv)}>✏️</button>
          {!isSold && <button className="btn btn-ghost btn-sm btn-icon" title="Mark as sold" onClick={() => onSell(inv)} style={{ color: 'var(--red)' }}>💰</button>}
          <button className="btn btn-danger btn-sm btn-icon" title="Delete" onClick={() => onDelete(inv._id)}>×</button>
        </div>
      </div>

      <div className="inv-card-values">
        <div>
          <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Invested</div>
          <div style={{ fontFamily: 'DM Mono', fontSize: 16, fontWeight: 500, color: 'var(--text)' }}>{fmt(inv.totalInvested)}</div>
        </div>
        <div style={{ color: 'var(--text3)', fontSize: 18, alignSelf: 'center' }}>→</div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Current Value</div>
          <div style={{ fontFamily: 'DM Mono', fontSize: 18, fontWeight: 600, color: isSold ? 'var(--text2)' : ac?.color }}>{fmt(isSold ? (inv.sellValue || inv.currentValue) : inv.currentValue)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Gain / Loss</div>
          <div style={{ fontFamily: 'DM Mono', fontWeight: 700, fontSize: 15, color: gain >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {gain >= 0 ? '+' : ''}{fmt(gain)}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: pct >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 1 }}>
            {pct >= 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Extra info */}
      <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: 'var(--text3)', flexWrap: 'wrap' }}>
        {inv.units && <span>Units: <strong style={{ color: 'var(--text2)' }}>{inv.units}</strong></span>}
        {inv.currentPrice && <span>Price: <strong style={{ color: 'var(--text2)', fontFamily: 'DM Mono' }}>{fmt(inv.currentPrice)}</strong></span>}
        {inv.interestRate && <span>Rate: <strong style={{ color: 'var(--green)' }}>{inv.interestRate}% p.a.</strong></span>}
        {inv.maturityDate && <span>Matures: <strong style={{ color: new Date(inv.maturityDate) < new Date() ? 'var(--amber)' : 'var(--text2)' }}>{fmtDate(inv.maturityDate)}</strong></span>}
        {inv.dividendReceived > 0 && <span>Dividend: <strong style={{ color: 'var(--green)', fontFamily: 'DM Mono' }}>{fmt(inv.dividendReceived)}</strong></span>}
        {inv.xirr && <span>XIRR: <strong style={{ color: 'var(--blue)' }}>{inv.xirr}%</strong></span>}
        {inv.purchaseDate && <span>Bought: <strong style={{ color: 'var(--text2)' }}>{fmtDate(inv.purchaseDate)}</strong></span>}
      </div>

      {inv.tags?.length > 0 && (
        <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
          {inv.tags.map(t => <span key={t} style={{ fontSize: 10, padding: '2px 7px', background: 'var(--bg2)', borderRadius: 100, color: 'var(--text3)', fontWeight: 600 }}>#{t}</span>)}
        </div>
      )}

      {/* Progress bar for gain */}
      <div style={{ marginTop: 12 }}>
        <div className="progress-bar" style={{ height: 4, borderRadius: 2 }}>
          <div className="progress-fill" style={{ width: `${Math.min(Math.max((inv.currentValue / (inv.totalInvested || 1)) * 50, 0), 100)}%`, background: gain >= 0 ? ac?.gradient : 'var(--red)', borderRadius: 2 }} />
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Investments() {
  const [investments, setInvestments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('portfolio');   // portfolio | charts | history
  const [filterClass, setFilterClass] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active');
  const [showModal, setShowModal] = useState(false);
  const [editInv, setEditInv] = useState(null);
  const [priceInv, setPriceInv] = useState(null);
  const [sellInv, setSellInv] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      getInvestments({ status: filterStatus, assetClass: filterClass !== 'all' ? filterClass : undefined }),
      getPortfolioSummary()
    ]).then(([inv, sum]) => {
      setInvestments(inv.data);
      setSummary(sum.data);
    }).finally(() => setLoading(false));
  }, [filterClass, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this investment?')) return;
    await deleteInvestment(id);
    toast.success('Removed');
    load();
  };

  const handleSave = () => load();

  // Chart data
  const pieData = summary ? Object.entries(summary.byClass).map(([cls, d]) => ({
    name: ASSET_CLASSES[cls]?.label || cls,
    value: d.currentValue,
    invested: d.totalInvested,
    color: ASSET_CLASSES[cls]?.color || '#6366f1'
  })) : [];

  const allocationData = summary ? Object.entries(summary.byClass).map(([cls, d]) => ({
    name: ASSET_CLASSES[cls]?.label || cls,
    'Invested': Math.round(d.totalInvested),
    'Current': Math.round(d.currentValue),
    gain: Math.round(d.currentValue - d.totalInvested)
  })) : [];

  const monthlyData = summary?.monthlyInvested?.map(m => ({
    name: `${monthName(+m.month.split('-')[1])} '${m.month.split('-')[0].slice(2)}`,
    Invested: m.amount
  })) || [];

  // Radar for diversification
  const radarData = Object.entries(ASSET_CLASSES).map(([key, conf]) => ({
    class: conf.label,
    allocation: summary?.byClass[key] ? Math.round((summary.byClass[key].currentValue / (summary.totalCurrentValue || 1)) * 100) : 0
  }));

  const total = summary?.totalCurrentValue || 0;
  const invested = summary?.totalInvested || 0;
  const gain = total - invested;

  return (
    <div className="page fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">Investment Portfolio</h1>
          <div className="page-sub">Track stocks, mutual funds, FDs, gold & more</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => setFilterStatus(s => s === 'active' ? 'all' : 'active')}>
            {filterStatus === 'active' ? '📁 Show All' : '✅ Active Only'}
          </button>
          <button className="btn btn-primary" onClick={() => { setEditInv(null); setShowModal(true); }}>+ Add Investment</button>
        </div>
      </div>

      {/* Summary stat cards */}
      {summary && (
        <div className="inv-stats-grid">
          <div className="stat-card" style={{ background: 'linear-gradient(135deg, #1a2560 0%, #2d3f99 100%)', border: 'none' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Portfolio Value</div>
            <div style={{ fontFamily: 'DM Mono', fontSize: 28, fontWeight: 500, color: '#fff' }}>{fmt(total)}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>{summary.count} active investments</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Invested</div>
            <div style={{ fontFamily: 'DM Mono', fontSize: 22, fontWeight: 500, color: 'var(--text)', marginTop: 6 }}>{fmt(invested)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Unrealized Gain / Loss</div>
            <div style={{ fontFamily: 'DM Mono', fontSize: 22, fontWeight: 600, color: gain >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 6 }}>
              {gain >= 0 ? '+' : ''}{fmt(gain)}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: gain >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 3 }}>
              {gain >= 0 ? '▲' : '▼'} {Math.abs(+summary.unrealizedGainPct).toFixed(2)}%
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Dividend + Realized</div>
            <div style={{ fontFamily: 'DM Mono', fontSize: 22, fontWeight: 500, color: 'var(--green)', marginTop: 6 }}>{fmt((summary.totalDividend || 0) + (summary.realizedGain || 0))}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>Dividend: {fmt(summary.totalDividend || 0)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Diversification Score</div>
            <div style={{ fontFamily: 'DM Mono', fontSize: 28, fontWeight: 700, color: summary.diversificationScore >= 50 ? 'var(--green)' : summary.diversificationScore >= 25 ? 'var(--amber)' : 'var(--red)', marginTop: 6 }}>
              {summary.diversificationScore}%
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
              {Object.keys(summary.byClass).length} of 8 asset classes
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 22 }}>
        <button className={`tab ${tab === 'portfolio' ? 'active' : ''}`} onClick={() => setTab('portfolio')}>📋 Holdings</button>
        <button className={`tab ${tab === 'charts' ? 'active' : ''}`} onClick={() => setTab('charts')}>📊 Charts & Analytics</button>
      </div>

      {/* ── PORTFOLIO TAB ──────────────────────────────────────────────────── */}
      {tab === 'portfolio' && (
        <>
          {/* Asset class filter chips */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            <button className={`btn btn-sm ${filterClass === 'all' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilterClass('all')}>All</button>
            {Object.entries(ASSET_CLASSES).map(([key, conf]) => (
              <button key={key} className={`btn btn-sm ${filterClass === key ? 'btn-primary' : 'btn-ghost'}`}
                style={filterClass === key ? { background: conf.gradient, border: 'none' } : {}}
                onClick={() => setFilterClass(filterClass === key ? 'all' : key)}>
                {conf.icon} {conf.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="loading-screen"><div className="spinner" /></div>
          ) : investments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📈</div>
              <div className="empty-title">No investments yet</div>
              <div className="empty-desc">Start tracking your stocks, mutual funds, fixed deposits, gold and more.</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, margin: '24px auto', maxWidth: 560 }}>
                {Object.entries(ASSET_CLASSES).slice(0, 4).map(([key, conf]) => (
                  <div key={key} onClick={() => setShowModal(true)} style={{ padding: '16px 8px', textAlign: 'center', background: `${conf.color}08`, border: `1.5px solid ${conf.color}22`, borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s' }}>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>{conf.icon}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: conf.color }}>{conf.label}</div>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary btn-lg" onClick={() => setShowModal(true)}>+ Add First Investment</button>
            </div>
          ) : (
            <div className="inv-grid">
              {investments.map(inv => (
                <InvCard key={inv._id} inv={inv}
                  onEdit={i => { setEditInv(i); setShowModal(true); }}
                  onUpdatePrice={i => setPriceInv(i)}
                  onSell={i => setSellInv(i)}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── CHARTS TAB ──────────────────────────────────────────────────────── */}
      {tab === 'charts' && summary && (
        <div className="inv-charts-layout">

          {/* Row 1: Pie + Bar side by side */}
          <div className="card" style={{ gridColumn: 'span 1' }}>
            <div className="card-header">
              <div className="section-title" style={{ marginBottom: 0 }}>Asset Allocation</div>
              <div style={{ fontFamily: 'DM Mono', fontSize: 12, color: 'var(--text3)' }}>{fmt(total)}</div>
            </div>
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} nameKey="name">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v, n, p) => [fmt(v), p.payload.name]} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e4e8f4' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pieData.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{d.name}</div>
                      <div style={{ fontSize: 12, fontFamily: 'DM Mono', color: d.color }}>{total > 0 ? ((d.value / total) * 100).toFixed(1) : 0}%</div>
                      <div style={{ fontSize: 12, fontFamily: 'DM Mono', color: 'var(--text2)' }}>{fmt(d.value)}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}>No data</div>}
          </div>

          {/* Invested vs Current by class */}
          <div className="card" style={{ gridColumn: 'span 1' }}>
            <div className="card-header">
              <div className="section-title" style={{ marginBottom: 0 }}>Invested vs Current Value</div>
            </div>
            {allocationData.length > 0 ? (
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={allocationData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid stroke="#f0f2fa" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#9aa3be' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#4a5578', fontWeight: 600 }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip content={<ChartTip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Invested" fill="#c7d2fe" radius={[0, 4, 4, 0]} maxBarSize={18} />
                  <Bar dataKey="Current" radius={[0, 4, 4, 0]} maxBarSize={18}>
                    {allocationData.map((d, i) => <Cell key={i} fill={d.gain >= 0 ? '#059669' : '#dc2626'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}>No data</div>}
          </div>

          {/* Monthly invested trend */}
          {monthlyData.length > 1 && (
            <div className="card" style={{ gridColumn: 'span 2' }}>
              <div className="card-header">
                <div className="section-title" style={{ marginBottom: 0 }}>Monthly Investment Inflow</div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={monthlyData} margin={{ left: -10 }}>
                  <defs>
                    <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#f0f2fa" strokeDasharray="0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9aa3be' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9aa3be' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v) => [fmt(v), 'Invested']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e4e8f4' }} />
                  <Area type="monotone" dataKey="Invested" stroke="#4f46e5" strokeWidth={2.5} fill="url(#invGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Diversification Radar */}
          <div className="card" style={{ gridColumn: 'span 1' }}>
            <div className="card-header">
              <div className="section-title" style={{ marginBottom: 0 }}>Diversification Radar</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: summary.diversificationScore >= 50 ? 'var(--green)' : 'var(--amber)' }}>Score: {summary.diversificationScore}%</div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <PolarGrid stroke="#e4e8f4" />
                <PolarAngleAxis dataKey="class" tick={{ fontSize: 10, fill: '#4a5578', fontWeight: 600 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: '#9aa3be' }} tickCount={4} />
                <Radar name="Allocation %" dataKey="allocation" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.15} strokeWidth={2} />
                <Tooltip formatter={(v) => [`${v.toFixed(1)}%`, 'Allocation']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e4e8f4' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Top / Bottom performers */}
          <div className="card" style={{ gridColumn: 'span 1' }}>
            <div style={{ marginBottom: 18 }}>
              <div className="section-title">🏆 Top Performers</div>
              {(summary.topPerformers || []).slice(0, 4).map(inv => {
                const ac = ASSET_CLASSES[inv.assetClass];
                return (
                  <div key={inv._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--bg)' }}>
                    <span style={{ fontSize: 18 }}>{ac?.icon}</span>
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.name}</div>
                    <div style={{ fontFamily: 'DM Mono', fontSize: 12, fontWeight: 700, color: 'var(--green)', flexShrink: 0 }}>+{inv._pct.toFixed(1)}%</div>
                  </div>
                );
              })}
            </div>
            <div>
              <div className="section-title">📉 Underperformers</div>
              {(summary.bottomPerformers || []).filter(i => i._pct < 0).slice(0, 4).map(inv => {
                const ac = ASSET_CLASSES[inv.assetClass];
                return (
                  <div key={inv._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--bg)' }}>
                    <span style={{ fontSize: 18 }}>{ac?.icon}</span>
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.name}</div>
                    <div style={{ fontFamily: 'DM Mono', fontSize: 12, fontWeight: 700, color: 'var(--red)', flexShrink: 0 }}>{inv._pct.toFixed(1)}%</div>
                  </div>
                );
              })}
              {(summary.bottomPerformers || []).filter(i => i._pct < 0).length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '20px 0' }}>🎉 All investments in profit!</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <InvestmentModal
          investment={editInv}
          onClose={() => { setShowModal(false); setEditInv(null); }}
          onSave={handleSave}
        />
      )}
      {priceInv && <PriceModal investment={priceInv} onClose={() => setPriceInv(null)} onSave={handleSave} />}
      {sellInv && <SellModal investment={sellInv} onClose={() => setSellInv(null)} onSave={handleSave} />}
    </div>
  );
}
