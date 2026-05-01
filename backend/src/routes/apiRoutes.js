const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const categoryController = require('../controllers/categoryController');
const transactionController = require('../controllers/transactionController');
const budgetController = require('../controllers/budgetController');
const dashboardController = require('../controllers/dashboardController');

const router = express.Router();

// All routes below require authentication
router.use(authenticateToken);

// Categories
router.post('/categories', categoryController.createCategory);
router.get('/categories', categoryController.getCategories);
router.put('/categories/:id', categoryController.updateCategory);
router.delete('/categories/:id', categoryController.deleteCategory);

// Transactions
router.post('/transactions', transactionController.createTransaction);
router.get('/transactions', transactionController.getTransactions);
router.put('/transactions/:id', transactionController.updateTransaction);
router.delete('/transactions/:id', transactionController.deleteTransaction);

// Budgets
router.post('/budgets', budgetController.setBudget);
router.get('/budgets', budgetController.getBudgets);
router.delete('/budgets/:id', budgetController.deleteBudget);

// Dashboard & Reports
router.get('/dashboard', dashboardController.getDashboardSummary);
router.get('/reports', dashboardController.getReports);

// Uploads
const uploadController = require('../controllers/uploadController');
router.post('/upload', uploadController.upload.single('receipt'), uploadController.uploadReceipt);

// AI Insights (Part B)
const aiController = require('../controllers/aiController');
router.get('/ai/insights', aiController.getFinancialInsights);
router.get('/ai/anomalies', aiController.detectAnomalies);

// Bank Statement CSV Import (Part B)
const importController = require('../controllers/importController');
router.post('/import/csv', importController.upload.single('statement'), importController.importCSV);

module.exports = router;
