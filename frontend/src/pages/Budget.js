import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getBudgets, getBudget, createBudget, deleteBudget, createBudgetItem, updateBudgetItem, deleteBudgetItem, getCategories } from '../utils/api';
import { fmt, getMonthOptions, monthName } from '../utils/helpers';

export default function Budget() {
  const [budgets, setBudgets] = useState([]);
  const [selectedBudget, setSelectedBudget] = useState(null);
  const [budgetDetail, setBudgetDetail] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showNewBudget, setShowNewBudget] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [newBudgetForm, setNewBudgetForm] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear(), name: '' });
  const [itemForm, setItemForm] = useState({ category: '', plannedAmount: '', notes: '' });

  const monthOpts = getMonthOptions();

  useEffect(() => {
    Promise.all([getBudgets(), getCategories({ type: 'expense' })]).then(([b, c]) => {
      setBudgets(b.data);
      setCategories(c.data);
      if (b.data.length > 0) setSelectedBudget(b.data[0]._id);
    }).finally(() => setLoading(false));
  }, []);

  const fetchDetail = useCallback(() => {
    if (!selectedBudget) { setBudgetDetail(null); return; }
    setDetailLoading(true);
    getBudget(selectedBudget).then(r => setBudgetDetail(r.data)).finally(() => setDetailLoading(false));
  }, [selectedBudget]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const handleCreateBudget = async (e) => {
    e.preventDefault();
    try {
      const name = newBudgetForm.name || `${monthName(newBudgetForm.month)} ${newBudgetForm.year}`;
      const r = await createBudget({ ...newBudgetForm, name });
      setBudgets(p => [r.data, ...p]);
      setSelectedBudget(r.data._id);
      setShowNewBudget(false);
      toast.success('Budget created!');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed — budget for this month may already exist'); }
  };

  const handleDeleteBudget = async (id) => {
    if (!window.confirm('Delete this budget and all its items?')) return;
    await deleteBudget(id);
    setBudgets(p => p.filter(b => b._id !== id));
    setSelectedBudget(budgets.find(b => b._id !== id)?._id || null);
    toast.success('Budget deleted');
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      if (editItem) {
        await updateBudgetItem(selectedBudget, editItem._id, { plannedAmount: +itemForm.plannedAmount, notes: itemForm.notes });
        toast.success('Updated!');
      } else {
        await createBudgetItem(selectedBudget, { ...itemForm, plannedAmount: +itemForm.plannedAmount });
        toast.success('Budget item added!');
      }
      setShowAddItem(false); setEditItem(null); setItemForm({ category: '', plannedAmount: '', notes: '' });
      fetchDetail();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Remove this budget item?')) return;
    await deleteBudgetItem(selectedBudget, itemId);
    toast.success('Removed');
    fetchDetail();
  };

  if (loading) return <div className="page"><div className="loading-screen"><div className="spinner" /></div></div>;

  const existingCatIds = new Set((budgetDetail?.items || []).map(i => i.category?._id));
  const availableCats = categories.filter(c => !existingCatIds.has(c._id));

  return (
    <div className="page fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">Budget Tracker</h1>
          <div className="page-sub">Set monthly budgets and track your spending</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNewBudget(true)}>+ New Budget</button>
      </div>

      {budgets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">◎</div>
          <div className="empty-title">No budgets yet</div>
          <div className="empty-desc">Create a monthly budget to track spending against your plan.</div>
          <button className="btn btn-primary btn-lg" onClick={() => setShowNewBudget(true)}>+ Create First Budget</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20 }}>
          {/* Budget List */}
          <div>
            <div className="card" style={{ padding: '12px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', padding: '4px 8px 10px' }}>Your Budgets</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {budgets.map(b => (
                  <div key={b._id} onClick={() => setSelectedBudget(b._id)} style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', background: selectedBudget === b._id ? 'var(--accent-light)' : 'transparent', border: `1.5px solid ${selectedBudget === b._id ? 'var(--accent)' : 'transparent'}`, transition: 'all 0.15s' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: selectedBudget === b._id ? 'var(--accent)' : 'var(--text)' }}>{b.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{monthName(b.month)} {b.year}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Budget Detail */}
          <div>
            {detailLoading ? (
              <div className="loading-screen"><div className="spinner" /></div>
            ) : budgetDetail ? (
              <>
                {/* Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
                  {[
                    { label: 'Total Budgeted', val: budgetDetail.totalPlanned, color: 'var(--blue)' },
                    { label: 'Total Spent', val: budgetDetail.totalSpent, color: 'var(--red)' },
                    { label: 'Remaining', val: budgetDetail.totalPlanned - budgetDetail.totalSpent, color: (budgetDetail.totalPlanned - budgetDetail.totalSpent) >= 0 ? 'var(--green)' : 'var(--red)' },
                  ].map(s => (
                    <div key={s.label} className="card" style={{ padding: '18px 20px' }}>
                      <div className="stat-label">{s.label}</div>
                      <div style={{ fontFamily: 'DM Mono', fontSize: 22, fontWeight: 500, color: s.color }}>{fmt(s.val)}</div>
                    </div>
                  ))}
                </div>

                {/* Overall progress */}
                {budgetDetail.totalPlanned > 0 && (
                  <div className="card" style={{ marginBottom: 20, padding: '18px 22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>Overall Budget Used</div>
                      <div style={{ fontFamily: 'DM Mono', fontSize: 14, fontWeight: 600, color: budgetDetail.totalSpent > budgetDetail.totalPlanned ? 'var(--red)' : 'var(--text)' }}>
                        {Math.round((budgetDetail.totalSpent / budgetDetail.totalPlanned) * 100)}%
                      </div>
                    </div>
                    <div className="progress-bar" style={{ height: 10, borderRadius: 6 }}>
                      <div className="progress-fill" style={{
                        width: `${Math.min((budgetDetail.totalSpent / budgetDetail.totalPlanned) * 100, 100)}%`,
                        background: budgetDetail.totalSpent > budgetDetail.totalPlanned ? 'var(--red)' : budgetDetail.totalSpent / budgetDetail.totalPlanned > 0.8 ? 'var(--amber)' : 'var(--accent)',
                        borderRadius: 6
                      }} />
                    </div>
                  </div>
                )}

                {/* Budget Items */}
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <div className="section-title" style={{ marginBottom: 0 }}>Budget Items ({budgetDetail.items.length})</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteBudget(selectedBudget)}>Delete Budget</button>
                      {availableCats.length > 0 && <button className="btn btn-primary btn-sm" onClick={() => { setShowAddItem(true); setEditItem(null); setItemForm({ category: '', plannedAmount: '', notes: '' }); }}>+ Add Category</button>}
                    </div>
                  </div>

                  {budgetDetail.items.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>
                      <div style={{ fontSize: 32, marginBottom: 12 }}>◎</div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No budget categories yet</div>
                      <button className="btn btn-primary btn-sm" onClick={() => setShowAddItem(true)}>+ Add First Category</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {budgetDetail.items.map(item => {
                        const pct = item.percentage;
                        const isOver = pct >= 100;
                        const isWarning = pct >= 80 && !isOver;
                        const barColor = isOver ? 'var(--red)' : isWarning ? 'var(--amber)' : 'var(--accent)';
                        return (
                          <div key={item._id} style={{ padding: '14px 16px', background: 'var(--surface2)', borderRadius: 12, border: `1px solid ${isOver ? 'rgba(220,38,38,0.2)' : 'var(--border)'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 9, background: `${item.category?.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                                  {item.category?.icon}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{item.category?.name}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                                    {fmt(item.spentAmount)} of {fmt(item.plannedAmount)} · {pct}%
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', align: 'center', gap: 8 }}>
                                {isOver && <span style={{ fontSize: 11, background: 'rgba(220,38,38,0.1)', color: 'var(--red)', fontWeight: 700, padding: '3px 8px', borderRadius: 100, border: '1px solid rgba(220,38,38,0.2)' }}>OVER</span>}
                                {isWarning && <span style={{ fontSize: 11, background: 'rgba(217,119,6,0.1)', color: 'var(--amber)', fontWeight: 700, padding: '3px 8px', borderRadius: 100, border: '1px solid rgba(217,119,6,0.2)' }}>WARN</span>}
                                <div style={{ fontFamily: 'DM Mono', fontSize: 14, fontWeight: 600, color: item.remaining >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                  {item.remaining >= 0 ? '+' : ''}{fmt(item.remaining)}
                                </div>
                                <button className="btn btn-ghost btn-sm btn-icon" title="Edit" onClick={() => { setEditItem(item); setItemForm({ category: item.category?._id, plannedAmount: item.plannedAmount, notes: item.notes || '' }); setShowAddItem(true); }}>✏️</button>
                                <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDeleteItem(item._id)}>×</button>
                              </div>
                            </div>
                            <div className="progress-bar">
                              <div className="progress-fill" style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* New Budget Modal */}
      {showNewBudget && (
        <div className="modal-overlay" onClick={() => setShowNewBudget(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Create Monthly Budget</div>
              <button className="modal-close" onClick={() => setShowNewBudget(false)}>×</button>
            </div>
            <form onSubmit={handleCreateBudget}>
              <div className="form-group">
                <label className="form-label">Select Month</label>
                <select className="form-select" value={`${newBudgetForm.month}-${newBudgetForm.year}`}
                  onChange={e => { const [m, y] = e.target.value.split('-'); setNewBudgetForm(p => ({ ...p, month: +m, year: +y })); }}>
                  {monthOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Budget Name (optional)</label>
                <input className="form-input" value={newBudgetForm.name} onChange={e => setNewBudgetForm(p => ({ ...p, name: e.target.value }))} placeholder={`${monthName(newBudgetForm.month)} ${newBudgetForm.year} Budget`} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowNewBudget(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Budget</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Item Modal */}
      {showAddItem && (
        <div className="modal-overlay" onClick={() => { setShowAddItem(false); setEditItem(null); }}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editItem ? 'Edit Budget Item' : 'Add Budget Category'}</div>
              <button className="modal-close" onClick={() => { setShowAddItem(false); setEditItem(null); }}>×</button>
            </div>
            <form onSubmit={handleAddItem}>
              {!editItem && (
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select className="form-select" value={itemForm.category} onChange={e => setItemForm(p => ({ ...p, category: e.target.value }))} required>
                    <option value="">Select expense category...</option>
                    {availableCats.map(c => <option key={c._id} value={c._id}>{c.icon} {c.name}</option>)}
                  </select>
                </div>
              )}
              {editItem && (
                <div style={{ padding: '12px 14px', background: `${editItem.category?.color}12`, borderRadius: 10, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 22 }}>{editItem.category?.icon}</span>
                  <span style={{ fontWeight: 700, color: editItem.category?.color }}>{editItem.category?.name}</span>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Monthly Budget Amount (₹) *</label>
                <input type="number" className="form-input" value={itemForm.plannedAmount} onChange={e => setItemForm(p => ({ ...p, plannedAmount: e.target.value }))} placeholder="e.g. 5000" required min="1" />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input className="form-input" value={itemForm.notes} onChange={e => setItemForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes..." />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => { setShowAddItem(false); setEditItem(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editItem ? 'Update' : 'Add to Budget'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
