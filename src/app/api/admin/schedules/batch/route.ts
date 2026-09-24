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
    const { userIds, weekdayShifts, sundayShifts } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'Vui lòng chọn nhân viên' }, { status: 400 });
    }

    await prisma.user.updateMany({
      where: {
        id: { in: userIds }
      },
      data: {
        weekdayShifts: Number(weekdayShifts) || 0,
        sundayShifts: Number(sundayShifts) || 0,
      }
    });

    return NextResponse.json({
      success: true,
      message: `Đã cài đặt định mức ca thành công cho ${userIds.length} nhân sự.`,
    });
  } catch (error: any) {
    console.error('Batch schedule error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi cài đặt ca' }, { status: 500 });
  }
}
