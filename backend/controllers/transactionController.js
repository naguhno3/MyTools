const Transaction = require('../models/Transaction');
const Account = require('../models/Account');

exports.getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 30, type, accountId, categoryId, from, to, search } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (accountId) filter.$or = [{ account: accountId }, { toAccount: accountId }];
    if (categoryId) filter.category = categoryId;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }
    if (search) filter.description = { $regex: search, $options: 'i' };

    const total = await Transaction.countDocuments(filter);
    const transactions = await Transaction.find(filter)
      .populate('account', 'name color icon type isRetirement')
      .populate('toAccount', 'name color icon type isRetirement')
      .populate('category', 'name icon color')
      .sort({ date: -1, createdAt: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit);

    res.json({ transactions, total, page: +page, pages: Math.ceil(total / +limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getTransaction = async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id)
      .populate('account')
      .populate('toAccount')
      .populate('category');
    if (!tx) return res.status(404).json({ error: 'Not found' });
    res.json(tx);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createTransaction = async (req, res) => {
  try {
    // Validate: expense cannot target a retirement account
    if (req.body.type === 'expense' && req.body.account) {
      const acc = await Account.findById(req.body.account);
      if (acc && acc.isRetirement) {
        return res.status(400).json({ error: 'Retirement accounts (PF/PPF/NPS) cannot be used for expenses.' });
      }
    }
    // Validate: contribution/interest must target a retirement account
    if (['contribution', 'interest'].includes(req.body.type) && req.body.account) {
      const acc = await Account.findById(req.body.account);
      if (acc && !acc.isRetirement) {
        return res.status(400).json({ error: 'Contributions and interest can only be added to retirement accounts.' });
      }
    }

    const tx = new Transaction(req.body);
    await tx.save();
    const populated = await Transaction.findById(tx._id)
      .populate('account', 'name color icon isRetirement')
      .populate('toAccount', 'name color icon')
      .populate('category', 'name icon color');
    res.status(201).json(populated);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.updateTransaction = async (req, res) => {
  try {
    const old = await Transaction.findById(req.params.id);
    if (!old) return res.status(404).json({ error: 'Not found' });

    // Reverse old effect
    if (['income', 'contribution', 'interest'].includes(old.type)) {
      await Account.findByIdAndUpdate(old.account, { $inc: { balance: -old.amount } });
    } else if (old.type === 'expense') {
      await Account.findByIdAndUpdate(old.account, { $inc: { balance: old.amount } });
    } else if (old.type === 'transfer') {
      await Account.findByIdAndUpdate(old.account, { $inc: { balance: old.amount } });
      await Account.findByIdAndUpdate(old.toAccount, { $inc: { balance: -old.amount } });
    }

    const updated = await Transaction.findByIdAndUpdate(req.params.id, req.body, { new: true });

    // Apply new effect
    if (['income', 'contribution', 'interest'].includes(updated.type)) {
      await Account.findByIdAndUpdate(updated.account, { $inc: { balance: updated.amount } });
    } else if (updated.type === 'expense') {
      await Account.findByIdAndUpdate(updated.account, { $inc: { balance: -updated.amount } });
    } else if (updated.type === 'transfer') {
      await Account.findByIdAndUpdate(updated.account, { $inc: { balance: -updated.amount } });
      await Account.findByIdAndUpdate(updated.toAccount, { $inc: { balance: updated.amount } });
    }

    const populated = await Transaction.findById(updated._id)
      .populate('account', 'name color icon isRetirement')
      .populate('toAccount', 'name color icon')
      .populate('category', 'name icon color');
    res.json(populated);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.deleteTransaction = async (req, res) => {
  try {
    await Transaction.findOneAndDelete({ _id: req.params.id });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
