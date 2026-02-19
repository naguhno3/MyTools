# 💸 FinFlow — Personal Finance Tracker

A full-stack MERN application for comprehensive personal finance management. Track income and expenses, manage bank accounts, set monthly budgets, and transfer money between accounts — all with a clean, modern UI.

---

## ✨ Features

### 🏦 Account Management
- **7 account types**: Savings, Checking, Credit Card, Cash, Investment, Wallet, Other
- Add opening balances, bank name, last 4 digits
- Color-coded accounts for visual tracking
- Net worth calculation across all accounts
- Balance auto-updates on every transaction

### ↕ Transactions
- Record **income**, **expenses**, and **transfers**
- **23 built-in categories** auto-seeded (15 expense + 8 income)
- Tag transactions for detailed tracking
- Filter by: type, account, category, search term
- Quick stats: total shown income/expense/net
- Date range filtering

### ◎ Budget Tracker
- Create monthly budgets per calendar month
- Add category-wise budget targets
- Real-time spending tracked against budget
- **Progress bars** with color warnings:
  - 🟦 Blue: On track
  - 🟡 Amber warning at 80%
  - 🔴 Red "OVER BUDGET" alert
- Overall budget utilization summary

### ⇄ Fund Transfer
- Dedicated transfer UI with account previews
- Shows balance before and after transfer
- Warns on insufficient funds
- Recent transfers history
- All transfers logged as transactions

### 📊 Dashboard
- Total portfolio balance
- This month's income, expenses, savings
- Month-over-month % change comparisons
- 6-month income vs expense bar chart
- Top spending categories (donut chart + breakdown)
- Account balances at a glance
- Recent 8 transactions feed

---

## 🏗 Tech Stack

**Backend**: Node.js · Express · MongoDB · Mongoose  
**Frontend**: React 18 · React Router v6 · Recharts · DM Sans + Syne + DM Mono fonts  
**Design**: Clean modern light theme · Deep navy sidebar · Blue accent system  

---

## 🚀 Quick Start

### Docker (Recommended)
```bash
docker-compose up -d
open http://localhost:3000
```

### Manual Setup
```bash
# 1. Start MongoDB locally

# 2. Backend
cd backend
cp .env.example .env
npm install
npm run dev     # → http://localhost:5000

# 3. Frontend
cd frontend
npm install
npm start       # → http://localhost:3000
```

On first startup, **23 default categories** are automatically seeded.

---

## 📡 API Reference

| Resource | Endpoint | Methods |
|---|---|---|
| Accounts | `/api/accounts` | GET, POST, PUT, DELETE |
| Transactions | `/api/transactions` | GET, POST, PUT, DELETE |
| Categories | `/api/categories` | GET, POST, PUT, DELETE |
| Budgets | `/api/budgets` | GET, POST, DELETE |
| Budget Items | `/api/budgets/:id/items` | POST, PUT, DELETE |
| Dashboard | `/api/dashboard` | GET |

---

## 🗂 Project Structure

```
finflow/
├── backend/
│   ├── models/     Account, Transaction, Category, Budget, BudgetItem
│   ├── controllers/ accountController, transactionController, budgetController, categoryController, dashboardController
│   ├── routes/
│   └── server.js   (auto-seeds 23 categories on startup)
│
├── frontend/src/
│   ├── pages/
│   │   ├── Dashboard.js    ← Portfolio overview + charts
│   │   ├── Accounts.js     ← Account CRUD
│   │   ├── Transactions.js ← Transaction list + filters + add
│   │   ├── Budget.js       ← Monthly budget with progress tracking
│   │   └── Transfer.js     ← Fund transfer between accounts
│   └── utils/
│       ├── api.js
│       └── helpers.js
│
└── docker-compose.yml
```

---

## 💡 Key Design Decisions

- **Auto-balance updates**: Transactions automatically update account balances via Mongoose post-hooks
- **Transfer reversal**: Deleting a transfer restores both account balances correctly
- **Budget tracking**: Budget spending is calculated live from actual transactions in that category/month
- **Category seeding**: 23 default categories are created once on first server start

# Docker (easiest)
docker-compose up -d
# → open http://localhost:3000

# Manual
cd backend && npm install && npm run dev   # :5000
cd frontend && npm install && npm start   # :3000