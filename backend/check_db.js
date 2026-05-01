const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const transactions = await prisma.transaction.findMany();
  console.log('Transactions:', transactions);
}

main().catch(console.error).finally(() => prisma.$disconnect());
