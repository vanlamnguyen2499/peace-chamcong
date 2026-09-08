import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getWorkDateString } from '@/lib/time';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const todayStr = getWorkDateString(new Date());

    // 1. Get today's attendance record
    const attendance = await prisma.attendance.findUnique({
      where: {
        userId_workDate: {
          userId: user.id,
          workDate: todayStr,
        },
      },
      include: {
        shift: true,
        branch: true,
      },
    });

    // 2. Get today's schedule or fallback to default standard shift
    let shift = null;
    const schedule = await prisma.userShiftSchedule.findUnique({
      where: {
        userId_workDate: {
          userId: user.id,
          workDate: todayStr,
        },
      },
      include: { shift: true },
    });

    if (schedule && schedule.shift) {
      shift = schedule.shift;
    } else {
      // Dynamic fallback theo ngày trong tuần: Chủ nhật hoặc Ca 1 Sáng T2-T7
      const dayOfWeek = new Date().getDay(); // 0 là Chủ Nhật
      if (dayOfWeek === 0) {
        shift = await prisma.shift.findFirst({ where: { code: 'CA_CN_SANG', isActive: true } });
      } else {
        shift = await prisma.shift.findFirst({ where: { code: 'CA_1_SANG', isActive: true } });
      }
      if (!shift) {
        shift = await prisma.shift.findFirst({ where: { code: 'CA_ALL_DAY', isActive: true } });
      }
      if (!shift) {
        shift = await prisma.shift.findFirst({ where: { code: 'CA_HC', isActive: true } });
      }
      if (!shift) {
        shift = await prisma.shift.findFirst({ where: { isActive: true } });
      }
    }

    // 3. User's assigned branch
    let branch = user.branch;
    if (!branch && user.branchId) {
      branch = await prisma.branch.findUnique({ where: { id: user.branchId } });
    }
    if (!branch) {
      branch = await prisma.branch.findFirst({ where: { isActive: true } });
    }

    return NextResponse.json({
      workDate: todayStr,
      user: {
        id: user.id,
        name: user.name,
        employeeCode: user.employeeCode,
        avatarUrl: user.avatarUrl,
        position: user.position,
      },
      shift,
      branch,
      attendance,
      serverTime: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error fetching today attendance:', error);
    return NextResponse.json({ error: 'Lỗi tải dữ liệu chấm công hôm nay' }, { status: 500 });
  }
}
