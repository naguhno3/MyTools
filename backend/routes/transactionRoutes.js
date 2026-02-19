const r = require('express').Router();
const c = require('../controllers/transactionController');
r.get('/', c.getTransactions);
r.get('/:id', c.getTransaction);
r.post('/', c.createTransaction);
r.put('/:id', c.updateTransaction);
r.delete('/:id', c.deleteTransaction);
module.exports = r;
