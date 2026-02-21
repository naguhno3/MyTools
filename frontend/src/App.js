import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Transactions from './pages/Transactions';
import Budget from './pages/Budget';
import Transfer from './pages/Transfer';
import Retirement from './pages/Retirement';
import RetirementDashboard from './pages/RetirementDashboard';
import Investments from './pages/Investments';
import Properties from './pages/Properties';
import Loans from './pages/Loans';
import { getExportData } from './utils/api';
import { exportToExcel } from './utils/excelExport';
import './App.css';

const NAV_MAIN = [
  { to: '/',             icon: '⬡',  label: 'Dashboard',   end: true },
  { to: '/accounts',     icon: '🏦', label: 'Accounts' },
  { to: '/transactions', icon: '↕',  label: 'Transactions' },
  { to: '/budget',       icon: '◎',  label: 'Budget' },
  { to: '/transfer',     icon: '⇄',  label: 'Transfer' },
];

const NAV_ASSETS = [
  { to: '/investments', icon: '📈', label: 'Investments' },
  { to: '/properties',  icon: '🏘️', label: 'Properties' },
];

const NAV_LIABILITIES = [
  { to: '/loans', icon: '💳', label: 'Loans & EMI' },
];

const NAV_RETIREMENT = [
  { to: '/retirement/dashboard', icon: '📊', label: 'Portfolio Overview' },
  { to: '/retirement',           icon: '🏛', label: 'PF / PPF / NPS', end: true },
];

function Sidebar() {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    const toastId = toast.loading('Preparing Excel export...');
    try {
      const res = await getExportData();
      const filename = exportToExcel(res.data);
      toast.success(`Downloaded: ${filename}`, { id: toastId, duration: 4000 });
    } catch (err) {
      toast.error('Export failed. Make sure backend is running.', { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">💸</div>
        <div>
          <div className="brand-name">NaguHNO3</div>
          <div className="brand-sub">My Tools</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-label">Main</div>
        {NAV_MAIN.map(n => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">{n.icon}</span>
            {n.label}
            <span className="nav-dot" />
          </NavLink>
        ))}

        <div className="nav-label">Assets</div>
        {NAV_ASSETS.map(n => (
          <NavLink key={n.to} to={n.to}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">{n.icon}</span>
            {n.label}
            <span className="nav-dot" />
          </NavLink>
        ))}

        <div className="nav-label">Liabilities</div>
        {NAV_LIABILITIES.map(n => (
          <NavLink key={n.to} to={n.to}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">{n.icon}</span>
            {n.label}
            <span className="nav-dot" />
          </NavLink>
        ))}

        <div className="nav-label">Retirement</div>
        {NAV_RETIREMENT.map(n => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">{n.icon}</span>
            {n.label}
            <span className="nav-dot" />
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer" style={{ padding: '14px 12px' }}>
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px', borderRadius: 10,
            border: '1.5px solid rgba(255,255,255,0.12)',
            background: exporting ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.07)',
            color: 'rgba(255,255,255,0.7)', fontSize: 12.5, fontWeight: 600,
            cursor: exporting ? 'not-allowed' : 'pointer',
            fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { if (!exporting) e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = exporting ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.07)'; }}
        >
          <span style={{ fontSize: 16 }}>{exporting ? '⏳' : '⬇'}</span>
          {exporting ? 'Exporting...' : 'Export to Excel'}
        </button>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 8, textAlign: 'center' }}>MyTools v1.3</div>
      </div>
    </aside>
  );
}

export default function App() {
  return (
    <Router>
      <div className="app-shell">
        <Sidebar />
        <main className="main">
          <Routes>
            <Route path="/"                      element={<Dashboard />} />
            <Route path="/accounts"              element={<Accounts />} />
            <Route path="/transactions"          element={<Transactions />} />
            <Route path="/budget"                element={<Budget />} />
            <Route path="/transfer"              element={<Transfer />} />
            <Route path="/investments"           element={<Investments />} />
            <Route path="/properties"            element={<Properties />} />
            <Route path="/loans"                 element={<Loans />} />
            <Route path="/retirement"            element={<Retirement />} />
            <Route path="/retirement/dashboard"  element={<RetirementDashboard />} />
          </Routes>
        </main>
      </div>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            fontFamily: 'DM Sans, sans-serif', fontSize: 13,
            borderRadius: 10, border: '1px solid #e4e8f4',
            boxShadow: '0 8px 24px rgba(15,22,41,0.12)',
          },
          success: { iconTheme: { primary: '#059669', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
          loading: { iconTheme: { primary: '#4f46e5', secondary: '#fff' } },
        }}
      />
    </Router>
  );
}
