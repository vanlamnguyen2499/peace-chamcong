import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getDaysInMonth } from '@/lib/time';
import { generateTimesheetExcelBuffer, TimesheetSummaryRow, TimesheetDailyDetail } from '@/lib/excel';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'HR_ADMIN' && user.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Không có quyền xuất bảng công' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const month = Number(searchParams.get('month')) || new Date().getMonth() + 1;
    const year = Number(searchParams.get('year')) || new Date().getFullYear();
    const branchId = searchParams.get('branchId');
    const departmentId = searchParams.get('departmentId');

    const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
    const days = getDaysInMonth(year, month);

    const userWhere: any = { isActive: true };
    if (branchId) userWhere.branchId = branchId;
    if (departmentId) userWhere.departmentId = departmentId;

    const users = await prisma.user.findMany({
      where: userWhere,
      include: {
        branch: true,
        department: true,
      },
      orderBy: { employeeCode: 'asc' },
    });

    const userIds = users.map((u) => u.id);
    const attendances = await prisma.attendance.findMany({
      where: {
        userId: { in: userIds },
        workDate: { startsWith: monthPrefix },
      },
    });

    const attMap: { [userId: string]: { [workDate: string]: any } } = {};
    attendances.forEach((att) => {
      if (!attMap[att.userId]) attMap[att.userId] = {};
      attMap[att.userId][att.workDate] = att;
    });

    let standardWorkDays = 0;
    days.forEach((dayStr) => {
      const d = new Date(dayStr);
      if (d.getDay() !== 0) standardWorkDays++;
    });

    const summaryList: TimesheetSummaryRow[] = [];
    const dailyDetails: TimesheetDailyDetail[] = [];

    users.forEach((u) => {
      const userAtts = attMap[u.id] || {};
      let actualWorkUnits = 0;
      let totalWorkHours = 0;
      let totalLateMinutes = 0;
      let totalEarlyMinutes = 0;
      let totalOtHours = 0;
      let paidLeaveDays = 0;
      let unpaidLeaveDays = 0;

      const dailyData: { [day: number]: any } = {};

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

          dailyData[dayNumber] = {
            inTime: att.checkInTime ? new Date(att.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : undefined,
            outTime: att.checkOutTime ? new Date(att.checkOutTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : undefined,
            workUnits: att.calculatedWorkUnits,
            status: att.status,
          };
        }
      });

      const finalPayableUnits = Math.round((actualWorkUnits + paidLeaveDays) * 10) / 10;

      summaryList.push({
        employeeCode: u.employeeCode,
        name: u.name,
        department: u.department?.name || '-',
        branch: u.branch?.name || '-',
        position: u.position || '-',
        standardWorkUnits: standardWorkDays,
        actualWorkUnits: Math.round(actualWorkUnits * 10) / 10,
        totalWorkHours: Math.round(totalWorkHours * 10) / 10,
        lateMinutes: totalLateMinutes,
        earlyMinutes: totalEarlyMinutes,
        otHours: Math.round(totalOtHours * 10) / 10,
        paidLeaveDays: Math.round(paidLeaveDays * 10) / 10,
        unpaidLeaveDays,
        finalPayableUnits,
      });

      dailyDetails.push({
        employeeCode: u.employeeCode,
        name: u.name,
        department: u.department?.name || '-',
        dailyData,
      });
    });

    const excelBuffer = await generateTimesheetExcelBuffer(
      month,
      year,
      summaryList,
      dailyDetails,
      days.length
    );

    return new NextResponse(new Uint8Array(excelBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Bang_Cong_Thang_${month}_${year}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting timesheet Excel:', error);
    return NextResponse.json({ error: 'Lỗi xuất file Excel bảng công' }, { status: 500 });
  }
}
