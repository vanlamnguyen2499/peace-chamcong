import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revertApprovalSideEffects } from '@/lib/approvalEffects';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'MANAGER' && user.role !== 'HR_ADMIN')) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const requests = await prisma.approvalRequest.findMany({
      where: { status: 'PENDING_DELETE' },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            employeeCode: true,
            position: true,
            department: true,
            branch: true,
          },
        },
        template: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ success: true, requests });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Lỗi tải dữ liệu' }, { status: 500 });
  }
}

// POST is used to APPROVE deletions (Force deletion + Revert business effects)
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Chỉ Quản lý hoặc Admin mới có quyền duyệt xóa phiếu' }, { status: 403 });
    }

    const { requestIds } = await req.json();
    if (!requestIds || !Array.isArray(requestIds)) {
      return NextResponse.json({ error: 'Danh sách phiếu không hợp lệ' }, { status: 400 });
    }

    let successCount = 0;
    
    await prisma.$transaction(async (tx) => {
      for (const id of requestIds) {
        const request = await tx.approvalRequest.findUnique({
          where: { id },
          include: { template: true }
        });

        if (!request || request.status !== 'PENDING_DELETE') continue;

        // Revert side-effects cleanly
        const formData = JSON.parse(request.data || '{}') as any;
        await revertApprovalSideEffects(tx, request, request.template?.code || '', formData, request.creatorId);

        await tx.approvalRequest.delete({ where: { id } });
        successCount++;
      }
    });

    return NextResponse.json({ success: true, message: `Đã duyệt xóa thành công ${successCount} phiếu (đã hoàn tác công & phép)` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Lỗi duyệt xóa' }, { status: 500 });
  }
}

// PUT is used to REJECT deletions (revert to APPROVED)
export async function PUT(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Chỉ Quản lý hoặc Admin mới có quyền từ chối xóa phiếu' }, { status: 403 });
    }

    const { requestIds } = await req.json();
    if (!requestIds || !Array.isArray(requestIds)) {
      return NextResponse.json({ error: 'Danh sách phiếu không hợp lệ' }, { status: 400 });
    }

    await prisma.approvalRequest.updateMany({
      where: {
        id: { in: requestIds },
        status: 'PENDING_DELETE'
      },
      data: { status: 'APPROVED' }
    });

    return NextResponse.json({ success: true, message: `Đã từ chối yêu cầu xóa cho ${requestIds.length} phiếu` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Lỗi từ chối xóa' }, { status: 500 });
  }
}
