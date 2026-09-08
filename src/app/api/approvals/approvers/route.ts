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
    const role = searchParams.get('role'); // Filter by role (optional)

    const whereClause: any = {
      isActive: true,
    };

    if (role) {
      whereClause.role = role;
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        employeeCode: true,
        name: true,
        email: true,
        role: true,
        position: true,
        avatarUrl: true,
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' },
        { name: 'asc' },
      ],
    });

    // Determine recommended approvers based on current user context
    const directManager = user.managerId
      ? users.find((u) => u.id === user.managerId) || null
      : null;

    const hrAdmins = users.filter((u) => u.role === 'HR_ADMIN');
    const managers = users.filter((u) => u.role === 'MANAGER');
    const superAdmins = users.filter((u) => u.role === 'SUPER_ADMIN');

    return NextResponse.json({
      users,
      recommendations: {
        directManager,
        defaultHr: hrAdmins[0] || null,
        defaultSuperAdmin: superAdmins[0] || null,
      },
      groups: {
        managers,
        hrAdmins,
        superAdmins,
        all: users,
      },
    });
  } catch (error: any) {
    console.error('Error fetching eligible approvers:', error);
    return NextResponse.json({ error: 'Lỗi tải danh sách người duyệt' }, { status: 500 });
  }
}
