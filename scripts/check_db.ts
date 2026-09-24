import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({ select: { employeeCode: true, name: true } });
  console.log("Found", users.length, "users.");
  console.log(users.filter(u => u.employeeCode === '16282'));
  console.log(users.filter(u => u.employeeCode === '20666'));
}
main().catch(console.error).finally(() => prisma.$disconnect());
