const mongoose = require('mongoose');

// Individual budget line item
const budgetItemSchema = new mongoose.Schema({
  budget: { type: mongoose.Schema.Types.ObjectId, ref: 'Budget', required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  plannedAmount: { type: Number, required: true, min: 0 },
  notes: { type: String }
}, { timestamps: true });

// Monthly budget
const budgetSchema = new mongoose.Schema({
  name: { type: String, required: true },
  month: { type: Number, required: true, min: 1, max: 12 }, // 1-12
  year: { type: Number, required: true },
  notes: { type: String }
}, { timestamps: true });

budgetSchema.index({ month: 1, year: 1 }, { unique: true });

const Budget = mongoose.model('Budget', budgetSchema);
const BudgetItem = mongoose.model('BudgetItem', budgetItemSchema);

module.exports = { Budget, BudgetItem };
