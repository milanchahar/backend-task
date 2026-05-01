const nodemailer = require('nodemailer');
const prisma = require('../lib/prisma');

// Use Ethereal for testing, or standard SMTP
let transporter;

const setupTransporter = async () => {
  if (transporter) return transporter;
  
  // Create a test account if you don't have real credentials
  // For production, use process.env.SMTP_HOST etc.
  const testAccount = await nodemailer.createTestAccount();
  
  transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false, 
    auth: {
      user: testAccount.user, 
      pass: testAccount.pass, 
    },
  });
  
  return transporter;
};

const checkBudgetAndNotify = async (userId, categoryId) => {
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();
    
    const budget = await prisma.budget.findFirst({
      where: {
        userId,
        categoryId,
        month: currentMonth
      },
      include: { category: true, user: true }
    });

    if (!budget) return; // No budget set for this category/month

    // Calculate total spent in this month
    const startDate = new Date(currentYear, now.getMonth(), 1);
    const endDate = new Date(currentYear, now.getMonth() + 1, 1);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        categoryId,
        date: {
          gte: startDate,
          lt: endDate
        }
      }
    });

    const totalSpent = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    const limit = parseFloat(budget.limitAmount);

    if (totalSpent > limit) {
      // Send notification
      const mailer = await setupTransporter();
      
      const info = await mailer.sendMail({
        from: '"Personal Finance Tracker" <noreply@finance-tracker.com>',
        to: budget.user.email,
        subject: `Budget Overrun Alert: ${budget.category.name}`,
        text: `You have exceeded your budget for ${budget.category.name} in month ${currentMonth}.\nLimit: $${limit}\nSpent: $${totalSpent}`,
        html: `<b>You have exceeded your budget for ${budget.category.name} in month ${currentMonth}.</b><br>Limit: $${limit}<br>Spent: $${totalSpent}`
      });

      console.log("Message sent: %s", info.messageId);
      console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    }
  } catch (error) {
    console.error("Failed to check budget and notify:", error);
  }
};

module.exports = {
  checkBudgetAndNotify
};
