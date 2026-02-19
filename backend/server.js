const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/accounts', require('./routes/accountRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/budgets', require('./routes/budgetRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/investments', require('./routes/investmentRoutes'));
app.use('/api/properties', require('./routes/propertyRoutes'));
app.use('/api/loans', require('./routes/loanRoutes'));

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/finflow';
mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB connected');
    const { seedCategories } = require('./controllers/categoryController');
    await seedCategories();
    const PORT = process.env.PORT || 5018;
    app.listen(PORT, () => console.log(`💰 FinFlow API on port ${PORT}`));
  })
  .catch(err => { console.error(err.message); process.exit(1); });
