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

    const users = await prisma.user.findMany({
      where: userWhere,
      include: {
        branch: true,
        department: true,
      },
      orderBy: { employeeCode: 'asc' },
    });

    const userIds = users.map((u) => u.id);

    // Fetch all attendances for these users in this month
    const attendances = await prisma.attendance.findMany({
      where: {
        userId: { in: userIds },
        workDate: { startsWith: monthPrefix },
      },
      include: {
        shift: true,
      },
    });

    // Map attendances by userId -> workDate -> attendance
    const attMap: { [userId: string]: { [workDate: string]: any } } = {};
    attendances.forEach((att) => {
      if (!attMap[att.userId]) attMap[att.userId] = {};
      attMap[att.userId][att.workDate] = att;
    });

    // Compute standard working days in month (excluding Sundays)
    let standardWorkDays = 0;
    days.forEach((dayStr) => {
      const d = new Date(dayStr);
      if (d.getDay() !== 0) {
        // Not Sunday
        standardWorkDays++;
      }
    });

    // Build comprehensive response
    const matrix = users.map((u) => {
      const userAtts = attMap[u.id] || {};
      let actualWorkUnits = 0;
      let totalWorkHours = 0;
      let totalLateMinutes = 0;
      let totalEarlyMinutes = 0;
      let totalOtHours = 0;
      let paidLeaveDays = 0;
      let unpaidLeaveDays = 0;

      const dailyRecords: { [day: number]: any } = {};

      days.forEach((dayStr) => {
        const dayNumber = parseInt(dayStr.split('-')[2], 10);
        const att = userAtts[dayStr];

        if (att) {
          if (att.status === 'LEAVE') {
            if (att.calculatedWorkUnits > 0) {
              paidLeaveDays++;
            } else {
              unpaidLeaveDays++;
            }
          } else if (att.status === 'INVALID' || att.status === 'ABSENT') {
            // Không tính công cho bản ghi chấm công lỗi hoặc vắng mặt chưa được giải trình
          } else {
            actualWorkUnits += att.calculatedWorkUnits || 0;
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

      const finalPayableUnits = Math.round((actualWorkUnits + paidLeaveDays) * 10) / 10;

      return {
        user: {
          id: u.id,
          employeeCode: u.employeeCode,
          name: u.name,
          email: u.email,
          position: u.position,
          department: u.department?.name || 'Chưa xếp',
          branch: u.branch?.name || 'Chưa gán',
          annualLeaveQuota: u.annualLeaveQuota,
          annualLeaveUsed: u.annualLeaveUsed,
        },
        summary: {
          standardWorkUnits: standardWorkDays,
          actualWorkUnits: Math.round(actualWorkUnits * 10) / 10,
          totalWorkHours: Math.round(totalWorkHours * 10) / 10,
          lateMinutes: totalLateMinutes,
          earlyMinutes: totalEarlyMinutes,
          otHours: Math.round(totalOtHours * 10) / 10,
          paidLeaveDays: Math.round(paidLeaveDays * 10) / 10,
          unpaidLeaveDays,
          finalPayableUnits,
        },
        dailyRecords,
      };
    });

    return NextResponse.json({
      month,
      year,
      daysInMonth: days.length,
      standardWorkDays,
      days,
      matrix,
    });
  } catch (error: any) {
    console.error('Error fetching admin timesheet:', error);
    return NextResponse.json({ error: 'Lỗi tải ma trận bảng công' }, { status: 500 });
  }
}
