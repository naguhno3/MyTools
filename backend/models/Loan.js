const mongoose = require('mongoose');

const emiPaymentSchema = new mongoose.Schema({
  type: { type: String, enum: ['emi', 'prepayment', 'part_payment'], required: true },
  amount: { type: Number, required: true },
  date: { type: Date, required: true, default: Date.now },
  principalComponent: { type: Number, default: 0 },
  interestComponent: { type: Number, default: 0 },
  emiNumber: { type: Number },         // which EMI number this corresponds to
  outstandingAfter: { type: Number },  // principal outstanding after this payment
  
  // For prepayment - what action to take
  prepaymentAction: { type: String, enum: ['reduce_tenure', 'reduce_emi'] }, // for prepayments
  newEmi: { type: Number },            // if EMI changes after prepayment
  tenureSavedMonths: { type: Number }, // months saved by prepayment
  
  notes: { type: String },
  receiptNumber: { type: String },
}, { timestamps: true });

const loanSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  loanType: {
    type: String,
    enum: ['home', 'car', 'personal', 'education', 'gold', 'business', 'lap', 'other'],
    required: true
  },

  // Lender details
  lender: { type: String, required: true },  // Bank / NBFC
  loanAccountNumber: { type: String },
  branchName: { type: String },
  loanOfficer: { type: String },
  lenderPhone: { type: String },
  lenderEmail: { type: String },

  // Loan terms
  principalAmount: { type: Number, required: true },   // original loan amount
  interestRate: { type: Number, required: true },       // annual % (reducing balance)
  tenureMonths: { type: Number, required: true },       // original tenure in months
  disbursalDate: { type: Date, required: true },         // date loan was disbursed
  firstEmiDate: { type: Date },                          // date first EMI was due
  emiDay: { type: Number, default: 1 },                  // day of month EMI is due

  // Calculated / stored for reference
  emiAmount: { type: Number },                           // calculated EMI
  totalInterestPayable: { type: Number },                // total interest over life

  // Current state (recomputed on each payment)
  outstandingPrincipal: { type: Number },                // current outstanding
  currentTenureMonths: { type: Number },                 // remaining months
  currentEmi: { type: Number },                          // current EMI (may change after prepayment)
  lastPaymentDate: { type: Date },
  nextEmiDate: { type: Date },
  paidEmis: { type: Number, default: 0 },
  totalPaidAmount: { type: Number, default: 0 },         // total paid so far
  totalPrincipalPaid: { type: Number, default: 0 },
  totalInterestPaid: { type: Number, default: 0 },
  totalPrepaid: { type: Number, default: 0 },

  // Property linked (for home/LAP loans)
  propertyLinked: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },

  // Linked vault documents
  documents: [{
    name: { type: String },
    docType: { type: String },
    linkedDocId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    notes: { type: String },
    addedAt: { type: Date, default: Date.now },
  }],

  // Status
  status: { type: String, enum: ['active', 'closed', 'npa'], default: 'active' },
  closedDate: { type: Date },

  // Payment history
  payments: [emiPaymentSchema],

  // Meta
  color: { type: String, default: '#2563eb' },
  notes: { type: String },
  tags: [{ type: String }],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Virtual: loan age in months
loanSchema.virtual('ageMonths').get(function () {
  return Math.floor((new Date() - new Date(this.disbursalDate)) / (1000 * 60 * 60 * 24 * 30));
});

// Virtual: completion percentage
loanSchema.virtual('completionPct').get(function () {
  if (!this.principalAmount) return 0;
  return Math.min(100, ((this.principalAmount - (this.outstandingPrincipal || this.principalAmount)) / this.principalAmount) * 100);
});

loanSchema.set('toJSON', { virtuals: true });
loanSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Loan', loanSchema);
