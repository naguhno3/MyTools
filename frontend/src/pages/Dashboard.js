import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
  AreaChart, Area, Legend
} from 'recharts';
import { getDashboard } from '../utils/api';
import { fmt, fmtShortDate, monthName, CHART_COLORS, ACCOUNT_TYPES } from '../utils/helpers';
import './Dashboard.css';

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e4e8f4', borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 16px rgba(15,22,41,0.1)' }}>
      <div style={{ color: '#9aa3be', marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {fmt(p.value)}</div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    getDashboard().then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page"><div className="loading-screen"><div className="spinner" /><span>Loading dashboard...</span></div></div>;
  if (!data) return <div className="page"><div style={{ color: 'var(--text2)', padding: '40px 0' }}>⚠️ Could not load dashboard. Make sure the backend is running at port 5000.</div></div>;

  const trendData = data.trend.map(t => ({
    name: `${monthName(+t.month.split('-')[1])} '${t.month.split('-')[0].slice(2)}`,
    income: t.income, expense: t.expense
  }));

  const retTrend = (data.retirement?.trend || []).map(t => ({
    name: `${monthName(+t.month.split('-')[1])} '${t.month.split('-')[0].slice(2)}`,
    contribution: t.contribution || 0,
    interest: t.interest || 0,
    total: (t.contribution || 0) + (t.interest || 0)
  }));

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const ret = data.retirement || { totalContributions: 0, totalInterest: 0, trend: [] };
  const hasRetirement = (data.retirementAccounts?.length || 0) > 0;
  const totalNetWorth = (data.totalBalance || 0) + (data.retirementBalance || 0);

  return (
    <div className="page fade-in">
      <div className="dash-header">
        <div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 4 }}>{greeting} 👋</div>
          <h1 className="page-title">Financial Overview</h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/transactions" className="btn btn-ghost">+ Add Transaction</Link>
          <Link to="/transfer" className="btn btn-primary">⇄ Transfer</Link>
        </div>
      </div>

      <div className={`dash-stats ${hasRetirement ? 'dash-stats-5' : ''}`}>
        <div className="stat-card gradient-navy">
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>
            {hasRetirement ? 'Net Worth (All)' : 'Total Balance'}
          </div>
          <div style={{ fontFamily: 'DM Mono', fontSize: 28, fontWeight: 500, color: '#fff' }}>{fmt(totalNetWorth)}</div>
          {hasRetirement ? (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>
              Liquid: {fmt(data.totalBalance)} · Retirement: {fmt(data.retirementBalance)}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>{data.accounts.length} account{data.accounts.length !== 1 ? 's' : ''} combined</div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-icon">↑</div>
          <div className="stat-label">This Month Income</div>
          <div className="stat-value amount-income">{fmt(data.thisMonth.income)}</div>
          <span className={`stat-change ${+data.incomeChange >= 0 ? 'up' : 'down'}`}>
            {+data.incomeChange >= 0 ? '↑' : '↓'} {Math.abs(data.incomeChange)}% vs last month
          </span>
        </div>
        <div className="stat-card">
          <div className="stat-icon">↓</div>
          <div className="stat-label">This Month Expense</div>
          <div className="stat-value amount-expense">{fmt(data.thisMonth.expense)}</div>
          <span className={`stat-change ${+data.expenseChange <= 0 ? 'up' : 'down'}`}>
            {+data.expenseChange >= 0 ? '↑' : '↓'} {Math.abs(data.expenseChange)}% vs last month
          </span>
        </div>
        <div className="stat-card">
          <div className="stat-icon">◆</div>
          <div className="stat-label">This Month Savings</div>
          <div className={`stat-value ${data.thisMonth.savings >= 0 ? 'amount-income' : 'amount-expense'}`}>{fmt(data.thisMonth.savings)}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>
            {data.thisMonth.income > 0 ? Math.round((data.thisMonth.savings / data.thisMonth.income) * 100) : 0}% savings rate
          </div>
        </div>
        {hasRetirement && (
          <div className="stat-card" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', border: 'none' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 10 }}>Retirement Corpus</div>
            <div style={{ fontFamily: 'DM Mono', fontSize: 24, fontWeight: 500, color: '#fff' }}>{fmt(data.retirementBalance)}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>
              {data.retirementAccounts.length} account{data.retirementAccounts.length !== 1 ? 's' : ''} · {ret.totalInterest > 0 ? `${fmt(ret.totalInterest)} interest` : 'PF + PPF + NPS'}
            </div>
          </div>
        )}
      </div>

      {hasRetirement && (
        <div className="tabs" style={{ marginBottom: 20 }}>
          <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>📊 Overview</button>
          <button className={`tab ${activeTab === 'retirement' ? 'active' : ''}`} onClick={() => setActiveTab('retirement')}>🏛 Retirement Trends</button>
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="dash-grid">
          <div className="card" style={{ gridColumn: 'span 2' }}>
            <div className="card-header">
              <div className="section-title" style={{ marginBottom: 0 }}>Income vs Expenses — Last 6 Months</div>
            </div>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trendData} margin={{ left: -10 }}>
                  <CartesianGrid stroke="#f0f2fa" strokeDasharray="0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9aa3be', fontFamily: 'DM Sans' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9aa3be' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip content={<TT />} />
                  <Bar dataKey="income" name="Income" fill="#059669" radius={[5, 5, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[5, 5, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)', fontSize: 13 }}>Add transactions to see trends</div>
            )}
          </div>

          <div className="card">
            <div className="section-title">Top Spending Categories</div>
            {data.categoryBreakdown.length > 0 ? (
              <>
                <PieChart width={200} height={160} style={{ margin: '0 auto 16px' }}>
                  <Pie data={data.categoryBreakdown} dataKey="amount" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3}>
                    {data.categoryBreakdown.map((entry, i) => (
                      <Cell key={i} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e4e8f4' }} />
                </PieChart>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {data.categoryBreakdown.slice(0, 5).map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 15 }}>{c.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{c.name}</span>
                          <span style={{ fontSize: 12, fontFamily: 'DM Mono', color: 'var(--red)' }}>{fmt(c.amount)}</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${Math.min((c.amount / data.categoryBreakdown[0]?.amount) * 100, 100)}%`, background: c.color }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text3)', fontSize: 13 }}>No expenses this month</div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <div className="section-title" style={{ marginBottom: 0 }}>Accounts</div>
              <Link to="/accounts" className="btn btn-ghost btn-sm">Manage</Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.accounts.length > 0 ? data.accounts.map(acc => {
                const tc = ACCOUNT_TYPES[acc.type];
                return (
                  <div key={acc._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', background: 'var(--bg)', borderRadius: 11, border: '1px solid var(--border)' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: `${acc.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{acc.icon || tc?.icon || '🏦'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{acc.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{tc?.label}</div>
                    </div>
                    <div style={{ fontFamily: 'DM Mono', fontWeight: 500, fontSize: 13, color: acc.balance >= 0 ? 'var(--text)' : 'var(--red)' }}>{fmt(acc.balance)}</div>
                  </div>
                );
              }) : <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text3)', fontSize: 13 }}>No accounts yet</div>}
              {hasRetirement && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', padding: '6px 2px 2px' }}>Retirement</div>
                  {data.retirementAccounts.map(acc => {
                    const tc = ACCOUNT_TYPES[acc.type];
                    return (
                      <div key={acc._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', background: `${acc.color || '#4f46e5'}08`, borderRadius: 11, border: `1px solid ${acc.color || '#4f46e5'}20` }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: `${acc.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{acc.icon || tc?.icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{acc.name}</div>
                          <div style={{ fontSize: 11, color: acc.color || '#4f46e5', fontWeight: 600 }}>{tc?.label}</div>
                        </div>
                        <div style={{ fontFamily: 'DM Mono', fontWeight: 500, fontSize: 13, color: acc.color || '#4f46e5' }}>{fmt(acc.balance)}</div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          <div className="card" style={{ gridColumn: 'span 2' }}>
            <div className="card-header">
              <div className="section-title" style={{ marginBottom: 0 }}>Recent Transactions</div>
              <Link to="/transactions" className="btn btn-ghost btn-sm">View All</Link>
            </div>
            {data.recentTransactions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {data.recentTransactions.map(tx => {
                  const isRet = tx.type === 'contribution' || tx.type === 'interest';
                  const color = tx.type === 'income' ? 'var(--green)' : tx.type === 'expense' ? 'var(--red)' : tx.type === 'transfer' ? 'var(--blue)' : tx.type === 'interest' ? '#0891b2' : '#4f46e5';
                  const sign = ['income','contribution','interest'].includes(tx.type) ? '+' : tx.type === 'expense' ? '−' : '⇄';
                  const icon = tx.type === 'transfer' ? '⇄' : tx.type === 'contribution' ? '🏛' : tx.type === 'interest' ? '📈' : tx.category?.icon || '💸';
                  return (
                    <div key={tx._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--bg)' }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: isRet ? `${color}15` : tx.category ? `${tx.category.color}15` : 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>{icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {tx.description}
                          {isRet && <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: `${color}18`, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tx.type}</span>}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{tx.account?.name}{tx.type === 'transfer' ? ` → ${tx.toAccount?.name}` : ''} · {fmtShortDate(tx.date)}</div>
                      </div>
                      <div style={{ fontFamily: 'DM Mono', fontWeight: 500, fontSize: 14, color }}>{sign}{fmt(tx.amount)}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text3)', fontSize: 13 }}>No transactions yet. Add your first one!</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'retirement' && hasRetirement && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { label: 'Total Corpus', val: data.retirementBalance, color: '#4f46e5', sub: `${data.retirementAccounts.length} accounts` },
              { label: 'Total Contributed', val: ret.totalContributions, color: '#059669', sub: 'All time contributions' },
              { label: 'Total Interest Earned', val: ret.totalInterest, color: '#0891b2', sub: `${data.retirementBalance > 0 ? ((ret.totalInterest / data.retirementBalance) * 100).toFixed(1) : 0}% of corpus` },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-label">{s.label}</div>
                <div style={{ fontFamily: 'DM Mono', fontSize: 24, fontWeight: 500, color: s.color, marginTop: 6 }}>{fmt(s.val)}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header" style={{ marginBottom: 16 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>Corpus by Account</div>
              <Link to="/retirement" className="btn btn-ghost btn-sm">Manage →</Link>
            </div>
            {data.retirementAccounts.map(acc => {
              const pct = data.retirementBalance > 0 ? (acc.balance / data.retirementBalance) * 100 : 0;
              const tc = ACCOUNT_TYPES[acc.type];
              return (
                <div key={acc._id} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{acc.icon || tc?.icon}</span>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{acc.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 6 }}>{tc?.label}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>{pct.toFixed(1)}%</span>
                      <span style={{ fontFamily: 'DM Mono', fontSize: 14, fontWeight: 600, color: acc.color || '#4f46e5' }}>{fmt(acc.balance)}</span>
                    </div>
                  </div>
                  <div className="progress-bar" style={{ height: 9, borderRadius: 5 }}>
                    <div className="progress-fill" style={{ width: `${pct}%`, background: acc.color || '#4f46e5', borderRadius: 5 }} />
                  </div>
                </div>
              );
            })}
          </div>

          {retTrend.length > 0 ? (
            <>
              <div className="card">
                <div className="card-header">
                  <div className="section-title" style={{ marginBottom: 0 }}>Monthly Contributions & Interest — Last 12 Months</div>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={retTrend} margin={{ left: -10 }}>
                    <CartesianGrid stroke="#f0f2fa" strokeDasharray="0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9aa3be', fontFamily: 'DM Sans' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9aa3be' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                    <Tooltip content={<TT />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontFamily: 'DM Sans' }} />
                    <Bar dataKey="contribution" name="Contribution" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="interest" name="Interest" fill="#0891b2" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="section-title" style={{ marginBottom: 0 }}>Monthly Additions to Corpus</div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={retTrend} margin={{ left: -10 }}>
                    <defs>
                      <linearGradient id="corpusGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#f0f2fa" strokeDasharray="0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9aa3be', fontFamily: 'DM Sans' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9aa3be' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                    <Tooltip content={<TT />} />
                    <Area type="monotone" dataKey="total" name="Total Added" stroke="#4f46e5" strokeWidth={2.5} fill="url(#corpusGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <div className="empty-title">No retirement activity yet</div>
              <div className="empty-desc">Add contributions and interest in the Retirement section to see trends here.</div>
              <Link to="/retirement" className="btn btn-primary">Go to Retirement →</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
