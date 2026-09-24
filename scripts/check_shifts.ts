import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const shifts = await prisma.shift.findMany();
  console.log(shifts);
}
main();
