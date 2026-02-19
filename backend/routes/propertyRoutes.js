const r = require('express').Router();
const c = require('../controllers/propertyController');

r.get('/summary', c.getPortfolioSummary);
r.get('/', c.getProperties);
r.get('/:id', c.getProperty);
r.post('/', c.createProperty);
r.put('/:id', c.updateProperty);
r.delete('/:id', c.deleteProperty);

// Tenant
r.put('/:id/tenant', c.upsertTenant);
r.delete('/:id/tenant', c.removeTenant);

// Contacts
r.post('/:id/contacts', c.addContact);
r.put('/:id/contacts/:contactId', c.updateContact);
r.delete('/:id/contacts/:contactId', c.deleteContact);

// Documents
r.post('/:id/documents', c.addDocument);
r.put('/:id/documents/:docId', c.updateDocument);
r.delete('/:id/documents/:docId', c.deleteDocument);

// Transactions
r.post('/:id/transactions', c.addTransaction);
r.delete('/:id/transactions/:txId', c.deleteTransaction);

module.exports = r;
