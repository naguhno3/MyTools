const Loan = require('../models/Loan');

// ── EMI Calculator ──────────────────────────────────────────────────────────
function calcEMI(principal, annualRate, tenureMonths) {
  if (annualRate === 0) return principal / tenureMonths;
  const r = annualRate / 12 / 100;
  return Math.round((principal * r * Math.pow(1 + r, tenureMonths)) / (Math.pow(1 + r, tenureMonths) - 1));
}

// Full amortization schedule from a given state
function buildSchedule(principal, annualRate, tenureMonths, startDate, emiAmount) {
  const r = annualRate / 12 / 100;
  let balance = principal;
  const schedule = [];

  for (let i = 1; i <= tenureMonths; i++) {
    const interest = Math.round(balance * r);
    const principalComp = Math.min(emiAmount - interest, balance);
    balance = Math.max(0, balance - principalComp);

    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + (i - 1));

    schedule.push({
      emiNumber: i,
      dueDate,
      emiAmount: i === tenureMonths ? principalComp + interest : emiAmount,
      principalComponent: principalComp,
      interestComponent: interest,
      openingBalance: balance + principalComp,
      closingBalance: balance,
    });

    if (balance === 0) break;
  }
  return schedule;
}

// Recompute loan state from all payments
function recomputeLoanState(loan) {
  const r = loan.interestRate / 12 / 100;
  const originalEmi = calcEMI(loan.principalAmount, loan.interestRate, loan.tenureMonths);

  let balance = loan.principalAmount;
  let totalPaid = 0;
  let totalPrincipal = 0;
  let totalInterest = 0;
  let totalPrepaid = 0;
  let emiCount = 0;
  let currentEmi = originalEmi;

  const sortedPayments = [...loan.payments].sort((a, b) => new Date(a.date) - new Date(b.date));

  for (const pmt of sortedPayments) {
    if (pmt.type === 'emi') {
      const interestComp = Math.round(balance * r);
      const principalComp = Math.min(pmt.amount - interestComp, balance);
      balance = Math.max(0, balance - principalComp);
      totalPrincipal += principalComp;
      totalInterest += interestComp;
      totalPaid += pmt.amount;
      emiCount++;
      pmt.principalComponent = principalComp;
      pmt.interestComponent = interestComp;
      pmt.outstandingAfter = balance;
      pmt.emiNumber = emiCount;
    } else if (pmt.type === 'prepayment' || pmt.type === 'part_payment') {
      balance = Math.max(0, balance - pmt.amount);
      totalPrepaid += pmt.amount;
      totalPaid += pmt.amount;
      pmt.outstandingAfter = balance;

      // Recompute EMI or tenure based on action
      if (balance > 0) {
        const remainingMonths = loan.tenureMonths - emiCount;
        if (pmt.prepaymentAction === 'reduce_emi') {
          currentEmi = calcEMI(balance, loan.interestRate, remainingMonths);
          pmt.newEmi = currentEmi;
        } else {
          // reduce tenure: keep same EMI, calculate new tenure
          if (r > 0) {
            const newTenure = Math.ceil(Math.log(currentEmi / (currentEmi - balance * r)) / Math.log(1 + r));
            const saved = remainingMonths - newTenure;
            pmt.tenureSavedMonths = Math.max(0, saved);
          }
        }
      }
    }
  }

  // Calculate remaining tenure
  let remainingTenure = 0;
  if (balance > 0 && currentEmi > 0) {
    if (r > 0) {
      remainingTenure = Math.ceil(Math.log(currentEmi / (currentEmi - balance * r)) / Math.log(1 + r));
    } else {
      remainingTenure = Math.ceil(balance / currentEmi);
    }
  }

  return {
    outstandingPrincipal: balance,
    currentEmi,
    currentTenureMonths: remainingTenure,
    paidEmis: emiCount,
    totalPaidAmount: totalPaid,
    totalPrincipalPaid: totalPrincipal,
    totalInterestPaid: totalInterest,
    totalPrepaid,
    lastPaymentDate: sortedPayments.length > 0 ? sortedPayments[sortedPayments.length - 1].date : null,
    isClosed: balance <= 0,
  };
}

// ── CRUD ────────────────────────────────────────────────────────────────────
exports.getLoans = async (req, res) => {
  try {
    const { status, loanType } = req.query;
    const filter = { isActive: true };
    if (status) filter.status = status;
    if (loanType) filter.loanType = loanType;
    const loans = await Loan.find(filter).sort({ disbursalDate: -1 });
    res.json(loans);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getLoan = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id).populate('propertyLinked', 'name address city');
    if (!loan) return res.status(404).json({ error: 'Not found' });
    res.json(loan);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createLoan = async (req, res) => {
  try {
    const data = req.body;

    // Auto-calculate EMI
    const emi = calcEMI(data.principalAmount, data.interestRate, data.tenureMonths);
    data.emiAmount = emi;
    data.currentEmi = emi;
    data.outstandingPrincipal = data.principalAmount;
    data.currentTenureMonths = data.tenureMonths;
    data.totalInterestPayable = (emi * data.tenureMonths) - data.principalAmount;

    if (!data.firstEmiDate && data.disbursalDate) {
      const fed = new Date(data.disbursalDate);
      fed.setMonth(fed.getMonth() + 1);
      data.firstEmiDate = fed;
    }

    const loan = new Loan(data);
    await loan.save();
    res.status(201).json(loan);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.updateLoan = async (req, res) => {
  try {
    const data = req.body;
    // Recalculate if core terms change
    if (data.principalAmount || data.interestRate || data.tenureMonths) {
      const loan = await Loan.findById(req.params.id);
      const principal = data.principalAmount || loan.principalAmount;
      const rate = data.interestRate || loan.interestRate;
      const tenure = data.tenureMonths || loan.tenureMonths;
      data.emiAmount = calcEMI(principal, rate, tenure);
      data.totalInterestPayable = (data.emiAmount * tenure) - principal;
    }
    const loan = await Loan.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!loan) return res.status(404).json({ error: 'Not found' });
    res.json(loan);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.deleteLoan = async (req, res) => {
  try {
    await Loan.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Loan removed' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── Amortization Schedule ───────────────────────────────────────────────────
exports.getAmortization = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ error: 'Not found' });

    const schedule = buildSchedule(
      loan.outstandingPrincipal || loan.principalAmount,
      loan.interestRate,
      loan.currentTenureMonths || loan.tenureMonths,
      loan.firstEmiDate || loan.disbursalDate,
      loan.currentEmi || loan.emiAmount
    );

    res.json({ schedule, loan });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── EMI Calculator (standalone, no DB) ─────────────────────────────────────
exports.calculateEmi = async (req, res) => {
  try {
    const { principal, rate, tenure } = req.body;
    const emi = calcEMI(+principal, +rate, +tenure);
    const totalPayable = emi * tenure;
    const totalInterest = totalPayable - principal;
    const schedule = buildSchedule(+principal, +rate, +tenure, new Date(), emi);
    res.json({ emi, totalPayable, totalInterest, schedule });
  } catch (err) { res.status(400).json({ error: err.message }); }
};

// ── Record Payment ──────────────────────────────────────────────────────────
exports.addPayment = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ error: 'Not found' });
    if (loan.status === 'closed') return res.status(400).json({ error: 'Loan is already closed' });

    loan.payments.push(req.body);

    // Recompute state
    const state = recomputeLoanState(loan);
    Object.assign(loan, {
      outstandingPrincipal: state.outstandingPrincipal,
      currentEmi: state.currentEmi,
      currentTenureMonths: state.currentTenureMonths,
      paidEmis: state.paidEmis,
      totalPaidAmount: state.totalPaidAmount,
      totalPrincipalPaid: state.totalPrincipalPaid,
      totalInterestPaid: state.totalInterestPaid,
      totalPrepaid: state.totalPrepaid,
      lastPaymentDate: state.lastPaymentDate,
    });

    if (state.isClosed) {
      loan.status = 'closed';
      loan.closedDate = new Date();
    }

    await loan.save();
    res.json(loan);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.deletePayment = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ error: 'Not found' });
    loan.payments.pull(req.params.paymentId);

    // Recompute state
    const state = recomputeLoanState(loan);
    Object.assign(loan, {
      outstandingPrincipal: state.outstandingPrincipal || loan.principalAmount,
      currentEmi: state.currentEmi || loan.emiAmount,
      currentTenureMonths: state.currentTenureMonths || loan.tenureMonths,
      paidEmis: state.paidEmis,
      totalPaidAmount: state.totalPaidAmount,
      totalPrincipalPaid: state.totalPrincipalPaid,
      totalInterestPaid: state.totalInterestPaid,
      totalPrepaid: state.totalPrepaid,
    });

    if (loan.status === 'closed') loan.status = 'active';
    await loan.save();
    res.json(loan);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── Portfolio Summary ───────────────────────────────────────────────────────
exports.getLoanSummary = async (req, res) => {
  try {
    const loans = await Loan.find({ isActive: true, status: 'active' });
    const all = await Loan.find({ isActive: true });

    const totalOutstanding = loans.reduce((s, l) => s + (l.outstandingPrincipal || 0), 0);
    const totalEmi = loans.reduce((s, l) => s + (l.currentEmi || 0), 0);
    const totalBorrowed = all.reduce((s, l) => s + (l.principalAmount || 0), 0);
    const totalInterestPaid = all.reduce((s, l) => s + (l.totalInterestPaid || 0), 0);
    const totalPrepaid = all.reduce((s, l) => s + (l.totalPrepaid || 0), 0);

    const byType = {};
    loans.forEach(l => {
      if (!byType[l.loanType]) byType[l.loanType] = { outstanding: 0, emi: 0, count: 0 };
      byType[l.loanType].outstanding += l.outstandingPrincipal || 0;
      byType[l.loanType].emi += l.currentEmi || 0;
      byType[l.loanType].count++;
    });

    res.json({
      activeCount: loans.length,
      closedCount: all.filter(l => l.status === 'closed').length,
      totalOutstanding,
      totalMonthlyEmi: totalEmi,
      totalBorrowed,
      totalInterestPaid,
      totalPrepaid,
      byType,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── Loan Documents ─────────────────────────────────────────────────────────
exports.addLoanDocument = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ error: 'Not found' });
    loan.documents.push(req.body);
    await loan.save();
    res.json(loan);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.deleteLoanDocument = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ error: 'Not found' });
    loan.documents.pull(req.params.docId);
    await loan.save();
    res.json(loan);
  } catch (err) { res.status(500).json({ error: err.message }); }
};
