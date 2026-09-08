import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'HR_ADMIN' && user.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Không có quyền xem danh sách nhân sự' }, { status: 403 });
    }

    const whereClause: any = {};
    if (user.role === 'MANAGER') {
      if (user.departmentId) {
        whereClause.departmentId = user.departmentId;
      } else {
        whereClause.OR = [{ id: user.id }, { managerId: user.id }];
      }
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        employeeCode: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        position: true,
        annualLeaveQuota: true,
        annualLeaveUsed: true,
        isActive: true,
        branch: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
        manager: { select: { id: true, name: true, employeeCode: true } },
        createdAt: true,
      },
      orderBy: { employeeCode: 'asc' },
    });

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Lỗi tải danh sách người dùng' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || (sessionUser.role !== 'SUPER_ADMIN' && sessionUser.role !== 'HR_ADMIN')) {
      return NextResponse.json({ error: 'Không có quyền tạo nhân sự' }, { status: 403 });
    }

    const body = await req.json();
    const { employeeCode, name, email, password, phone, role, position, branchId, departmentId, managerId, annualLeaveQuota } = body;

    if (!employeeCode || !name || !email || !password) {
      return NextResponse.json({ error: 'Vui lòng điền đủ Mã NV, Họ Tên, Email và Mật khẩu' }, { status: 400 });
    }

    const existingEmail = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existingEmail) {
      return NextResponse.json({ error: 'Email này đã tồn tại trong hệ thống' }, { status: 400 });
    }

    const existingCode = await prisma.user.findUnique({ where: { employeeCode: employeeCode.trim() } });
    if (existingCode) {
      return NextResponse.json({ error: 'Mã nhân viên này đã được sử dụng' }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    const newUser = await prisma.user.create({
      data: {
        employeeCode: employeeCode.trim(),
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        phone: phone || null,
        role: role || 'EMPLOYEE',
        position: position || null,
        branchId: branchId || null,
        departmentId: departmentId || null,
        managerId: managerId || null,
        annualLeaveQuota: Number(annualLeaveQuota) || 12.0,
        annualLeaveUsed: 0.0,
        isActive: true,
      },
      include: {
        branch: true,
        department: true,
        manager: true,
      },
    });

    return NextResponse.json({ success: true, user: newUser });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: error.message || 'Lỗi tạo nhân sự mới' }, { status: 500 });
  }
}
