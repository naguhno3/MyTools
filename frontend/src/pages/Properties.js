import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  getProperties, createProperty, updateProperty, deleteProperty,
  getPropertySummary, upsertTenant, removeTenant,
  addContact, deleteContact, addDocument, deleteDocument,
  addPropertyTx, deletePropertyTx
} from '../utils/api';
import { fmt, fmtDate } from '../utils/helpers';
import './Properties.css';

// ─── Config ───────────────────────────────────────────────────────────────────
const PROP_TYPES = {
  apartment: { icon: '🏢', label: 'Apartment', color: '#2563eb' },
  house:     { icon: '🏠', label: 'House',     color: '#059669' },
  villa:     { icon: '🏡', label: 'Villa',     color: '#d97706' },
  plot:      { icon: '🗺️', label: 'Plot',      color: '#6b7280' },
  commercial:{ icon: '🏪', label: 'Commercial',color: '#7c3aed' },
  farm:      { icon: '🌾', label: 'Farm',      color: '#84cc16' },
  other:     { icon: '🏗️', label: 'Other',     color: '#94a3b8' },
};

const STATUS_CONFIG = {
  self_occupied:     { label: 'Self-Occupied', color: '#2563eb', bg: 'rgba(37,99,235,0.1)' },
  rented:           { label: 'Rented',         color: '#059669', bg: 'rgba(5,150,105,0.1)' },
  vacant:           { label: 'Vacant',         color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
  under_construction:{ label: 'Construction',  color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
};

const DOC_TYPES = ['Sale Deed','Khata Certificate','EC Certificate','Property Tax Receipt','Home Insurance','Society NOC','Occupancy Certificate','Electricity Bill','Water Bill','Mutation Document','Power of Attorney','Loan NOC','Other'];
const CONTACT_ROLES = ['Society Manager','Plumber','Electrician','Carpenter','Painter','Pest Control','Security','Broker/Agent','Tenant','CA/Lawyer','Bank Manager','Other'];
const TX_CATEGORIES = {
  income:  ['Rent','Advance Rent','Security Deposit','Lease Premium','Other Income'],
  expense: ['Maintenance','Property Tax','Home Insurance','Repair','Renovation','Society Charges','Electricity','Water','Brokerage','Loan EMI','Other Expense'],
};
const PROP_COLORS = ['#2563eb','#059669','#d97706','#7c3aed','#0891b2','#dc2626','#84cc16','#0d9488','#ec4899','#6b7280'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pill = (label, color, bg) => (
  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 100, background: bg, color, letterSpacing: '0.02em' }}>{label}</span>
);

// ─── Property Form Modal ──────────────────────────────────────────────────────
const emptyForm = {
  name:'', type:'apartment', status:'self_occupied', address:'', city:'', state:'', pincode:'', landmark:'',
  area:'', builtArea:'', bedrooms:'', bathrooms:'', parkingSpots:'', yearBuilt:'', floors:'',
  purchasePrice:'', purchaseDate:'', currentValue:'', stampDuty:'', registrationCost:'',
  monthlyMaintenance:'', annualPropertyTax:'', annualInsurance:'',
  registrationNumber:'', surveyNumber:'', color:'#2563eb', notes:'', tags:''
};

function PropertyModal({ property, onClose, onSave }) {
  const [form, setForm] = useState(property ? {
    ...emptyForm, ...property,
    purchaseDate: property.purchaseDate?.split('T')[0] || '',
    tags: (property.tags || []).join(', '),
  } : { ...emptyForm });
  const [tab, setTab] = useState('basic');
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form,
        area: +form.area || undefined, builtArea: +form.builtArea || undefined,
        bedrooms: +form.bedrooms || undefined, bathrooms: +form.bathrooms || undefined,
        parkingSpots: +form.parkingSpots || 0, yearBuilt: +form.yearBuilt || undefined,
        purchasePrice: +form.purchasePrice || undefined, currentValue: +form.currentValue || undefined,
        stampDuty: +form.stampDuty || undefined, registrationCost: +form.registrationCost || undefined,
        monthlyMaintenance: +form.monthlyMaintenance || 0,
        annualPropertyTax: +form.annualPropertyTax || 0,
        annualInsurance: +form.annualInsurance || 0,
        tags: form.tags ? form.tags.split(',').map(t=>t.trim()).filter(Boolean) : [],
        purchaseDate: form.purchaseDate || undefined,
      };
      let saved;
      if (property) { saved = (await updateProperty(property._id, payload)).data; toast.success('Property updated!'); }
      else { saved = (await createProperty(payload)).data; toast.success('Property added! 🏠'); }
      onSave(saved); onClose();
    } catch(err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  const tc = PROP_TYPES[form.type] || {};
  const appreciation = (+form.currentValue || 0) - (+form.purchasePrice || 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e=>e.stopPropagation()} style={{ maxHeight:'90vh', overflowY:'auto' }}>
        <div className="modal-header">
          <div className="modal-title">{property ? 'Edit Property' : 'Add Property'}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {/* Type selector */}
          <div className="form-group">
            <label className="form-label">Property Type *</label>
            <div className="prop-type-grid">
              {Object.entries(PROP_TYPES).map(([k, t]) => (
                <button key={k} type="button" onClick={() => set('type', k)}
                  style={{ padding:'10px 8px', borderRadius:10, border:`2px solid ${form.type===k ? t.color : 'var(--border)'}`, background: form.type===k ? `${t.color}10` : 'var(--surface2)', cursor:'pointer', textAlign:'center', transition:'all 0.15s' }}>
                  <div style={{ fontSize:22, marginBottom:3 }}>{t.icon}</div>
                  <div style={{ fontSize:10, fontWeight:800, color: form.type===k ? t.color : 'var(--text3)', fontFamily:'Syne,sans-serif' }}>{t.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Inner tabs */}
          <div className="tabs" style={{ marginBottom:18 }}>
            {['basic','details','financials'].map(t2 => (
              <button key={t2} type="button" className={`tab ${tab===t2?'active':''}`} onClick={()=>setTab(t2)}>
                {t2==='basic'?'📍 Basic':t2==='details'?'📐 Details':'💰 Financials'}
              </button>
            ))}
          </div>

          {tab === 'basic' && <>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Property Name *</label>
                <input className="form-input" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Home at Whitefield" required /></div>
              <div className="form-group"><label className="form-label">Status</label>
                <select className="form-select" value={form.status} onChange={e=>set('status',e.target.value)}>
                  {Object.entries(STATUS_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select></div>
            </div>
            <div className="form-group"><label className="form-label">Address</label>
              <input className="form-input" value={form.address} onChange={e=>set('address',e.target.value)} placeholder="Street address, flat no." /></div>
            <div className="form-row-3">
              <div className="form-group"><label className="form-label">City</label>
                <input className="form-input" value={form.city} onChange={e=>set('city',e.target.value)} placeholder="e.g. Bengaluru" /></div>
              <div className="form-group"><label className="form-label">State</label>
                <input className="form-input" value={form.state} onChange={e=>set('state',e.target.value)} placeholder="e.g. Karnataka" /></div>
              <div className="form-group"><label className="form-label">Pincode</label>
                <input className="form-input" value={form.pincode} onChange={e=>set('pincode',e.target.value)} placeholder="560001" /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Landmark</label>
                <input className="form-input" value={form.landmark} onChange={e=>set('landmark',e.target.value)} placeholder="Near..." /></div>
              <div className="form-group"><label className="form-label">Color Tag</label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:4 }}>
                  {PROP_COLORS.map(c => (
                    <div key={c} onClick={()=>set('color',c)} style={{ width:26, height:26, borderRadius:'50%', background:c, cursor:'pointer', border:`3px solid ${form.color===c ? '#0f1629' : 'transparent'}`, transition:'all 0.15s' }} />
                  ))}
                </div></div>
            </div>
            <div className="form-group"><label className="form-label">Notes</label>
              <textarea className="form-textarea" value={form.notes} onChange={e=>set('notes',e.target.value)} style={{ minHeight:64 }} /></div>
          </>}

          {tab === 'details' && <>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Plot Area (sq ft)</label>
                <input type="number" className="form-input" value={form.area} onChange={e=>set('area',e.target.value)} placeholder="2400" /></div>
              <div className="form-group"><label className="form-label">Built-up Area (sq ft)</label>
                <input type="number" className="form-input" value={form.builtArea} onChange={e=>set('builtArea',e.target.value)} placeholder="1800" /></div>
            </div>
            <div className="form-row-3">
              <div className="form-group"><label className="form-label">Bedrooms</label>
                <input type="number" className="form-input" value={form.bedrooms} onChange={e=>set('bedrooms',e.target.value)} placeholder="3" /></div>
              <div className="form-group"><label className="form-label">Bathrooms</label>
                <input type="number" className="form-input" value={form.bathrooms} onChange={e=>set('bathrooms',e.target.value)} placeholder="2" /></div>
              <div className="form-group"><label className="form-label">Parking Spots</label>
                <input type="number" className="form-input" value={form.parkingSpots} onChange={e=>set('parkingSpots',e.target.value)} placeholder="1" /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Floors</label>
                <input type="number" className="form-input" value={form.floors} onChange={e=>set('floors',e.target.value)} placeholder="2" /></div>
              <div className="form-group"><label className="form-label">Year Built</label>
                <input type="number" className="form-input" value={form.yearBuilt} onChange={e=>set('yearBuilt',e.target.value)} placeholder="2018" /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Registration Number</label>
                <input className="form-input" value={form.registrationNumber} onChange={e=>set('registrationNumber',e.target.value)} placeholder="Reg. doc number" /></div>
              <div className="form-group"><label className="form-label">Survey / Khata Number</label>
                <input className="form-input" value={form.surveyNumber} onChange={e=>set('surveyNumber',e.target.value)} placeholder="Survey number" /></div>
            </div>
          </>}

          {tab === 'financials' && <>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Purchase Price (₹)</label>
                <input type="number" className="form-input" value={form.purchasePrice} onChange={e=>set('purchasePrice',e.target.value)} placeholder="0" /></div>
              <div className="form-group"><label className="form-label">Purchase Date</label>
                <input type="date" className="form-input" value={form.purchaseDate} onChange={e=>set('purchaseDate',e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Current Market Value (₹)</label>
                <input type="number" className="form-input" value={form.currentValue} onChange={e=>set('currentValue',e.target.value)} placeholder="0" /></div>
              <div className="form-group"><label className="form-label">Stamp Duty Paid (₹)</label>
                <input type="number" className="form-input" value={form.stampDuty} onChange={e=>set('stampDuty',e.target.value)} placeholder="0" /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Registration Cost (₹)</label>
                <input type="number" className="form-input" value={form.registrationCost} onChange={e=>set('registrationCost',e.target.value)} placeholder="0" /></div>
              <div className="form-group"><label className="form-label">Monthly Maintenance (₹)</label>
                <input type="number" className="form-input" value={form.monthlyMaintenance} onChange={e=>set('monthlyMaintenance',e.target.value)} placeholder="0" /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Annual Property Tax (₹)</label>
                <input type="number" className="form-input" value={form.annualPropertyTax} onChange={e=>set('annualPropertyTax',e.target.value)} placeholder="0" /></div>
              <div className="form-group"><label className="form-label">Annual Insurance (₹)</label>
                <input type="number" className="form-input" value={form.annualInsurance} onChange={e=>set('annualInsurance',e.target.value)} placeholder="0" /></div>
            </div>
            {(+form.currentValue > 0 && +form.purchasePrice > 0) && (
              <div style={{ padding:'14px 16px', borderRadius:12, background: appreciation>=0?'rgba(5,150,105,0.07)':'rgba(220,38,38,0.07)', border:`1px solid ${appreciation>=0?'rgba(5,150,105,0.2)':'rgba(220,38,38,0.2)'}` }}>
                <div style={{ fontSize:12, color:'var(--text3)', marginBottom:4 }}>Appreciation Preview</div>
                <div style={{ fontFamily:'DM Mono', fontSize:20, fontWeight:600, color: appreciation>=0?'var(--green)':'var(--red)' }}>
                  {appreciation>=0?'+':''}{fmt(appreciation)} ({((appreciation/(+form.purchasePrice||1))*100).toFixed(1)}%)
                </div>
              </div>
            )}
          </>}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ background:`linear-gradient(135deg, ${tc.color||'#2563eb'}, ${tc.color||'#2563eb'}cc)`, border:'none' }}>
              {saving ? 'Saving...' : property ? 'Update Property' : 'Add Property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tenant Modal ─────────────────────────────────────────────────────────────
function TenantModal({ property, onClose, onSave }) {
  const t = property.tenant || {};
  const [form, setForm] = useState({
    name: t.name||'', phone:t.phone||'', email:t.email||'', aadhar:t.aadhar||'', pan:t.pan||'',
    leaseStart:t.leaseStart?.split('T')[0]||'', leaseEnd:t.leaseEnd?.split('T')[0]||'',
    monthlyRent:t.monthlyRent||'', securityDeposit:t.securityDeposit||'',
    rentDueDay:t.rentDueDay||1, escalationPct:t.escalationPct||5, notes:t.notes||'', isActive:true
  });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...form, monthlyRent:+form.monthlyRent, securityDeposit:+form.securityDeposit, rentDueDay:+form.rentDueDay, escalationPct:+form.escalationPct };
      const r = await upsertTenant(property._id, payload);
      onSave(r.data); toast.success('Tenant info saved!'); onClose();
    } catch(err) { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e=>e.stopPropagation()} style={{ maxHeight:'88vh', overflowY:'auto' }}>
        <div className="modal-header">
          <div className="modal-title">{property.tenant ? 'Edit Tenant' : 'Add Tenant'}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ padding:'12px 16px', borderRadius:11, background:'rgba(5,150,105,0.07)', border:'1px solid rgba(5,150,105,0.18)', marginBottom:18, display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:24 }}>🏠</span>
            <div><div style={{ fontWeight:700, fontSize:13 }}>{property.name}</div>
            <div style={{ fontSize:12, color:'var(--text3)' }}>{property.address}, {property.city}</div></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Tenant Name *</label>
              <input className="form-input" value={form.name} onChange={e=>set('name',e.target.value)} required placeholder="Full name" /></div>
            <div className="form-group"><label className="form-label">Phone</label>
              <input className="form-input" value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="+91 9876543210" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Email</label>
              <input className="form-input" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="email@example.com" /></div>
            <div className="form-group"><label className="form-label">Aadhaar Number</label>
              <input className="form-input" value={form.aadhar} onChange={e=>set('aadhar',e.target.value)} placeholder="XXXX XXXX XXXX" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">PAN</label>
              <input className="form-input" value={form.pan} onChange={e=>set('pan',e.target.value)} placeholder="ABCDE1234F" /></div>
            <div className="form-group"><label className="form-label">Monthly Rent (₹) *</label>
              <input type="number" className="form-input" value={form.monthlyRent} onChange={e=>set('monthlyRent',e.target.value)} required placeholder="25000" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Security Deposit (₹)</label>
              <input type="number" className="form-input" value={form.securityDeposit} onChange={e=>set('securityDeposit',e.target.value)} placeholder="75000" /></div>
            <div className="form-group"><label className="form-label">Rent Due Day (of month)</label>
              <input type="number" min="1" max="31" className="form-input" value={form.rentDueDay} onChange={e=>set('rentDueDay',e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Lease Start</label>
              <input type="date" className="form-input" value={form.leaseStart} onChange={e=>set('leaseStart',e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Lease End</label>
              <input type="date" className="form-input" value={form.leaseEnd} onChange={e=>set('leaseEnd',e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Annual Rent Escalation %</label>
              <input type="number" step="0.5" className="form-input" value={form.escalationPct} onChange={e=>set('escalationPct',e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Notes</label>
              <input className="form-input" value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Any notes..." /></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn" style={{ background:'linear-gradient(135deg,#059669,#0d9488)', color:'#fff', border:'none' }} disabled={saving}>
              {saving ? 'Saving...' : 'Save Tenant Info'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Contact Modal ────────────────────────────────────────────────────────────
function ContactModal({ property, contact, onClose, onSave }) {
  const [form, setForm] = useState({ name:'', role:'', phone:'', email:'', notes:'', ...(contact||{}) });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const r = await addContact(property._id, form);
      onSave(r.data); toast.success('Contact added!'); onClose();
    } catch(err) { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Add Contact</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label className="form-label">Name *</label>
            <input className="form-input" value={form.name} onChange={e=>set('name',e.target.value)} required placeholder="Full name" /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Role</label>
              <select className="form-select" value={form.role} onChange={e=>set('role',e.target.value)}>
                <option value="">Select role...</option>
                {CONTACT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select></div>
            <div className="form-group"><label className="form-label">Phone</label>
              <input className="form-input" value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="+91 9876543210" /></div>
          </div>
          <div className="form-group"><label className="form-label">Email</label>
            <input className="form-input" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="email@example.com" /></div>
          <div className="form-group"><label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.notes} onChange={e=>set('notes',e.target.value)} style={{ minHeight:60 }} /></div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '...' : 'Add Contact'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Document Modal ───────────────────────────────────────────────────────────
function DocumentModal({ property, onClose, onSave }) {
  const [form, setForm] = useState({ name:'', type:'', fileName:'', issueDate:'', expiryDate:'', notes:'', isImportant:false });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const r = await addDocument(property._id, form);
      onSave(r.data); toast.success('Document recorded!'); onClose();
    } catch(err) { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Add Document Record</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label className="form-label">Document Name *</label>
            <input className="form-input" value={form.name} onChange={e=>set('name',e.target.value)} required placeholder="e.g. Sale Deed 2019" /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Document Type</label>
              <select className="form-select" value={form.type} onChange={e=>set('type',e.target.value)}>
                <option value="">Select type...</option>
                {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select></div>
            <div className="form-group"><label className="form-label">File / Reference Name</label>
              <input className="form-input" value={form.fileName} onChange={e=>set('fileName',e.target.value)} placeholder="File name or reference" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Issue Date</label>
              <input type="date" className="form-input" value={form.issueDate} onChange={e=>set('issueDate',e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Expiry Date</label>
              <input type="date" className="form-input" value={form.expiryDate} onChange={e=>set('expiryDate',e.target.value)} /></div>
          </div>
          <div className="form-group"><label className="form-label">Notes / Location</label>
            <textarea className="form-textarea" value={form.notes} onChange={e=>set('notes',e.target.value)} style={{ minHeight:60 }} placeholder="Where is this document stored? Any important notes..." /></div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
            <input type="checkbox" id="imp" checked={form.isImportant} onChange={e=>set('isImportant',e.target.checked)} style={{ width:16, height:16 }} />
            <label htmlFor="imp" style={{ fontSize:13, color:'var(--text2)', cursor:'pointer' }}>⭐ Mark as important document</label>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '...' : 'Save Document'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Transaction Modal ────────────────────────────────────────────────────────
function TxModal({ property, onClose, onSave }) {
  const [form, setForm] = useState({ type:'income', category:'Rent', amount:'', date:new Date().toISOString().split('T')[0], description:'', notes:'' });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const cats = TX_CATEGORIES[form.type] || [];

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const r = await addPropertyTx(property._id, { ...form, amount:+form.amount });
      onSave(r.data); toast.success(form.type==='income'?'Income recorded! 💰':'Expense recorded!'); onClose();
    } catch(err) { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Add Transaction</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:18 }}>
            {[['income','💰 Income','#059669','rgba(5,150,105,0.08)'],['expense','💸 Expense','#dc2626','rgba(220,38,38,0.08)']].map(([t,label,color,bg])=>(
              <button key={t} type="button" onClick={()=>{ set('type',t); set('category',TX_CATEGORIES[t][0]); }}
                style={{ padding:'12px', borderRadius:10, border:`2px solid ${form.type===t?color:'var(--border)'}`, background:form.type===t?bg:'var(--surface2)', color:form.type===t?color:'var(--text3)', fontWeight:700, fontSize:14, cursor:'pointer', transition:'all 0.15s' }}>
                {label}
              </button>
            ))}
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Category</label>
              <select className="form-select" value={form.category} onChange={e=>set('category',e.target.value)}>
                {cats.map(c => <option key={c} value={c}>{c}</option>)}
              </select></div>
            <div className="form-group"><label className="form-label">Amount (₹) *</label>
              <input type="number" className="form-input" value={form.amount} onChange={e=>set('amount',e.target.value)} required placeholder="0" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Date *</label>
              <input type="date" className="form-input" value={form.date} onChange={e=>set('date',e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">Description *</label>
              <input className="form-input" value={form.description} onChange={e=>set('description',e.target.value)} required placeholder="e.g. February rent" /></div>
          </div>
          <div className="form-group"><label className="form-label">Notes</label>
            <input className="form-input" value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Optional notes" /></div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn" style={{ background: form.type==='income'?'linear-gradient(135deg,#059669,#0d9488)':'linear-gradient(135deg,#dc2626,#ef4444)', color:'#fff', border:'none' }} disabled={saving}>
              {saving?'...':`Add ${form.type==='income'?'Income':'Expense'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Property Detail Panel ────────────────────────────────────────────────────
function PropertyDetail({ property: initProp, onUpdate }) {
  const [prop, setProp] = useState(initProp);
  const [tab, setTab] = useState('overview');
  const [modal, setModal] = useState(null); // 'tenant'|'contact'|'doc'|'tx'|'edit'

  useEffect(() => { setProp(initProp); }, [initProp]);

  const handleSave = (updated) => { setProp(updated); onUpdate(updated); };

  const tc = PROP_TYPES[prop.type] || {};
  const sc = STATUS_CONFIG[prop.status] || {};
  const appreciation = (prop.currentValue || 0) - (prop.purchasePrice || 0);
  const appreciationPct = prop.purchasePrice ? (appreciation / prop.purchasePrice * 100) : 0;

  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const yearIncome = (prop.transactions||[]).filter(t=>t.type==='income' && new Date(t.date)>=yearStart).reduce((s,t)=>s+t.amount,0);
  const yearExpense = (prop.transactions||[]).filter(t=>t.type==='expense' && new Date(t.date)>=yearStart).reduce((s,t)=>s+t.amount,0);
  const allIncome = (prop.transactions||[]).filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const allExpense = (prop.transactions||[]).filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);

  const handleDeleteContact = async (cid) => {
    if (!window.confirm('Remove this contact?')) return;
    const r = await deleteContact(prop._id, cid);
    handleSave(r.data); toast.success('Contact removed');
  };
  const handleDeleteDoc = async (did) => {
    if (!window.confirm('Remove this document record?')) return;
    const r = await deleteDocument(prop._id, did);
    handleSave(r.data); toast.success('Document removed');
  };
  const handleDeleteTx = async (tid) => {
    if (!window.confirm('Delete this transaction?')) return;
    const r = await deletePropertyTx(prop._id, tid);
    handleSave(r.data); toast.success('Deleted');
  };
  const handleRemoveTenant = async () => {
    if (!window.confirm('Remove tenant from this property?')) return;
    const r = await removeTenant(prop._id);
    handleSave(r.data); toast.success('Tenant removed');
  };

  // Lease expiry warning
  const leaseExpiry = prop.tenant?.leaseEnd ? new Date(prop.tenant.leaseEnd) : null;
  const daysToExpiry = leaseExpiry ? Math.ceil((leaseExpiry - new Date()) / (1000*60*60*24)) : null;

  return (
    <div className="prop-detail fade-in">
      {/* Hero */}
      <div className="prop-hero" style={{ background:`linear-gradient(135deg, ${prop.color||tc.color||'#2563eb'} 0%, ${prop.color||tc.color||'#2563eb'}99 100%)` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
              <span style={{ fontSize:32 }}>{tc.icon}</span>
              <div>
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'rgba(255,255,255,0.5)' }}>{tc.label}</div>
                <div style={{ fontFamily:'Syne,sans-serif', fontSize:22, fontWeight:800, color:'#fff', lineHeight:1.1 }}>{prop.name}</div>
              </div>
            </div>
            {(prop.address||prop.city) && (
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.6)', marginTop:4 }}>📍 {[prop.address, prop.city, prop.state].filter(Boolean).join(', ')}</div>
            )}
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8 }}>
            <span style={{ fontSize:11, fontWeight:800, padding:'4px 10px', borderRadius:100, background:'rgba(255,255,255,0.15)', color:'#fff', backdropFilter:'blur(8px)' }}>{sc.label}</span>
            <button className="btn btn-sm" onClick={() => setModal('edit')} style={{ background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.2)', backdropFilter:'blur(4px)' }}>✏️ Edit</button>
          </div>
        </div>

        {/* Quick stats in hero */}
        <div className="prop-hero-stats">
          {prop.currentValue > 0 && (
            <div><div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Market Value</div>
              <div style={{ fontFamily:'DM Mono', fontSize:20, fontWeight:600, color:'#fff' }}>{fmt(prop.currentValue)}</div></div>
          )}
          {prop.purchasePrice > 0 && (
            <div><div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Appreciation</div>
              <div style={{ fontFamily:'DM Mono', fontSize:20, fontWeight:600, color: appreciation>=0?'#6ee7b7':'#fca5a5' }}>{appreciation>=0?'+':''}{fmt(appreciation)}</div></div>
          )}
          {prop.status==='rented' && prop.tenant?.monthlyRent > 0 && (
            <div><div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Monthly Rent</div>
              <div style={{ fontFamily:'DM Mono', fontSize:20, fontWeight:600, color:'#fff' }}>{fmt(prop.tenant.monthlyRent)}</div></div>
          )}
          {(prop.bedrooms||prop.builtArea) && (
            <div><div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Size</div>
              <div style={{ fontSize:15, fontWeight:600, color:'#fff' }}>{prop.bedrooms ? `${prop.bedrooms}BHK` : ''} {prop.builtArea ? `${prop.builtArea} sq ft` : prop.area ? `${prop.area} sq ft` : ''}</div></div>
          )}
        </div>
      </div>

      {/* Lease expiry alert */}
      {daysToExpiry !== null && daysToExpiry <= 90 && daysToExpiry > 0 && (
        <div style={{ padding:'12px 16px', borderRadius:11, background:daysToExpiry<=30?'rgba(220,38,38,0.08)':'rgba(217,119,6,0.08)', border:`1px solid ${daysToExpiry<=30?'rgba(220,38,38,0.25)':'rgba(217,119,6,0.25)'}`, marginTop:18, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:20 }}>{daysToExpiry<=30?'🚨':'⚠️'}</span>
          <span style={{ fontSize:13, fontWeight:600, color:daysToExpiry<=30?'var(--red)':'var(--amber)' }}>
            Lease expires in {daysToExpiry} days ({fmtDate(prop.tenant.leaseEnd)})
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs" style={{ marginTop:20 }}>
        {[['overview','🏠 Overview'],['tenant','👤 Tenant'],['contacts','📞 Contacts'],['documents','📄 Documents'],['transactions','💰 Transactions']].map(([t,label])=>(
          <button key={t} className={`tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>
            {label}
            {t==='contacts' && prop.contacts?.length>0 && <span className="tab-badge">{prop.contacts.length}</span>}
            {t==='documents' && prop.documents?.length>0 && <span className="tab-badge">{prop.documents.length}</span>}
            {t==='transactions' && prop.transactions?.length>0 && <span className="tab-badge">{prop.transactions.length}</span>}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab==='overview' && (
        <div className="prop-overview-grid">
          {/* Property specs */}
          <div className="card">
            <div className="section-title">Property Details</div>
            <div className="prop-spec-grid">
              {prop.bedrooms && <div className="prop-spec"><span>🛏️</span><div><div className="prop-spec-val">{prop.bedrooms} BHK</div><div className="prop-spec-label">Bedrooms</div></div></div>}
              {prop.bathrooms && <div className="prop-spec"><span>🚿</span><div><div className="prop-spec-val">{prop.bathrooms}</div><div className="prop-spec-label">Bathrooms</div></div></div>}
              {prop.builtArea && <div className="prop-spec"><span>📐</span><div><div className="prop-spec-val">{prop.builtArea} sq ft</div><div className="prop-spec-label">Built-up</div></div></div>}
              {prop.area && <div className="prop-spec"><span>🗺️</span><div><div className="prop-spec-val">{prop.area} sq ft</div><div className="prop-spec-label">Plot Area</div></div></div>}
              {prop.parkingSpots > 0 && <div className="prop-spec"><span>🅿️</span><div><div className="prop-spec-val">{prop.parkingSpots}</div><div className="prop-spec-label">Parking</div></div></div>}
              {prop.floors && <div className="prop-spec"><span>🏗️</span><div><div className="prop-spec-val">{prop.floors}</div><div className="prop-spec-label">Floors</div></div></div>}
              {prop.yearBuilt && <div className="prop-spec"><span>📅</span><div><div className="prop-spec-val">{prop.yearBuilt}</div><div className="prop-spec-label">Year Built</div></div></div>}
              {prop.registrationNumber && <div className="prop-spec"><span>📝</span><div><div className="prop-spec-val" style={{ fontSize:11 }}>{prop.registrationNumber}</div><div className="prop-spec-label">Reg. Number</div></div></div>}
            </div>
          </div>

          {/* Financial overview */}
          <div className="card">
            <div className="section-title">Financial Overview</div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {prop.purchasePrice>0 && (
                <div className="fin-row"><span style={{ color:'var(--text3)', fontSize:12 }}>Purchase Price</span><span style={{ fontFamily:'DM Mono', fontWeight:500 }}>{fmt(prop.purchasePrice)}</span></div>
              )}
              {(prop.stampDuty||prop.registrationCost) && (
                <div className="fin-row"><span style={{ color:'var(--text3)', fontSize:12 }}>Stamp Duty + Reg.</span><span style={{ fontFamily:'DM Mono', fontWeight:500 }}>{fmt((prop.stampDuty||0)+(prop.registrationCost||0))}</span></div>
              )}
              {prop.currentValue>0 && (
                <div className="fin-row"><span style={{ color:'var(--text3)', fontSize:12 }}>Current Market Value</span><span style={{ fontFamily:'DM Mono', fontWeight:600, color:prop.color||'#2563eb' }}>{fmt(prop.currentValue)}</span></div>
              )}
              {prop.purchasePrice>0 && prop.currentValue>0 && (
                <div className="fin-row" style={{ paddingTop:8, borderTop:'1px solid var(--border)' }}>
                  <span style={{ fontWeight:700, fontSize:13 }}>Appreciation</span>
                  <span style={{ fontFamily:'DM Mono', fontWeight:700, color:appreciation>=0?'var(--green)':'var(--red)', fontSize:16 }}>
                    {appreciation>=0?'+':''}{fmt(appreciation)} ({appreciationPct.toFixed(1)}%)
                  </span>
                </div>
              )}
              <div style={{ height:1, background:'var(--border)', margin:'4px 0' }} />
              {prop.monthlyMaintenance>0 && (
                <div className="fin-row"><span style={{ color:'var(--text3)', fontSize:12 }}>Monthly Maintenance</span><span style={{ fontFamily:'DM Mono', color:'var(--red)' }}>{fmt(prop.monthlyMaintenance)}/mo</span></div>
              )}
              {prop.annualPropertyTax>0 && (
                <div className="fin-row"><span style={{ color:'var(--text3)', fontSize:12 }}>Property Tax</span><span style={{ fontFamily:'DM Mono', color:'var(--red)' }}>{fmt(prop.annualPropertyTax)}/yr</span></div>
              )}
              {prop.annualInsurance>0 && (
                <div className="fin-row"><span style={{ color:'var(--text3)', fontSize:12 }}>Insurance</span><span style={{ fontFamily:'DM Mono', color:'var(--red)' }}>{fmt(prop.annualInsurance)}/yr</span></div>
              )}
            </div>
          </div>

          {/* This year P&L */}
          <div className="card" style={{ gridColumn:'1 / -1' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
              <div className="section-title" style={{ marginBottom:0 }}>P&L — This Year ({new Date().getFullYear()})</div>
              <button className="btn btn-primary btn-sm" onClick={()=>setModal('tx')}>+ Add Transaction</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
              <div style={{ padding:'16px 18px', background:'rgba(5,150,105,0.07)', borderRadius:12, border:'1px solid rgba(5,150,105,0.18)' }}>
                <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--green)', marginBottom:6 }}>Total Income</div>
                <div style={{ fontFamily:'DM Mono', fontSize:22, fontWeight:600, color:'var(--green)' }}>{fmt(yearIncome)}</div>
              </div>
              <div style={{ padding:'16px 18px', background:'rgba(220,38,38,0.07)', borderRadius:12, border:'1px solid rgba(220,38,38,0.18)' }}>
                <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--red)', marginBottom:6 }}>Total Expenses</div>
                <div style={{ fontFamily:'DM Mono', fontSize:22, fontWeight:600, color:'var(--red)' }}>{fmt(yearExpense)}</div>
              </div>
              <div style={{ padding:'16px 18px', background:(yearIncome-yearExpense)>=0?'rgba(5,150,105,0.07)':'rgba(220,38,38,0.07)', borderRadius:12, border:`1px solid ${(yearIncome-yearExpense)>=0?'rgba(5,150,105,0.18)':'rgba(220,38,38,0.18)'}` }}>
                <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:(yearIncome-yearExpense)>=0?'var(--green)':'var(--red)', marginBottom:6 }}>Net Cash Flow</div>
                <div style={{ fontFamily:'DM Mono', fontSize:22, fontWeight:600, color:(yearIncome-yearExpense)>=0?'var(--green)':'var(--red)' }}>{fmt(yearIncome-yearExpense)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tenant Tab */}
      {tab==='tenant' && (
        <div>
          {prop.tenant ? (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
                <div className="section-title" style={{ marginBottom:0 }}>Current Tenant</div>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={()=>setModal('tenant')}>✏️ Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={handleRemoveTenant}>Remove</button>
                </div>
              </div>
              <div className="prop-tenant-card">
                <div style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
                  <div style={{ width:56, height:56, borderRadius:16, background:'linear-gradient(135deg,#059669,#0d9488)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>👤</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:'Syne,sans-serif', fontSize:20, fontWeight:800, color:'var(--text)' }}>{prop.tenant.name}</div>
                    <div style={{ display:'flex', gap:16, marginTop:6, flexWrap:'wrap' }}>
                      {prop.tenant.phone && <a href={`tel:${prop.tenant.phone}`} style={{ fontSize:13, color:'var(--accent)', textDecoration:'none', fontWeight:600 }}>📞 {prop.tenant.phone}</a>}
                      {prop.tenant.email && <a href={`mailto:${prop.tenant.email}`} style={{ fontSize:13, color:'var(--accent)', textDecoration:'none', fontWeight:600 }}>✉️ {prop.tenant.email}</a>}
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontFamily:'DM Mono', fontSize:24, fontWeight:600, color:'var(--green)' }}>{fmt(prop.tenant.monthlyRent)}</div>
                    <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>per month</div>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginTop:20 }}>
                  {[
                    ['Lease Start', fmtDate(prop.tenant.leaseStart)],
                    ['Lease End', fmtDate(prop.tenant.leaseEnd)],
                    ['Rent Due', `${prop.tenant.rentDueDay}${['st','nd','rd'][prop.tenant.rentDueDay-1]||'th'} of month`],
                    ['Security Deposit', fmt(prop.tenant.securityDeposit)],
                    ['Escalation', `${prop.tenant.escalationPct}% per year`],
                    ['Aadhaar', prop.tenant.aadhar || '—'],
                  ].map(([label,val])=>(
                    <div key={label}><div style={{ fontSize:10, color:'var(--text3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>{label}</div>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--text2)' }}>{val}</div></div>
                  ))}
                </div>
                {daysToExpiry !== null && (
                  <div style={{ marginTop:16, padding:'10px 14px', borderRadius:10, background: daysToExpiry<0?'rgba(220,38,38,0.07)':daysToExpiry<=90?'rgba(217,119,6,0.07)':'rgba(5,150,105,0.07)', border:`1px solid ${daysToExpiry<0?'rgba(220,38,38,0.2)':daysToExpiry<=90?'rgba(217,119,6,0.2)':'rgba(5,150,105,0.2)'}` }}>
                    <span style={{ fontSize:13, fontWeight:700, color:daysToExpiry<0?'var(--red)':daysToExpiry<=90?'var(--amber)':'var(--green)' }}>
                      {daysToExpiry<0 ? `⚠️ Lease expired ${Math.abs(daysToExpiry)} days ago` : daysToExpiry===0 ? '🚨 Lease expires today!' : `✅ Lease valid for ${daysToExpiry} more days`}
                    </span>
                  </div>
                )}
                {prop.tenant.notes && <div style={{ marginTop:14, fontSize:13, color:'var(--text2)', padding:'10px 12px', background:'var(--surface2)', borderRadius:10, border:'1px solid var(--border)' }}>{prop.tenant.notes}</div>}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🏠</div>
              <div className="empty-title">{prop.status==='self_occupied'?'Self Occupied Property':'No Active Tenant'}</div>
              <div className="empty-desc">{prop.status==='self_occupied'?'This property is currently self-occupied.':'Add tenant details to track rent, lease period and contact information.'}</div>
              <button className="btn btn-primary" onClick={()=>setModal('tenant')}>+ Add Tenant</button>
            </div>
          )}
        </div>
      )}

      {/* Contacts Tab */}
      {tab==='contacts' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
            <div className="section-title" style={{ marginBottom:0 }}>Important Contacts ({prop.contacts?.length||0})</div>
            <button className="btn btn-primary btn-sm" onClick={()=>setModal('contact')}>+ Add Contact</button>
          </div>
          {prop.contacts?.length > 0 ? (
            <div className="prop-contacts-grid">
              {prop.contacts.map(c => (
                <div key={c._id} className="prop-contact-card">
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                      <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg,var(--accent),#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>👤</div>
                      <div>
                        <div style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>{c.name}</div>
                        {c.role && <div style={{ fontSize:11, color:'var(--accent)', fontWeight:700, marginTop:1 }}>{c.role}</div>}
                      </div>
                    </div>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={()=>handleDeleteContact(c._id)}>×</button>
                  </div>
                  <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:6 }}>
                    {c.phone && <a href={`tel:${c.phone}`} style={{ fontSize:13, color:'var(--text2)', textDecoration:'none', display:'flex', alignItems:'center', gap:6, fontWeight:500 }}>📞 <span style={{ color:'var(--accent)' }}>{c.phone}</span></a>}
                    {c.email && <a href={`mailto:${c.email}`} style={{ fontSize:13, color:'var(--text2)', textDecoration:'none', display:'flex', alignItems:'center', gap:6, fontWeight:500 }}>✉️ <span style={{ color:'var(--accent)' }}>{c.email}</span></a>}
                    {c.notes && <div style={{ fontSize:12, color:'var(--text3)', marginTop:4, fontStyle:'italic' }}>{c.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding:'40px 0' }}>
              <div className="empty-icon">📞</div>
              <div className="empty-title">No Contacts Yet</div>
              <div className="empty-desc">Add important contacts — plumber, electrician, society manager, etc.</div>
            </div>
          )}
        </div>
      )}

      {/* Documents Tab */}
      {tab==='documents' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
            <div className="section-title" style={{ marginBottom:0 }}>Documents ({prop.documents?.length||0})</div>
            <button className="btn btn-primary btn-sm" onClick={()=>setModal('doc')}>+ Add Document</button>
          </div>
          {prop.documents?.length > 0 ? (
            <div className="prop-docs-grid">
              {[...prop.documents].sort((a,b)=>(b.isImportant?1:0)-(a.isImportant?1:0)).map(d => {
                const isExpiring = d.expiryDate && new Date(d.expiryDate) < new Date(Date.now()+90*24*60*60*1000);
                return (
                  <div key={d._id} className={`prop-doc-card ${d.isImportant?'prop-doc-important':''}`}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                      <div style={{ display:'flex', gap:10, alignItems:'flex-start', flex:1, minWidth:0 }}>
                        <div style={{ fontSize:28, flexShrink:0 }}>📄</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontWeight:700, fontSize:13, color:'var(--text)', display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                            {d.name}
                            {d.isImportant && <span style={{ fontSize:9, fontWeight:800, padding:'2px 5px', borderRadius:4, background:'rgba(217,119,6,0.15)', color:'#d97706', textTransform:'uppercase' }}>⭐ Important</span>}
                          </div>
                          {d.type && <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{d.type}</div>}
                          {d.fileName && <div style={{ fontSize:11, color:'var(--text3)' }}>📎 {d.fileName}</div>}
                        </div>
                      </div>
                      <button className="btn btn-danger btn-sm btn-icon" style={{ flexShrink:0 }} onClick={()=>handleDeleteDoc(d._id)}>×</button>
                    </div>
                    <div style={{ display:'flex', gap:16, marginTop:10, flexWrap:'wrap' }}>
                      {d.issueDate && <span style={{ fontSize:11, color:'var(--text3)' }}>Issued: {fmtDate(d.issueDate)}</span>}
                      {d.expiryDate && <span style={{ fontSize:11, fontWeight:600, color:isExpiring?'var(--red)':'var(--text3)' }}>Expires: {fmtDate(d.expiryDate)}{isExpiring?' ⚠️':''}</span>}
                    </div>
                    {d.notes && <div style={{ fontSize:11, color:'var(--text2)', marginTop:8, padding:'8px 10px', background:'var(--surface2)', borderRadius:8 }}>{d.notes}</div>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state" style={{ padding:'40px 0' }}>
              <div className="empty-icon">📄</div>
              <div className="empty-title">No Documents Recorded</div>
              <div className="empty-desc">Track sale deeds, khata, property tax receipts, insurance policies and more.</div>
            </div>
          )}
        </div>
      )}

      {/* Transactions Tab */}
      {tab==='transactions' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
            <div className="section-title" style={{ marginBottom:0 }}>Transactions ({prop.transactions?.length||0})</div>
            <button className="btn btn-primary btn-sm" onClick={()=>setModal('tx')}>+ Add</button>
          </div>
          {/* All-time summary */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:20 }}>
            <div style={{ padding:'14px 16px', background:'rgba(5,150,105,0.07)', borderRadius:12, border:'1px solid rgba(5,150,105,0.15)' }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', color:'var(--green)', marginBottom:4 }}>All-time Income</div>
              <div style={{ fontFamily:'DM Mono', fontSize:20, fontWeight:600, color:'var(--green)' }}>{fmt(allIncome)}</div>
            </div>
            <div style={{ padding:'14px 16px', background:'rgba(220,38,38,0.07)', borderRadius:12, border:'1px solid rgba(220,38,38,0.15)' }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', color:'var(--red)', marginBottom:4 }}>All-time Expenses</div>
              <div style={{ fontFamily:'DM Mono', fontSize:20, fontWeight:600, color:'var(--red)' }}>{fmt(allExpense)}</div>
            </div>
            <div style={{ padding:'14px 16px', background:(allIncome-allExpense)>=0?'rgba(5,150,105,0.07)':'rgba(220,38,38,0.07)', borderRadius:12, border:`1px solid ${(allIncome-allExpense)>=0?'rgba(5,150,105,0.15)':'rgba(220,38,38,0.15)'}` }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', color:(allIncome-allExpense)>=0?'var(--green)':'var(--red)', marginBottom:4 }}>Net</div>
              <div style={{ fontFamily:'DM Mono', fontSize:20, fontWeight:600, color:(allIncome-allExpense)>=0?'var(--green)':'var(--red)' }}>{fmt(allIncome-allExpense)}</div>
            </div>
          </div>
          {prop.transactions?.length > 0 ? (
            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th style={{ textAlign:'right' }}>Amount</th><th></th></tr></thead>
                  <tbody>
                    {[...prop.transactions].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(tx=>(
                      <tr key={tx._id}>
                        <td style={{ fontSize:12, color:'var(--text3)', whiteSpace:'nowrap' }}>{fmtDate(tx.date)}</td>
                        <td style={{ fontWeight:600, fontSize:13 }}>{tx.description}</td>
                        <td><span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:100, background:'var(--bg2)', color:'var(--text2)' }}>{tx.category}</span></td>
                        <td>{pill(tx.type, tx.type==='income'?'var(--green)':'var(--red)', tx.type==='income'?'rgba(5,150,105,0.1)':'rgba(220,38,38,0.1)')}</td>
                        <td style={{ textAlign:'right', fontFamily:'DM Mono', fontWeight:600, color:tx.type==='income'?'var(--green)':'var(--red)' }}>{tx.type==='income'?'+':'-'}{fmt(tx.amount)}</td>
                        <td><button className="btn btn-danger btn-sm btn-icon" style={{ fontSize:11 }} onClick={()=>handleDeleteTx(tx._id)}>×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ padding:'40px 0' }}>
              <div className="empty-icon">💰</div><div className="empty-title">No Transactions Yet</div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {modal==='edit' && <PropertyModal property={prop} onClose={()=>setModal(null)} onSave={updated=>{ handleSave(updated); setModal(null); }} />}
      {modal==='tenant' && <TenantModal property={prop} onClose={()=>setModal(null)} onSave={handleSave} />}
      {modal==='contact' && <ContactModal property={prop} onClose={()=>setModal(null)} onSave={handleSave} />}
      {modal==='doc' && <DocumentModal property={prop} onClose={()=>setModal(null)} onSave={handleSave} />}
      {modal==='tx' && <TxModal property={prop} onClose={()=>setModal(null)} onSave={handleSave} />}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Properties() {
  const [properties, setProperties] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, sRes] = await Promise.all([getProperties(), getPropertySummary()]);
      setProperties(pRes.data);
      setSummary(sRes.data);
      if (pRes.data.length > 0 && !selected) setSelected(pRes.data[0]._id);
    } finally { setLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this property?')) return;
    await deleteProperty(id);
    toast.success('Property removed');
    setProperties(prev => prev.filter(p => p._id !== id));
    if (selected === id) setSelected(properties.find(p => p._id !== id)?._id || null);
  };

  const handleSave = (saved) => {
    setProperties(prev => {
      const idx = prev.findIndex(p => p._id === saved._id);
      if (idx >= 0) { const n=[...prev]; n[idx]=saved; return n; }
      return [...prev, saved];
    });
    if (!selected) setSelected(saved._id);
    load(); // refresh summary
  };

  const selectedProp = properties.find(p => p._id === selected);

  if (loading) return <div className="page"><div className="loading-screen"><div className="spinner" /></div></div>;

  return (
    <div className="page fade-in">
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:24, flexWrap:'wrap', gap:16 }}>
        <div>
          <h1 className="page-title">Property Portfolio</h1>
          <div className="page-sub">Manage your properties, tenants, documents and finances</div>
        </div>
        <button className="btn btn-primary" onClick={()=>setShowModal(true)}>+ Add Property</button>
      </div>

      {/* Summary row */}
      {summary && properties.length > 0 && (
        <div className="prop-summary-grid">
          {[
            { label:'Total Properties', val: summary.count, sub:`${summary.rented} rented · ${summary.selfOccupied} self-occupied`, icon:'🏘️', color:'#2563eb' },
            { label:'Portfolio Value', val: fmt(summary.totalCurrentValue), sub:`Cost: ${fmt(summary.totalPurchasePrice)}`, icon:'💰', color:'#059669', mono:true },
            { label:'Appreciation', val: fmt(summary.totalAppreciation), sub: summary.totalPurchasePrice > 0 ? `${((summary.totalAppreciation/summary.totalPurchasePrice)*100).toFixed(1)}% growth` : '', icon:'📈', color: summary.totalAppreciation>=0?'#059669':'#dc2626', mono:true },
            { label:'Monthly Rent', val: fmt(summary.totalMonthlyRent), sub:`${summary.rented} rented properties`, icon:'🏠', color:'#d97706', mono:true },
            { label:`${new Date().getFullYear()} Net Yield`, val: fmt(summary.netYield), sub:`Income: ${fmt(summary.yearIncome)} · Exp: ${fmt(summary.yearExpenses)}`, icon:'📊', color: summary.netYield>=0?'#059669':'#dc2626', mono:true },
          ].map((s,i) => (
            <div key={i} className="stat-card" style={i===0?{ background:'linear-gradient(135deg,#1a2560,#2d3f99)', border:'none' }:{}}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-label" style={i===0?{ color:'rgba(255,255,255,0.5)' }:{}}>{s.label}</div>
              <div className={`stat-value ${s.mono?'mono':''}`} style={{ fontSize:20, color:i===0?'#fff':s.color }}>{s.val}</div>
              {s.sub && <div style={{ fontSize:11, color:i===0?'rgba(255,255,255,0.35)':'var(--text3)', marginTop:6 }}>{s.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {properties.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏘️</div>
          <div className="empty-title">No Properties Yet</div>
          <div className="empty-desc">Start tracking your properties — home, rental, commercial. Manage tenants, documents and finances all in one place.</div>
          <button className="btn btn-primary btn-lg" onClick={()=>setShowModal(true)}>+ Add First Property</button>
        </div>
      ) : (
        <div className="prop-layout">
          {/* Left sidebar: property list */}
          <div className="prop-sidebar">
            <div className="prop-sidebar-header">
              <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text3)' }}>My Properties</span>
              <button className="btn btn-ghost btn-sm" style={{ fontSize:11, padding:'5px 10px' }} onClick={()=>setShowModal(true)}>+ Add</button>
            </div>
            {properties.map(p => {
              const tc = PROP_TYPES[p.type] || {};
              const sc = STATUS_CONFIG[p.status] || {};
              return (
                <div key={p._id} className={`prop-list-item ${selected===p._id?'active':''}`}
                  style={{ '--pc': p.color || tc.color || '#2563eb' }}
                  onClick={()=>setSelected(p._id)}>
                  <div style={{ width:36, height:36, borderRadius:10, background:`${p.color||tc.color||'#2563eb'}20`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{tc.icon}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</div>
                    <div style={{ fontSize:11, color:'var(--text3)', marginTop:1, display:'flex', alignItems:'center', gap:6 }}>
                      {p.city||tc.label}
                      <span style={{ fontSize:9, padding:'1px 6px', borderRadius:100, background:sc.bg, color:sc.color, fontWeight:700 }}>{sc.label}</span>
                    </div>
                  </div>
                  <button className="btn btn-danger btn-icon" style={{ width:24, height:24, fontSize:10, borderRadius:6, opacity:0, transition:'opacity 0.15s' }}
                    onClick={e=>{ e.stopPropagation(); handleDelete(p._id); }}>×</button>
                </div>
              );
            })}
          </div>

          {/* Detail panel */}
          <div className="prop-detail-wrap">
            {selectedProp ? (
              <PropertyDetail key={selected} property={selectedProp} onUpdate={handleSave} />
            ) : (
              <div className="empty-state"><div className="empty-icon">👈</div><div className="empty-title">Select a property</div></div>
            )}
          </div>
        </div>
      )}

      {showModal && <PropertyModal onClose={()=>setShowModal(false)} onSave={saved=>{ handleSave(saved); setShowModal(false); }} />}
    </div>
  );
}
