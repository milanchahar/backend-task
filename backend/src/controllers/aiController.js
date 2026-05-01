const OpenAI = require('openai');
const prisma = require('../lib/prisma');

const getFinancialInsights = async (req, res) => {
  try {
    const { userId } = req.user;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ message: 'OpenAI API key not configured' });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Get last 3 months of transactions for context
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const transactions = await prisma.transaction.findMany({
      where: { userId, date: { gte: threeMonthsAgo } },
      include: { category: true },
      orderBy: { date: 'desc' },
      take: 100, // Cap to avoid huge prompts
    });

    if (transactions.length === 0) {
      return res.status(400).json({ message: 'Not enough transaction data to generate insights' });
    }

    // Build a summary string for the prompt
    const summary = transactions
      .map(tx => `${tx.date.toISOString().split('T')[0]}: [${tx.category.type}/${tx.category.name}] ${tx.description} - ${tx.currency} ${tx.amount}`)
      .join('\n');

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a personal finance advisor. Analyze the user\'s transaction history and provide concise, actionable insights. Look for spending patterns, anomalies, and budget improvement tips. Keep it to 3-5 bullet points.',
        },
        {
          role: 'user',
          content: `Here are my recent transactions:\n\n${summary}\n\nPlease analyze my spending habits and give me financial insights.`,
        },
      ],
    });

    const insights = completion.choices[0].message.content;

    return res.json({ insights });
  } catch (error) {
    console.error('OpenAI error:', error);
    return res.status(500).json({ message: 'Failed to generate insights', error: error.message });
  }
};

const detectAnomalies = async (req, res) => {
  try {
    const { userId } = req.user;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ message: 'OpenAI API key not configured' });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const transactions = await prisma.transaction.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { date: 'desc' },
      take: 50,
    });

    if (transactions.length < 5) {
      return res.status(400).json({ message: 'Not enough data for anomaly detection' });
    }

    const summary = transactions
      .map(tx => `${tx.date.toISOString().split('T')[0]}: [${tx.category.name}] ${tx.description} - ${tx.currency} ${tx.amount}`)
      .join('\n');

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a financial fraud and anomaly detection expert. Identify unusual or suspicious transactions from the list, such as unusually large amounts, duplicate transactions, or out-of-pattern spending. Reply in JSON format: { "anomalies": [{ "date": "...", "description": "...", "reason": "..." }] }',
        },
        {
          role: 'user',
          content: `Analyze these transactions for anomalies:\n\n${summary}`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(completion.choices[0].message.content);
    return res.json(result);
  } catch (error) {
    console.error('OpenAI error:', error);
    return res.status(500).json({ message: 'Failed to detect anomalies', error: error.message });
  }
};

module.exports = {
  getFinancialInsights,
  detectAnomalies,
};
