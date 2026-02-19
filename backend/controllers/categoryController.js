const Category = require('../models/Category');

const DEFAULT_CATEGORIES = [
  // Expense categories
  { name: 'Food & Dining', type: 'expense', icon: '🍽️', color: '#f97316', isDefault: true },
  { name: 'Groceries', type: 'expense', icon: '🛒', color: '#84cc16', isDefault: true },
  { name: 'Transport', type: 'expense', icon: '🚗', color: '#3b82f6', isDefault: true },
  { name: 'Shopping', type: 'expense', icon: '🛍️', color: '#ec4899', isDefault: true },
  { name: 'Entertainment', type: 'expense', icon: '🎬', color: '#8b5cf6', isDefault: true },
  { name: 'Bills & Utilities', type: 'expense', icon: '💡', color: '#f59e0b', isDefault: true },
  { name: 'Healthcare', type: 'expense', icon: '🏥', color: '#ef4444', isDefault: true },
  { name: 'Education', type: 'expense', icon: '📚', color: '#06b6d4', isDefault: true },
  { name: 'Rent & Housing', type: 'expense', icon: '🏠', color: '#14b8a6', isDefault: true },
  { name: 'Travel', type: 'expense', icon: '✈️', color: '#6366f1', isDefault: true },
  { name: 'Personal Care', type: 'expense', icon: '💅', color: '#d946ef', isDefault: true },
  { name: 'Insurance', type: 'expense', icon: '🛡️', color: '#64748b', isDefault: true },
  { name: 'Investments', type: 'expense', icon: '📈', color: '#22c55e', isDefault: true },
  { name: 'Subscriptions', type: 'expense', icon: '📱', color: '#a855f7', isDefault: true },
  { name: 'Other Expense', type: 'expense', icon: '📦', color: '#78716c', isDefault: true },
  // Income categories
  { name: 'Salary', type: 'income', icon: '💼', color: '#10b981', isDefault: true },
  { name: 'Freelance', type: 'income', icon: '💻', color: '#3b82f6', isDefault: true },
  { name: 'Business', type: 'income', icon: '🏢', color: '#f59e0b', isDefault: true },
  { name: 'Investment Returns', type: 'income', icon: '📊', color: '#22c55e', isDefault: true },
  { name: 'Rental Income', type: 'income', icon: '🏘️', color: '#6366f1', isDefault: true },
  { name: 'Gift', type: 'income', icon: '🎁', color: '#ec4899', isDefault: true },
  { name: 'Refund', type: 'income', icon: '↩️', color: '#14b8a6', isDefault: true },
  { name: 'Other Income', type: 'income', icon: '💰', color: '#84cc16', isDefault: true },
];

exports.seedCategories = async () => {
  const count = await Category.countDocuments({ isDefault: true });
  if (count === 0) {
    await Category.insertMany(DEFAULT_CATEGORIES);
    console.log('✅ Default categories seeded');
  }
};

exports.getCategories = async (req, res) => {
  try {
    const filter = req.query.type ? { type: req.query.type } : {};
    const cats = await Category.find(filter).sort({ type: 1, name: 1 });
    res.json(cats);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createCategory = async (req, res) => {
  try {
    const cat = new Category(req.body);
    await cat.save();
    res.status(201).json(cat);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.updateCategory = async (req, res) => {
  try {
    const cat = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(cat);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.deleteCategory = async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
