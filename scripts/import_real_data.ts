import { PrismaClient } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing old data...');
  await prisma.attendance.deleteMany({});
  await prisma.userShiftSchedule.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.department.deleteMany({});
  await prisma.branch.deleteMany({});

  console.log('Creating shifts...');
  // Shifts are probably kept, but let's make sure they exist
  const shiftsData = [
    { code: 'CA_1_SANG', name: 'Ca Sáng (T2-T7)', startTime: '08:00', endTime: '12:00', workUnits: 1.0, minWorkHours: 4.0 },
    { code: 'CA_2_CHIEU', name: 'Ca Chiều (T2-T7)', startTime: '13:30', endTime: '17:30', workUnits: 1.0, minWorkHours: 4.0 },
    { code: 'CA_3_TOI', name: 'Ca Tối (T2-T7)', startTime: '15:30', endTime: '19:30', workUnits: 1.0, minWorkHours: 4.0 },
    { code: 'CA_CN_SANG', name: 'Ca Sáng (CN)', startTime: '08:00', endTime: '12:00', workUnits: 1.0, minWorkHours: 4.0 },
    { code: 'CA_CN_CHIEU', name: 'Ca Chiều (CN)', startTime: '13:30', endTime: '18:00', workUnits: 1.0, minWorkHours: 4.5 },
  ];
  
  for (const s of shiftsData) {
    await prisma.shift.upsert({
      where: { code: s.code },
      update: s,
      create: s
    });
  }
  
  const shifts = await prisma.shift.findMany();
  const shiftMap: Record<string, any> = {};
  shifts.forEach(s => shiftMap[s.code] = s);

  console.log('Creating branch...');
  const branch = await prisma.branch.create({
    data: { name: "Chi Nhánh Quận 1", code: "CN_Q1", latitude: 10.762622, longitude: 106.660172, radiusMeters: 100, address: 'Quận 1, TP.HCM' }
  });

  const filePath = path.resolve(process.cwd(), 'T8_2026 QUẬN 1_VÂN TAY.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.getWorksheet('CHẤM VÂN TAY');

  const deptMap: any = {};
  const userMap: any = {};

  let rowCount = 0;
  
  // Extract users and departments
  sheet?.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const employeeCode = String(row.getCell(1).value || '').replace('.0', '').trim();
    const name = String(row.getCell(2).value || '').trim();
    const deptName = String(row.getCell(3).value || 'CHƯA XẾP').trim();
    
    if (!employeeCode || employeeCode === 'null') return;
    
    if (!deptMap[deptName]) {
      deptMap[deptName] = true;
    }
    
    if (!userMap[employeeCode]) {
      userMap[employeeCode] = { name, deptName };
    }
  });

  console.log('Creating departments...');
  const dbDepts: any = {};
  for (const dName of Object.keys(deptMap)) {
    const d = await prisma.department.create({ data: { name: dName, code: dName.replace(/[ \\/]/g, "_").toUpperCase() } });
    dbDepts[dName] = d.id;
  }

  console.log('Creating users...');
  // Add a super admin to login
  const admin = await prisma.user.create({
    data: {
      email: 'admin@peace.vn',
      name: 'Super Admin',
      employeeCode: 'ADMIN',
      passwordHash: "$2a$10$lwIHaxXPiAbfuXKRr4asuOTcp7vGU0jKXjJA3L07vgExThLDIGgeO", // Demo purpose
      role: 'SUPER_ADMIN',
      branchId: branch.id,
    }
  });

  const dbUsers: any = {};
  for (const [code, u] of Object.entries(userMap) as any) {
    const newUser = await prisma.user.create({
      data: {
        email: `user${code}@peace.vn`,
        name: u.name,
        employeeCode: code,
        passwordHash: "$2a$10$/4p.UIcbjxkCslM4vYCMY.SfsAMF6wYZ/Nj10LdOEJi7.JjhtYFm6",
        role: 'EMPLOYEE',
        branchId: branch.id,
        departmentId: dbDepts[u.deptName],
        annualLeaveQuota: 12.0
      }
    });
    dbUsers[code] = newUser.id;
  }
  
  console.log('Processing attendance & schedules...');
  const logs: any[] = [];
  
  sheet?.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const employeeCode = String(row.getCell(1).value || '').replace('.0', '').trim();
    if (!employeeCode || employeeCode === 'null') return;
    
    const dateCell = row.getCell(4).value;
    if (!dateCell) return;
    let dateObj: Date;
    if (dateCell instanceof Date) {
      dateObj = dateCell;
    } else {
      dateObj = new Date(dateCell as string);
    }
    
    if (isNaN(dateObj.getTime())) return;
    const regex = /^[0-2][0-9]:[0-5][0-9]$/;

    
    // adjust timezone if needed, ExcelJS returns UTC
    const dateStr = dateObj.toISOString().split('T')[0];
    
    const timesRaw = String(row.getCell(5).value || '').trim();
    if (!timesRaw || timesRaw === 'null') return;
    
    const timeParts = timesRaw.split(' ').filter(t => t.length >= 4);
    if (timeParts.length === 0) return;
    if (!regex.test(timeParts[0]) || !regex.test(timeParts[timeParts.length - 1])) return;
    
    timeParts.sort();
    const inTimeStr = timeParts[0];
    const outTimeStr = timeParts[timeParts.length - 1];
    
    logs.push({
      userId: dbUsers[employeeCode],
      workDate: dateStr,
      inTimeStr,
      outTimeStr,
      isSunday: dateObj.getDay() === 0
    });
  });

  console.log(`Creating ${logs.length} attendance records...`);
  for (const log of logs) {
    const { userId, workDate, inTimeStr, outTimeStr, isSunday } = log;
    
    const inTime = new Date(`${workDate}T${inTimeStr}:00`);
    const outTime = new Date(`${workDate}T${outTimeStr}:00`);
    
    // Determine which shifts to assign based on the time!
    // Sáng: 08:00 - 12:00
    // Chiều: 13:30 - 17:30
    // Tối: 15:30 - 19:30
    const inHour = inTime.getHours() + inTime.getMinutes() / 60;
    const outHour = outTime.getHours() + outTime.getMinutes() / 60;
    
    const assignedShifts = [];
    if (isSunday) {
       if (inHour <= 8.5 && outHour >= 11.5) assignedShifts.push(shiftMap['CA_CN_SANG']);
       if (inHour <= 14.0 && outHour >= 17.5) assignedShifts.push(shiftMap['CA_CN_CHIEU']);
    } else {
       if (inHour <= 8.5 && outHour >= 11.5) assignedShifts.push(shiftMap['CA_1_SANG']);
       if (inHour <= 14.0 && outHour >= 17.0) assignedShifts.push(shiftMap['CA_2_CHIEU']);
       if (inHour <= 16.0 && outHour >= 19.0) assignedShifts.push(shiftMap['CA_3_TOI']);
       
       // Fallback for full day or weird times
       if (assignedShifts.length === 0 && outHour - inHour > 3) {
         if (inHour < 12) assignedShifts.push(shiftMap['CA_1_SANG']);
         else assignedShifts.push(shiftMap['CA_2_CHIEU']);
       }
    }
    
    // Default to at least 1 shift if worked
    if (assignedShifts.length === 0) assignedShifts.push(isSunday ? shiftMap['CA_CN_SANG'] : shiftMap['CA_1_SANG']);
    
    for (const s of assignedShifts) {
      await prisma.userShiftSchedule.upsert({
        where: { userId_workDate_shiftId: { userId, workDate, shiftId: s.id } },
        update: {},
        create: { userId, workDate, shiftId: s.id, isOffDay: false }
      });
    }
    
    const calculatedWorkUnits = assignedShifts.reduce((sum, s) => sum + s.workUnits, 0);
    const workHours = Math.round(((outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60)) * 10) / 10;
    
    await prisma.attendance.upsert({
      where: { userId_workDate: { userId, workDate } },
      update: {
        checkInTime: inTime,
        checkOutTime: outTime,
        calculatedWorkUnits,
        workHours,
      },
      create: {
        userId,
        workDate,
        checkInTime: inTime,
        checkOutTime: outTime,
        checkInStatus: 'FINGERPRINT',
        checkOutStatus: 'FINGERPRINT',
        calculatedWorkUnits,
        workHours,
        status: 'PRESENT'
      }
    });
  }

  console.log('Done!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
