const multer = require('multer');
const { parse } = require('csv-parse');
const prisma = require('../lib/prisma');
const crypto = require('crypto');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Generate a fingerprint for duplicate detection
const generateFingerprint = (row) => {
  const key = `${row.date}-${row.amount}-${row.description}`.toLowerCase().trim();
  return crypto.createHash('md5').update(key).digest('hex');
};

// Guess category from description keywords
const autoCategorize = (description = '') => {
  const desc = description.toLowerCase();
  if (/salary|paycheck|income|payment received/i.test(desc)) return 'Salary';
  if (/grocery|supermarket|food|mart|fresh/i.test(desc)) return 'Groceries';
  if (/uber|lyft|taxi|cab|transport|metro|bus|train/i.test(desc)) return 'Transport';
  if (/netflix|spotify|amazon prime|hbo|disney|subscription/i.test(desc)) return 'Subscriptions';
  if (/restaurant|cafe|dining|pizza|burger|swiggy|zomato/i.test(desc)) return 'Dining';
  if (/electricity|water|gas|internet|bill|utility/i.test(desc)) return 'Utilities';
  if (/rent|mortgage|lease/i.test(desc)) return 'Rent';
  if (/hospital|clinic|pharmacy|medicine|health/i.test(desc)) return 'Healthcare';
  return 'General';
};

const importCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No CSV file uploaded' });
    }

    const { userId } = req.user;
    const csvData = req.file.buffer.toString('utf8');

    const records = await new Promise((resolve, reject) => {
      parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }, (err, records) => {
        if (err) reject(err);
        else resolve(records);
      });
    });

    // Normalize columns — handle different CSV formats
    const normalizedRecords = records.map(row => {
      const keys = Object.keys(row).map(k => k.toLowerCase());
      const getVal = (aliases) => {
        for (const alias of aliases) {
          const key = keys.find(k => k.includes(alias));
          if (key) return row[Object.keys(row)[keys.indexOf(key)]];
        }
        return null;
      };

      return {
        date: getVal(['date', 'transaction date', 'txn date']),
        amount: getVal(['amount', 'debit', 'credit', 'value']),
        description: getVal(['description', 'narration', 'details', 'memo', 'particulars']),
      };
    }).filter(r => r.date && r.amount && r.description);

    const results = { imported: 0, duplicates: 0, errors: 0 };

    for (const record of normalizedRecords) {
      try {
        const fingerprint = generateFingerprint(record);
        const categoryName = autoCategorize(record.description);
        const amount = parseFloat(record.amount.replace(/[^0-9.-]/g, ''));

        if (isNaN(amount)) { results.errors++; continue; }

        // Detect duplicate: same fingerprint within same user
        const existingTx = await prisma.transaction.findFirst({
          where: { userId, description: { contains: fingerprint } },
        });

        if (existingTx) { results.duplicates++; continue; }

        // Get or create category
        let category = await prisma.category.findFirst({
          where: { userId, name: categoryName },
        });

        if (!category) {
          const type = /salary|income|payment received/i.test(record.description) ? 'income' : 'expense';
          category = await prisma.category.create({
            data: { name: categoryName, type, userId },
          });
        }

        // Embed fingerprint in description for future duplicate detection
        await prisma.transaction.create({
          data: {
            amount: amount.toString(),
            currency: 'USD',
            date: new Date(record.date),
            description: `${record.description} [fp:${fingerprint}]`,
            categoryId: category.id,
            userId,
          },
        });

        results.imported++;
      } catch (err) {
        console.error('Row import error:', err.message);
        results.errors++;
      }
    }

    return res.json({
      message: 'CSV import complete',
      results,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to import CSV', error: error.message });
  }
};

module.exports = { upload, importCSV };
