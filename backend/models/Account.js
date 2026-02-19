const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: {
    type: String,
    enum: ['savings', 'checking', 'credit_card', 'cash', 'investment', 'wallet', 'other', 'pf', 'ppf', 'nps'],
    required: true
  },
  balance: { type: Number, required: true, default: 0 },
  initialBalance: { type: Number, required: true, default: 0 },
  currency: { type: String, default: 'INR' },
  color: { type: String, default: '#6366f1' },
  icon: { type: String, default: '🏦' },
  bankName: { type: String },
  accountNumber: { type: String }, // last 4 digits / UAN / PRAN
  isActive: { type: Boolean, default: true },
  isRetirement: { type: Boolean, default: false }, // PF, PPF, NPS accounts
  notes: { type: String },
  // Retirement-specific
  interestRate: { type: Number }, // current applicable rate %
  maturityDate: { type: Date },
  employerContribution: { type: Number, default: 0 }, // monthly employer share (PF)
  employeeContribution: { type: Number, default: 0 }, // monthly employee share (PF)
}, { timestamps: true });

module.exports = mongoose.model('Account', accountSchema);
