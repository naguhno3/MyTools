const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String }, // e.g. 'Plumber', 'Electrician', 'Society Manager', 'CA', 'Broker'
  phone: { type: String },
  email: { type: String },
  notes: { type: String },
}, { timestamps: true });

const documentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String }, // 'sale_deed', 'khata', 'electricity_bill', 'tax_receipt', 'insurance', 'other'
  fileUrl: { type: String },  // for future file upload integration
  fileName: { type: String },
  fileSize: { type: String },
  issueDate: { type: Date },
  expiryDate: { type: Date },
  notes: { type: String },
  isImportant: { type: Boolean, default: false },
}, { timestamps: true });

const tenantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String },
  email: { type: String },
  aadhar: { type: String },
  pan: { type: String },
  leaseStart: { type: Date },
  leaseEnd: { type: Date },
  monthlyRent: { type: Number },
  securityDeposit: { type: Number },
  rentDueDay: { type: Number, default: 1 },  // day of month rent is due
  escalationPct: { type: Number, default: 5 }, // annual rent increase %
  notes: { type: String },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const propertyTransactionSchema = new mongoose.Schema({
  type: { type: String, enum: ['income', 'expense'], required: true },
  category: { type: String }, // 'rent', 'maintenance', 'property_tax', 'insurance', 'repair', 'other'
  amount: { type: Number, required: true },
  date: { type: Date, required: true, default: Date.now },
  description: { type: String, required: true },
  paidBy: { type: String },
  receipt: { type: String },
  notes: { type: String },
}, { timestamps: true });

const propertySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['apartment', 'house', 'villa', 'plot', 'commercial', 'farm', 'other'], default: 'apartment' },
  status: { type: String, enum: ['self_occupied', 'rented', 'vacant', 'under_construction'], default: 'self_occupied' },

  // Location
  address: { type: String },
  city: { type: String },
  state: { type: String },
  pincode: { type: String },
  landmark: { type: String },

  // Property details
  area: { type: Number },         // sq ft
  builtArea: { type: Number },    // built-up sq ft
  floors: { type: Number, default: 1 },
  bedrooms: { type: Number },
  bathrooms: { type: Number },
  parkingSpots: { type: Number, default: 0 },
  yearBuilt: { type: Number },
  registrationNumber: { type: String },
  surveyNumber: { type: String },

  // Financials
  purchasePrice: { type: Number },
  purchaseDate: { type: Date },
  currentValue: { type: Number },
  stampDuty: { type: Number },
  registrationCost: { type: Number },
  loanLinked: { type: String }, // Loan ID reference

  // Recurring costs
  monthlyMaintenance: { type: Number, default: 0 },
  annualPropertyTax: { type: Number, default: 0 },
  annualInsurance: { type: Number, default: 0 },

  // Tenant info (active tenant)
  tenant: { type: tenantSchema },

  // Sub-collections
  contacts: [contactSchema],
  documents: [documentSchema],
  transactions: [propertyTransactionSchema],

  // Meta
  color: { type: String, default: '#0d9488' },
  coverImage: { type: String },
  notes: { type: String },
  tags: [{ type: String }],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Virtual: total income this year
propertySchema.virtual('yearlyRentIncome').get(function () {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  return this.transactions
    .filter(t => t.type === 'income' && new Date(t.date) >= yearStart)
    .reduce((s, t) => s + t.amount, 0);
});

// Virtual: total expenses this year
propertySchema.virtual('yearlyExpenses').get(function () {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  return this.transactions
    .filter(t => t.type === 'expense' && new Date(t.date) >= yearStart)
    .reduce((s, t) => s + t.amount, 0);
});

// Virtual: appreciation
propertySchema.virtual('appreciation').get(function () {
  if (!this.currentValue || !this.purchasePrice) return 0;
  return this.currentValue - this.purchasePrice;
});

propertySchema.virtual('appreciationPct').get(function () {
  if (!this.purchasePrice || this.purchasePrice === 0) return 0;
  return ((this.currentValue - this.purchasePrice) / this.purchasePrice) * 100;
});

propertySchema.set('toJSON', { virtuals: true });
propertySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Property', propertySchema);
