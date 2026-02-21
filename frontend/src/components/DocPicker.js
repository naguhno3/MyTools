import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { listDocuments, getDocumentDownloadUrl } from '../utils/api';
import { fmtDate } from '../utils/helpers';

// ─── Config ───────────────────────────────────────────────────────────────────
const CATEGORIES = {
  all:        { label: 'All',        icon: '📂' },
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

function mimeIcon(mimeType) {
  if (!mimeType) return '📄';
  if (mimeType === 'application/pdf') return '📕';
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.includes('word')) return '📝';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
  return '📄';
}

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── DocPicker Modal ─────────────────────────────────────────────────────────
// Props:
//   onSelect(doc)  — called with the vault document object when user picks one
//   onClose()
//   defaultCategory — pre-filter to a category (optional)
//   title — modal title (optional)
export function DocPicker({ onSelect, onClose, defaultCategory = 'all', title = 'Pick a Document from Vault' }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(defaultCategory);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (category !== 'all') params.category = category;
      if (search) params.search = search;
      const r = await listDocuments(params);
      setDocs(r.data);
    } catch { toast.error('Failed to load vault'); }
    finally { setLoading(false); }
  }, [category, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal-lg"
        style={{ maxWidth: 640, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div>
            <div className="modal-title">📂 {title}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              Select a document from your vault to link
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* Search + filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexShrink: 0 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text3)' }}>🔍</span>
            <input
              className="form-input"
              style={{ paddingLeft: 32 }}
              placeholder="Search documents..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <select className="form-select" style={{ width: 150 }} value={category} onChange={e => setCategory(e.target.value)}>
            {Object.entries(CATEGORIES).map(([k, c]) => (
              <option key={k} value={k}>{c.icon} {c.label}</option>
            ))}
          </select>
        </div>

        {/* Doc list */}
        <div style={{ flex: 1, overflowY: 'auto', marginRight: -8, paddingRight: 8 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div className="spinner" />
            </div>
          ) : docs.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <div className="empty-icon">📂</div>
              <div className="empty-title">{search ? 'No matching documents' : 'No documents in vault'}</div>
              <div className="empty-desc">Upload documents via the Document Vault page first.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {docs.map(doc => {
                const cat = CATEGORIES[doc.category] || CATEGORIES.other;
                return (
                  <button
                    key={doc._id}
                    onClick={() => onSelect(doc)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 11,
                      border: '1.5px solid var(--border)',
                      background: 'var(--surface)', cursor: 'pointer',
                      textAlign: 'left', transition: 'all 0.15s', width: '100%',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-light)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)'; }}
                  >
                    {/* File icon */}
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${cat.color || '#6b7280'}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                      {mimeIcon(doc.mimeType)}
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{doc.name}</span>
                        {doc.isImportant && <span style={{ fontSize: 9, background: 'rgba(217,119,6,0.14)', color: '#d97706', padding: '1px 5px', borderRadius: 4, fontWeight: 800 }}>⭐</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ color: cat.color || 'var(--text3)', fontWeight: 700 }}>{cat.icon} {cat.label}</span>
                        <span>{doc.originalName.length > 30 ? doc.originalName.slice(0, 28) + '…' : doc.originalName}</span>
                        <span>{fmtSize(doc.fileSize)}</span>
                        {doc.documentDate && <span>📅 {fmtDate(doc.documentDate)}</span>}
                      </div>
                      {doc.description && <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{doc.description}</div>}
                    </div>
                    {/* Select arrow */}
                    <span style={{ fontSize: 18, color: 'var(--accent)', flexShrink: 0 }}>→</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ flexShrink: 0, paddingTop: 14 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── DocLink ─────────────────────────────────────────────────────────────────
// Displays a linked vault document as a downloadable chip/row.
// Props:
//   docId — vault document _id
//   docName — display name (cached, so we don't re-fetch)
//   originalName — filename for download
//   mimeType
//   onUnlink() — optional callback to remove the link
//   size — 'sm' | 'md' (default 'md')
export function DocLink({ docId, docName, originalName, mimeType, onUnlink, size = 'md' }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (e) => {
    e.stopPropagation();
    setDownloading(true);
    try {
      const url = getDocumentDownloadUrl(docId);
      const a = document.createElement('a');
      a.href = url;
      a.download = originalName || docName || 'document';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`Downloading ${originalName || docName}`);
    } catch { toast.error('Download failed'); }
    finally { setTimeout(() => setDownloading(false), 1500); }
  };

  if (size === 'sm') {
    return (
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 10px 3px 8px', borderRadius: 100,
          background: 'rgba(59,86,245,0.08)', border: '1px solid rgba(59,86,245,0.2)',
          cursor: 'pointer', transition: 'all 0.15s',
          fontSize: 11, fontWeight: 600, color: 'var(--accent)',
          userSelect: 'none',
        }}
        onClick={handleDownload}
        title={`Download ${originalName || docName}`}
      >
        <span style={{ fontSize: 13 }}>{mimeIcon(mimeType)}</span>
        {downloading ? 'Downloading…' : (docName || originalName || 'Document')}
        {!downloading && <span style={{ fontSize: 10, opacity: 0.7 }}>⬇</span>}
        {onUnlink && (
          <span
            style={{ marginLeft: 3, fontSize: 12, opacity: 0.5, cursor: 'pointer' }}
            onClick={e => { e.stopPropagation(); onUnlink(); }}
            title="Unlink document"
          >×</span>
        )}
      </span>
    );
  }

  // md (default) — card-style row
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 10,
        border: '1.5px solid rgba(59,86,245,0.2)',
        background: 'rgba(59,86,245,0.04)',
        transition: 'all 0.15s',
      }}
    >
      <span style={{ fontSize: 22, flexShrink: 0 }}>{mimeIcon(mimeType)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{docName || originalName}</div>
        {originalName && docName !== originalName && (
          <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{originalName}</div>
        )}
      </div>
      <button
        className="btn btn-primary btn-sm"
        style={{ flexShrink: 0, background: 'linear-gradient(135deg,#3b56f5,#7c3aed)', border: 'none', padding: '5px 12px' }}
        onClick={handleDownload}
        disabled={downloading}
        title={`Download ${originalName || docName}`}
      >
        {downloading ? '⏳' : '⬇ Download'}
      </button>
      {onUnlink && (
        <button
          className="btn btn-ghost btn-sm btn-icon"
          style={{ flexShrink: 0 }}
          onClick={onUnlink}
          title="Unlink document"
        >×</button>
      )}
    </div>
  );
}
