import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || (sessionUser.role !== 'SUPER_ADMIN' && sessionUser.role !== 'HR_ADMIN' && sessionUser.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Không có quyền xem lịch phân ca' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    const whereClause: any = {};
    if (userId) {
      whereClause.userId = userId;
    }

    if (month && year) {
      const padMonth = String(month).padStart(2, '0');
      const startPrefix = `${year}-${padMonth}-01`;
      const endPrefix = `${year}-${padMonth}-31`;
      whereClause.workDate = {
        gte: startPrefix,
        lte: endPrefix,
      };
    }

    const schedules = await prisma.userShiftSchedule.findMany({
      where: whereClause,
      include: {
        shift: true,
        user: {
          select: {
            id: true,
            employeeCode: true,
            name: true,
            department: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { workDate: 'asc' },
    });

    return NextResponse.json({ schedules });
  } catch (error: any) {
    console.error('Fetch schedule error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi tải lịch phân ca' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || (sessionUser.role !== 'SUPER_ADMIN' && sessionUser.role !== 'HR_ADMIN' && sessionUser.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Không có quyền phân ca' }, { status: 403 });
    }

    const body = await req.json();
    const { userId, workDate, shiftId, isOffDay } = body;

    if (!userId || !workDate) {
      return NextResponse.json({ error: 'Thiếu thông tin nhân viên hoặc ngày làm việc' }, { status: 400 });
    }

    if (!shiftId && !isOffDay) {
      // Clear schedule for this date
      await prisma.userShiftSchedule.deleteMany({
        where: { userId, workDate },
      });
      return NextResponse.json({ success: true, message: 'Đã xóa lịch ca ngày này' });
    }

    const schedule = await prisma.userShiftSchedule.upsert({
      where: {
        userId_workDate: { userId, workDate },
      },
      update: {
        shiftId: shiftId || null,
        isOffDay: Boolean(isOffDay),
      },
      create: {
        userId,
        workDate,
        shiftId: shiftId || null,
        isOffDay: Boolean(isOffDay),
      },
      include: { shift: true },
    });

    return NextResponse.json({ success: true, schedule });
  } catch (error: any) {
    console.error('Save schedule error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi lưu lịch ca' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || (sessionUser.role !== 'SUPER_ADMIN' && sessionUser.role !== 'HR_ADMIN' && sessionUser.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Không có quyền xóa phân ca' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const workDate = searchParams.get('workDate');

    if (!userId || !workDate) {
      return NextResponse.json({ error: 'Thiếu thông tin nhân viên hoặc ngày làm việc' }, { status: 400 });
    }

    await prisma.userShiftSchedule.deleteMany({
      where: { userId, workDate },
    });

    return NextResponse.json({ success: true, message: 'Đã xóa phân ca' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Lỗi xóa phân ca' }, { status: 500 });
  }
}
