import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revertApprovalSideEffects } from '@/lib/approvalEffects';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const { id } = params;

    const request = await prisma.approvalRequest.findUnique({
      where: { id },
      include: {
        template: true,
        creator: {
          include: {
            department: true,
            branch: true,
            manager: true,
          },
        },
        steps: {
          include: {
            approver: {
              select: {
                id: true,
                name: true,
                email: true,
                position: true,
                role: true,
              },
            },
          },
          orderBy: { stepOrder: 'asc' },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!request) {
      return NextResponse.json({ error: 'Không tìm thấy phiếu yêu cầu' }, { status: 404 });
    }

    // Check permissions
    const isCreator = request.creatorId === user.id;
    const isApproverInChain = request.steps.some(
      (s) => s.approverId === user.id || s.approverRole === user.role
    );
    const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN';

    if (!isCreator && !isApproverInChain && !isAdmin) {
      return NextResponse.json({ error: 'Bạn không có quyền xem phiếu này' }, { status: 403 });
    }

    // Determine if current logged-in user can act on the current step
    const currentStepObj = request.steps.find((s) => s.stepOrder === request.currentStep && s.status === 'PENDING');
    let canApprove = false;
    if (currentStepObj && request.status === 'PENDING') {
      if (currentStepObj.approverId === user.id) canApprove = true;
      else if (currentStepObj.approverRole === user.role) canApprove = true;
      else if (user.role === 'SUPER_ADMIN') canApprove = true;
      else if (user.role === 'HR_ADMIN' && currentStepObj.approverRole === 'HR_ADMIN') canApprove = true;
    }

    const parsed = {
      ...request,
      data: JSON.parse(request.data || '{}'),
      template: {
        ...request.template,
        schemaFields: JSON.parse(request.template.schemaFields || '[]'),
        defaultSteps: JSON.parse(request.template.defaultSteps || '[]'),
      },
      canApprove,
      currentStepObj,
    };

    return NextResponse.json({ request: parsed });
  } catch (error: any) {
    console.error('Error fetching approval detail:', error);
    return NextResponse.json({ error: 'Lỗi tải chi tiết phiếu yêu cầu' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const { id } = params;

    const request = await prisma.approvalRequest.findUnique({
      where: { id },
      include: { template: true },
    });

    if (!request) {
      return NextResponse.json({ error: 'Không tìm thấy phiếu' }, { status: 404 });
    }

    // Role check: HR_ADMIN or regular creator can request deletion (do nhập nhầm)
    // MANAGER or SUPER_ADMIN can approve and delete directly
    if (user.role === 'HR_ADMIN' || (user.role === 'EMPLOYEE' && request.creatorId === user.id)) {
      await prisma.approvalRequest.update({
        where: { id },
        data: { status: 'PENDING_DELETE' },
      });

      // In-app alert for Managers & Super Admins
      const managersAndAdmins = await prisma.user.findMany({
        where: { role: { in: ['SUPER_ADMIN', 'MANAGER'] }, isActive: true },
      });
      for (const m of managersAndAdmins) {
        await prisma.notification.create({
          data: {
            userId: m.id,
            title: `Yêu cầu xác nhận xóa phiếu ${request.code}`,
            message: `Nhân sự ${user.name} yêu cầu xóa phiếu ${request.code} (${request.template?.name || ''}) do nhập nhầm.`,
            link: `/admin/delete-requests`,
            type: 'APPROVAL',
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Đã xác nhận yêu cầu xóa phiếu (do nhập nhầm). Vui lòng chờ Quản lý hoặc Admin xác nhận.',
      });
    }

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Không có quyền xóa phiếu này' }, { status: 403 });
    }

    // MANAGER / SUPER_ADMIN direct deletion & side-effect reversion
    await prisma.$transaction(async (tx) => {
      if (request.status === 'APPROVED' || request.status === 'PENDING_DELETE') {
        const formData = JSON.parse(request.data || '{}') as any;
        await revertApprovalSideEffects(tx, request, request.template?.code || '', formData, request.creatorId);
      }

      await tx.approvalRequest.delete({
        where: { id },
      });
    });

    return NextResponse.json({ success: true, message: 'Đã xóa phiếu và hoàn tác dữ liệu thành công' });
  } catch (error: any) {
    console.error('Delete request error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi xóa phiếu' }, { status: 500 });
  }
}
