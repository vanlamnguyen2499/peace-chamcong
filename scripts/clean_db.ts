import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.notification.deleteMany({});
  await prisma.approvalComment.deleteMany({});
  await prisma.approvalStep.deleteMany({});
  await prisma.approvalRequest.deleteMany({});
  await prisma.approvalTemplate.deleteMany({});
  console.log('Cleaned up templates and approvals');
}
main().catch(console.error).finally(() => prisma.$disconnect());
