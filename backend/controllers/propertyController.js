const Property = require('../models/Property');

// ── Properties ─────────────────────────────────────────────────────────────
exports.getProperties = async (req, res) => {
  try {
    const { status, type } = req.query;
    const filter = { isActive: true };
    if (status) filter.status = status;
    if (type) filter.type = type;
    const props = await Property.find(filter).sort({ createdAt: -1 });
    res.json(props);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getProperty = async (req, res) => {
  try {
    const p = await Property.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json(p);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createProperty = async (req, res) => {
  try {
    const p = new Property(req.body);
    await p.save();
    res.status(201).json(p);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.updateProperty = async (req, res) => {
  try {
    const p = await Property.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json(p);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.deleteProperty = async (req, res) => {
  try {
    await Property.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Property removed' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── Tenant ─────────────────────────────────────────────────────────────────
exports.upsertTenant = async (req, res) => {
  try {
    const p = await Property.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    p.tenant = req.body;
    p.status = req.body.isActive !== false ? 'rented' : p.status;
    await p.save();
    res.json(p);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.removeTenant = async (req, res) => {
  try {
    const p = await Property.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    p.tenant = undefined;
    if (p.status === 'rented') p.status = 'vacant';
    await p.save();
    res.json(p);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── Contacts ───────────────────────────────────────────────────────────────
exports.addContact = async (req, res) => {
  try {
    const p = await Property.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    p.contacts.push(req.body);
    await p.save();
    res.json(p);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.updateContact = async (req, res) => {
  try {
    const p = await Property.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    const contact = p.contacts.id(req.params.contactId);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    Object.assign(contact, req.body);
    await p.save();
    res.json(p);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.deleteContact = async (req, res) => {
  try {
    const p = await Property.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    p.contacts.pull(req.params.contactId);
    await p.save();
    res.json(p);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── Documents ──────────────────────────────────────────────────────────────
exports.addDocument = async (req, res) => {
  try {
    const p = await Property.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    p.documents.push(req.body);
    await p.save();
    res.json(p);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.updateDocument = async (req, res) => {
  try {
    const p = await Property.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    const doc = p.documents.id(req.params.docId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    Object.assign(doc, req.body);
    await p.save();
    res.json(p);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.deleteDocument = async (req, res) => {
  try {
    const p = await Property.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    p.documents.pull(req.params.docId);
    await p.save();
    res.json(p);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── Property Transactions ──────────────────────────────────────────────────
exports.addTransaction = async (req, res) => {
  try {
    const p = await Property.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    p.transactions.push(req.body);
    await p.save();
    res.json(p);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.deleteTransaction = async (req, res) => {
  try {
    const p = await Property.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    p.transactions.pull(req.params.txId);
    await p.save();
    res.json(p);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── Summary ────────────────────────────────────────────────────────────────
exports.getPortfolioSummary = async (req, res) => {
  try {
    const props = await Property.find({ isActive: true });
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const totalCurrentValue = props.reduce((s, p) => s + (p.currentValue || 0), 0);
    const totalPurchasePrice = props.reduce((s, p) => s + (p.purchasePrice || 0), 0);
    const totalMonthlyRent = props.filter(p => p.status === 'rented').reduce((s, p) => s + (p.tenant?.monthlyRent || 0), 0);

    const yearIncome = props.reduce((s, p) =>
      s + p.transactions.filter(t => t.type === 'income' && new Date(t.date) >= yearStart).reduce((a, t) => a + t.amount, 0), 0);
    const yearExpenses = props.reduce((s, p) =>
      s + p.transactions.filter(t => t.type === 'expense' && new Date(t.date) >= yearStart).reduce((a, t) => a + t.amount, 0), 0);

    res.json({
      count: props.length,
      rented: props.filter(p => p.status === 'rented').length,
      selfOccupied: props.filter(p => p.status === 'self_occupied').length,
      vacant: props.filter(p => p.status === 'vacant').length,
      totalCurrentValue,
      totalPurchasePrice,
      totalAppreciation: totalCurrentValue - totalPurchasePrice,
      totalMonthlyRent,
      yearIncome,
      yearExpenses,
      netYield: yearIncome - yearExpenses,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
