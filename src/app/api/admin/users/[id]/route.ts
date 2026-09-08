import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || (sessionUser.role !== 'SUPER_ADMIN' && sessionUser.role !== 'HR_ADMIN')) {
      return NextResponse.json({ error: 'Không có quyền cập nhật nhân sự' }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();
    const { name, phone, role, position, branchId, departmentId, managerId, annualLeaveQuota, annualLeaveUsed, isActive, password } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (phone !== undefined) updateData.phone = phone;
    if (role !== undefined) updateData.role = role;
    if (position !== undefined) updateData.position = position;
    if (branchId !== undefined) updateData.branchId = branchId || null;
    if (departmentId !== undefined) updateData.departmentId = departmentId || null;
    if (managerId !== undefined) updateData.managerId = managerId || null;
    if (annualLeaveQuota !== undefined) updateData.annualLeaveQuota = Number(annualLeaveQuota);
    if (annualLeaveUsed !== undefined) updateData.annualLeaveUsed = Number(annualLeaveUsed);
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    if (password && password.trim().length >= 6) {
      updateData.passwordHash = await hashPassword(password);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: error.message || 'Lỗi cập nhật nhân sự' }, { status: 500 });
  }
}
