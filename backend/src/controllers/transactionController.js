const prisma = require('../lib/prisma');
const { checkBudgetAndNotify } = require('./notificationController');

const createTransaction = async (req, res) => {
  try {
    const { amount, date, description, categoryId, currency, receiptUrl } = req.body;
    const { userId } = req.user;

    if (amount === undefined || !date || !description || !categoryId) {
      return res.status(400).json({ message: 'Amount, date, description, and categoryId are required' });
    }

    // Amount can be negative for refunds, Prisma Decimal handles strings to avoid precision loss
    console.log('Creating transaction:', { userId, amount, date, description, categoryId });
    const transaction = await prisma.transaction.create({
      data: {
        amount: amount.toString(),
        currency: currency || 'USD',
        date: new Date(date),
        description,
        receiptUrl,
        categoryId: parseInt(categoryId),
        userId,
      },
    });

    // Async notification check — does NOT block the response
    checkBudgetAndNotify(userId, parseInt(categoryId)).catch(console.error);

    return res.status(201).json(transaction);
  } catch (error) {
    console.error('Transaction creation error:', error);
    return res.status(500).json({ message: 'Failed to create transaction', error: error.message });
  }
};

const getTransactions = async (req, res) => {
  try {
    const { userId } = req.user;
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { date: 'desc' },
    });

    return res.json(transactions);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch transactions', error: error.message });
  }
};

const updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, date, description, categoryId, currency, receiptUrl } = req.body;
    const { userId } = req.user;

    const transaction = await prisma.transaction.findFirst({
      where: { id: parseInt(id), userId },
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    const updatedData = {};
    if (amount !== undefined) updatedData.amount = amount.toString();
    if (date) updatedData.date = new Date(date);
    if (description) updatedData.description = description;
    if (categoryId) updatedData.categoryId = parseInt(categoryId);
    if (currency) updatedData.currency = currency;
    if (receiptUrl !== undefined) updatedData.receiptUrl = receiptUrl;

    const updatedTransaction = await prisma.transaction.update({
      where: { id: parseInt(id) },
      data: updatedData,
    });

    return res.json(updatedTransaction);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update transaction', error: error.message });
  }
};

const deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;

    const transaction = await prisma.transaction.findFirst({
      where: { id: parseInt(id), userId },
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    await prisma.transaction.delete({
      where: { id: parseInt(id) },
    });

    return res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete transaction', error: error.message });
  }
};

module.exports = {
  createTransaction,
  getTransactions,
  updateTransaction,
  deleteTransaction,
};
