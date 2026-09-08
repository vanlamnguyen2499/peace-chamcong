import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getWorkDateString } from '@/lib/time';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const todayStr = getWorkDateString(new Date());

    // Get today's attendance if exists
    const todayAttendance = await prisma.attendance.findUnique({
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

    // Get today's assigned shift if any
    const todaySchedule = await prisma.userShiftSchedule.findUnique({
      where: {
        userId_workDate: {
          userId: user.id,
          workDate: todayStr,
        },
      },
      include: {
        shift: true,
      },
    });

    // Count unread notifications
    const unreadNotificationsCount = await prisma.notification.count({
      where: {
        userId: user.id,
        isRead: false,
      },
    });

    // Count pending approvals to be reviewed by this user
    let pendingApprovalsCount = 0;
    if (user.role !== 'EMPLOYEE') {
      pendingApprovalsCount = await prisma.approvalStep.count({
        where: {
          status: 'PENDING',
          request: {
            status: 'PENDING',
          },
          OR: [
            { approverId: user.id },
            { approverRole: user.role },
            ...(user.role === 'SUPER_ADMIN' ? [{ approverRole: 'SUPER_ADMIN' }, { approverRole: 'HR_ADMIN' }, { approverRole: 'MANAGER' }] : []),
          ],
        },
      });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        employeeCode: user.employeeCode,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        role: user.role,
        position: user.position,
        annualLeaveQuota: user.annualLeaveQuota,
        annualLeaveUsed: user.annualLeaveUsed,
        branch: user.branch,
        department: user.department,
        manager: user.manager ? { id: user.manager.id, name: user.manager.name, email: user.manager.email } : null,
      },
      todaySchedule: todaySchedule?.shift || null,
      todayAttendance,
      unreadNotificationsCount,
      pendingApprovalsCount,
    });
  } catch (error: any) {
    console.error('Get session error:', error);
    return NextResponse.json({ error: 'Lỗi kiểm tra phiên đăng nhập' }, { status: 500 });
  }
}
