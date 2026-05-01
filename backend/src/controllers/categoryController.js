const prisma = require('../lib/prisma');

const createCategory = async (req, res) => {
  try {
    const { name, type } = req.body;
    const { userId } = req.user;

    if (!name || !type) {
      return res.status(400).json({ message: 'Name and type are required' });
    }

    const category = await prisma.category.create({
      data: {
        name,
        type, // 'income' or 'expense'
        userId,
      },
    });

    return res.status(201).json(category);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create category', error: error.message });
  }
};

const getCategories = async (req, res) => {
  try {
    const { userId } = req.user;
    const categories = await prisma.category.findMany({
      where: { userId },
    });

    return res.json(categories);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch categories', error: error.message });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type } = req.body;
    const { userId } = req.user;

    const category = await prisma.category.findFirst({
      where: { id: parseInt(id), userId },
    });

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const updatedCategory = await prisma.category.update({
      where: { id: parseInt(id) },
      data: { name, type },
    });

    return res.json(updatedCategory);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update category', error: error.message });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;

    const category = await prisma.category.findFirst({
      where: { id: parseInt(id), userId },
      include: {
        _count: {
          select: { transactions: true }
        }
      }
    });

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Check for existing transactions to handle the edge case as proposed
    if (category._count.transactions > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete category with existing transactions. Please reassign or delete the transactions first.' 
      });
    }

    await prisma.category.delete({
      where: { id: parseInt(id) },
    });

    return res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete category', error: error.message });
  }
};

module.exports = {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
};
