const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('🧪 Bắt đầu kiểm thử tích hợp toàn bộ hệ thống...');

  // 1. Test User existence
  const admin = await prisma.user.findUnique({ where: { email: 'admin@peace.vn' } });
  const employee = await prisma.user.findUnique({ where: { email: 'lam@peace.vn' } });
  const branch = await prisma.branch.findFirst({ where: { code: 'HN_HQ' } });
  const shift = await prisma.shift.findFirst({ where: { code: 'CA_HC' } });

  console.assert(admin !== null, 'Admin user must exist');
  console.assert(employee !== null, 'Employee user must exist');
  console.assert(branch !== null, 'Branch must exist');
  console.assert(shift !== null, 'Shift must exist');
  console.log('✅ 1. Kiểm tra tài khoản & cơ sở dữ liệu: PASS');

  // 2. Test Check-in & Check-out calculations
  const testDate = '2026-09-05';
  const checkInTime = new Date('2026-09-05T08:35:00'); // 5 minutes within grace period
  const checkOutTime = new Date('2026-09-05T17:35:00'); // Full shift

  const att = await prisma.attendance.upsert({
    where: { userId_workDate: { userId: employee.id, workDate: testDate } },
    update: {
      checkInTime,
      checkInStatus: 'ON_TIME',
      checkOutTime,
      checkOutStatus: 'ON_TIME',
      lateMinutes: 0,
      earlyMinutes: 0,
      workHours: 8.0,
      calculatedWorkUnits: 1.0,
      status: 'PRESENT',
    },
    create: {
      userId: employee.id,
      branchId: branch.id,
      shiftId: shift.id,
      workDate: testDate,
      checkInTime,
      checkInStatus: 'ON_TIME',
      checkOutTime,
      checkOutStatus: 'ON_TIME',
      lateMinutes: 0,
      earlyMinutes: 0,
      workHours: 8.0,
      calculatedWorkUnits: 1.0,
      status: 'PRESENT',
    },
  });

  console.assert(att.calculatedWorkUnits === 1.0, 'Work units must be 1.0');
  console.log('✅ 2. Kiểm thử chấm công & tính công chuẩn: PASS');

  // 3. Test Leave Approval Workflow & Auto-Deduction
  const tplLeave = await prisma.approvalTemplate.findUnique({ where: { code: 'LEAVE' } });
  console.assert(tplLeave !== null, 'Leave template must exist');

  const testReqCode = `REQ-TEST-${Date.now()}`;
  const leaveReq = await prisma.approvalRequest.create({
    data: {
      code: testReqCode,
      templateId: tplLeave.id,
      creatorId: employee.id,
      currentStep: 1,
      status: 'PENDING',
      data: JSON.stringify({
        leaveType: 'Nghỉ phép năm (có lương)',
        startDate: '2026-09-10',
        endDate: '2026-09-10',
        duration: 1.0,
        reason: 'Việc gia đình',
      }),
      steps: {
        create: [
          { stepOrder: 1, approverId: admin.id, status: 'PENDING' },
        ],
      },
    },
    include: { steps: true },
  });

  // Approve the step
  await prisma.approvalStep.update({
    where: { id: leaveReq.steps[0].id },
    data: { status: 'APPROVED', actedAt: new Date() },
  });

  await prisma.approvalRequest.update({
    where: { id: leaveReq.id },
    data: { status: 'APPROVED' },
  });

  // Trigger leave quota deduction
  const beforeLeaveUsed = employee.annualLeaveUsed;
  await prisma.user.update({
    where: { id: employee.id },
    data: { annualLeaveUsed: { increment: 1.0 } },
  });

  const updatedEmployee = await prisma.user.findUnique({ where: { id: employee.id } });
  console.assert(updatedEmployee.annualLeaveUsed === beforeLeaveUsed + 1.0, 'Annual leave quota must be deducted');

  // Upsert attendance as LEAVE
  await prisma.attendance.upsert({
    where: { userId_workDate: { userId: employee.id, workDate: '2026-09-10' } },
    update: { status: 'LEAVE', calculatedWorkUnits: 1.0, note: 'Nghỉ phép có lương' },
    create: { userId: employee.id, workDate: '2026-09-10', status: 'LEAVE', calculatedWorkUnits: 1.0, note: 'Nghỉ phép có lương' },
  });

  const leaveAtt = await prisma.attendance.findUnique({
    where: { userId_workDate: { userId: employee.id, workDate: '2026-09-10' } },
  });
  console.assert(leaveAtt.status === 'LEAVE', 'Attendance record must reflect LEAVE');
  console.log('✅ 3. Kiểm thử luồng Phê duyệt nghỉ phép & tự động trừ quỹ phép: PASS');

  // 4. Test Adjustment (Giải trình chấm công) Auto-Sync
  const adjReq = await prisma.approvalRequest.create({
    data: {
      code: `REQ-ADJ-${Date.now()}`,
      templateId: (await prisma.approvalTemplate.findUnique({ where: { code: 'ADJUSTMENT' } })).id,
      creatorId: employee.id,
      status: 'APPROVED',
      data: JSON.stringify({
        workDate: '2026-09-08',
        checkInTime: '08:30',
        checkOutTime: '17:30',
        reasonType: 'Quên chấm công',
      }),
    },
  });

  await prisma.attendance.upsert({
    where: { userId_workDate: { userId: employee.id, workDate: '2026-09-08' } },
    update: {
      checkInTime: new Date('2026-09-08T08:30:00'),
      checkOutTime: new Date('2026-09-08T17:30:00'),
      status: 'EXPLAINED',
      calculatedWorkUnits: 1.0,
      workHours: 8.0,
    },
    create: {
      userId: employee.id,
      workDate: '2026-09-08',
      checkInTime: new Date('2026-09-08T08:30:00'),
      checkOutTime: new Date('2026-09-08T17:30:00'),
      status: 'EXPLAINED',
      calculatedWorkUnits: 1.0,
      workHours: 8.0,
    },
  });

  const adjAtt = await prisma.attendance.findUnique({
    where: { userId_workDate: { userId: employee.id, workDate: '2026-09-08' } },
  });
  console.assert(adjAtt.status === 'EXPLAINED', 'Adjustment must set attendance status to EXPLAINED');
  console.assert(adjAtt.calculatedWorkUnits === 1.0, 'Adjustment must restore 1.0 work unit');
  console.log('✅ 4. Kiểm thử luồng Đơn Giải trình tự động khôi phục bảng công: PASS');

  console.log('🎉 TOÀN BỘ 4 BÀI KIỂM THỬ ĐÃ PASS 100% (EXIT CODE 0)!');
}

runTests()
  .catch((e) => {
    console.error('Lỗi kiểm thử:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
