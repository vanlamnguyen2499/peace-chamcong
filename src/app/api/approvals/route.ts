import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendTelegramNotification } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

// Serialized in-process queue to prevent concurrent code generation collisions
let codeGenLock = Promise.resolve();
function withCodeGenLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = codeGenLock.then(fn, fn);
  codeGenLock = next.catch(() => {}) as Promise<void>;
  return next;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tab = searchParams.get('tab') || 'my_requests'; // my_requests, pending_me, history_me, all, summary
    const status = searchParams.get('status');
    const templateCode = searchParams.get('templateCode');
    const creatorId = searchParams.get('creatorId');
    const approverId = searchParams.get('approverId');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    let whereClause: any = {};

    if (status) {
      whereClause.status = status;
    }

    if (templateCode) {
      whereClause.template = { code: templateCode };
    }

    if (creatorId) {
      whereClause.creatorId = creatorId;
    }

    if (approverId) {
      whereClause.steps = {
        some: {
          approverId: approverId,
        },
      };
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

    if (tab === 'my_requests') {
      if (!creatorId) {
        whereClause.creatorId = user.id;
      }
    } else if (tab === 'pending_me') {
      whereClause.status = 'PENDING';
      whereClause.steps = {
        some: {
          status: 'PENDING',
          OR: [
            { approverId: user.id },
            { approverRole: user.role },
            ...(user.role === 'SUPER_ADMIN' ? [{ approverRole: 'HR_ADMIN' }, { approverRole: 'MANAGER' }] : []),
          ],
        },
      };
    } else if (tab === 'history_me') {
      whereClause.steps = {
        some: {
          approverId: user.id,
          status: { in: ['APPROVED', 'REJECTED'] },
        },
      };
    } else if (tab === 'all' || tab === 'summary') {
      if (user.role !== 'SUPER_ADMIN' && user.role !== 'HR_ADMIN') {
        if (user.role === 'MANAGER') {
          // Managers see their department or their own or subordinate requests
          whereClause.OR = [
            { creatorId: user.id },
            { creator: { departmentId: user.departmentId || undefined } },
            { steps: { some: { approverId: user.id } } },
          ];
        } else {
          return NextResponse.json({ error: 'Không có quyền xem toàn bộ phiếu' }, { status: 403 });
        }
      }
    }

    const requests = await prisma.approvalRequest.findMany({
      where: whereClause,
      include: {
        template: true,
        creator: {
          select: {
            id: true,
            name: true,
            employeeCode: true,
            avatarUrl: true,
            position: true,
            department: true,
            branch: true,
          },
        },
        steps: {
          include: {
            approver: {
              select: {
                id: true,
                name: true,
                email: true,
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

    // Compute user-centric overview counts
    const [myRequestsCount, myApprovedCount, myRejectedCount, myPendingCount, pendingMeCount, historyMeCount] =
      await Promise.all([
        prisma.approvalRequest.count({ where: { creatorId: user.id } }),
        prisma.approvalRequest.count({ where: { creatorId: user.id, status: 'APPROVED' } }),
        prisma.approvalRequest.count({ where: { creatorId: user.id, status: 'REJECTED' } }),
        prisma.approvalRequest.count({ where: { creatorId: user.id, status: 'PENDING' } }),
        prisma.approvalRequest.count({
          where: {
            status: 'PENDING',
            steps: {
              some: {
                status: 'PENDING',
                OR: [
                  { approverId: user.id },
                  { approverRole: user.role },
                  ...(user.role === 'SUPER_ADMIN' ? [{ approverRole: 'HR_ADMIN' }, { approverRole: 'MANAGER' }] : []),
                ],
              },
            },
          },
        }),
        prisma.approvalRequest.count({
          where: {
            steps: {
              some: {
                approverId: user.id,
                status: { in: ['APPROVED', 'REJECTED'] },
              },
            },
          },
        }),
      ]);

    const totalCompanyCount =
      user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN'
        ? await prisma.approvalRequest.count()
        : myRequestsCount;

    const parsed = requests.map((req) => ({
      ...req,
      data: JSON.parse(req.data || '{}'),
      template: {
        ...req.template,
        schemaFields: JSON.parse(req.template.schemaFields || '[]'),
        defaultSteps: JSON.parse(req.template.defaultSteps || '[]'),
      },
    }));

    return NextResponse.json({
      requests: parsed,
      counts: {
        myRequests: myRequestsCount,
        myApproved: myApprovedCount,
        myRejected: myRejectedCount,
        myPending: myPendingCount,
        pendingMe: pendingMeCount,
        historyMe: historyMeCount,
        all: totalCompanyCount,
      },
    });
  } catch (error: any) {
    console.error('Error fetching approvals:', error);
    return NextResponse.json({ error: 'Lỗi tải danh sách phê duyệt' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const body = await req.json();
    const {
      templateId,
      data,
      linkedAttendanceId,
      approvers,
      steps,
      approverId,
      paperSlipPhotoUrl,
      attachedPhotoUrl,
      paperSlipCode,
      signedByApproverName,
      signedByApproverId,
      isDigitizedOffline,
    } = body;

    if (!templateId || !data) {
      return NextResponse.json({ error: 'Thiếu thông tin mẫu phiếu hoặc dữ liệu gửi lên' }, { status: 400 });
    }

    const template = await prisma.approvalTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template || !template.isActive) {
      return NextResponse.json({ error: 'Mẫu phiếu không tồn tại hoặc đã bị khóa' }, { status: 404 });
    }

    // Parse default steps
    const defaultSteps: Array<{ stepOrder: number; approverRole?: string; label?: string; approverId?: string }> =
      JSON.parse(template.defaultSteps || '[]');

    // Build steps records with support for designated approvers
    const stepsData: Array<{ stepOrder: number; approverId?: string; approverRole?: string; status: string }> = [];

    if (defaultSteps.length === 0) {
      // Fallback 1 step: Explicit approver > Direct manager > HR
      const designatedApproverId =
        (approvers && (approvers[1] || approvers['1'])) ||
        (Array.isArray(steps) && steps.find((s) => s.stepOrder === 1)?.approverId) ||
        approverId ||
        user.managerId ||
        undefined;

      stepsData.push({
        stepOrder: 1,
        approverId: designatedApproverId,
        approverRole: designatedApproverId ? undefined : user.managerId ? undefined : 'HR_ADMIN',
        status: 'PENDING',
      });
    } else {
      for (let i = 0; i < defaultSteps.length; i++) {
        const stepDef = defaultSteps[i];
        const stepNum = stepDef.stepOrder || i + 1;

        // Priority for approver:
        // 1. Explicit approvers dictionary e.g. approvers[stepNum]
        // 2. Explicit steps array item e.g. steps[i].approverId
        // 3. Single approverId for step 1
        // 4. Default direct manager if role is MANAGER
        // 5. Default stepDef.approverId if template configured it
        let chosenApproverId: string | undefined = undefined;

        if (approvers && (approvers[stepNum] || approvers[String(stepNum)])) {
          chosenApproverId = approvers[stepNum] || approvers[String(stepNum)];
        } else if (Array.isArray(steps)) {
          const stepMatch = steps.find((s) => s.stepOrder === stepNum);
          if (stepMatch && stepMatch.approverId) {
            chosenApproverId = stepMatch.approverId;
          }
        } else if (stepNum === 1 && approverId) {
          chosenApproverId = approverId;
        } else if (stepDef.approverRole === 'MANAGER' && user.managerId) {
          chosenApproverId = user.managerId;
        } else if (stepDef.approverId) {
          chosenApproverId = stepDef.approverId;
        }

        stepsData.push({
          stepOrder: stepNum,
          approverId: chosenApproverId || undefined,
          approverRole: chosenApproverId ? undefined : stepDef.approverRole || 'MANAGER',
          status: 'PENDING',
        });
      }
    }

    // Check if Manager or HR is creating request on behalf of an employee (targetUserId)
    let effectiveCreatorId = user.id;
    let creatorUser = user;
    const potentialTargetId = body.targetUserId || data?.targetUserId || data?.userId;
    if (potentialTargetId && user.role !== 'EMPLOYEE') {
      const target = await prisma.user.findUnique({ where: { id: potentialTargetId } });
      if (target) {
        effectiveCreatorId = target.id;
        creatorUser = target as any;
      }
    }

    // Resolve optional attached photo and paper slip metadata
    const finalPhotoUrl =
      paperSlipPhotoUrl ||
      attachedPhotoUrl ||
      data?.paperSlipPhotoUrl ||
      data?.attachedPhotoUrl ||
      data?.attachmentUrl ||
      null;

    const finalSlipCode = paperSlipCode || data?.paperSlipCode || null;
    const finalSignerName = signedByApproverName || data?.signedByApproverName || null;
    const finalSignerId = signedByApproverId || data?.signedByApproverId || null;
    const isOffline = Boolean(isDigitizedOffline || body.isDigitizedOffline || finalPhotoUrl || finalSignerName);

    // Generate unique Request Code and create approval request concurrently-safe
    const newRequest = await withCodeGenLock(async () => {
      let retries = 10;
      let lastError: any = null;

      while (retries > 0) {
        try {
          const now = new Date();
          const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
          const prefix = `REQ-${yearMonth}-`;

          // Find the current highest code for this month to avoid gaps/deletions collisions
          const allMatching = await prisma.approvalRequest.findMany({
            where: { code: { startsWith: prefix } },
            select: { code: true },
          });

          let maxNum = 0;
          for (const r of allMatching) {
            const m = r.code.match(/^REQ-\d{6}-(\d+)/);
            if (m) {
              const num = parseInt(m[1], 10);
              if (!isNaN(num) && num > maxNum) {
                maxNum = num;
              }
            }
          }

          const seqStr = String(maxNum + 1).padStart(4, '0');
          const requestCode = `REQ-${yearMonth}-${seqStr}`;

          const payloadData = {
            ...data,
            targetUserId: effectiveCreatorId,
            ...(finalPhotoUrl ? { paperSlipPhotoUrl: finalPhotoUrl } : {}),
            ...(finalSlipCode ? { paperSlipCode: finalSlipCode } : {}),
            ...(finalSignerName ? { signedByApproverName: finalSignerName } : {}),
            ...(effectiveCreatorId !== user.id
              ? { submittedBy: user.id, submitterName: user.name, submitterRole: user.role }
              : {}),
          };

          return await prisma.approvalRequest.create({
            data: {
              code: requestCode,
              templateId: template.id,
              creatorId: effectiveCreatorId,
              currentStep: 1,
              status: 'PENDING',
              data: JSON.stringify(payloadData),
              linkedAttendanceId: linkedAttendanceId || undefined,
              paperSlipPhotoUrl: finalPhotoUrl,
              paperSlipCode: finalSlipCode,
              signedByApproverName: finalSignerName,
              signedByApproverId: finalSignerId,
              isDigitizedOffline: isOffline,
              steps: {
                create: stepsData,
              },
            },
            include: {
              steps: {
                include: {
                  approver: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      employeeCode: true,
                    },
                  },
                },
              },
              template: true,
            },
          });
        } catch (err: any) {
          // Retry on Prisma unique constraint collision on 'code'
          if (err.code === 'P2002' && (err.meta?.target?.includes('code') || String(err).includes('code'))) {
            retries--;
            lastError = err;
            if (retries === 0) break;
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 25 + 5));
            continue;
          }
          throw err;
        }
      }

      throw lastError || new Error('Không thể sinh mã phiếu duy nhất sau nhiều lần thử');
    });

    const requestCode = newRequest.code;

    // Send in-app notification to the first step designated approver or role
    const firstStep = newRequest.steps[0];
    if (firstStep) {
      if (firstStep.approverId) {
        await prisma.notification.create({
          data: {
            userId: firstStep.approverId,
            title: `Phiếu mới cần duyệt: ${template.name}`,
            message: `${user.name} (${user.employeeCode}) vừa chỉ định bạn duyệt yêu cầu ${requestCode}.`,
            link: `/approvals/${newRequest.id}`,
            type: 'APPROVAL',
          },
        });
      } else if (firstStep.approverRole) {
        const approversWithRole = await prisma.user.findMany({
          where: { role: firstStep.approverRole, isActive: true },
        });
        for (const approver of approversWithRole) {
          await prisma.notification.create({
            data: {
              userId: approver.id,
              title: `Phiếu mới cần duyệt: ${template.name}`,
              message: `${user.name} (${user.employeeCode}) vừa gửi yêu cầu ${requestCode}.`,
              link: `/approvals/${newRequest.id}`,
              type: 'APPROVAL',
            },
          });
        }
      }
    }

    // Dispatch Telegram Bot alert
    const telegramMsg = `🔔 <b>[PHIẾU MỚI CẦN DUYỆT]</b>\n` +
      `📌 <b>Loại phiếu:</b> ${template.name}\n` +
      `👤 <b>Người tạo:</b> ${user.name} (${user.employeeCode} - ${user.position || 'Nhân viên'})\n` +
      `🔖 <b>Mã phiếu:</b> <code>${requestCode}</code>\n` +
      `📝 <b>Lý do:</b> ${data.reason || data.purpose || 'Xem chi tiết trong hệ thống'}\n` +
      `👉 <i>Vui lòng vào hệ thống để xem và phê duyệt.</i>`;
    sendTelegramNotification(telegramMsg).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Gửi phiếu phê duyệt thành công!',
      request: newRequest,
    });
  } catch (error: any) {
    console.error('Error creating approval request:', error);
    return NextResponse.json({ error: error.message || 'Lỗi gửi phiếu phê duyệt' }, { status: 500 });
  }
}
