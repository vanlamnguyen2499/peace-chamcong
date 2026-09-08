import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });

    const shifts = await prisma.shift.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ shifts });
  } catch (error: any) {
    return NextResponse.json({ error: 'Lỗi tải danh sách ca làm việc' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'HR_ADMIN')) {
      return NextResponse.json({ error: 'Không có quyền tạo ca làm việc' }, { status: 403 });
    }

    const body = await req.json();
    const { name, code, startTime, endTime, breakStartTime, breakEndTime, gracePeriodLate, gracePeriodEarly, workUnits, isFlexible, minWorkHours } = body;

    if (!name || !code || !startTime || !endTime) {
      return NextResponse.json({ error: 'Vui lòng nhập tên, mã, giờ bắt đầu và giờ kết thúc ca' }, { status: 400 });
    }

    const newShift = await prisma.shift.create({
      data: {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        startTime,
        endTime,
        breakStartTime: breakStartTime || null,
        breakEndTime: breakEndTime || null,
        gracePeriodLate: Number(gracePeriodLate) || 15,
        gracePeriodEarly: Number(gracePeriodEarly) || 15,
        workUnits: Number(workUnits) || 1.0,
        isFlexible: Boolean(isFlexible),
        minWorkHours: Number(minWorkHours) || 8.0,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, shift: newShift });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Lỗi tạo ca làm việc' }, { status: 500 });
  }
}
