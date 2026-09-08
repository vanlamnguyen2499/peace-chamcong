import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || (sessionUser.role !== 'SUPER_ADMIN' && sessionUser.role !== 'HR_ADMIN' && sessionUser.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Không có quyền điều chỉnh công thủ công' }, { status: 403 });
    }

    const body = await req.json();
    const {
      userId,
      workDate,
      workUnits,
      workHours,
      lateMinutes,
      earlyMinutes,
      otHours,
      status,
      note,
    } = body;

    if (!userId || !workDate) {
      return NextResponse.json({ error: 'Thiếu thông tin nhân sự hoặc ngày làm việc' }, { status: 400 });
    }

    // Role check: Manager can only override for subordinates in their department
    if (sessionUser.role === 'MANAGER') {
      const targetUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!targetUser || (sessionUser.departmentId && targetUser.departmentId !== sessionUser.departmentId && targetUser.managerId !== sessionUser.id && targetUser.id !== sessionUser.id)) {
        return NextResponse.json({ error: 'Không có quyền điều chỉnh công cho nhân sự ngoài phòng ban' }, { status: 403 });
      }
    }

    const parsedWorkUnits = typeof workUnits === 'number' ? workUnits : parseFloat(workUnits) || 1.0;
    const parsedWorkHours = typeof workHours === 'number' ? workHours : parseFloat(workHours) || 8.0;
    const parsedLateMinutes = typeof lateMinutes === 'number' ? lateMinutes : parseInt(lateMinutes, 10) || 0;
    const parsedEarlyMinutes = typeof earlyMinutes === 'number' ? earlyMinutes : parseInt(earlyMinutes, 10) || 0;
    const parsedOtHours = typeof otHours === 'number' ? otHours : parseFloat(otHours) || 0.0;
    const overrideStatus = status || 'EXPLAINED';
    const overrideNote = note ? `[ĐIỀU CHỈNH THỦ CÔNG: ${note}]` : '[ĐIỀU CHỈNH THỦ CÔNG]';

    const attendance = await prisma.attendance.upsert({
      where: {
        userId_workDate: {
          userId,
          workDate,
        },
      },
      update: {
        calculatedWorkUnits: parsedWorkUnits,
        workHours: parsedWorkHours,
        lateMinutes: parsedLateMinutes,
        earlyMinutes: parsedEarlyMinutes,
        otHours: parsedOtHours,
        status: overrideStatus,
        note: overrideNote,
      },
      create: {
        userId,
        workDate,
        calculatedWorkUnits: parsedWorkUnits,
        workHours: parsedWorkHours,
        lateMinutes: parsedLateMinutes,
        earlyMinutes: parsedEarlyMinutes,
        otHours: parsedOtHours,
        status: overrideStatus,
        note: overrideNote,
      },
    });

    // Create notification for employee
    await prisma.notification.create({
      data: {
        userId,
        title: `Công ngày ${workDate} đã được điều chỉnh`,
        message: `${sessionUser.name} (${sessionUser.position || sessionUser.role}) đã điều chỉnh công ngày ${workDate} thành ${parsedWorkUnits} công. Lý do: ${note || 'Điều chỉnh thủ công'}`,
        link: `/history`,
        type: 'ATTENDANCE',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Điều chỉnh công thủ công thành công!',
      attendance,
    });
  } catch (error: any) {
    console.error('Error in manual timesheet override:', error);
    return NextResponse.json({ error: error.message || 'Lỗi điều chỉnh công thủ công' }, { status: 500 });
  }
}
