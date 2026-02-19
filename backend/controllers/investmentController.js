const Investment = require('../models/Investment');

// ─── CRUD ──────────────────────────────────────────────────────────────────

exports.getInvestments = async (req, res) => {
  try {
    const { assetClass, status = 'active' } = req.query;
    const filter = { isActive: true };
    if (assetClass) filter.assetClass = assetClass;
    if (status !== 'all') filter.status = status;
    const investments = await Investment.find(filter).sort({ totalInvested: -1 });
    res.json(investments);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getInvestment = async (req, res) => {
  try {
    const inv = await Investment.findById(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });
    res.json(inv);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createInvestment = async (req, res) => {
  try {
    const data = req.body;

    // Auto-calc currentValue from units × currentPrice if not provided
    if (!data.currentValue && data.units && data.currentPrice) {
      data.currentValue = data.units * data.currentPrice;
    }
    if (!data.totalInvested && data.units && data.purchasePrice) {
      data.totalInvested = data.units * data.purchasePrice;
    }

    // Seed first price history point
    if (data.currentValue) {
      data.priceHistory = [{
        date: data.purchaseDate || new Date(),
        price: data.currentPrice || (data.totalInvested / (data.units || 1)),
        totalValue: data.currentValue,
        note: 'Initial entry'
      }];
    }

    const inv = new Investment(data);
    await inv.save();
    res.status(201).json(inv);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.updateInvestment = async (req, res) => {
  try {
    const data = req.body;
    // Auto-calc
    if (data.units && data.currentPrice && !data.currentValue) {
      data.currentValue = data.units * data.currentPrice;
    }
    const inv = await Investment.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!inv) return res.status(404).json({ error: 'Not found' });
    res.json(inv);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.deleteInvestment = async (req, res) => {
  try {
    await Investment.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Investment removed' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ─── Price Snapshot ────────────────────────────────────────────────────────

exports.addPriceSnapshot = async (req, res) => {
  try {
    const { price, totalValue, date, note } = req.body;
    const inv = await Investment.findById(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });

    const tv = totalValue || (price * (inv.units || 1));
    inv.priceHistory.push({ date: date || new Date(), price, totalValue: tv, note });
    inv.currentPrice = price;
    inv.currentValue = tv;

    await inv.save();
    res.json(inv);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

// ─── Sell / Mature ─────────────────────────────────────────────────────────

exports.sellInvestment = async (req, res) => {
  try {
    const { sellDate, sellPrice, sellValue } = req.body;
    const inv = await Investment.findById(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });

    const tv = sellValue || (sellPrice * (inv.units || 1));
    inv.status = 'sold';
    inv.sellDate = sellDate || new Date();
    inv.sellPrice = sellPrice;
    inv.sellValue = tv;
    inv.currentValue = tv;

    await inv.save();
    res.json(inv);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

// ─── Portfolio Analytics ───────────────────────────────────────────────────

exports.getPortfolioSummary = async (req, res) => {
  try {
    const active = await Investment.find({ isActive: true, status: 'active' });
    const all = await Investment.find({ isActive: true });

    // By asset class
    const byClass = {};
    active.forEach(inv => {
      if (!byClass[inv.assetClass]) byClass[inv.assetClass] = { totalInvested: 0, currentValue: 0, count: 0 };
      byClass[inv.assetClass].totalInvested += inv.totalInvested;
      byClass[inv.assetClass].currentValue += inv.currentValue;
      byClass[inv.assetClass].count++;
    });

    const totalInvested = active.reduce((s, i) => s + i.totalInvested, 0);
    const totalCurrentValue = active.reduce((s, i) => s + i.currentValue, 0);
    const totalDividend = active.reduce((s, i) => s + (i.dividendReceived || 0), 0);

    // Sold investments gain
    const realized = all
      .filter(i => i.status === 'sold' && i.sellValue)
      .reduce((s, i) => s + (i.sellValue - i.totalInvested), 0);

    // Top performers
    const topPerformers = [...active]
      .map(i => ({ ...i.toJSON(), _gain: i.currentValue - i.totalInvested, _pct: i.returnPct }))
      .sort((a, b) => b._pct - a._pct)
      .slice(0, 5);

    // Bottom performers
    const bottomPerformers = [...active]
      .map(i => ({ ...i.toJSON(), _gain: i.currentValue - i.totalInvested, _pct: i.returnPct }))
      .sort((a, b) => a._pct - b._pct)
      .slice(0, 5);

    // Monthly invested trend (from purchaseDate)
    const monthlyInvested = {};
    all.forEach(inv => {
      if (!inv.purchaseDate) return;
      const d = new Date(inv.purchaseDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyInvested[key] = (monthlyInvested[key] || 0) + inv.totalInvested;
    });

    // Diversification score (simple: number of distinct asset classes / 8 * 100)
    const diversificationScore = Math.round((Object.keys(byClass).length / 8) * 100);

    res.json({
      totalInvested,
      totalCurrentValue,
      unrealizedGain: totalCurrentValue - totalInvested,
      unrealizedGainPct: totalInvested > 0 ? ((totalCurrentValue - totalInvested) / totalInvested * 100).toFixed(2) : 0,
      totalDividend,
      realizedGain: realized,
      totalReturn: totalCurrentValue - totalInvested + realized + totalDividend,
      byClass,
      count: active.length,
      diversificationScore,
      topPerformers,
      bottomPerformers,
      monthlyInvested: Object.entries(monthlyInvested)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, amount]) => ({ month, amount }))
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ─── Export Data (for Excel download) ─────────────────────────────────────

exports.getExportData = async (req, res) => {
  try {
    const Transaction = require('../models/Transaction');
    const Account = require('../models/Account');
    const { Budget, BudgetItem } = require('../models/Budget');
    const Category = require('../models/Category');

    const [investments, transactions, accounts, budgets, budgetItems, categories] = await Promise.all([
      Investment.find({ isActive: true }),
      Transaction.find().populate('account', 'name type').populate('toAccount', 'name').populate('category', 'name type').sort({ date: -1 }),
      Account.find({ isActive: true }),
      Budget.find().sort({ year: -1, month: -1 }),
      BudgetItem.find().populate('category', 'name'),
      Category.find()
    ]);

    res.json({ investments, transactions, accounts, budgets, budgetItems, categories });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
