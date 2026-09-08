import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
      return NextResponse.json({ error: 'Không tìm thấy đơn yêu cầu' }, { status: 404 });
    }

    // Check permissions
    const isCreator = request.creatorId === user.id;
    const isApproverInChain = request.steps.some(
      (s) => s.approverId === user.id || s.approverRole === user.role
    );
    const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN';

    if (!isCreator && !isApproverInChain && !isAdmin) {
      return NextResponse.json({ error: 'Bạn không có quyền xem đơn này' }, { status: 403 });
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
    return NextResponse.json({ error: 'Lỗi tải chi tiết đơn yêu cầu' }, { status: 500 });
  }
}
