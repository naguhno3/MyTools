const mongoose = require('mongoose');

// Price history snapshots for trend tracking
const priceSnapshotSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  price: { type: Number, required: true },  // current price / NAV / rate per unit
  totalValue: { type: Number, required: true },
  note: { type: String }
}, { _id: false });

const investmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },

  assetClass: {
    type: String,
    required: true,
    enum: ['stocks', 'mutual_funds', 'fixed_deposit', 'gold', 'bonds', 'crypto', 'real_estate', 'other']
  },

  // Sub-type detail
  subType: { type: String }, // e.g. 'Large Cap', 'ELSS', 'SGB', 'Sovereign', 'Corporate Bond'

  // Broker / Bank / Fund house
  institution: { type: String }, // e.g. 'Zerodha', 'HDFC AMC', 'SBI', 'MMTC-PAMP'

  // Identifier
  ticker: { type: String },     // NSE/BSE symbol or ISIN
  folioNumber: { type: String }, // For MF / FD
  accountRef: { type: String },  // Optional link to a bank account

  // Purchase details
  purchaseDate: { type: Date },
  units: { type: Number, default: 1 },        // shares / units / grams for gold
  purchasePrice: { type: Number },             // price per unit at purchase
  totalInvested: { type: Number, required: true }, // total cost basis

  // Current value
  currentPrice: { type: Number },              // current price per unit
  currentValue: { type: Number, required: true }, // current total value

  // FD-specific
  maturityDate: { type: Date },
  interestRate: { type: Number },              // % p.a. for FD/bonds
  maturityValue: { type: Number },             // at maturity

  // Gold-specific
  goldWeight: { type: Number },               // grams
  goldPurity: { type: String },               // 24K, 22K, SGB

  // Performance
  dividendReceived: { type: Number, default: 0 },
  xirr: { type: Number },                     // calculated or manual XIRR %

  // Status
  status: { type: String, enum: ['active', 'sold', 'matured'], default: 'active' },
  sellDate: { type: Date },
  sellPrice: { type: Number },                // price per unit at sale
  sellValue: { type: Number },                // total sale proceeds

  // Price history (snapshots for charts)
  priceHistory: [priceSnapshotSchema],

  color: { type: String, default: '#6366f1' },
  tags: [{ type: String }],
  notes: { type: String },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Virtual: unrealized gain/loss
investmentSchema.virtual('unrealizedGain').get(function () {
  if (this.status !== 'active') return 0;
  return this.currentValue - this.totalInvested;
});

investmentSchema.virtual('returnPct').get(function () {
  if (!this.totalInvested || this.totalInvested === 0) return 0;
  const base = this.status === 'active' ? this.currentValue : (this.sellValue || this.currentValue);
  return ((base - this.totalInvested) / this.totalInvested) * 100;
});

investmentSchema.set('toJSON', { virtuals: true });
investmentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Investment', investmentSchema);
