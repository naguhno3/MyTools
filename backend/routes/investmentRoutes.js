const r = require('express').Router();
const c = require('../controllers/investmentController');

r.get('/portfolio-summary', c.getPortfolioSummary);
r.get('/export-all', c.getExportData);
r.get('/', c.getInvestments);
r.get('/:id', c.getInvestment);
r.post('/', c.createInvestment);
r.put('/:id', c.updateInvestment);
r.delete('/:id', c.deleteInvestment);
r.post('/:id/price-snapshot', c.addPriceSnapshot);
r.post('/:id/sell', c.sellInvestment);

module.exports = r;
