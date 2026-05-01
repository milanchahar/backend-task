const prisma = require('../lib/prisma');

const setBudget = async (req, res) => {
  try {
    const { categoryId, limitAmount, month } = req.body;
    const { userId } = req.user;

    if (!categoryId || limitAmount === undefined || !month) {
      return res.status(400).json({ message: 'categoryId, limitAmount, and month are required' });
    }

    // Check if budget already exists for this category and month
    const existingBudget = await prisma.budget.findFirst({
      where: { categoryId: parseInt(categoryId), month: parseInt(month), userId },
    });

    let budget;
    if (existingBudget) {
      budget = await prisma.budget.update({
        where: { id: existingBudget.id },
        data: { limitAmount: limitAmount.toString() },
      });
    } else {
      budget = await prisma.budget.create({
        data: {
          categoryId: parseInt(categoryId),
          limitAmount: limitAmount.toString(),
          month: parseInt(month),
          userId,
        },
      });
    }

    return res.status(200).json(budget);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to set budget', error: error.message });
  }
};

const getBudgets = async (req, res) => {
  try {
    const { userId } = req.user;
    const { month, year } = req.query; // Optional filters

    const whereClause = { userId };
    if (month) whereClause.month = parseInt(month);

    const budgets = await prisma.budget.findMany({
      where: whereClause,
      include: { category: true },
    });

    // Calculate progress for each budget
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    
    const budgetsWithProgress = await Promise.all(
      budgets.map(async (budget) => {
        // Find transactions for this category in this month/year
        // Note: JavaScript getMonth() is 0-indexed, but usually we store month as 1-12.
        const startDate = new Date(targetYear, budget.month - 1, 1);
        const endDate = new Date(targetYear, budget.month, 1);

        const transactions = await prisma.transaction.findMany({
          where: {
            categoryId: budget.categoryId,
            userId,
            date: {
              gte: startDate,
              lt: endDate,
            },
          },
        });

        // Sum amounts
        const totalSpent = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
        
        return {
          ...budget,
          spent: totalSpent,
          remaining: parseFloat(budget.limitAmount) - totalSpent,
        };
      })
    );

    return res.json(budgetsWithProgress);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch budgets', error: error.message });
  }
};

const deleteBudget = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;

    const budget = await prisma.budget.findFirst({
      where: { id: parseInt(id), userId },
    });

    if (!budget) {
      return res.status(404).json({ message: 'Budget not found' });
    }

    await prisma.budget.delete({
      where: { id: parseInt(id) },
    });

    return res.json({ message: 'Budget deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete budget', error: error.message });
  }
};

module.exports = {
  setBudget,
  getBudgets,
  deleteBudget,
};
