import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { eachDayOfInterval, format, parseISO } from 'date-fns';

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || (sessionUser.role !== 'SUPER_ADMIN' && sessionUser.role !== 'HR_ADMIN' && sessionUser.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Không có quyền phân ca' }, { status: 403 });
    }

    const body = await req.json();
    const { userIds, shiftId, startDate, endDate, excludeSundays } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0 || !shiftId || !startDate || !endDate) {
      return NextResponse.json({ error: 'Vui lòng chọn nhân viên, ca làm việc và khoảng thời gian' }, { status: 400 });
    }

    const dates = eachDayOfInterval({
      start: parseISO(startDate),
      end: parseISO(endDate),
    });

    let count = 0;
    for (const userId of userIds) {
      for (const d of dates) {
        if (excludeSundays && d.getDay() === 0) continue; // Skip Sunday

        const workDate = format(d, 'yyyy-MM-dd');
        await prisma.userShiftSchedule.upsert({
          where: {
            userId_workDate: { userId, workDate },
          },
          update: { shiftId, isOffDay: false },
          create: { userId, shiftId, workDate, isOffDay: false },
        });
        count++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Đã phân ca thành công cho ${userIds.length} nhân sự (${count} lượt ca).`,
    });
  } catch (error: any) {
    console.error('Batch schedule error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi phân ca' }, { status: 500 });
  }
}
