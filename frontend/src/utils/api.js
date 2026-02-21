import axios from 'axios';

const API = axios.create({ baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5018/api' });

export const getAccounts = (params) => API.get('/accounts', { params });
export const getAccount = (id) => API.get(`/accounts/${id}`);
export const createAccount = (d) => API.post('/accounts', d);
export const updateAccount = (id, d) => API.put(`/accounts/${id}`, d);
export const deleteAccount = (id) => API.delete(`/accounts/${id}`);
export const getAccountTransactions = (id, params) => API.get(`/accounts/${id}/transactions`, { params });
export const getRetirementSummary = (id) => API.get(`/accounts/${id}/retirement-summary`);

export const getTransactions = (params) => API.get('/transactions', { params });
export const createTransaction = (d) => API.post('/transactions', d);
export const updateTransaction = (id, d) => API.put(`/transactions/${id}`, d);
export const deleteTransaction = (id) => API.delete(`/transactions/${id}`);

export const getCategories = (params) => API.get('/categories', { params });
export const createCategory = (d) => API.post('/categories', d);
export const deleteCategory = (id) => API.delete(`/categories/${id}`);

export const getBudgets = () => API.get('/budgets');
export const getBudget = (id) => API.get(`/budgets/${id}`);
export const getBudgetByMonth = (m, y) => API.get(`/budgets/month/${m}/${y}`);
export const createBudget = (d) => API.post('/budgets', d);
export const deleteBudget = (id) => API.delete(`/budgets/${id}`);
export const createBudgetItem = (budgetId, d) => API.post(`/budgets/${budgetId}/items`, d);
export const updateBudgetItem = (budgetId, itemId, d) => API.put(`/budgets/${budgetId}/items/${itemId}`, d);
export const deleteBudgetItem = (budgetId, itemId) => API.delete(`/budgets/${budgetId}/items/${itemId}`);

export const getDashboard = () => API.get('/dashboard');

// Investments
export const getInvestments = (params) => API.get('/investments', { params });
export const getInvestment = (id) => API.get(`/investments/${id}`);
export const createInvestment = (d) => API.post('/investments', d);
export const updateInvestment = (id, d) => API.put(`/investments/${id}`, d);
export const deleteInvestment = (id) => API.delete(`/investments/${id}`);
export const addPriceSnapshot = (id, d) => API.post(`/investments/${id}/price-snapshot`, d);
export const sellInvestment = (id, d) => API.post(`/investments/${id}/sell`, d);
export const getPortfolioSummary = () => API.get('/investments/portfolio-summary');
export const getExportData = () => API.get('/investments/export-all');

export default API;
export const getRetirementPortfolioTrend = () => API.get('/accounts/retirement-portfolio-trend');

// Properties
export const getProperties = (p) => API.get('/properties', { params: p });
export const getProperty = (id) => API.get(`/properties/${id}`);
export const createProperty = (d) => API.post('/properties', d);
export const updateProperty = (id, d) => API.put(`/properties/${id}`, d);
export const deleteProperty = (id) => API.delete(`/properties/${id}`);
export const getPropertySummary = () => API.get('/properties/summary');
export const upsertTenant = (id, d) => API.put(`/properties/${id}/tenant`, d);
export const removeTenant = (id) => API.delete(`/properties/${id}/tenant`);
export const addContact = (id, d) => API.post(`/properties/${id}/contacts`, d);
export const updateContact = (id, cid, d) => API.put(`/properties/${id}/contacts/${cid}`, d);
export const deleteContact = (id, cid) => API.delete(`/properties/${id}/contacts/${cid}`);
export const addDocument = (id, d) => API.post(`/properties/${id}/documents`, d);
export const updateDocument = (id, did, d) => API.put(`/properties/${id}/documents/${did}`, d);
export const deleteDocument = (id, did) => API.delete(`/properties/${id}/documents/${did}`);
export const addPropertyTx = (id, d) => API.post(`/properties/${id}/transactions`, d);
export const deletePropertyTx = (id, tid) => API.delete(`/properties/${id}/transactions/${tid}`);

// Loans
export const getLoans = (p) => API.get('/loans', { params: p });
export const getLoan = (id) => API.get(`/loans/${id}`);
export const createLoan = (d) => API.post('/loans', d);
export const updateLoan = (id, d) => API.put(`/loans/${id}`, d);
export const deleteLoan = (id) => API.delete(`/loans/${id}`);
export const getLoanSummary = () => API.get('/loans/summary');
export const getAmortization = (id) => API.get(`/loans/${id}/amortization`);
export const calculateEmi = (d) => API.post('/loans/calculate-emi', d);
export const addLoanPayment = (id, d) => API.post(`/loans/${id}/payments`, d);
export const deleteLoanPayment = (id, pid) => API.delete(`/loans/${id}/payments/${pid}`);

// ── Document Vault ──────────────────────────────────────────────────────────
// Upload uses FormData (multipart), all others use JSON
export const uploadDocument = (formData) =>
  API.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const listDocuments = (params) => API.get('/documents', { params });
export const getDocumentMeta = (id) => API.get(`/documents/${id}`);
export const updateDocumentMeta = (id, d) => API.put(`/documents/${id}`, d);
export const deleteVaultDocument = (id) => API.delete(`/documents/${id}`);
export const getDocumentStats = () => API.get('/documents/stats');
export const addDocumentLink = (id, d) => API.post(`/documents/${id}/link`, d);
export const removeDocumentLink = (id, d) => API.delete(`/documents/${id}/link`, { data: d });

// Download returns a blob — caller handles save
export const getDocumentDownloadUrl = (id) =>
  `${process.env.REACT_APP_API_URL || 'http://localhost:5018/api'}/documents/${id}/download`;

// Loan documents
export const addLoanDoc = (id, d) => API.post(`/loans/${id}/documents`, d);
export const deleteLoanDoc = (id, did) => API.delete(`/loans/${id}/documents/${did}`);
