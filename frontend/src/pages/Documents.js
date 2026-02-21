import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  listDocuments, uploadDocument, updateDocumentMeta,
  deleteVaultDocument, getDocumentStats, getDocumentDownloadUrl,
} from '../utils/api';
import { fmtDate } from '../utils/helpers';
import './Documents.css';

// ─── Config ───────────────────────────────────────────────────────────────────
const CATEGORIES = {
  all:        { label: 'All',        icon: '📂', color: '#6b7280' },
  property:   { label: 'Property',   icon: '🏠', color: '#2563eb' },
  loan:       { label: 'Loan',       icon: '💳', color: '#7c3aed' },
  investment: { label: 'Investment', icon: '📈', color: '#059669' },
  insurance:  { label: 'Insurance',  icon: '🛡️', color: '#0891b2' },
  tax:        { label: 'Tax',        icon: '📋', color: '#dc2626' },
  identity:   { label: 'Identity',   icon: '🪪', color: '#d97706' },
  vehicle:    { label: 'Vehicle',    icon: '🚗', color: '#0d9488' },
  medical:    { label: 'Medical',    icon: '🏥', color: '#ec4899' },
  legal:      { label: 'Legal',      icon: '⚖️', color: '#64748b' },
  bank:       { label: 'Bank',       icon: '🏦', color: '#4f46e5' },
  other:      { label: 'Other',      icon: '📁', color: '#94a3b8' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function mimeIcon(mimeType, filename) {
  if (!mimeType) return '📄';
  if (mimeType === 'application/pdf') return '📕';
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.includes('word')) return '📝';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
  if (mimeType === 'text/plain') return '📄';
  return '📁';
}

function mimeLabel(mimeType) {
  if (!mimeType) return 'File';
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.startsWith('image/')) return mimeType.split('/')[1].toUpperCase();
  if (mimeType.includes('word')) return 'Word';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'Excel';
  if (mimeType === 'text/plain') return 'Text';
  return 'File';
}

// ─── Download helper ──────────────────────────────────────────────────────────
async function triggerDownload(docId, filename) {
  try {
    const url = getDocumentDownloadUrl(docId);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'document';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    toast.error('Download failed');
  }
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────
function UploadModal({ onClose, onUploaded }) {
  const [files, setFiles] = useState([]); // [{file, name, category, description, tags, documentDate, expiryDate, isImportant}]
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const addFiles = (rawFiles) => {
    const newEntries = Array.from(rawFiles).map(f => ({
      file: f,
      name: f.name.replace(/\.[^/.]+$/, ''), // strip extension for display name
      category: 'other',
      description: '',
      tags: '',
      documentDate: '',
      expiryDate: '',
      isImportant: false,
    }));
    setFiles(prev => [...prev, ...newEntries]);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const setField = (idx, k, v) => setFiles(prev => {
    const n = [...prev]; n[idx] = { ...n[idx], [k]: v }; return n;
  });

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const handleUpload = async () => {
    if (!files.length) { toast.error('Add at least one file'); return; }
    setUploading(true);
    let successCount = 0;
    let lastDoc = null;
    for (const entry of files) {
      try {
        const fd = new FormData();
        fd.append('file', entry.file);
        fd.append('name', entry.name || entry.file.name);
        fd.append('category', entry.category);
        fd.append('description', entry.description);
        fd.append('tags', entry.tags);
        if (entry.documentDate) fd.append('documentDate', entry.documentDate);
        if (entry.expiryDate) fd.append('expiryDate', entry.expiryDate);
        fd.append('isImportant', entry.isImportant ? 'true' : 'false');
        const r = await uploadDocument(fd);
        lastDoc = r.data;
        successCount++;
      } catch (err) {
        toast.error(`Failed: ${entry.file.name} — ${err.response?.data?.error || err.message}`);
      }
    }
    setUploading(false);
    if (successCount > 0) {
      toast.success(`${successCount} file${successCount > 1 ? 's' : ''} uploaded! 📁`);
      onUploaded(lastDoc);
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" style={{ maxWidth: 680, maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">📤 Upload Documents</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>PDF, Images, Word, Excel · Max 20MB each</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* Drop zone */}
        <div
          className={`doc-dropzone ${dragOver ? 'dragover' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" multiple style={{ display: 'none' }}
            accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx,.xls,.xlsx,.txt"
            onChange={e => addFiles(e.target.files)} />
          <div style={{ fontSize: 40, marginBottom: 10 }}>📂</div>
          <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Drop files here or click to browse</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Supports PDF, JPG, PNG, Word, Excel, Text</div>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
            {files.map((entry, idx) => (
              <div key={idx} className="doc-upload-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 26 }}>{mimeIcon(entry.file.type)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.file.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{fmtSize(entry.file.size)} · {mimeLabel(entry.file.type)}</div>
                  </div>
                  <button className="btn btn-danger btn-icon btn-sm" onClick={() => removeFile(idx)}>×</button>
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label">Display Name</label>
                    <input className="form-input" value={entry.name} onChange={e => setField(idx, 'name', e.target.value)} placeholder="Document name" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label">Category</label>
                    <select className="form-select" value={entry.category} onChange={e => setField(idx, 'category', e.target.value)}>
                      {Object.entries(CATEGORIES).filter(([k]) => k !== 'all').map(([k, c]) => (
                        <option key={k} value={k}>{c.icon} {c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label">Document Date</label>
                    <input type="date" className="form-input" value={entry.documentDate} onChange={e => setField(idx, 'documentDate', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label">Expiry Date (optional)</label>
                    <input type="date" className="form-input" value={entry.expiryDate} onChange={e => setField(idx, 'expiryDate', e.target.value)} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label">Description</label>
                    <input className="form-input" value={entry.description} onChange={e => setField(idx, 'description', e.target.value)} placeholder="Brief description" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label">Tags (comma separated)</label>
                    <input className="form-input" value={entry.tags} onChange={e => setField(idx, 'tags', e.target.value)} placeholder="e.g. hdfc, flat3A" />
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={entry.isImportant} onChange={e => setField(idx, 'isImportant', e.target.checked)} />
                  <span style={{ color: 'var(--text2)' }}>⭐ Mark as important</span>
                </label>
              </div>
            ))}
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary" disabled={uploading || !files.length}
            onClick={handleUpload}
            style={{ background: 'linear-gradient(135deg, #3b56f5, #7c3aed)', border: 'none', minWidth: 140 }}
          >
            {uploading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                Uploading...
              </span>
            ) : `Upload ${files.length > 0 ? files.length : ''} File${files.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Metadata Modal ──────────────────────────────────────────────────────
function EditDocModal({ doc, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: doc.name,
    category: doc.category,
    description: doc.description || '',
    tags: (doc.tags || []).join(', '),
    documentDate: doc.documentDate ? doc.documentDate.split('T')[0] : '',
    expiryDate: doc.expiryDate ? doc.expiryDate.split('T')[0] : '',
    isImportant: doc.isImportant || false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const r = await updateDocumentMeta(doc._id, {
        ...form,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        documentDate: form.documentDate || null,
        expiryDate: form.expiryDate || null,
      });
      toast.success('Updated!');
      onSaved(r.data);
      onClose();
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Edit Document</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Document Name *</label>
            <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={form.category} onChange={e => set('category', e.target.value)}>
                {Object.entries(CATEGORIES).filter(([k]) => k !== 'all').map(([k, c]) => (
                  <option key={k} value={k}>{c.icon} {c.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tags</label>
              <input className="form-input" value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="comma separated" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-input" value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Document Date</label>
              <input type="date" className="form-input" value={form.documentDate} onChange={e => set('documentDate', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Expiry Date</label>
              <input type="date" className="form-input" value={form.expiryDate} onChange={e => set('expiryDate', e.target.value)} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 16 }}>
            <input type="checkbox" checked={form.isImportant} onChange={e => set('isImportant', e.target.checked)} />
            <span>⭐ Mark as important</span>
          </label>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Document Card ────────────────────────────────────────────────────────────
function DocCard({ doc, onDelete, onEdit, view }) {
  const [downloading, setDownloading] = useState(false);
  const cat = CATEGORIES[doc.category] || CATEGORIES.other;
  const isExpiring = doc.expiryDate && new Date(doc.expiryDate) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const isExpired = doc.expiryDate && new Date(doc.expiryDate) < new Date();

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await triggerDownload(doc._id, doc.originalName);
      toast.success(`Downloading ${doc.originalName}`);
    } finally {
      setTimeout(() => setDownloading(false), 1500);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${doc.name}"? This cannot be undone.`)) return;
    try {
      await deleteVaultDocument(doc._id);
      toast.success('Document deleted');
      onDelete(doc._id);
    } catch { toast.error('Delete failed'); }
  };

  if (view === 'list') {
    return (
      <div className={`doc-list-row ${doc.isImportant ? 'doc-important' : ''}`}>
        <div className="doc-list-icon" style={{ background: `${cat.color}14` }}>
          <span style={{ fontSize: 20 }}>{mimeIcon(doc.mimeType)}</span>
        </div>
        <div className="doc-list-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{doc.name}</span>
            {doc.isImportant && <span className="doc-badge doc-badge-star">⭐ Important</span>}
            {isExpired && <span className="doc-badge doc-badge-danger">Expired</span>}
            {!isExpired && isExpiring && <span className="doc-badge doc-badge-warn">Expiring Soon</span>}
            <span className="doc-badge" style={{ background: `${cat.color}14`, color: cat.color }}>{cat.icon} {cat.label}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <span>{mimeLabel(doc.mimeType)} · {fmtSize(doc.fileSize)}</span>
            <span>{doc.originalName}</span>
            {doc.documentDate && <span>Date: {fmtDate(doc.documentDate)}</span>}
            {doc.expiryDate && <span style={{ color: isExpired ? 'var(--red)' : isExpiring ? 'var(--amber)' : undefined }}>Expires: {fmtDate(doc.expiryDate)}</span>}
            {doc.linkedTo?.length > 0 && <span>🔗 {doc.linkedTo.length} link{doc.linkedTo.length !== 1 ? 's' : ''}</span>}
          </div>
          {doc.description && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{doc.description}</div>}
          {doc.tags?.length > 0 && (
            <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
              {doc.tags.map(t => <span key={t} className="doc-tag">#{t}</span>)}
            </div>
          )}
        </div>
        <div className="doc-list-actions">
          <button className="btn btn-primary btn-sm" onClick={handleDownload} disabled={downloading} title="Download">
            {downloading ? '⏳' : '⬇ Download'}
          </button>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => onEdit(doc)} title="Edit">✏️</button>
          <button className="btn btn-danger btn-sm btn-icon" onClick={handleDelete} title="Delete">×</button>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div className={`doc-card ${doc.isImportant ? 'doc-important' : ''}`} style={{ '--cat-color': cat.color }}>
      {/* Top accent */}
      <div className="doc-card-accent" style={{ background: `linear-gradient(90deg, ${cat.color}, ${cat.color}88)` }} />

      {/* Icon + badges */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: `${cat.color}12`, border: `1.5px solid ${cat.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>
          {mimeIcon(doc.mimeType)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
          {doc.isImportant && <span className="doc-badge doc-badge-star">⭐</span>}
          {isExpired && <span className="doc-badge doc-badge-danger">Expired</span>}
          {!isExpired && isExpiring && <span className="doc-badge doc-badge-warn">⚠️ Soon</span>}
        </div>
      </div>

      {/* Name */}
      <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 4, lineHeight: 1.3 }}>{doc.name}</div>

      {/* Category pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 100, background: `${cat.color}14`, color: cat.color }}>{cat.icon} {cat.label}</span>
        <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>{mimeLabel(doc.mimeType)}</span>
      </div>

      {/* Meta */}
      <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10 }}>
        <span>📎 {doc.originalName.length > 28 ? doc.originalName.slice(0, 25) + '...' : doc.originalName}</span>
        <span>💾 {fmtSize(doc.fileSize)}</span>
        {doc.documentDate && <span>📅 {fmtDate(doc.documentDate)}</span>}
        {doc.expiryDate && <span style={{ color: isExpired ? 'var(--red)' : isExpiring ? 'var(--amber)' : undefined }}>⏰ Expires {fmtDate(doc.expiryDate)}</span>}
        {doc.linkedTo?.length > 0 && <span style={{ color: 'var(--accent)' }}>🔗 Linked to {doc.linkedTo.length} item{doc.linkedTo.length !== 1 ? 's' : ''}</span>}
      </div>

      {/* Tags */}
      {doc.tags?.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
          {doc.tags.slice(0, 3).map(t => <span key={t} className="doc-tag">#{t}</span>)}
          {doc.tags.length > 3 && <span className="doc-tag">+{doc.tags.length - 3}</span>}
        </div>
      )}

      {/* Description */}
      {doc.description && (
        <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 10, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {doc.description}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <button
          className="btn btn-primary btn-sm"
          style={{ flex: 1, justifyContent: 'center', background: `linear-gradient(135deg, ${cat.color}, ${cat.color}cc)`, border: 'none' }}
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? '⏳' : '⬇ Download'}
        </button>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => onEdit(doc)} title="Edit metadata">✏️</button>
        <button className="btn btn-danger btn-sm btn-icon" onClick={handleDelete} title="Delete">×</button>
      </div>
    </div>
  );
}

// ─── Main Documents Page ──────────────────────────────────────────────────────
export default function Documents() {
  const [docs, setDocs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [view, setView] = useState('grid'); // 'grid' | 'list'
  const [showUpload, setShowUpload] = useState(false);
  const [editDoc, setEditDoc] = useState(null);
  const [sortBy, setSortBy] = useState('date'); // 'date' | 'name' | 'size'

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (activeCategory !== 'all') params.category = activeCategory;
      if (search) params.search = search;
      const [dRes, sRes] = await Promise.all([listDocuments(params), getDocumentStats()]);
      setDocs(dRes.data);
      setStats(sRes.data);
    } catch { toast.error('Failed to load documents'); }
    finally { setLoading(false); }
  }, [activeCategory, search]);

  useEffect(() => {
    const t = setTimeout(loadDocs, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadDocs, search]);

  const handleUploaded = () => { loadDocs(); };

  const handleDelete = (id) => { setDocs(prev => prev.filter(d => d._id !== id)); loadDocs(); };

  const handleSaved = (updated) => {
    setDocs(prev => prev.map(d => d._id === updated._id ? updated : d));
  };

  const sorted = [...docs].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'size') return b.fileSize - a.fileSize;
    return new Date(b.uploadedAt) - new Date(a.uploadedAt);
  });

  // Group docs by category for stats sidebar
  const catCounts = docs.reduce((acc, d) => {
    acc[d.category] = (acc[d.category] || 0) + 1;
    return acc;
  }, {});
  const importantCount = docs.filter(d => d.isImportant).length;
  const expiringCount = docs.filter(d => d.expiryDate && new Date(d.expiryDate) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)).length;

  return (
    <div className="page fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">Document Vault</h1>
          <div className="page-sub">Store, organise and access all your important documents</div>
        </div>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => setShowUpload(true)}
          style={{ background: 'linear-gradient(135deg, #3b56f5, #7c3aed)', border: 'none' }}
        >
          📤 Upload Documents
        </button>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="doc-stats-row">
          <div className="doc-stat-pill">
            <span style={{ fontSize: 18 }}>📁</span>
            <div>
              <div style={{ fontFamily: 'DM Mono', fontWeight: 700, fontSize: 20, color: 'var(--text)' }}>{stats.totalDocuments}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Documents</div>
            </div>
          </div>
          <div className="doc-stat-pill">
            <span style={{ fontSize: 18 }}>💾</span>
            <div>
              <div style={{ fontFamily: 'DM Mono', fontWeight: 700, fontSize: 20, color: 'var(--text)' }}>{fmtSize(stats.totalSize)}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Total Size</div>
            </div>
          </div>
          {importantCount > 0 && (
            <div className="doc-stat-pill" style={{ background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.2)' }}>
              <span style={{ fontSize: 18 }}>⭐</span>
              <div>
                <div style={{ fontFamily: 'DM Mono', fontWeight: 700, fontSize: 20, color: '#d97706' }}>{importantCount}</div>
                <div style={{ fontSize: 10, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Important</div>
              </div>
            </div>
          )}
          {expiringCount > 0 && (
            <div className="doc-stat-pill" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)' }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div>
                <div style={{ fontFamily: 'DM Mono', fontWeight: 700, fontSize: 20, color: 'var(--red)' }}>{expiringCount}</div>
                <div style={{ fontSize: 10, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Expiring</div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="doc-layout">
        {/* Left sidebar: category filter */}
        <div className="doc-sidebar">
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text3)', padding: '4px 10px 10px', marginBottom: 4 }}>
            Categories
          </div>
          {Object.entries(CATEGORIES).map(([key, cat]) => {
            const count = key === 'all' ? docs.length : (catCounts[key] || 0);
            const isActive = activeCategory === key;
            return (
              <button key={key} onClick={() => setActiveCategory(key)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                  padding: '9px 10px', borderRadius: 9, border: '1.5px solid transparent',
                  background: isActive ? `${cat.color}12` : 'transparent',
                  borderColor: isActive ? `${cat.color}30` : 'transparent',
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', marginBottom: 2,
                }}
              >
                <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{cat.icon}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? cat.color : 'var(--text2)' }}>{cat.label}</span>
                {count > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 100, background: isActive ? cat.color : 'var(--bg2)', color: isActive ? '#fff' : 'var(--text3)' }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Search + view toggle bar */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text3)' }}>🔍</span>
              <input
                className="form-input"
                style={{ paddingLeft: 36 }}
                placeholder="Search by name, description, tag..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select className="form-select" style={{ width: 140 }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="date">Latest first</option>
              <option value="name">Name A–Z</option>
              <option value="size">Largest first</option>
            </select>
            <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 4 }}>
              {[['grid', '⊞'], ['list', '☰']].map(([v, icon]) => (
                <button key={v} onClick={() => setView(v)}
                  style={{ padding: '5px 10px', borderRadius: 7, border: 'none', background: view === v ? 'var(--accent)' : 'transparent', color: view === v ? '#fff' : 'var(--text3)', cursor: 'pointer', fontSize: 15, transition: 'all 0.15s' }}>
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="loading-screen"><div className="spinner" /></div>
          ) : sorted.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📂</div>
              <div className="empty-title">{search || activeCategory !== 'all' ? 'No matching documents' : 'No Documents Yet'}</div>
              <div className="empty-desc">
                {search ? `No results for "${search}"` : activeCategory !== 'all' ? `No ${CATEGORIES[activeCategory]?.label} documents uploaded yet.` : 'Upload PDFs, images, contracts, receipts and any document you want to keep safe and accessible.'}
              </div>
              {!search && <button className="btn btn-primary" onClick={() => setShowUpload(true)}>📤 Upload First Document</button>}
            </div>
          ) : view === 'grid' ? (
            <div className="doc-grid">
              {sorted.map(doc => (
                <DocCard key={doc._id} doc={doc} view="grid" onDelete={handleDelete} onEdit={setEditDoc} />
              ))}
            </div>
          ) : (
            <div className="doc-list">
              {sorted.map(doc => (
                <DocCard key={doc._id} doc={doc} view="list" onDelete={handleDelete} onEdit={setEditDoc} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onUploaded={handleUploaded} />}
      {editDoc && <EditDocModal doc={editDoc} onClose={() => setEditDoc(null)} onSaved={handleSaved} />}
    </div>
  );
}
