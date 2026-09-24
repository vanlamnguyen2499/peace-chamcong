import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getDaysInMonth } from '@/lib/time';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'HR_ADMIN' && user.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Không có quyền truy cập bảng công' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const month = Number(searchParams.get('month')) || new Date().getMonth() + 1;
    const year = Number(searchParams.get('year')) || new Date().getFullYear();
    const branchId = searchParams.get('branchId');
    const departmentId = searchParams.get('departmentId');
    const search = searchParams.get('search');

    const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
    const days = getDaysInMonth(year, month);

    // Build filter for users
    const userWhere: any = { isActive: true };
    if (branchId) userWhere.branchId = branchId;
    if (departmentId) userWhere.departmentId = departmentId;
    if (search) {
      userWhere.OR = [
        { name: { contains: search } },
        { employeeCode: { contains: search } },
        { email: { contains: search } },
      ];
    }

    // If manager, restrict to their department or subordinates unless Super/HR
    if (user.role === 'MANAGER') {
      if (user.departmentId) {
        userWhere.departmentId = user.departmentId;
      } else {
        userWhere.OR = [{ id: user.id }, { managerId: user.id }];
      }
    }

    const rawUsers = await prisma.user.findMany({
      where: userWhere,
      include: {
        branch: true,
        department: true,
      },
    });

    const users = [...rawUsers].sort((a, b) => {
      const deptA = a.department?.name || 'ZZZ';
      const deptB = b.department?.name || 'ZZZ';
      const deptComp = deptA.localeCompare(deptB, 'vi');
      if (deptComp !== 0) return deptComp;
      return (a.name || '').localeCompare(b.name || '', 'vi');
    });

    const userIds = users.map((u) => u.id);

    // Fetch all attendances for these users in this month
    const attendances = await prisma.attendance.findMany({
      where: {
        userId: { in: userIds },
        workDate: { startsWith: monthPrefix },
      },
    });

    // Fetch all schedules for these users in this month to calculate standard workdays
    const schedules = await prisma.userShiftSchedule.findMany({
      where: {
        userId: { in: userIds },
        workDate: { startsWith: monthPrefix },
      },
      include: {
        shift: true,
      }
    });

    // Fetch all shifts to map shifts in weekly schedule
    const allShifts = await prisma.shift.findMany({ where: { isActive: true } });
    const shiftMapById: { [id: string]: any } = {};
    allShifts.forEach((s) => {
      shiftMapById[s.id] = s;
      shiftMapById[s.code] = s;
    });

    // Map attendances by userId -> workDate -> attendance
    const attMap: { [userId: string]: { [workDate: string]: any } } = {};
    attendances.forEach((att) => {
      if (!attMap[att.userId]) attMap[att.userId] = {};
      attMap[att.userId][att.workDate] = att;
    });

    // Map schedules by userId -> list of schedules
    const scheduleMap: { [userId: string]: any[] } = {};
    schedules.forEach((sch) => {
      if (!scheduleMap[sch.userId]) scheduleMap[sch.userId] = [];
      scheduleMap[sch.userId].push(sch);
    });

    // Build comprehensive response
    const matrix = users.map((u) => {
      const userAtts = attMap[u.id] || {};
      const userSchedules = scheduleMap[u.id] || [];
      
      // Calculate Standard Work Units dynamically
      let computedStandardWorkUnits = 0;
      if (u.weeklySchedule) {
        // If employee has a saved fixed weekly pattern, compute exactly by weekdays in this month
        try {
          const weekly = JSON.parse(u.weeklySchedule);
          days.forEach((dayStr) => {
            const d = new Date(dayStr);
            const dow = String(d.getDay());
            if (dow === '0') {
              if (!weekly.sundayFlexible?.enabled) {
                const shiftIdOrOff = weekly['0'];
                if (shiftIdOrOff && shiftIdOrOff !== 'OFF' && shiftIdOrOff !== 'FLEXIBLE') {
                  const sObj = shiftMapById[shiftIdOrOff];
                  if (sObj) {
                    computedStandardWorkUnits += (sObj.workUnits || 1);
                  }
                }
              }
            } else {
              const shiftIdOrOff = weekly[dow];
              if (shiftIdOrOff && shiftIdOrOff !== 'OFF') {
                const sObj = shiftMapById[shiftIdOrOff];
                if (sObj) {
                  computedStandardWorkUnits += (sObj.workUnits || 1);
                }
              }
            }
          });

          if (weekly.sundayFlexible?.enabled && Number(weekly.sundayFlexible.shiftsCount) > 0) {
            const flexShift = shiftMapById[weekly.sundayFlexible.shiftId];
            const flexShiftUnits = flexShift ? (flexShift.workUnits || 1) : 1;
            computedStandardWorkUnits += Number(weekly.sundayFlexible.shiftsCount) * flexShiftUnits;
          }
        } catch (e) {
          console.error('Error parsing weeklySchedule for user', u.id, e);
        }
      } else if (userSchedules.length > 0) {
        // If there are specific shifts assigned in this month, use them
        userSchedules.forEach((sch) => {
          if (!sch.isOffDay && sch.shift) {
            computedStandardWorkUnits += (sch.shift.workUnits || 1);
          }
        });
      } else {
        // Fallback to the user's default shift config if no specific schedule exists for the month
        days.forEach((dayStr) => {
          const d = new Date(dayStr);
          if (d.getDay() === 0) {
            computedStandardWorkUnits += (u.sundayShifts ?? 0);
          } else {
            computedStandardWorkUnits += (u.weekdayShifts ?? 0);
          }
        });
      }
      const standardWorkUnits = u.overrideWorkUnits !== null ? u.overrideWorkUnits : computedStandardWorkUnits;
      let actualWorkUnits = 0;
      let totalWorkHours = 0;
      let totalLateMinutes = 0;
      let totalEarlyMinutes = 0;
      let totalOtHours = 0;
      let paidLeaveUnits = 0;
      let unpaidLeaveUnits = 0;
      let sundayMealAllowance = 0;

      const dailyRecords: { [day: number]: any } = {};

      days.forEach((dayStr) => {
        const d = new Date(dayStr);
        const isSunday = d.getDay() === 0;
        const dayNumber = parseInt(dayStr.split('-')[2], 10);
        const att = userAtts[dayStr];

        if (att) {
          if (att.status === 'LEAVE') {
            if (att.calculatedWorkUnits > 0) {
              paidLeaveUnits += att.calculatedWorkUnits;
            } else {
              unpaidLeaveUnits += 1.0;
            }
          } else if (att.status === 'INVALID' || att.status === 'ABSENT') {
            // Không tính công
          } else {
            actualWorkUnits += att.calculatedWorkUnits || 0;
            // Tính phụ cấp cơm Chủ Nhật: Làm >= 2 ca (>= 2 công)
            if (isSunday && att.calculatedWorkUnits >= 2.0) {
              sundayMealAllowance += 1;
            }
          }

          totalWorkHours += att.workHours || 0;
          totalLateMinutes += att.lateMinutes || 0;
          totalEarlyMinutes += att.earlyMinutes || 0;
          totalOtHours += att.otHours || 0;

          dailyRecords[dayNumber] = {
            id: att.id,
            workDate: dayStr,
            inTime: att.checkInTime ? new Date(att.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : null,
            outTime: att.checkOutTime ? new Date(att.checkOutTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : null,
            workUnits: att.calculatedWorkUnits,
            workHours: att.workHours,
            lateMinutes: att.lateMinutes,
            earlyMinutes: att.earlyMinutes,
            otHours: att.otHours,
            status: att.status,
            note: att.note,
            checkInPhotoUrl: att.checkInPhotoUrl,
            checkOutPhotoUrl: att.checkOutPhotoUrl,
            checkInDistance: att.checkInDistance,
          };
        } else {
          dailyRecords[dayNumber] = null;
        }
      });

      const finalPayableUnits = Math.round((actualWorkUnits + paidLeaveUnits) * 10) / 10;

      return {
        user: {
          id: u.id,
          employeeCode: u.employeeCode,
          name: u.name,
          email: u.email,
          position: u.position,
          department: u.department?.name || 'Chưa xếp',
          branch: u.branch?.name || "Chưa gán",
          annualLeaveQuota: u.annualLeaveQuota,
          annualLeaveUsed: u.annualLeaveUsed,
        },
        summary: {
          standardWorkUnits: Math.round(standardWorkUnits * 10) / 10,
          actualWorkUnits: Math.round(actualWorkUnits * 10) / 10,
          totalWorkHours: Math.round(totalWorkHours * 10) / 10,
          lateMinutes: totalLateMinutes,
          earlyMinutes: totalEarlyMinutes,
          otHours: Math.round(totalOtHours * 10) / 10,
          paidLeaveDays: Math.round(paidLeaveUnits * 10) / 10,
          unpaidLeaveDays: Math.round(unpaidLeaveUnits * 10) / 10,
          finalPayableUnits,
          sundayMealAllowance,
        },
        dailyRecords,
      };
    });

    return NextResponse.json({
      month,
      year,
      daysInMonth: days.length,
      days,
      matrix,
    });
  } catch (error: any) {
    console.error('Error fetching admin timesheet:', error);
    return NextResponse.json({ error: 'Lỗi tải ma trận bảng công' }, { status: 500 });
  }
}
