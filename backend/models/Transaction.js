const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  type: { type: String, enum: ['income', 'expense', 'transfer', 'contribution', 'interest'], required: true },
  amount: { type: Number, required: true, min: 0.01 },
  description: { type: String, required: true, trim: true },
  date: { type: Date, required: true, default: Date.now },

  account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
  toAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' }, // for transfers

  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },

  // Budget link
  budgetItem: { type: mongoose.Schema.Types.ObjectId, ref: 'BudgetItem' },

  // Retirement-specific sub-fields
  contributionBreakdown: {
    employee: { type: Number, default: 0 },
    employer: { type: Number, default: 0 }
  },

  tags: [{ type: String }],
  notes: { type: String },
  isRecurring: { type: Boolean, default: false },
  recurringFrequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'] }
}, { timestamps: true });

// Auto-update account balance on save
transactionSchema.post('save', async function() {
  const Account = mongoose.model('Account');
  if (this.type === 'income' || this.type === 'contribution' || this.type === 'interest') {
    await Account.findByIdAndUpdate(this.account, { $inc: { balance: this.amount } });
  } else if (this.type === 'expense') {
    await Account.findByIdAndUpdate(this.account, { $inc: { balance: -this.amount } });
  } else if (this.type === 'transfer') {
    await Account.findByIdAndUpdate(this.account, { $inc: { balance: -this.amount } });
    await Account.findByIdAndUpdate(this.toAccount, { $inc: { balance: this.amount } });
  }
});

// Reverse balance on delete
transactionSchema.post('findOneAndDelete', async function(doc) {
  if (!doc) return;
  const Account = mongoose.model('Account');
  if (doc.type === 'income' || doc.type === 'contribution' || doc.type === 'interest') {
    await Account.findByIdAndUpdate(doc.account, { $inc: { balance: -doc.amount } });
  } else if (doc.type === 'expense') {
    await Account.findByIdAndUpdate(doc.account, { $inc: { balance: doc.amount } });
  } else if (doc.type === 'transfer') {
    await Account.findByIdAndUpdate(doc.account, { $inc: { balance: doc.amount } });
    await Account.findByIdAndUpdate(doc.toAccount, { $inc: { balance: -doc.amount } });
  }
});

module.exports = mongoose.model('Transaction', transactionSchema);
