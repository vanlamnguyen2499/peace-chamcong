import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const month = Number(searchParams.get('month')) || new Date().getMonth() + 1;
    const year = Number(searchParams.get('year')) || new Date().getFullYear();

    const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;

    const attendances = await prisma.attendance.findMany({
      where: {
        userId: user.id,
        workDate: {
          startsWith: monthPrefix,
        },
      },
      include: {
        shift: true,
        branch: true,
      },
      orderBy: {
        workDate: 'desc',
      },
    });

    // Calculate monthly totals
    let totalWorkUnits = 0;
    let totalWorkHours = 0;
    let totalLateMinutes = 0;
    let totalEarlyMinutes = 0;
    let totalOtHours = 0;

    attendances.forEach((att) => {
      totalWorkUnits += att.calculatedWorkUnits;
      totalWorkHours += att.workHours;
      totalLateMinutes += att.lateMinutes;
      totalEarlyMinutes += att.earlyMinutes;
      totalOtHours += att.otHours;
    });

    return NextResponse.json({
      month,
      year,
      summary: {
        totalDays: attendances.length,
        totalWorkUnits: Math.round(totalWorkUnits * 10) / 10,
        totalWorkHours: Math.round(totalWorkHours * 10) / 10,
        totalLateMinutes,
        totalEarlyMinutes,
        totalOtHours: Math.round(totalOtHours * 10) / 10,
      },
      attendances,
    });
  } catch (error: any) {
    console.error('Attendance history error:', error);
    return NextResponse.json({ error: 'Lỗi tải lịch sử chấm công' }, { status: 500 });
  }
}
