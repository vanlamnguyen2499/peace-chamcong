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
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const departmentId = searchParams.get('departmentId');
    const templateCode = searchParams.get('templateCode');

    let whereClause: any = {};

    if (templateCode) {
      whereClause.template = { code: templateCode };
    }

    if (departmentId) {
      whereClause.creator = { departmentId };
    }

    if (fromDate || toDate) {
      whereClause.createdAt = {};
      if (fromDate) {
        whereClause.createdAt.gte = new Date(`${fromDate}T00:00:00.000Z`);
      }
      if (toDate) {
        whereClause.createdAt.lte = new Date(`${toDate}T23:59:59.999Z`);
      }
    }

    // Role-based visibility scoping
    if (user.role === 'EMPLOYEE') {
      whereClause.OR = [
        { creatorId: user.id },
        { steps: { some: { approverId: user.id } } },
      ];
    } else if (user.role === 'MANAGER' && user.departmentId) {
      whereClause.OR = [
        { creatorId: user.id },
        { creator: { departmentId: user.departmentId } },
        { steps: { some: { approverId: user.id } } },
      ];
    }

    const allRequests = await prisma.approvalRequest.findMany({
      where: whereClause,
      include: {
        template: true,
        creator: {
          select: {
            id: true,
            name: true,
            employeeCode: true,
            position: true,
            department: { select: { id: true, name: true, code: true } },
            branch: { select: { id: true, name: true } },
          },
        },
        steps: {
          include: {
            approver: {
              select: {
                id: true,
                name: true,
                employeeCode: true,
                position: true,
                role: true,
              },
            },
          },
          orderBy: { stepOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Aggregations
    const totalRequests = allRequests.length;
    const totalApproved = allRequests.filter((r) => r.status === 'APPROVED').length;
    const totalRejected = allRequests.filter((r) => r.status === 'REJECTED').length;
    const totalPending = allRequests.filter((r) => r.status === 'PENDING').length;
    const approvalRate = totalRequests > 0 ? ((totalApproved / (totalApproved + totalRejected || 1)) * 100).toFixed(1) : '100.0';

    // Group by Template
    const templateCounts: { [code: string]: { name: string; total: number; approved: number; rejected: number; pending: number } } = {};
    for (const reqItem of allRequests) {
      const code = reqItem.template.code;
      if (!templateCounts[code]) {
        templateCounts[code] = {
          name: reqItem.template.name,
          total: 0,
          approved: 0,
          rejected: 0,
          pending: 0,
        };
      }
      templateCounts[code].total++;
      if (reqItem.status === 'APPROVED') templateCounts[code].approved++;
      else if (reqItem.status === 'REJECTED') templateCounts[code].rejected++;
      else templateCounts[code].pending++;
    }

    // Completed for requester vs processed by approver
    const completedForRequester = allRequests.filter(
      (r) => r.creatorId === user.id && r.status !== 'PENDING'
    );
    const processedByApprover = allRequests.filter(
      (r) => r.steps.some((s) => s.approverId === user.id && s.status !== 'PENDING')
    );

    return NextResponse.json({
      summary: {
        total: totalRequests,
        approved: totalApproved,
        rejected: totalRejected,
        pending: totalPending,
        approvalRate: `${approvalRate}%`,
      },
      templateStats: Object.values(templateCounts),
      completedForRequesterCount: completedForRequester.length,
      processedByApproverCount: processedByApprover.length,
      recentRequests: allRequests.slice(0, 10).map((r) => ({
        ...r,
        data: JSON.parse(r.data || '{}'),
      })),
    });
  } catch (error: any) {
    console.error('Error fetching approval summary:', error);
    return NextResponse.json({ error: 'Lỗi tải tổng hợp phê duyệt' }, { status: 500 });
  }
}
