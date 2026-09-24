import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import * as xlsx from 'xlsx';
import { getSessionUser } from '@/lib/auth';

const prisma = new PrismaClient();

// Helper to remove accents for name matching
function removeAccents(str: string) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Convert "08:30" to minutes since midnight for easy comparison
function timeToMinutes(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || !['SUPER_ADMIN', 'HR_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer() as any);
    const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });

    // Try to find the correct sheet
    const sheetName = workbook.SheetNames.find(s => s === 'CHẤM VÂN TAY') || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return NextResponse.json({ error: 'Could not find a valid sheet in the Excel file' }, { status: 400 });
    }

    // Load all users to map
    const users = await prisma.user.findMany({
      select: { id: true, employeeCode: true, name: true, branchId: true }
    });

    const results: string[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Parse data to array of arrays
    const rows = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1 });

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 5) continue;

      const rawCode = String(row[0] || '').trim();
      const rawName = String(row[1] || '').trim();
      const rawDate = row[3]; // Column 4 (index 3)
      const rawTimeStr = String(row[4] || '').trim(); // Column 5 (index 4)

      if (!rawName || !rawDate || !rawTimeStr) continue;

      // Parse Date
      let workDateStr = '';
      if (rawDate instanceof Date) {
        workDateStr = rawDate.toISOString().split('T')[0];
      } else if (typeof rawDate === 'string') {
        // Assume format DD/MM/YYYY or similar, we'll try to handle it. For now, try simple parse
        const parsed = new Date(rawDate);
        if (!isNaN(parsed.getTime())) {
          workDateStr = parsed.toISOString().split('T')[0];
        }
      }
      
      if (!workDateStr) {
        results.push(`Dòng ${(i + 1)}: Không thể đọc ngày tháng (${rawDate})`);
        errorCount++;
        continue;
      }

      // Map User
      let user = users.find(u => u.employeeCode === rawCode);
      if (!user) {
        const normalizedRawName = removeAccents(rawName);
        user = users.find(u => removeAccents(u.name) === normalizedRawName);
      }

      if (!user) {
        results.push(`Dòng ${(i + 1)}: Không tìm thấy nhân viên "${rawName}" hoặc mã "${rawCode}"`);
        errorCount++;
        continue;
      }

      // Parse Times
      const times = rawTimeStr.split(/\s+/).filter(t => t.includes(':'));
      if (times.length === 0) continue;

      // Extract MIN and MAX
      times.sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
      const minTime = times[0];
      const maxTime = times[times.length - 1];

      // Convert to full Date objects for DB
      const checkInDateTime = new Date(`${workDateStr}T${minTime}:00+07:00`);
      const checkOutDateTime = new Date(`${workDateStr}T${maxTime}:00+07:00`);

      // Evaluate against Scheduled Shifts to determine Late/Early and Work Units
      const scheduledShifts = await prisma.userShiftSchedule.findMany({
        where: { userId: user.id, workDate: workDateStr },
        include: { shift: true }
      });

      // Check if Excel already has calculated values for this row
      const excelLate = parseInt(String(row[7] || 0)) || 0;
      const excelEarly = parseInt(String(row[8] || 0)) || 0;
      const excelUnits = parseFloat(String(row[9] || 0)) || 0.0;
      const excelOt = parseFloat(String(row[10] || 0)) || 0.0;

      let lateMinutes = 0;
      let earlyMinutes = 0;
      let calculatedWorkUnits = 0.0;
      let status = 'PRESENT';
      let otHours = 0.0;

      // If the Excel file already calculates the work units, trust it directly.
      // This solves the problem when importing old records where Shift Schedules haven't been generated in the system.
      if (excelUnits > 0 || excelLate > 0 || excelEarly > 0 || excelOt > 0) {
        lateMinutes = excelLate;
        earlyMinutes = excelEarly;
        calculatedWorkUnits = excelUnits;
        otHours = excelOt;
        
        if (lateMinutes > 0 || earlyMinutes > 0) {
          status = lateMinutes > 0 ? 'LATE' : 'EARLY';
        }
      } else if (scheduledShifts.length > 0) {
        // Fallback: evaluate against Scheduled Shifts to determine Late/Early and Work Units
        // Sort shifts by start time
        scheduledShifts.sort((a, b) => timeToMinutes(a.shift.startTime) - timeToMinutes(b.shift.startTime));
        
        const firstShift = scheduledShifts[0].shift;
        const lastShift = scheduledShifts[scheduledShifts.length - 1].shift;

        const checkInMins = timeToMinutes(minTime);
        const firstShiftStartMins = timeToMinutes(firstShift.startTime);
        
        const checkOutMins = timeToMinutes(maxTime);
        const lastShiftEndMins = timeToMinutes(lastShift.endTime);

        if (checkInMins > firstShiftStartMins + firstShift.gracePeriodLate) {
          lateMinutes = checkInMins - firstShiftStartMins;
        }

        if (checkOutMins < lastShiftEndMins - lastShift.gracePeriodEarly) {
          earlyMinutes = lastShiftEndMins - checkOutMins;
        }

        for (const schedule of scheduledShifts) {
          const shiftStartMins = timeToMinutes(schedule.shift.startTime);
          const shiftEndMins = timeToMinutes(schedule.shift.endTime);
          
          if (checkInMins <= shiftStartMins + schedule.shift.gracePeriodLate && 
              checkOutMins >= shiftEndMins - schedule.shift.gracePeriodEarly) {
            calculatedWorkUnits += schedule.shift.workUnits;
          }
        }
        
        if (lateMinutes > 0 || earlyMinutes > 0) {
          status = lateMinutes > 0 ? 'LATE' : 'EARLY';
        }
      } else {
        // No scheduled shifts and no Excel units? Just record the time, units = 0
        status = 'UNSCHEDULED';
      }

      const workMins = timeToMinutes(maxTime) - timeToMinutes(minTime);
      const workHours = Math.max(0, Math.round((workMins / 60) * 10) / 10);

      // Upsert Attendance
      await prisma.attendance.upsert({
        where: {
          userId_workDate: {
            userId: user.id,
            workDate: workDateStr
          }
        },
        update: {
          checkInTime: checkInDateTime,
          checkOutTime: checkOutDateTime,
          lateMinutes,
          earlyMinutes,
          calculatedWorkUnits,
          workHours,
          otHours,
          status,
          checkInDevice: 'BIOMETRIC_IMPORT',
          checkOutDevice: 'BIOMETRIC_IMPORT'
        },
        create: {
          userId: user.id,
          workDate: workDateStr,
          branchId: user.branchId,
          checkInTime: checkInDateTime,
          checkOutTime: checkOutDateTime,
          lateMinutes,
          earlyMinutes,
          calculatedWorkUnits,
          workHours,
          otHours,
          status,
          checkInDevice: 'BIOMETRIC_IMPORT',
          checkOutDevice: 'BIOMETRIC_IMPORT'
        }
      });

      successCount++;
    }

    return NextResponse.json({
      message: `Đã xử lý xong. Thành công: ${successCount} bản ghi. Lỗi: ${errorCount} bản ghi.`,
      results
    });

  } catch (error: any) {
    console.error('Import Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
