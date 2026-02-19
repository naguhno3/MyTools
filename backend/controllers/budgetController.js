const { Budget, BudgetItem } = require('../models/Budget');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');

exports.getBudgets = async (req, res) => {
  try {
    const budgets = await Budget.find().sort({ year: -1, month: -1 });
    res.json(budgets);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getBudget = async (req, res) => {
  try {
    const budget = await Budget.findById(req.params.id);
    if (!budget) return res.status(404).json({ error: 'Budget not found' });

    const items = await BudgetItem.find({ budget: budget._id }).populate('category', 'name icon color type');

    // Get actual spending for each budget item's category in the budget month
    const startDate = new Date(budget.year, budget.month - 1, 1);
    const endDate = new Date(budget.year, budget.month, 0, 23, 59, 59);

    const enrichedItems = await Promise.all(items.map(async (item) => {
      const i = item.toObject();
      const agg = await Transaction.aggregate([
        {
          $match: {
            category: item.category._id,
            type: 'expense',
            date: { $gte: startDate, $lte: endDate }
          }
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      i.spentAmount = agg[0]?.total || 0;
      i.remaining = i.plannedAmount - i.spentAmount;
      i.percentage = i.plannedAmount > 0 ? Math.min(Math.round((i.spentAmount / i.plannedAmount) * 100), 999) : 0;
      return i;
    }));

    const totalPlanned = enrichedItems.reduce((s, i) => s + i.plannedAmount, 0);
    const totalSpent = enrichedItems.reduce((s, i) => s + i.spentAmount, 0);

    res.json({ budget, items: enrichedItems, totalPlanned, totalSpent });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getBudgetByMonth = async (req, res) => {
  try {
    const { month, year } = req.params;
    let budget = await Budget.findOne({ month: +month, year: +year });
    if (!budget) return res.status(404).json({ error: 'No budget for this month' });

    req.params.id = budget._id;
    return exports.getBudget(req, res);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createBudget = async (req, res) => {
  try {
    const budget = new Budget(req.body);
    await budget.save();
    res.status(201).json(budget);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.updateBudget = async (req, res) => {
  try {
    const budget = await Budget.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(budget);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.deleteBudget = async (req, res) => {
  try {
    await BudgetItem.deleteMany({ budget: req.params.id });
    await Budget.findByIdAndDelete(req.params.id);
    res.json({ message: 'Budget deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Budget Items
exports.getBudgetItems = async (req, res) => {
  try {
    const items = await BudgetItem.find({ budget: req.params.id }).populate('category');
    res.json(items);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createBudgetItem = async (req, res) => {
  try {
    const item = new BudgetItem({ ...req.body, budget: req.params.id });
    await item.save();
    const populated = await BudgetItem.findById(item._id).populate('category', 'name icon color');
    res.status(201).json(populated);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.updateBudgetItem = async (req, res) => {
  try {
    const item = await BudgetItem.findByIdAndUpdate(req.params.itemId, req.body, { new: true }).populate('category', 'name icon color');
    res.json(item);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.deleteBudgetItem = async (req, res) => {
  try {
    await BudgetItem.findByIdAndDelete(req.params.itemId);
    res.json({ message: 'Item deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
