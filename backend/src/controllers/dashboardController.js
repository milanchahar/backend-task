const prisma = require('../lib/prisma');

const getDashboardSummary = async (req, res) => {
  try {
    const { userId } = req.user;

    // We can filter by the current month for a dashboard summary
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: startOfMonth }
      },
      include: { category: true }
    });

    let totalIncome = 0;
    let totalExpense = 0;

    const expenseByCategory = {};

    transactions.forEach(tx => {
      const amount = parseFloat(tx.amount);
      if (tx.category.type === 'income') {
        totalIncome += amount;
      } else if (tx.category.type === 'expense') {
        totalExpense += amount;
        
        // Group for graphical representation
        if (!expenseByCategory[tx.category.name]) {
          expenseByCategory[tx.category.name] = 0;
        }
        expenseByCategory[tx.category.name] += amount;
      }
    });

    const savings = totalIncome - totalExpense;

    return res.json({
      totalIncome,
      totalExpense,
      savings,
      expenseByCategory,
      recentTransactions: transactions.slice(0, 5) // Last 5 transactions
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch dashboard summary', error: error.message });
  }
};

const getReports = async (req, res) => {
  try {
    const { userId } = req.user;
    const { year } = req.query;

    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    const startDate = new Date(targetYear, 0, 1);
    const endDate = new Date(targetYear + 1, 0, 1);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lt: endDate,
        }
      },
      include: { category: true }
    });

    // Initialize 12 months data
    const monthlyReport = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      income: 0,
      expense: 0,
    }));

    transactions.forEach(tx => {
      const monthIndex = tx.date.getMonth(); // 0-11
      const amount = parseFloat(tx.amount);
      
      if (tx.category.type === 'income') {
        monthlyReport[monthIndex].income += amount;
      } else if (tx.category.type === 'expense') {
        monthlyReport[monthIndex].expense += amount;
      }
    });

    return res.json({
      year: targetYear,
      monthlyReport
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to generate reports', error: error.message });
  }
};

module.exports = {
  getDashboardSummary,
  getReports,
};
