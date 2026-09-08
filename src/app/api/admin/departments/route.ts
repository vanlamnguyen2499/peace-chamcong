import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });

    const departments = await prisma.department.findMany({
      include: {
        manager: { select: { id: true, name: true, employeeCode: true } },
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ departments });
  } catch (error: any) {
    return NextResponse.json({ error: 'Lỗi tải danh sách phòng ban' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Không có quyền tạo phòng ban' }, { status: 403 });
    }

    const { name, code, parentId, managerId } = await req.json();

    if (!name || !code) {
      return NextResponse.json({ error: 'Vui lòng nhập tên và mã phòng ban' }, { status: 400 });
    }

    const newDept = await prisma.department.create({
      data: {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        parentId: parentId || null,
        managerId: managerId || null,
      },
    });

    return NextResponse.json({ success: true, department: newDept });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Lỗi tạo phòng ban' }, { status: 500 });
  }
}
