import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Helper function to apply business side-effects when an offline slip is digitized and auto-approved
 */
async function applyDigitizedSlipSideEffects(
  tx: any,
  request: any,
  templateCode: string,
  formData: any,
  creatorId: string
) {
  const workDate = formData.workDate || formData.startDate;

  // 1. Nhóm Nghỉ Phép (LEAVE_ANNUAL, LEAVE_UNPAID, LEAVE_SICK, LEAVE_SPECIAL, LEAVE_HALF_SHIFT, LEAVE)
  if (
    templateCode === 'LEAVE' ||
    templateCode === 'LEAVE_ANNUAL' ||
    templateCode === 'LEAVE_UNPAID' ||
    templateCode === 'LEAVE_SICK' ||
    templateCode === 'LEAVE_SPECIAL' ||
    templateCode === 'LEAVE_HALF_SHIFT'
  ) {
    const isHalfShift = templateCode === 'LEAVE_HALF_SHIFT';
    const isUnpaid = templateCode === 'LEAVE_UNPAID' || (formData.leaveType && formData.leaveType.includes('không lương'));
    const duration = isHalfShift ? 0.5 : (Number(formData.duration) || 1.0);
    const leaveWorkUnits = isUnpaid ? 0.0 : duration;

    // Trừ quỹ phép năm nếu là phép năm có lương
    if (
      templateCode === 'LEAVE_ANNUAL' ||
      (templateCode === 'LEAVE' && (formData.leaveType?.includes('phép năm') || formData.leaveType?.includes('có lương')))
    ) {
      await tx.user.update({
        where: { id: creatorId },
        data: {
          annualLeaveUsed: { increment: duration },
        },
      });
    }

    if (workDate) {
      await tx.attendance.upsert({
        where: {
          userId_workDate: {
            userId: creatorId,
            workDate: workDate,
          },
        },
        update: {
          status: 'LEAVE',
          calculatedWorkUnits: leaveWorkUnits,
          lateMinutes: 0,
          earlyMinutes: 0,
          note: `Nghỉ phép đã số hóa từ giấy ký tay: ${request.template.name} (${duration} công, Mã ${request.code})`,
        },
        create: {
          userId: creatorId,
          workDate: workDate,
          status: 'LEAVE',
          calculatedWorkUnits: leaveWorkUnits,
          lateMinutes: 0,
          earlyMinutes: 0,
          note: `Nghỉ phép đã số hóa từ giấy ký tay: ${request.template.name} (${duration} công, Mã ${request.code})`,
        },
      });
    }
  }

  // 2. Nhóm Quên Chấm Công / Giải Trình (FORGOT_CHECKIN_CONFIRM, ADJUSTMENT)
  else if (templateCode === 'FORGOT_CHECKIN_CONFIRM' || templateCode === 'ADJUSTMENT') {
    const inTimeStr = formData.checkInTime || '08:00';
    const outTimeStr = formData.checkOutTime || '17:30';

    if (workDate) {
      const inDate = new Date(`${workDate}T${inTimeStr}:00`);
      const outDate = new Date(`${workDate}T${outTimeStr}:00`);

      // Check schedule to get shift workUnits
      const schedule = await tx.userShiftSchedule.findUnique({
        where: {
          userId_workDate: {
            userId: creatorId,
            workDate: workDate,
          },
        },
        include: { shift: true },
      });

      let shift: any = schedule?.shift;
      if (!shift && formData.shiftId) {
        shift = await tx.shift.findUnique({ where: { id: formData.shiftId } });
      }
      if (!shift && formData.shiftCode) {
        shift = await tx.shift.findFirst({ where: { code: formData.shiftCode } });
      }
      if (!shift) {
        shift = await tx.shift.findFirst({ where: { code: 'CA_ALL_DAY' } });
      }
      if (!shift) {
        shift = await tx.shift.findFirst({ where: { code: 'CA_1_SANG' } });
      }
      if (!shift) {
        shift = await tx.shift.findFirst({ where: { isActive: true } });
      }

      const targetUnits = shift?.workUnits || 1.0;
      const targetHours = shift?.minWorkHours || 8.0;

      await tx.attendance.upsert({
        where: {
          userId_workDate: {
            userId: creatorId,
            workDate: workDate,
          },
        },
        update: {
          shiftId: shift?.id,
          checkInTime: inDate,
          checkInStatus: 'MANUAL',
          checkOutTime: outDate,
          checkOutStatus: 'MANUAL',
          lateMinutes: 0,
          earlyMinutes: 0,
          workHours: targetHours,
          otHours: 0,
          calculatedWorkUnits: targetUnits,
          status: 'EXPLAINED',
          note: `Quên chấm công (Đã số hóa từ phiếu ký tay của Bác sĩ/Quản lý): ${formData.reason || ''} (Mã ${request.code})`,
        },
        create: {
          userId: creatorId,
          workDate: workDate,
          shiftId: shift?.id,
          checkInTime: inDate,
          checkInStatus: 'MANUAL',
          checkOutTime: outDate,
          checkOutStatus: 'MANUAL',
          lateMinutes: 0,
          earlyMinutes: 0,
          workHours: targetHours,
          otHours: 0,
          calculatedWorkUnits: targetUnits,
          status: 'EXPLAINED',
          note: `Quên chấm công (Đã số hóa từ phiếu ký tay của Bác sĩ/Quản lý): ${formData.reason || ''} (Mã ${request.code})`,
        },
      });
    }
  }

  // 3. Nhóm Xác Nhận Đi Trễ / Về Sớm (LATE_EARLY_CONFIRM, LATE_EARLY)
  else if (templateCode === 'LATE_EARLY_CONFIRM' || templateCode === 'LATE_EARLY') {
    if (workDate) {
      const att = await tx.attendance.findUnique({
        where: { userId_workDate: { userId: creatorId, workDate } },
        include: { shift: true },
      });
      if (att) {
        const restoredUnits = att.shift?.workUnits || (att.calculatedWorkUnits === 2.0 ? 3.0 : att.calculatedWorkUnits || 1.0);
        await tx.attendance.update({
          where: { id: att.id },
          data: {
            lateMinutes: 0,
            earlyMinutes: 0,
            calculatedWorkUnits: restoredUnits,
            status: 'EXPLAINED',
            note: `${att.note ? att.note + ' | ' : ''}Miễn phạt đi trễ (Số hóa từ phiếu Bác sĩ ký, Mã ${request.code})`,
          },
        });
      }
    }
  }

  // 4. Nhóm Xác Nhận Tăng Ca OT x2 (OVERTIME_X2_CONFIRM, OVERTIME)
  else if (templateCode === 'OVERTIME_X2_CONFIRM' || templateCode === 'OVERTIME') {
    let calculatedOtHours = 0;

    if (templateCode === 'OVERTIME_X2_CONFIRM') {
      let rawMinutes = Number(formData.actualMinutes || 0);
      if (!rawMinutes && formData.otStartTime && formData.otEndTime) {
        const [sh, sm] = formData.otStartTime.split(':').map(Number);
        const [eh, em] = formData.otEndTime.split(':').map(Number);
        rawMinutes = Math.max(0, eh * 60 + em - (sh * 60 + sm));
      }
      if (rawMinutes >= 15) {
        calculatedOtHours = Math.round(((rawMinutes * 2) / 60) * 10) / 10;
      }
    } else {
      if (formData.estimatedHours) {
        calculatedOtHours = Number(formData.estimatedHours);
      } else if (formData.otHours) {
        calculatedOtHours = Number(formData.otHours);
      } else if (formData.actualMinutes) {
        calculatedOtHours = Math.round((Number(formData.actualMinutes) / 60) * 10) / 10;
      } else {
        calculatedOtHours = 1.0;
      }
    }

    if (workDate && calculatedOtHours > 0) {
      await tx.attendance.upsert({
        where: {
          userId_workDate: {
            userId: creatorId,
            workDate: workDate,
          },
        },
        update: {
          otHours: calculatedOtHours,
          note: `Tăng ca OT x2 đã số hóa từ phiếu ký tay (+${calculatedOtHours}h) (Mã ${request.code})`,
        },
        create: {
          userId: creatorId,
          workDate: workDate,
          calculatedWorkUnits: 1.0,
          workHours: 8.0,
          otHours: calculatedOtHours,
          status: 'PRESENT',
          note: `Tăng ca OT x2 đã số hóa từ phiếu ký tay (+${calculatedOtHours}h) (Mã ${request.code})`,
        },
      });
    }
  }

  // 5. Nhóm Đi Học / Đào Tạo / Công Tác (TRAINING_REQUEST, BUSINESS_TRIP)
  else if (templateCode === 'TRAINING_REQUEST' || templateCode === 'BUSINESS_TRIP') {
    if (workDate) {
      const units = templateCode === 'TRAINING_REQUEST' ? 2.0 : 1.0;
      await tx.attendance.upsert({
        where: {
          userId_workDate: {
            userId: creatorId,
            workDate: workDate,
          },
        },
        update: {
          calculatedWorkUnits: units,
          workHours: units * 4.0,
          lateMinutes: 0,
          earlyMinutes: 0,
          status: 'EXPLAINED',
          note: `${templateCode === 'TRAINING_REQUEST' ? 'Đi học đào tạo đặc cách (2 ca)' : 'Công tác tuyến'} (Số hóa từ phiếu Bác sĩ ký, Mã ${request.code})`,
        },
        create: {
          userId: creatorId,
          workDate: workDate,
          calculatedWorkUnits: units,
          workHours: units * 4.0,
          lateMinutes: 0,
          earlyMinutes: 0,
          status: 'EXPLAINED',
          note: `${templateCode === 'TRAINING_REQUEST' ? 'Đi học đào tạo đặc cách (2 ca)' : 'Công tác tuyến'} (Số hóa từ phiếu Bác sĩ ký, Mã ${request.code})`,
        },
      });
    }
  }
}

/**
 * POST /api/approvals/digitize
 * HR directly enters and auto-approves handwritten slips signed by Doctors/Managers.
 * Supports both Single Slip object and Batch Array ({ items: [...] })
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'HR_ADMIN')) {
      return NextResponse.json({ error: 'Chỉ HR hoặc Quản trị viên mới có quyền số hóa phiếu xác nhận ký tay' }, { status: 403 });
    }

    const body = await req.json();
    const rawItems = Array.isArray(body.items) ? body.items : [body];

    if (rawItems.length === 0) {
      return NextResponse.json({ error: 'Danh sách phiếu số hóa trống' }, { status: 400 });
    }

    const processedRequests: any[] = [];
    const now = new Date();
    const yearMonth = now.toISOString().slice(0, 7).replace('-', '');

    for (const item of rawItems) {
      const {
        templateId,
        templateCode,
        targetUserId,
        signedByApproverId,
        signedByApproverName,
        data,
        paperSlipPhotoUrl,
        paperSlipCode,
        note,
      } = item;

      // 1. Resolve target user (Employee)
      const employeeId = targetUserId || item.creatorId || item.userId;
      if (!employeeId) {
        throw new Error('Vui lòng chọn nhân sự được xác nhận / tạo phiếu');
      }

      const employee = await prisma.user.findUnique({
        where: { id: employeeId },
        include: { department: true },
      });
      if (!employee) {
        throw new Error(`Không tìm thấy nhân viên với ID ${employeeId}`);
      }

      // 2. Resolve template
      let template = null;
      if (templateId) {
        template = await prisma.approvalTemplate.findUnique({ where: { id: templateId } });
      }
      if (!template && templateCode) {
        template = await prisma.approvalTemplate.findFirst({ where: { code: templateCode } });
      }
      if (!template) {
        template = (await prisma.approvalTemplate.findFirst({ where: { code: 'FORGOT_CHECKIN_CONFIRM' } })) ||
                   (await prisma.approvalTemplate.findFirst({ where: { code: 'LEAVE_ANNUAL' } }));
      }
      if (!template) {
        throw new Error('Không tìm thấy mẫu phiếu phù hợp để số hóa');
      }

      // 3. Resolve signing Doctor/Manager
      let doctorApprover = null;
      if (signedByApproverId) {
        doctorApprover = await prisma.user.findUnique({ where: { id: signedByApproverId } });
      }
      if (!doctorApprover && signedByApproverName) {
        doctorApprover = await prisma.user.findFirst({
          where: { name: { contains: signedByApproverName } },
        });
      }
      if (!doctorApprover) {
        // Fallback to department manager or first active manager
        doctorApprover = (await prisma.user.findFirst({
          where: { role: 'MANAGER', isActive: true },
        })) || (await prisma.user.findFirst({
          where: { role: 'SUPER_ADMIN', isActive: true },
        }));
      }

      const finalDoctorName = signedByApproverName || doctorApprover?.name || 'Bác sĩ / Quản lý chi nhánh';

      // 4. Generate unique request code safely
      const prefix = `REQ-${yearMonth}-`;
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

      const nextSeq = maxNum + 1 + processedRequests.length;
      const seqStr = String(nextSeq).padStart(4, '0');
      const requestCode = `REQ-${yearMonth}-${seqStr}`;

      // 5. Transaction: Create Request, create 2 completed ApprovalSteps, and apply side-effects
      const savedRequest = await prisma.$transaction(async (tx) => {
        const formData = typeof data === 'object' ? data : (data ? JSON.parse(data) : {});

        // Create Request as APPROVED
        const reqRecord = await tx.approvalRequest.create({
          data: {
            code: requestCode,
            templateId: template.id,
            creatorId: employee.id,
            status: 'APPROVED',
            currentStep: 2,
            data: JSON.stringify(formData),
            isDigitizedOffline: true,
            signedByApproverId: doctorApprover?.id,
            signedByApproverName: finalDoctorName,
            paperSlipPhotoUrl: paperSlipPhotoUrl || null,
            paperSlipCode: paperSlipCode || null,
          },
          include: {
            template: true,
            creator: {
              select: {
                id: true,
                employeeCode: true,
                name: true,
                department: { select: { name: true } },
              },
            },
          },
        });

        // Step 1: Doctor/Manager offline signature confirmation
        await tx.approvalStep.create({
          data: {
            requestId: reqRecord.id,
            stepOrder: 1,
            approverId: doctorApprover?.id,
            approverRole: doctorApprover?.role || 'MANAGER',
            status: 'APPROVED',
            note: `Bác sĩ / Quản lý (${finalDoctorName}) đã ký xác nhận trên phiếu giấy thực tế`,
            actedAt: now,
          },
        });

        // Step 2: HR digitization verification
        await tx.approvalStep.create({
          data: {
            requestId: reqRecord.id,
            stepOrder: 2,
            approverId: user.id,
            approverRole: 'HR_ADMIN',
            status: 'APPROVED',
            note: `HR (${user.name}) đã đối soát chứng từ và số hóa lên hệ thống: ${note || 'Hồ sơ đầy đủ, hợp lệ'}`,
            actedAt: now,
          },
        });

        // Apply all business side-effects into Attendance and User records
        await applyDigitizedSlipSideEffects(tx, reqRecord, template.code, formData, employee.id);

        // Notifications
        // To Employee
        await tx.notification.create({
          data: {
            userId: employee.id,
            title: `Phiếu xác nhận đã được HR số hóa & duyệt: ${template.name}`,
            message: `HR (${user.name}) đã cập nhật phiếu có chữ ký của ${finalDoctorName}. Công/OT của bạn đã được ghi nhận trên hệ thống.`,
            link: `/approvals/${reqRecord.id}`,
            type: 'APPROVAL',
          },
        });

        // To Doctor / Manager (if distinct from HR)
        if (doctorApprover && doctorApprover.id !== user.id) {
          await tx.notification.create({
            data: {
              userId: doctorApprover.id,
              title: `Đã số hóa phiếu ký tay của bạn: ${template.name}`,
              message: `HR đã số hóa phiếu xác nhận của nhân viên ${employee.name} (${employee.employeeCode}) do bạn ký tay.`,
              link: `/approvals/${reqRecord.id}`,
              type: 'APPROVAL',
            },
          });
        }

        return reqRecord;
      });

      processedRequests.push(savedRequest);
    }

    return NextResponse.json({
      success: true,
      message: `Đã số hóa và duyệt thành công ${processedRequests.length} phiếu xác nhận ký tay!`,
      count: processedRequests.length,
      requests: processedRequests,
    });
  } catch (error: any) {
    console.error('Error digitizing offline slip:', error);
    return NextResponse.json({ error: error.message || 'Lỗi khi số hóa phiếu ký tay' }, { status: 500 });
  }
}

/**
 * GET /api/approvals/digitize
 * Retrieves all offline digitized requests with rich filtering and KPI statistics
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'HR_ADMIN' && user.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Không có quyền truy cập cổng số hóa chứng từ' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const creatorId = searchParams.get('creatorId');
    const approverId = searchParams.get('approverId');
    const templateCode = searchParams.get('templateCode');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const hasPhoto = searchParams.get('hasPhoto'); // 'true' | 'false'

    const where: any = {
      isDigitizedOffline: true,
    };

    if (creatorId) where.creatorId = creatorId;
    if (approverId) where.signedByApproverId = approverId;
    if (templateCode) where.template = { code: templateCode };

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(`${fromDate}T00:00:00.000Z`);
      if (toDate) where.createdAt.lte = new Date(`${toDate}T23:59:59.999Z`);
    }

    if (hasPhoto === 'true') {
      where.paperSlipPhotoUrl = { not: null };
    } else if (hasPhoto === 'false') {
      where.paperSlipPhotoUrl = null;
    }

    const requests = await prisma.approvalRequest.findMany({
      where,
      include: {
        template: true,
        creator: {
          select: {
            id: true,
            employeeCode: true,
            name: true,
            department: { select: { name: true } },
          },
        },
        steps: {
          include: {
            approver: { select: { id: true, name: true, employeeCode: true, role: true } },
          },
          orderBy: { stepOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const parsedRequests = requests.map((r) => {
      let parsedData = {};
      try {
        parsedData = JSON.parse(r.data || '{}');
      } catch (e) {}
      return {
        ...r,
        data: parsedData,
      };
    });

    // KPI statistics
    const totalDigitized = requests.length;
    const totalWithPhoto = requests.filter((r) => Boolean(r.paperSlipPhotoUrl)).length;
    const totalOTSlips = requests.filter(
      (r) => r.template.code === 'OVERTIME' || r.template.code === 'OVERTIME_X2_CONFIRM'
    ).length;
    const totalForgotCheckinSlips = requests.filter(
      (r) => r.template.code === 'FORGOT_CHECKIN_CONFIRM' || r.template.code === 'ADJUSTMENT'
    ).length;
    const totalLeaveSlips = requests.filter((r) => r.template.code.startsWith('LEAVE')).length;

    return NextResponse.json({
      requests: parsedRequests,
      stats: {
        totalDigitized,
        totalWithPhoto,
        totalPendingPhoto: totalDigitized - totalWithPhoto,
        totalOTSlips,
        totalForgotCheckinSlips,
        totalLeaveSlips,
      },
    });
  } catch (error: any) {
    console.error('Error fetching digitized requests:', error);
    return NextResponse.json({ error: 'Lỗi khi tải danh sách phiếu số hóa' }, { status: 500 });
  }
}
