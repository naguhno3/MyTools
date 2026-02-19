const Account = require('../models/Account');
const Transaction = require('../models/Transaction');

exports.getAccounts = async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.isRetirement !== undefined) {
      filter.isRetirement = req.query.isRetirement === 'true';
    }
    const accounts = await Account.find(filter).sort({ createdAt: 1 });
    res.json(accounts);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getAccount = async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });
    res.json(account);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createAccount = async (req, res) => {
  try {
    // Auto-flag retirement account types
    const retirementTypes = ['pf', 'ppf', 'nps'];
    if (retirementTypes.includes(req.body.type)) {
      req.body.isRetirement = true;
    }
    const account = new Account(req.body);
    await account.save();
    res.status(201).json(account);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.updateAccount = async (req, res) => {
  try {
    const retirementTypes = ['pf', 'ppf', 'nps'];
    if (req.body.type && retirementTypes.includes(req.body.type)) {
      req.body.isRetirement = true;
    }
    const account = await Account.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!account) return res.status(404).json({ error: 'Account not found' });
    res.json(account);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.deleteAccount = async (req, res) => {
  try {
    await Account.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Account deactivated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getAccountTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const id = req.params.id;
    const filter = { $or: [{ account: id }, { toAccount: id }] };
    const total = await Transaction.countDocuments(filter);
    const transactions = await Transaction.find(filter)
      .populate('account', 'name color icon')
      .populate('toAccount', 'name color icon')
      .populate('category', 'name icon color')
      .sort({ date: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit);
    res.json({ transactions, total, page: +page, pages: Math.ceil(total / +limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Summary for retirement account: monthly contributions + interest over time
exports.getRetirementSummary = async (req, res) => {
  try {
    const id = req.params.id;
    const account = await Account.findById(id);
    if (!account) return res.status(404).json({ error: 'Not found' });

    const [contributions, interest, monthly] = await Promise.all([
      Transaction.aggregate([
        { $match: { account: account._id, type: 'contribution' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      Transaction.aggregate([
        { $match: { account: account._id, type: 'interest' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      Transaction.aggregate([
        { $match: { account: account._id, type: { $in: ['contribution', 'interest'] } } },
        {
          $group: {
            _id: { year: { $year: '$date' }, month: { $month: '$date' }, type: '$type' },
            total: { $sum: '$amount' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ])
    ]);

    res.json({
      account,
      totalContributions: contributions[0]?.total || 0,
      totalInterest: interest[0]?.total || 0,
      monthly
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Portfolio-wide retirement trend (all retirement accounts combined)
exports.getRetirementPortfolioTrend = async (req, res) => {
  try {
    const accounts = await Account.find({ isRetirement: true, isActive: true });
    const accountIds = accounts.map(a => a._id);

    const [monthly, totals, employeeVsEmployer] = await Promise.all([
      Transaction.aggregate([
        { $match: { account: { $in: accountIds }, type: { $in: ['contribution', 'interest', 'income'] } } },
        { $group: { _id: { year: { $year: '$date' }, month: { $month: '$date' }, type: '$type' }, total: { $sum: '$amount' } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),
      Transaction.aggregate([
        { $match: { account: { $in: accountIds }, type: { $in: ['contribution', 'interest', 'income'] } } },
        { $lookup: { from: 'accounts', localField: 'account', foreignField: '_id', as: 'acc' } },
        { $unwind: '$acc' },
        { $group: { _id: { accountType: '$acc.type', txType: '$type' }, total: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: { account: { $in: accountIds }, type: 'contribution' } },
        { $group: { _id: null, employee: { $sum: '$contributionBreakdown.employee' }, employer: { $sum: '$contributionBreakdown.employer' } } }
      ])
    ]);

    const monthMap = {};
    monthly.forEach(m => {
      const key = `${m._id.year}-${String(m._id.month).padStart(2, '0')}`;
      if (!monthMap[key]) monthMap[key] = { key, year: m._id.year, month: m._id.month, contribution: 0, interest: 0, income: 0 };
      monthMap[key][m._id.type] = m.total;
    });
    const trend = Object.values(monthMap).sort((a, b) => a.key.localeCompare(b.key));

    const totalInitial = accounts.reduce((s, a) => s + a.initialBalance, 0);
    let running = totalInitial;
    trend.forEach(t => {
      running += t.contribution + t.interest + t.income;
      t.corpus = running;
    });

    const byAccountType = {};
    totals.forEach(t => {
      if (!byAccountType[t._id.accountType]) byAccountType[t._id.accountType] = { contributions: 0, interest: 0, income: 0 };
      const field = t._id.txType === 'contribution' ? 'contributions' : t._id.txType;
      byAccountType[t._id.accountType][field] = t.total;
    });

    res.json({
      accounts,
      trend,
      byAccountType,
      pfBreakdown: employeeVsEmployer[0] || { employee: 0, employer: 0 },
      summary: {
        totalCorpus: accounts.reduce((s, a) => s + a.balance, 0),
        totalInitial,
        pf: accounts.filter(a => a.type === 'pf').reduce((s, a) => s + a.balance, 0),
        ppf: accounts.filter(a => a.type === 'ppf').reduce((s, a) => s + a.balance, 0),
        nps: accounts.filter(a => a.type === 'nps').reduce((s, a) => s + a.balance, 0),
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
