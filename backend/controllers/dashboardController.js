const Account = require('../models/Account');
const Transaction = require('../models/Transaction');

exports.getDashboard = async (req, res) => {
  try {
    const now = new Date();
    const thisMonth = { $gte: new Date(now.getFullYear(), now.getMonth(), 1), $lte: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) };
    const lastMonth = { $gte: new Date(now.getFullYear(), now.getMonth() - 1, 1), $lte: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59) };

    const [
      allAccounts,
      thisMonthIncome, thisMonthExpense,
      lastMonthIncome, lastMonthExpense,
      recentTransactions, categoryBreakdown, monthlyTrend,
      retirementMonthly, totalContributions, totalInterest
    ] = await Promise.all([
      Account.find({ isActive: true }),

      Transaction.aggregate([{ $match: { type: 'income', date: thisMonth } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Transaction.aggregate([{ $match: { type: 'expense', date: thisMonth } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Transaction.aggregate([{ $match: { type: 'income', date: lastMonth } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Transaction.aggregate([{ $match: { type: 'expense', date: lastMonth } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),

      Transaction.find({ type: { $in: ['income', 'expense', 'transfer', 'contribution', 'interest'] } })
        .populate('account', 'name color icon isRetirement type')
        .populate('toAccount', 'name color icon')
        .populate('category', 'name icon color')
        .sort({ date: -1 }).limit(8),

      Transaction.aggregate([
        { $match: { type: 'expense', date: thisMonth } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } }, { $limit: 8 },
        { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'cat' } },
        { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } }
      ]),

      // Last 6 months income/expense trend (non-retirement)
      Transaction.aggregate([
        {
          $match: {
            type: { $in: ['income', 'expense'] },
            date: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) }
          }
        },
        { $group: { _id: { year: { $year: '$date' }, month: { $month: '$date' }, type: '$type' }, total: { $sum: '$amount' } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),

      // Retirement monthly contributions + interest (last 12 months)
      Transaction.aggregate([
        {
          $match: {
            type: { $in: ['contribution', 'interest'] },
            date: { $gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) }
          }
        },
        { $group: { _id: { year: { $year: '$date' }, month: { $month: '$date' }, type: '$type' }, total: { $sum: '$amount' } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),

      Transaction.aggregate([{ $match: { type: 'contribution' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Transaction.aggregate([{ $match: { type: 'interest' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    ]);

    const regularAccounts = allAccounts.filter(a => !a.isRetirement);
    const retirementAccounts = allAccounts.filter(a => a.isRetirement);

    const totalBalance = regularAccounts.reduce((s, a) => s + a.balance, 0);
    const retirementBalance = retirementAccounts.reduce((s, a) => s + a.balance, 0);

    const tmi = thisMonthIncome[0]?.total || 0;
    const tme = thisMonthExpense[0]?.total || 0;
    const lmi = lastMonthIncome[0]?.total || 0;
    const lme = lastMonthExpense[0]?.total || 0;

    // Monthly trend for income/expense
    const monthMap = {};
    monthlyTrend.forEach(m => {
      const key = `${m._id.year}-${String(m._id.month).padStart(2, '0')}`;
      if (!monthMap[key]) monthMap[key] = { month: key, income: 0, expense: 0 };
      monthMap[key][m._id.type] = m.total;
    });
    const trend = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));

    // Retirement monthly trend
    const retMap = {};
    retirementMonthly.forEach(m => {
      const key = `${m._id.year}-${String(m._id.month).padStart(2, '0')}`;
      if (!retMap[key]) retMap[key] = { month: key, contribution: 0, interest: 0 };
      retMap[key][m._id.type] = m.total;
    });

    // Build cumulative balance growth for retirement accounts
    const retTrend = Object.values(retMap).sort((a, b) => a.month.localeCompare(b.month));

    res.json({
      totalBalance,
      retirementBalance,
      accounts: regularAccounts,
      retirementAccounts,
      thisMonth: { income: tmi, expense: tme, savings: tmi - tme },
      lastMonth: { income: lmi, expense: lme, savings: lmi - lme },
      incomeChange: lmi > 0 ? ((tmi - lmi) / lmi * 100).toFixed(1) : 0,
      expenseChange: lme > 0 ? ((tme - lme) / lme * 100).toFixed(1) : 0,
      recentTransactions,
      categoryBreakdown: categoryBreakdown.map(c => ({
        name: c.cat?.name || 'Uncategorized',
        icon: c.cat?.icon || '📦',
        color: c.cat?.color || '#6b7280',
        amount: c.total
      })),
      trend,
      retirement: {
        totalContributions: totalContributions[0]?.total || 0,
        totalInterest: totalInterest[0]?.total || 0,
        trend: retTrend
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
