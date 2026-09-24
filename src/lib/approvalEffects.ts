import { resolveActualShift } from '@/lib/time';

/**
 * Apply business side-effects when an approval request is approved/created
 */
export async function applyApprovalSideEffects(
  tx: any,
  request: any,
  templateCode: string,
  formData: any,
  creatorId: string
) {
  const tCode = templateCode || request.template?.code;

  // 1. Nhóm Nghỉ Phép
  if (
    tCode === 'LEAVE' ||
    tCode === 'LEAVE_ANNUAL' ||
    tCode === 'LEAVE_UNPAID' ||
    tCode === 'LEAVE_SICK' ||
    tCode === 'LEAVE_SPECIAL' ||
    tCode === 'LEAVE_HALF_SHIFT'
  ) {
    const isHalfShift = tCode === 'LEAVE_HALF_SHIFT';
    const isUnpaid = tCode === 'LEAVE_UNPAID' || (formData.leaveType && formData.leaveType.includes('không lương'));
    const duration = isHalfShift ? 0.5 : (Number(formData.duration) || Number(formData.numDays) || 1.0);
    const leaveWorkUnits = isUnpaid ? 0.0 : duration;

    // Trừ quỹ phép năm nếu là phép năm có lương
    if (
      tCode === 'LEAVE_ANNUAL' ||
      (tCode === 'LEAVE' && (!formData.leaveType || formData.leaveType?.includes('phép năm') || formData.leaveType?.includes('có lương')))
    ) {
      await tx.user.update({
        where: { id: creatorId },
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
          dateList = [startDateStr];
        }
      }

      const unitsPerDay = isHalfShift ? 0.5 : (isUnpaid ? 0.0 : 1.0);

      for (const leaveDate of dateList) {
        await tx.attendance.upsert({
          where: {
            userId_workDate: {
              userId: creatorId,
              workDate: leaveDate,
            },
          },
          update: {
            status: 'LEAVE',
            calculatedWorkUnits: unitsPerDay,
            lateMinutes: 0,
            earlyMinutes: 0,
            note: `Nghỉ phép đã duyệt: ${request.template?.name || tCode} (${duration} công, Mã ${request.code})`,
          },
          create: {
            userId: creatorId,
            workDate: leaveDate,
            status: 'LEAVE',
            calculatedWorkUnits: unitsPerDay,
            lateMinutes: 0,
            earlyMinutes: 0,
            note: `Nghỉ phép đã duyệt: ${request.template?.name || tCode} (${duration} công, Mã ${request.code})`,
          },
        });
      }
    }
  }

  // 2. Nhóm Giải Trình / Quên Chấm Công
  else if (tCode === 'ADJUSTMENT' || tCode === 'FORGOT_CHECKIN_CONFIRM') {
    const workDate = formData.workDate || formData.startDate;
    const inTimeStr = formData.checkInTime || '08:00';
    const outTimeStr = formData.checkOutTime || '17:30';

    if (workDate) {
      const inDate = new Date(`${workDate}T${inTimeStr}:00`);
      const outDate = new Date(`${workDate}T${outTimeStr}:00`);

      const schedule = await tx.userShiftSchedule.findFirst({
        where: {
          userId: creatorId,
          workDate: workDate,
        },
        include: { shift: true },
      });

      const allActiveShifts = await tx.shift.findMany({ where: { isActive: true } });
      let shift = resolveActualShift(inDate, outDate, schedule?.shift, allActiveShifts);

      if (!shift && formData.shiftId) {
        shift = allActiveShifts.find((s: any) => s.id === formData.shiftId);
      }
      if (!shift && formData.shiftCode) {
        shift = allActiveShifts.find((s: any) => s.code === formData.shiftCode);
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
          note: `Chấm công bổ sung/quên vân tay đã duyệt: ${formData.reason || ''} (Mã ${request.code})`,
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
          note: `Chấm công bổ sung/quên vân tay đã duyệt: ${formData.reason || ''} (Mã ${request.code})`,
        },
      });
    }
  }

  // 3. Nhóm Đi Muộn / Về Sớm
  else if (tCode === 'LATE_EARLY' || tCode === 'LATE_EARLY_CONFIRM') {
    const workDate = formData.workDate || formData.startDate;
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
            note: `${att.note ? att.note + ' | ' : ''}Miễn phạt đi muộn/về sớm (Mã ${request.code})`,
          },
        });
      }
    }
  }

  // 4. Nhóm Tăng Ca OT
  else if (tCode === 'OVERTIME' || tCode === 'OVERTIME_X2_CONFIRM') {
    const workDate = formData.workDate || formData.startDate;
    let calculatedOtHours = 0;

    if (tCode === 'OVERTIME_X2_CONFIRM') {
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
          note: `Đã duyệt tăng ca (+${calculatedOtHours}h) (Mã ${request.code})`,
        },
        create: {
          userId: creatorId,
          workDate: workDate,
          calculatedWorkUnits: 1.0,
          workHours: 8.0,
          otHours: calculatedOtHours,
          status: 'PRESENT',
          note: `Đã duyệt tăng ca (+${calculatedOtHours}h) (Mã ${request.code})`,
        },
      });
    }
  }
}

/**
 * Revert business side-effects when an approved request is deleted
 */
export async function revertApprovalSideEffects(
  tx: any,
  request: any,
  templateCode: string,
  formData: any,
  creatorId: string
) {
  const tCode = templateCode || request.template?.code;

  // 1. Revert Nghỉ phép (Hoàn quỹ phép năm & reset bảng công)
  if (
    tCode === 'LEAVE' ||
    tCode === 'LEAVE_ANNUAL' ||
    tCode === 'LEAVE_UNPAID' ||
    tCode === 'LEAVE_SICK' ||
    tCode === 'LEAVE_SPECIAL' ||
    tCode === 'LEAVE_HALF_SHIFT'
  ) {
    const isHalfShift = tCode === 'LEAVE_HALF_SHIFT';
    const duration = isHalfShift ? 0.5 : (Number(formData.duration) || Number(formData.numDays) || 1.0);

    // Hoàn lại quỹ phép năm nếu là phép năm có lương
    if (
      tCode === 'LEAVE_ANNUAL' ||
      (tCode === 'LEAVE' && (!formData.leaveType || formData.leaveType?.includes('phép năm') || formData.leaveType?.includes('có lương')))
    ) {
      await tx.user.update({
        where: { id: creatorId },
        data: {
          annualLeaveUsed: { decrement: duration },
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
          dateList = [startDateStr];
        }
      }

      for (const leaveDate of dateList) {
        await tx.attendance.updateMany({
          where: {
            userId: creatorId,
            workDate: leaveDate,
            status: 'LEAVE',
          },
          data: {
            status: 'UNSCHEDULED',
            calculatedWorkUnits: 0,
            note: 'Đã hoàn tác phiếu nghỉ phép',
          },
        });
      }
    }
  }

  // 2. Revert Giải trình / Quên chấm công
  else if (tCode === 'ADJUSTMENT' || tCode === 'FORGOT_CHECKIN_CONFIRM') {
    const workDate = formData.workDate || formData.startDate;
    if (workDate) {
      await tx.attendance.updateMany({
        where: {
          userId: creatorId,
          workDate: workDate,
          status: 'EXPLAINED',
        },
        data: {
          status: 'UNSCHEDULED',
          calculatedWorkUnits: 0,
          note: 'Đã hoàn tác phiếu giải trình/quên chấm công',
        },
      });
    }
  }

  // 3. Revert Đi muộn / Về sớm
  else if (tCode === 'LATE_EARLY' || tCode === 'LATE_EARLY_CONFIRM') {
    const workDate = formData.workDate || formData.startDate;
    if (workDate) {
      await tx.attendance.updateMany({
        where: {
          userId: creatorId,
          workDate: workDate,
        },
        data: {
          note: 'Đã hoàn tác phiếu xác nhận đi trễ/về sớm',
        },
      });
    }
  }

  // 4. Revert Tăng ca OT
  else if (tCode === 'OVERTIME' || tCode === 'OVERTIME_X2_CONFIRM') {
    const workDate = formData.workDate || formData.startDate;
    if (workDate) {
      await tx.attendance.updateMany({
        where: {
          userId: creatorId,
          workDate: workDate,
        },
        data: {
          otHours: 0,
          note: 'Đã hoàn tác phiếu tăng ca OT',
        },
      });
    }
  }
}
