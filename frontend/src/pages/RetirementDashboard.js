import React, { useEffect, useState, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis
} from 'recharts';
import { getRetirementPortfolioTrend } from '../utils/api';
import { fmt, monthName, ACCOUNT_TYPES, RETIREMENT_INFO } from '../utils/helpers';
import { Link } from 'react-router-dom';
import './RetirementDashboard.css';

/* ─── Custom Tooltip ──────────────────────────────────────── */
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e4e8f4', borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 16px rgba(15,22,41,0.12)', minWidth: 160 }}>
      <div style={{ color: '#9aa3be', marginBottom: 6, fontWeight: 700 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, fontWeight: 600, marginBottom: 2 }}>
          {p.name}: <span style={{ fontFamily: 'DM Mono' }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

/* ─── Projection calculator ────────────────────────────────── */
function calcProjection(corpus, monthlyContrib, annualRatePercent, years) {
  const monthlyRate = annualRatePercent / 12 / 100;
  const months = years * 12;
  const points = [];
  let bal = corpus;
  for (let m = 0; m <= months; m += 12) {
    points.push({ year: `Year ${m / 12}`, corpus: Math.round(bal) });
    for (let i = 0; i < 12; i++) {
      bal = bal * (1 + monthlyRate) + monthlyContrib;
    }
  }
  return points;
}

/* ─── Account type donut config ─────────────────────────────  */
const TYPE_CONFIG = {
  pf:  { label: 'PF',  icon: '🏛', color: '#4f46e5', lightColor: 'rgba(79,70,229,0.12)' },
  ppf: { label: 'PPF', icon: '🏅', color: '#0891b2', lightColor: 'rgba(8,145,178,0.12)' },
  nps: { label: 'NPS', icon: '🎯', color: '#7c3aed', lightColor: 'rgba(124,58,237,0.12)' },
};

/* ─── Main Component ──────────────────────────────────────── */
export default function RetirementDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [projMonthly, setProjMonthly] = useState(5000);
  const [projRate, setProjRate] = useState(8.25);
  const [projYears, setProjYears] = useState(20);
  const [activeTab, setActiveTab] = useState('overview');

  const load = useCallback(() => {
    setLoading(true);
    getRetirementPortfolioTrend()
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="page">
      <div className="loading-screen"><div className="spinner" /><span>Loading retirement portfolio...</span></div>
    </div>
  );

  if (!data || data.accounts.length === 0) return (
    <div className="page fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 className="page-title">Retirement Dashboard</h1>
        <div className="page-sub">Portfolio trends, projections & insights</div>
      </div>
      <div className="empty-state">
        <div className="empty-icon" style={{ fontSize: 52, letterSpacing: -4 }}>🏛🏅🎯</div>
        <div className="empty-title">No retirement accounts yet</div>
        <div className="empty-desc">Add PF, PPF or NPS accounts to see portfolio analytics, corpus trends, and retirement projections.</div>
        <Link to="/retirement" className="btn btn-primary btn-lg">+ Add Retirement Account</Link>
      </div>
    </div>
  );

  const { summary, trend, byAccountType, pfBreakdown, accounts } = data;
  const totalGrowth = summary.totalCorpus - summary.totalInitial;
  const growthPct = summary.totalInitial > 0 ? ((totalGrowth / summary.totalInitial) * 100).toFixed(1) : 0;

  // Chart: monthly bar data (last 18 months)
  const chartTrend = trend.slice(-18).map(t => ({
    name: `${monthName(t.month)} '${String(t.year).slice(2)}`,
    Contribution: t.contribution,
    Interest: t.interest,
    Income: t.income,
  }));

  // Chart: corpus area chart (running total)
  const corpusData = trend.map(t => ({
    name: `${monthName(t.month)} '${String(t.year).slice(2)}`,
    Corpus: t.corpus,
  }));

  // Pie: allocation by type
  const pieData = [
    { name: 'PF', value: summary.pf, color: '#4f46e5' },
    { name: 'PPF', value: summary.ppf, color: '#0891b2' },
    { name: 'NPS', value: summary.nps, color: '#7c3aed' },
  ].filter(p => p.value > 0);

  // Projection data
  const projData = calcProjection(summary.totalCorpus, +projMonthly, +projRate, +projYears);
  const projectedCorpus = projData[projData.length - 1]?.corpus || 0;

  // Per-type breakdown for table
  const typeBreakdown = ['pf', 'ppf', 'nps'].map(t => ({
    type: t,
    config: TYPE_CONFIG[t],
    corpus: summary[t] || 0,
    accounts: accounts.filter(a => a.type === t),
    contributions: byAccountType[t]?.contributions || 0,
    interest: byAccountType[t]?.interest || 0,
    income: byAccountType[t]?.income || 0,
  })).filter(t => t.corpus > 0 || t.accounts.length > 0);

  // Month-by-month contribution frequency stats
  const monthlyStats = trend.length > 0 ? {
    avgContrib: Math.round(trend.reduce((s, t) => s + t.contribution, 0) / trend.length),
    avgInterest: Math.round(trend.reduce((s, t) => s + t.interest, 0) / trend.length),
    totalContrib: trend.reduce((s, t) => s + t.contribution, 0),
    totalInterest: trend.reduce((s, t) => s + t.interest, 0),
  } : { avgContrib: 0, avgInterest: 0, totalContrib: 0, totalInterest: 0 };

  return (
    <div className="page fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Retirement</div>
          <h1 className="page-title">Portfolio Dashboard</h1>
          <div className="page-sub">Trends, allocation & growth projections across all accounts</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/retirement" className="btn btn-ghost">Manage Accounts →</Link>
        </div>
      </div>

      {/* ── Hero corpus banner ── */}
      <div className="rd-hero">
        <div className="rd-hero-bg" />
        <div className="rd-hero-content">
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
              Total Retirement Corpus
            </div>
            <div style={{ fontFamily: 'DM Mono', fontSize: 44, fontWeight: 500, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1 }}>
              {fmt(summary.totalCorpus)}
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
                Opening: <strong style={{ color: '#fff' }}>{fmt(summary.totalInitial)}</strong>
              </span>
              <span style={{ fontSize: 13, color: totalGrowth >= 0 ? '#6ee7b7' : '#fca5a5', fontWeight: 700 }}>
                {totalGrowth >= 0 ? '▲' : '▼'} {fmt(Math.abs(totalGrowth))} ({growthPct}%)
              </span>
            </div>

            <div style={{ display: 'flex', gap: 14, marginTop: 20, flexWrap: 'wrap' }}>
              {typeBreakdown.map(td => (
                <div key={td.type} style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 2 }}>{td.config.label}</div>
                  <div style={{ fontFamily: 'DM Mono', fontSize: 16, fontWeight: 600, color: '#fff' }}>{fmt(td.corpus)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Pie chart in hero */}
          {pieData.length > 0 && (
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <PieChart width={160} height={160}>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={4} dataKey="value">
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="rgba(255,255,255,0.15)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e4e8f4' }} />
              </PieChart>
              <div style={{ display: 'flex', gap: 10 }}>
                {pieData.map(p => (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="tabs">
        {[['overview', 'Overview'], ['trends', 'Corpus Trend'], ['breakdown', 'Breakdown'], ['projection', 'Projection']].map(([id, label]) => (
          <button key={id} className={`tab ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>{label}</button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="rd-tab-content fade-in">
          {/* Quick stats row */}
          <div className="rd-stats-grid">
            {[
              { label: 'Total Contributions', val: monthlyStats.totalContrib, color: '#4f46e5', icon: '🏛' },
              { label: 'Total Interest Earned', val: monthlyStats.totalInterest, color: '#0891b2', icon: '📈' },
              { label: 'Avg Monthly Contribution', val: monthlyStats.avgContrib, color: '#7c3aed', icon: '📅' },
              { label: 'Interest % of Corpus', val: null, display: `${summary.totalCorpus > 0 ? ((monthlyStats.totalInterest / summary.totalCorpus) * 100).toFixed(1) : 0}%`, color: '#059669', icon: '💹' },
            ].map(s => (
              <div key={s.label} className="rd-stat-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div className="stat-label">{s.label}</div>
                  <span style={{ fontSize: 22 }}>{s.icon}</span>
                </div>
                <div style={{ fontFamily: 'DM Mono', fontSize: 22, fontWeight: 500, color: s.color }}>
                  {s.display || fmt(s.val)}
                </div>
              </div>
            ))}
          </div>

          {/* Combined monthly bar chart */}
          <div className="card" style={{ marginTop: 20, padding: '22px 24px' }}>
            <div style={{ marginBottom: 16 }}>
              <div className="section-title" style={{ marginBottom: 2 }}>Monthly Activity — Contributions & Interest</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Last {Math.min(chartTrend.length, 18)} months across all retirement accounts</div>
            </div>
            {chartTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartTrend} margin={{ left: -10 }}>
                  <CartesianGrid stroke="#f0f2fa" strokeDasharray="0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9aa3be' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9aa3be' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                  <Tooltip content={<ChartTip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontFamily: 'DM Sans' }} />
                  <Bar dataKey="Contribution" fill="#4f46e5" radius={[4,4,0,0]} maxBarSize={32} />
                  <Bar dataKey="Interest" fill="#0891b2" radius={[4,4,0,0]} maxBarSize={32} />
                  {chartTrend.some(d => d.Income > 0) && <Bar dataKey="Income" fill="#059669" radius={[4,4,0,0]} maxBarSize={32} />}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)', fontSize: 13 }}>No transaction data yet. Add contributions and interest entries to see the chart.</div>
            )}
          </div>

          {/* Account cards */}
          <div style={{ marginTop: 20 }}>
            <div className="section-title" style={{ marginBottom: 14 }}>Individual Accounts ({accounts.length})</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {accounts.map(acc => {
                const cfg = TYPE_CONFIG[acc.type] || TYPE_CONFIG.pf;
                const info = RETIREMENT_INFO[acc.type] || {};
                const growth = acc.balance - acc.initialBalance;
                const growPct = acc.initialBalance > 0 ? ((growth / acc.initialBalance) * 100).toFixed(1) : 0;
                return (
                  <div key={acc._id} className="rd-account-card" style={{ '--acc-color': cfg.color }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: cfg.color, borderRadius: '14px 14px 0 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <div style={{ width: 42, height: 42, borderRadius: 12, background: cfg.lightColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                          {cfg.icon}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{acc.name}</div>
                          <div style={{ fontSize: 11, color: cfg.color, fontWeight: 700 }}>{cfg.label} · {info.fullName}</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Current Corpus</div>
                      <div style={{ fontFamily: 'DM Mono', fontSize: 24, fontWeight: 500, color: cfg.color }}>{fmt(acc.balance)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                      <span style={{ color: 'var(--text3)' }}>Opening: <strong style={{ color: 'var(--text)' }}>{fmt(acc.initialBalance)}</strong></span>
                      <span style={{ color: growth >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                        {growth >= 0 ? '▲' : '▼'} {growPct}%
                      </span>
                    </div>
                    {acc.interestRate && (
                      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)' }}>
                        Rate: <strong style={{ color: cfg.color }}>{acc.interestRate}% p.a.</strong>
                      </div>
                    )}
                    {acc.bankName && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{acc.bankName}{acc.accountNumber ? ` · #${acc.accountNumber}` : ''}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── CORPUS TREND TAB ── */}
      {activeTab === 'trends' && (
        <div className="rd-tab-content fade-in">
          {/* Running corpus area chart */}
          <div className="card" style={{ padding: '22px 24px', marginBottom: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <div className="section-title" style={{ marginBottom: 2 }}>Corpus Growth Over Time</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Cumulative portfolio value tracking all contributions + interest</div>
            </div>
            {corpusData.length > 1 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={corpusData} margin={{ left: -10 }}>
                  <defs>
                    <linearGradient id="corpusGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#f0f2fa" strokeDasharray="0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9aa3be' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: '#9aa3be' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 100000 ? `${(v/100000).toFixed(1)}L` : `${(v/1000).toFixed(0)}K`} />
                  <Tooltip content={<ChartTip />} />
                  <Area type="monotone" dataKey="Corpus" stroke="#4f46e5" strokeWidth={2.5} fill="url(#corpusGrad)" dot={false} activeDot={{ r: 5, fill: '#4f46e5' }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)', fontSize: 13 }}>
                Add multiple entries across months to see the corpus growth trend.
              </div>
            )}
          </div>

          {/* Contribution vs Interest area comparison */}
          {chartTrend.length > 0 && (
            <div className="card" style={{ padding: '22px 24px', marginBottom: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <div className="section-title" style={{ marginBottom: 2 }}>Contributions vs Interest — Monthly Flow</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>See how interest credits compare to your contributions over time</div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartTrend} margin={{ left: -10 }}>
                  <CartesianGrid stroke="#f0f2fa" strokeDasharray="0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9aa3be' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9aa3be' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                  <Tooltip content={<ChartTip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="Contribution" stroke="#4f46e5" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Interest" stroke="#0891b2" strokeWidth={2} dot={false} activeDot={{ r: 4 }} strokeDasharray="6 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* PF employee vs employer breakdown */}
          {(pfBreakdown.employee > 0 || pfBreakdown.employer > 0) && (
            <div className="card" style={{ padding: '22px 24px' }}>
              <div className="section-title" style={{ marginBottom: 16 }}>PF Contribution Breakdown — Employee vs Employer</div>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <PieChart width={160} height={160}>
                  <Pie data={[
                    { name: 'Your Share', value: pfBreakdown.employee, color: '#4f46e5' },
                    { name: "Employer's Share", value: pfBreakdown.employer, color: '#818cf8' },
                  ]} cx="50%" cy="50%" innerRadius={44} outerRadius={68} paddingAngle={4} dataKey="value">
                    <Cell fill="#4f46e5" />
                    <Cell fill="#818cf8" />
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
                <div style={{ flex: 1 }}>
                  {[
                    { label: 'Your Contribution', val: pfBreakdown.employee, color: '#4f46e5', pct: pfBreakdown.employee + pfBreakdown.employer > 0 ? ((pfBreakdown.employee / (pfBreakdown.employee + pfBreakdown.employer)) * 100).toFixed(0) : 0 },
                    { label: "Employer's Contribution", val: pfBreakdown.employer, color: '#818cf8', pct: pfBreakdown.employee + pfBreakdown.employer > 0 ? ((pfBreakdown.employer / (pfBreakdown.employee + pfBreakdown.employer)) * 100).toFixed(0) : 0 },
                  ].map(item => (
                    <div key={item.label} style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{item.label}</span>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <span style={{ fontFamily: 'DM Mono', fontSize: 14, color: item.color }}>{fmt(item.val)}</span>
                          <span style={{ fontSize: 12, color: 'var(--text3)' }}>{item.pct}%</span>
                        </div>
                      </div>
                      <div className="progress-bar" style={{ height: 8 }}>
                        <div className="progress-fill" style={{ width: `${item.pct}%`, background: item.color }} />
                      </div>
                    </div>
                  ))}
                  <div style={{ padding: '12px 14px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)', marginTop: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Total PF Contributions</span>
                      <span style={{ fontFamily: 'DM Mono', fontSize: 14, fontWeight: 600, color: '#4f46e5' }}>{fmt(pfBreakdown.employee + pfBreakdown.employer)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── BREAKDOWN TAB ── */}
      {activeTab === 'breakdown' && (
        <div className="rd-tab-content fade-in">
          {/* Allocation donut */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div className="card" style={{ padding: '22px 24px' }}>
              <div className="section-title" style={{ marginBottom: 16 }}>Corpus Allocation</div>
              {pieData.length > 0 ? (
                <>
                  <PieChart width="100%" height={200} style={{ margin: '0 auto' }}>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={5} dataKey="value">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [fmt(v), '']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  </PieChart>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                    {pieData.map(p => (
                      <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.name}</span>
                          <div style={{ display: 'flex', gap: 10 }}>
                            <span style={{ fontFamily: 'DM Mono', fontSize: 13, color: 'var(--text)' }}>{fmt(p.value)}</span>
                            <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                              {summary.totalCorpus > 0 ? ((p.value / summary.totalCorpus) * 100).toFixed(0) : 0}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text3)' }}>No data</div>}
            </div>

            {/* Contribution vs Interest breakdown */}
            <div className="card" style={{ padding: '22px 24px' }}>
              <div className="section-title" style={{ marginBottom: 16 }}>Corpus Composition</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { label: 'Opening Balance', val: summary.totalInitial, color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
                  { label: 'Total Contributions', val: monthlyStats.totalContrib, color: '#4f46e5', bg: 'rgba(79,70,229,0.1)' },
                  { label: 'Interest Earned', val: monthlyStats.totalInterest, color: '#0891b2', bg: 'rgba(8,145,178,0.1)' },
                  { label: 'Other Income', val: typeBreakdown.reduce((s, t) => s + t.income, 0), color: '#059669', bg: 'rgba(5,150,105,0.1)' },
                ].map(item => {
                  const pct = summary.totalCorpus > 0 ? Math.max((item.val / summary.totalCorpus) * 100, 0) : 0;
                  return (
                    <div key={item.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>{item.label}</span>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <span style={{ fontFamily: 'DM Mono', fontSize: 13, color: item.color, fontWeight: 600 }}>{fmt(item.val)}</span>
                          <span style={{ fontSize: 11, color: 'var(--text3)', width: 32, textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="progress-bar" style={{ height: 7 }}>
                        <div className="progress-fill" style={{ width: `${pct}%`, background: item.color }} />
                      </div>
                    </div>
                  );
                })}
                <div style={{ padding: '12px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Total Corpus</span>
                    <span style={{ fontFamily: 'DM Mono', fontSize: 16, fontWeight: 600, color: 'var(--accent)' }}>{fmt(summary.totalCorpus)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Per-type breakdown table */}
          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
              <div className="section-title" style={{ marginBottom: 0 }}>Breakdown by Account Type</div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Type</th><th>Accounts</th><th>Corpus</th><th>Contributions</th><th>Interest</th><th>Other Income</th><th>Growth</th></tr>
                </thead>
                <tbody>
                  {typeBreakdown.map(td => {
                    const totalIn = td.contributions + td.interest + td.income;
                    const growthFromZero = td.corpus - (accounts.filter(a => a.type === td.type).reduce((s, a) => s + a.initialBalance, 0));
                    return (
                      <tr key={td.type}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: td.config.lightColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{td.config.icon}</div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13, color: td.config.color }}>{td.config.label}</div>
                              <div style={{ fontSize: 10, color: 'var(--text3)' }}>{RETIREMENT_INFO[td.type]?.fullName}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: 13 }}>{td.accounts.length}</td>
                        <td style={{ fontFamily: 'DM Mono', fontSize: 14, fontWeight: 600, color: td.config.color }}>{fmt(td.corpus)}</td>
                        <td style={{ fontFamily: 'DM Mono', fontSize: 13, color: '#4f46e5' }}>{fmt(td.contributions)}</td>
                        <td style={{ fontFamily: 'DM Mono', fontSize: 13, color: '#0891b2' }}>{fmt(td.interest)}</td>
                        <td style={{ fontFamily: 'DM Mono', fontSize: 13, color: '#059669' }}>{fmt(td.income)}</td>
                        <td style={{ fontFamily: 'DM Mono', fontSize: 13, color: growthFromZero >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                          {growthFromZero >= 0 ? '+' : ''}{fmt(growthFromZero)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── PROJECTION TAB ── */}
      {activeTab === 'projection' && (
        <div className="rd-tab-content fade-in">
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
            {/* Controls */}
            <div className="card rd-proj-controls">
              <div className="section-title" style={{ marginBottom: 18 }}>Projection Settings</div>

              <div className="form-group">
                <label className="form-label">Current Corpus</label>
                <div style={{ fontFamily: 'DM Mono', fontSize: 20, fontWeight: 600, color: 'var(--accent)', padding: '10px 0' }}>{fmt(summary.totalCorpus)}</div>
              </div>

              <div className="form-group">
                <label className="form-label">Additional Monthly Contribution (₹)</label>
                <input type="number" className="form-input" value={projMonthly} onChange={e => setProjMonthly(e.target.value)} min="0" step="500" />
                <div className="form-hint">Extra monthly investment beyond current contributions</div>
              </div>

              <div className="form-group">
                <label className="form-label">Expected Annual Return (%)</label>
                <input type="number" className="form-input" value={projRate} onChange={e => setProjRate(e.target.value)} min="1" max="30" step="0.25" />
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {[7.1, 8.25, 10, 12].map(r => (
                    <button key={r} className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '4px 10px', background: +projRate === r ? 'var(--accent-light)' : '', color: +projRate === r ? 'var(--accent)' : '', border: +projRate === r ? '1.5px solid var(--accent)' : '' }}
                      onClick={() => setProjRate(r)}>{r}%</button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Projection Horizon (Years)</label>
                <input type="range" min="5" max="40" step="5" value={projYears} onChange={e => setProjYears(+e.target.value)} style={{ width: '100%', accentColor: 'var(--accent)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  <span>5 yrs</span><strong style={{ color: 'var(--accent)' }}>{projYears} yrs</strong><span>40 yrs</span>
                </div>
              </div>

              {/* Result highlight */}
              <div style={{ marginTop: 8, padding: '18px', background: 'linear-gradient(135deg, #1a2560, #2d3f99)', borderRadius: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 6 }}>PROJECTED IN {projYears} YEARS</div>
                <div style={{ fontFamily: 'DM Mono', fontSize: 28, fontWeight: 500, color: '#fff', letterSpacing: '-0.02em' }}>{fmt(projectedCorpus)}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
                  +{fmt(projectedCorpus - summary.totalCorpus)} growth
                </div>
              </div>

              <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text3)', lineHeight: 1.5, padding: '10px', background: 'var(--surface2)', borderRadius: 8 }}>
                ⚠️ Projection assumes constant monthly contribution and annual return. Actual results may vary.
              </div>
            </div>

            {/* Projection chart */}
            <div className="card" style={{ padding: '22px 24px' }}>
              <div style={{ marginBottom: 16 }}>
                <div className="section-title" style={{ marginBottom: 2 }}>Corpus Projection — Next {projYears} Years</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  Starting at {fmt(summary.totalCorpus)} · +{fmt(+projMonthly)}/month · {projRate}% p.a.
                </div>
              </div>
              <ResponsiveContainer width="100%" height={360}>
                <AreaChart data={projData} margin={{ left: -10 }}>
                  <defs>
                    <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#f0f2fa" strokeDasharray="0" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#9aa3be' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9aa3be' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 10000000 ? `${(v/10000000).toFixed(1)}Cr` : v >= 100000 ? `${(v/100000).toFixed(1)}L` : `${(v/1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v) => [fmt(v), 'Corpus']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e4e8f4' }} />
                  <Area type="monotone" dataKey="corpus" name="Projected Corpus" stroke="#4f46e5" strokeWidth={2.5} fill="url(#projGrad)" dot={(props) => {
                    const { cx, cy, payload } = props;
                    return <circle key={payload.year} cx={cx} cy={cy} r={4} fill="#4f46e5" stroke="#fff" strokeWidth={2} />;
                  }} />
                </AreaChart>
              </ResponsiveContainer>

              {/* Milestone table */}
              <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 12 }}>Milestones</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                  {projData.filter((_, i) => i > 0).map(p => (
                    <div key={p.year} style={{ padding: '10px 14px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 3 }}>{p.year}</div>
                      <div style={{ fontFamily: 'DM Mono', fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>{fmt(p.corpus)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
