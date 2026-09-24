import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.userShiftSchedule.count({
    where: {
      workDate: {
        startsWith: '2026-09'
      }
    }
  });
  console.log("Schedules in Sept 2026:", count);
  
  // also check Ho Hoang Hai
  const user = await prisma.user.findFirst({ where: { employeeCode: '12643' } });
  if (user) {
     const sched = await prisma.userShiftSchedule.findMany({
       where: { userId: user.id, workDate: '2026-09-04' }
     });
     console.log("Hai's schedules on Sept 4:", sched.length);
  }
}
main();
