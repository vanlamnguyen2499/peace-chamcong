import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'HR_ADMIN')) {
      return NextResponse.json({ error: 'Không có quyền cập nhật ca làm việc' }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();
    const { name, startTime, endTime, breakStartTime, breakEndTime, gracePeriodLate, gracePeriodEarly, workUnits, isFlexible, minWorkHours, isActive } = body;

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (startTime) updateData.startTime = startTime;
    if (endTime) updateData.endTime = endTime;
    if (breakStartTime !== undefined) updateData.breakStartTime = breakStartTime;
    if (breakEndTime !== undefined) updateData.breakEndTime = breakEndTime;
    if (gracePeriodLate !== undefined) updateData.gracePeriodLate = Number(gracePeriodLate);
    if (gracePeriodEarly !== undefined) updateData.gracePeriodEarly = Number(gracePeriodEarly);
    if (workUnits !== undefined) updateData.workUnits = Number(workUnits);
    if (isFlexible !== undefined) updateData.isFlexible = Boolean(isFlexible);
    if (minWorkHours !== undefined) updateData.minWorkHours = Number(minWorkHours);
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const updated = await prisma.shift.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, shift: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Lỗi cập nhật ca làm việc' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'HR_ADMIN')) {
      return NextResponse.json({ error: 'Không có quyền xóa ca làm việc' }, { status: 403 });
    }

    const { id } = params;
    await prisma.shift.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Đã xóa ca làm việc' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Lỗi xóa ca làm việc' }, { status: 500 });
  }
}
