const r = require('express').Router();
const c = require('../controllers/loanController');

r.get('/summary', c.getLoanSummary);
r.post('/calculate-emi', c.calculateEmi);
r.get('/', c.getLoans);
r.get('/:id', c.getLoan);
r.post('/', c.createLoan);
r.put('/:id', c.updateLoan);
r.delete('/:id', c.deleteLoan);

// Amortization
r.get('/:id/amortization', c.getAmortization);

// Payments
r.post('/:id/payments', c.addPayment);
r.delete('/:id/payments/:paymentId', c.deletePayment);

module.exports = r;
