import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendTelegramNotification } from '@/lib/telegram';
import { calculateAttendanceMetrics } from '@/lib/time';

class ActionError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'ActionError';
    this.statusCode = statusCode;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const { id } = params;
    const body = await req.json();
    const { action, note, signatureUrl } = body; // action: 'APPROVE' | 'REJECT'

    if (action !== 'APPROVE' && action !== 'REJECT') {
      return NextResponse.json({ error: 'Hành động không hợp lệ (chỉ chấp nhận APPROVE hoặc REJECT)' }, { status: 400 });
    }

    if (action === 'REJECT' && (!note || typeof note !== 'string' || note.trim().length === 0)) {
      return NextResponse.json({ error: 'Vui lòng nhập lý do từ chối' }, { status: 400 });
    }

    const now = new Date();

    // Toàn bộ quy trình kiểm tra, chuyển trạng thái và side-effects thực thi nguyên tử trong transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Đọc dữ liệu mới nhất bên trong Transaction
      const freshRequest = await tx.approvalRequest.findUnique({
        where: { id },
        include: {
          template: true,
          creator: true,
          steps: {
            orderBy: { stepOrder: 'asc' },
          },
        },
      });

      if (!freshRequest) {
        throw new ActionError(404, 'Không tìm thấy phiếu yêu cầu');
      }

      if (freshRequest.status !== 'PENDING') {
        throw new ActionError(400, `Phiếu này đã ở trạng thái ${freshRequest.status}, không thể thao tác thêm`);
      }

      const currentStep = freshRequest.steps.find(
        (s) => s.stepOrder === freshRequest.currentStep && s.status === 'PENDING'
      );
      if (!currentStep) {
        throw new ActionError(400, 'Không tìm thấy bước duyệt hiện tại hoặc phiếu này đã được xử lý bởi thao tác khác, không thể thao tác thêm');
      }

      // 2. Kiểm tra thẩm quyền phê duyệt
      const canApprove =
        user.role === 'SUPER_ADMIN' ||
        currentStep.approverId === user.id ||
        currentStep.approverRole === user.role ||
        (user.role === 'HR_ADMIN' && currentStep.approverRole === 'HR_ADMIN');

      if (!canApprove) {
        throw new ActionError(403, 'Bạn không có quyền phê duyệt bước này');
      }

      const now = new Date();

      // 3. Phân nhánh hành động: REJECT
      if (action === 'REJECT') {
        if (!note || note.trim().length === 0) {
          throw new ActionError(400, 'Vui lòng nhập lý do từ chối');
        }

        // Cập nhật Step hiện tại
        const stepUpdate = await tx.approvalStep.updateMany({
          where: {
            id: currentStep.id,
            status: 'PENDING',
          },
          data: {
            approverId: user.id,
            status: 'REJECTED',
            note,
            signatureUrl: signatureUrl || undefined,
            actedAt: now,
          },
        });

        if (stepUpdate.count === 0) {
          throw new ActionError(400, 'Bước duyệt này đã được xử lý bởi một thao tác khác, không thể thao tác thêm');
        }

        // Cập nhật Request thành REJECTED có điều kiện lạc quan
        const reqUpdate = await tx.approvalRequest.updateMany({
          where: {
            id: freshRequest.id,
            status: 'PENDING',
          },
          data: {
            status: 'REJECTED',
          },
        });

        if (reqUpdate.count === 0) {
          throw new ActionError(400, 'Phiếu này đã ở trạng thái đã xử lý, không thể thao tác thêm');
        }

        // Thông báo cho người tạo phiếu
        await tx.notification.create({
          data: {
            userId: freshRequest.creatorId,
            title: `Phiếu ${freshRequest.code} bị từ chối`,
            message: `${user.name} đã từ chối yêu cầu "${freshRequest.template.name}". Lý do: ${note}`,
            link: `/approvals/${freshRequest.id}`,
            type: 'APPROVAL',
          },
        });

        return {
          isRejected: true,
          isFinal: false,
          request: freshRequest,
          message: 'Đã từ chối phiếu yêu cầu',
        };
      }

      // 4. Phân nhánh hành động: APPROVE
      // Cập nhật Step hiện tại có điều kiện lạc quan
      const stepUpdate = await tx.approvalStep.updateMany({
        where: {
          id: currentStep.id,
          status: 'PENDING',
        },
        data: {
          approverId: user.id,
          status: 'APPROVED',
          note: note || 'Đồng ý phê duyệt',
          signatureUrl: signatureUrl || undefined,
          actedAt: now,
        },
      });

      if (stepUpdate.count === 0) {
        throw new ActionError(400, 'Bước duyệt này đã được xử lý bởi một thao tác khác, không thể thao tác thêm');
      }

      const nextStep = freshRequest.steps.find((s) => s.stepOrder === freshRequest.currentStep + 1);

      if (nextStep) {
        // Duyệt cấp trung gian: Chuyển sang bước kế tiếp có điều kiện lạc quan
        const reqUpdate = await tx.approvalRequest.updateMany({
          where: {
            id: freshRequest.id,
            status: 'PENDING',
            currentStep: freshRequest.currentStep,
          },
          data: {
            currentStep: freshRequest.currentStep + 1,
          },
        });

        if (reqUpdate.count === 0) {
          throw new ActionError(400, 'Phiếu này đã được chuyển bước bởi một thao tác khác, không thể thao tác thêm');
        }

        // Bắn thông báo cho người duyệt bước kế tiếp
        if (nextStep.approverId) {
          await tx.notification.create({
            data: {
              userId: nextStep.approverId,
              title: `Phiếu cần bạn duyệt tiếp: ${freshRequest.template.name}`,
              message: `${freshRequest.creator.name} - Mã phiếu: ${freshRequest.code}`,
              link: `/approvals/${freshRequest.id}`,
              type: 'APPROVAL',
            },
          });
        } else if (nextStep.approverRole) {
          const approversWithRole = await tx.user.findMany({
            where: { role: nextStep.approverRole, isActive: true },
          });
          for (const approver of approversWithRole) {
            await tx.notification.create({
              data: {
                userId: approver.id,
                title: `Phiếu cần bạn duyệt tiếp: ${freshRequest.template.name}`,
                message: `${freshRequest.creator.name} - Mã phiếu: ${freshRequest.code}`,
                link: `/approvals/${freshRequest.id}`,
                type: 'APPROVAL',
              },
            });
          }
        }

        return {
          isRejected: false,
          isFinal: false,
          request: freshRequest,
          message: 'Đã duyệt bước này, phiếu đã được chuyển đến cấp phê duyệt tiếp theo.',
        };
      }

      // DUYỆT CẤP CUỐI (FINAL APPROVAL): Hoàn tất đơn với khóa lạc quan & kích hoạt side-effects
      const reqUpdate = await tx.approvalRequest.updateMany({
        where: {
          id: freshRequest.id,
          status: 'PENDING',
          currentStep: freshRequest.currentStep,
        },
        data: {
          status: 'APPROVED',
        },
      });

      if (reqUpdate.count === 0) {
        throw new ActionError(400, 'Đơn này đã được hoàn tất phê duyệt bởi thao tác khác, không thể thao tác thêm');
      }

      // ĐẢM BẢO SIDE-EFFECTS CHỈ CHẠY ĐÚNG 1 LẦN DUY NHẤT VÌ CHỈ CÓ 1 TRANSACTION THÀNH CÔNG VỚI reqUpdate.count === 1
      const formData = JSON.parse(freshRequest.data || '{}');

      // 4.1. Xử lý Đơn Nghỉ Phép (LEAVE, LEAVE_ANNUAL, LEAVE_UNPAID, LEAVE_SICK, LEAVE_SPECIAL, LEAVE_HALF_SHIFT)
      if (
        freshRequest.template.code === 'LEAVE' ||
        freshRequest.template.code === 'LEAVE_ANNUAL' ||
        freshRequest.template.code === 'LEAVE_UNPAID' ||
        freshRequest.template.code === 'LEAVE_SICK' ||
        freshRequest.template.code === 'LEAVE_SPECIAL' ||
        freshRequest.template.code === 'LEAVE_HALF_SHIFT'
      ) {
        const isHalfShift = freshRequest.template.code === 'LEAVE_HALF_SHIFT';
        const isUnpaid = freshRequest.template.code === 'LEAVE_UNPAID' || (formData.leaveType && formData.leaveType.includes('không lương'));
        const duration = isHalfShift ? 0.5 : (Number(formData.duration) || 1.0);
        const leaveWorkUnits = isUnpaid ? 0.0 : duration;

        // Trừ quỹ phép nếu là phép năm có lương
        if (
          freshRequest.template.code === 'LEAVE_ANNUAL' ||
          (freshRequest.template.code === 'LEAVE' && (formData.leaveType?.includes('phép năm') || formData.leaveType?.includes('có lương')))
        ) {
          await tx.user.update({
            where: { id: freshRequest.creatorId },
            data: {
              annualLeaveUsed: { increment: duration },
            },
          });
        }

        const startDateStr = formData.startDate || formData.workDate;
        const endDateStr = formData.endDate || startDateStr;

        if (startDateStr) {
          let dateList: string[] = [startDateStr];
          if (endDateStr && endDateStr !== startDateStr) {
            try {
              const startObj = new Date(startDateStr);
              const endObj = new Date(endDateStr);
              if (!isNaN(startObj.getTime()) && !isNaN(endObj.getTime()) && endObj >= startObj) {
                dateList = [];
                const curr = new Date(startObj);
                while (curr <= endObj) {
                  dateList.push(curr.toISOString().split('T')[0]);
                  curr.setDate(curr.getDate() + 1);
                }
              }
            } catch (err) {
              console.error('Error parsing leave date interval:', err);
              dateList = [startDateStr];
            }
          }

          const unitsPerDay = isHalfShift ? 0.5 : (isUnpaid ? 0.0 : 1.0);

          for (const leaveDate of dateList) {
            await tx.attendance.upsert({
              where: {
                userId_workDate: {
                  userId: freshRequest.creatorId,
                  workDate: leaveDate,
                },
              },
              update: {
                status: 'LEAVE',
                calculatedWorkUnits: unitsPerDay,
                lateMinutes: 0,
                earlyMinutes: 0,
                note: `Nghỉ phép đã duyệt: ${freshRequest.template.name} (${duration} công, Đơn ${freshRequest.code})`,
              },
              create: {
                userId: freshRequest.creatorId,
                workDate: leaveDate,
                status: 'LEAVE',
                calculatedWorkUnits: unitsPerDay,
                lateMinutes: 0,
                earlyMinutes: 0,
                note: `Nghỉ phép đã duyệt: ${freshRequest.template.name} (${duration} công, Đơn ${freshRequest.code})`,
              },
            });
          }
        }
      }

      // 4.2. Xử lý Đơn Giải Trình / Phiếu Quên Chấm Công (ADJUSTMENT, FORGOT_CHECKIN_CONFIRM)
      else if (freshRequest.template.code === 'ADJUSTMENT' || freshRequest.template.code === 'FORGOT_CHECKIN_CONFIRM') {
        const workDate = formData.workDate;
        const inTimeStr = formData.checkInTime || '08:00';
        const outTimeStr = formData.checkOutTime || '17:30';

        if (workDate) {
          const inDate = new Date(`${workDate}T${inTimeStr}:00`);
          const outDate = new Date(`${workDate}T${outTimeStr}:00`);

          // Check if employee has an assigned schedule for that work date
          const schedule = await tx.userShiftSchedule.findUnique({
            where: {
              userId_workDate: {
                userId: freshRequest.creatorId,
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
                userId: freshRequest.creatorId,
                workDate: workDate,
              },
            },
            update: {
              shiftId: shift?.id,
              checkInTime: inDate,
              checkInStatus: 'MANUAL',
              checkOutTime: outDate,
              checkOutStatus: 'MANUAL',
              lateMinutes: 0, // Miễn phạt khi có phiếu giải trình/xác nhận
              earlyMinutes: 0,
              workHours: targetHours,
              otHours: 0,
              calculatedWorkUnits: targetUnits,
              status: 'EXPLAINED',
              note: `Chấm công bổ sung/quên vân tay đã duyệt: ${formData.reason || ''} (Đơn ${freshRequest.code})`,
            },
            create: {
              userId: freshRequest.creatorId,
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
              note: `Chấm công bổ sung/quên vân tay đã duyệt: ${formData.reason || ''} (Đơn ${freshRequest.code})`,
            },
          });
        }
      }

      // 4.3. Xử lý Đơn Đi Muộn / Về Sớm & Phiếu Xác Nhận Đi Trễ (LATE_EARLY, LATE_EARLY_CONFIRM)
      else if (freshRequest.template.code === 'LATE_EARLY' || freshRequest.template.code === 'LATE_EARLY_CONFIRM') {
        const workDate = formData.workDate;
        if (workDate) {
          const att = await tx.attendance.findUnique({
            where: { userId_workDate: { userId: freshRequest.creatorId, workDate } },
            include: { shift: true },
          });
          if (att) {
            // Khôi phục công chuẩn nếu bị trừ do phạt trễ > 30p
            const restoredUnits = att.shift?.workUnits || (att.calculatedWorkUnits === 2.0 ? 3.0 : att.calculatedWorkUnits || 1.0);
            await tx.attendance.update({
              where: { id: att.id },
              data: {
                lateMinutes: 0,
                earlyMinutes: 0,
                calculatedWorkUnits: restoredUnits,
                status: 'EXPLAINED',
                note: `${att.note ? att.note + ' | ' : ''}Miễn phạt đi muộn/về sớm (Đơn ${freshRequest.code})`,
              },
            });
          }
        }
      }

      // 4.4. Xử lý Đơn Làm Thêm Giờ & Phiếu Xác Nhận Tăng Ca OT x2 (OVERTIME, OVERTIME_X2_CONFIRM)
      else if (freshRequest.template.code === 'OVERTIME' || freshRequest.template.code === 'OVERTIME_X2_CONFIRM') {
        const workDate = formData.workDate;
        let calculatedOtHours = 0;

        if (freshRequest.template.code === 'OVERTIME_X2_CONFIRM') {
          // MỤC 4: Phiếu xác nhận tăng ca x2 - Nhân đôi số phút làm thêm
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
          // Đơn OVERTIME tiêu chuẩn: Giờ làm thêm dự kiến
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
                userId: freshRequest.creatorId,
                workDate: workDate,
              },
            },
            update: {
              otHours: calculatedOtHours,
              note: `Đã duyệt tăng ca (+${calculatedOtHours}h) (Đơn ${freshRequest.code})`,
            },
            create: {
              userId: freshRequest.creatorId,
              workDate: workDate,
              calculatedWorkUnits: 1.0,
              workHours: 8.0,
              otHours: calculatedOtHours,
              status: 'PRESENT',
              note: `Đã duyệt tăng ca (+${calculatedOtHours}h) (Phiếu ${freshRequest.code})`,
            },
          });
        }
      }

      // 4.5. Thông báo hoàn tất cho người tạo phiếu
      await tx.notification.create({
        data: {
          userId: freshRequest.creatorId,
          title: `Phiếu ${freshRequest.code} đã được duyệt thành công 🎉`,
          message: `Yêu cầu "${freshRequest.template.name}" của bạn đã hoàn tất toàn bộ các bước phê duyệt.`,
          link: `/approvals/${freshRequest.id}`,
          type: 'APPROVAL',
        },
      });

      return {
        isRejected: false,
        isFinal: true,
        request: freshRequest,
        message: 'Đã hoàn tất phê duyệt phiếu yêu cầu thành công!',
      };
    });

    // 5. Bắn thông báo Telegram bất đồng bộ ngoài transaction (chỉ gửi khi transaction đã commit thành công)
    if (result.isRejected) {
      sendTelegramNotification(
        `❌ <b>[PHIẾU BỊ TỪ CHỐI]</b>\n` +
        `📌 <b>Loại phiếu:</b> ${result.request.template.name}\n` +
        `🔖 <b>Mã phiếu:</b> <code>${result.request.code}</code>\n` +
        `👤 <b>Người duyệt:</b> ${user.name}\n` +
        `⚠️ <b>Lý do từ chối:</b> ${note}`
      ).catch(() => {});
    } else if (result.isFinal) {
      sendTelegramNotification(
        `✅ <b>[PHIẾU ĐÃ PHÊ DUYỆT HOÀN TẤT]</b>\n` +
        `📌 <b>Loại phiếu:</b> ${result.request.template.name}\n` +
        `🔖 <b>Mã phiếu:</b> <code>${result.request.code}</code>\n` +
        `👤 <b>Người tạo:</b> ${result.request.creator.name}\n` +
        `✍️ <b>Người duyệt cuối:</b> ${user.name}`
      ).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    if (error instanceof ActionError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Error acting on approval:', error);
    return NextResponse.json({ error: error.message || 'Lỗi xử lý phê duyệt' }, { status: 500 });
  }
}
