import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { vi } from 'date-fns/locale';

/**
 * Convert "08:30" string to minutes from 00:00
 */
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/**
 * Convert Date object to minutes from 00:00 (local time)
 */
export function dateToMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Format Date to "YYYY-MM-DD"
 */
export function getWorkDateString(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Format Date to "HH:mm"
 */
export function formatTime(date?: Date | null): string {
  if (!date) return '--:--';
  return format(new Date(date), 'HH:mm');
}

/**
 * Format Date to "HH:mm dd/MM/yyyy"
 */
export function formatDateTimeVN(date?: Date | null): string {
  if (!date) return '--';
  return format(new Date(date), 'HH:mm dd/MM/yyyy', { locale: vi });
}

/**
 * Format Date to "dd/MM/yyyy"
 */
export function formatDateVN(dateStrOrDate?: string | Date | null): string {
  if (!dateStrOrDate) return '--';
  const d = typeof dateStrOrDate === 'string' ? parseISO(dateStrOrDate) : dateStrOrDate;
  return format(d, 'dd/MM/yyyy', { locale: vi });
}

/**
 * Calculate attendance metrics with support for:
 * 1. Early check-in window (e.g. from 07:45 for 08:00 shifts)
 * 2. Late > 30 mins rule: cancels morning shift portion (e.g. 3-shift all day loses 1 công, leaving 2 công)
 * 3. Overtime with x2 multiplier: after >= 15 minutes of overtime outside standard shift end
 * 4. Multi-shift work units (1.0, 2.0, 3.0 công/ngày)
 */
export function calculateAttendanceMetrics(
  checkIn: Date | null,
  checkOut: Date | null,
  shift: {
    startTime: string;
    endTime: string;
    breakStartTime?: string | null;
    breakEndTime?: string | null;
    gracePeriodLate: number;
    gracePeriodEarly: number;
    workUnits: number;
    isFlexible?: boolean;
    minWorkHours?: number;
    earlyCheckInMinutes?: number; // Minutes before startTime allowed for early preparation (default 15)
  }
) {
  let lateMinutes = 0;
  let earlyMinutes = 0;
  let workHours = 0;
  let otHours = 0;
  let calculatedWorkUnits = 0;
  let checkInStatus = 'ON_TIME';
  let checkOutStatus = 'ON_TIME';
  let isLateOver30Mins = false;

  const shiftStartMin = timeStringToMinutes(shift.startTime);
  const shiftEndMin = timeStringToMinutes(shift.endTime);
  const breakStartMin = shift.breakStartTime ? timeStringToMinutes(shift.breakStartTime) : 0;
  const breakEndMin = shift.breakEndTime ? timeStringToMinutes(shift.breakEndTime) : 0;
  const breakDurationMin =
    breakStartMin && breakEndMin && breakEndMin > breakStartMin ? breakEndMin - breakStartMin : 0;

  if (checkIn) {
    const checkInMin = dateToMinutes(checkIn);
    if (checkInMin > shiftStartMin + shift.gracePeriodLate) {
      lateMinutes = checkInMin - shiftStartMin;
      checkInStatus = 'LATE';
      // Đi trễ quá 30 phút tính từ mốc chuẩn bị (07h45 -> sau 08h15/08h16) HOẶC quá 30 phút từ giờ ca (sau 08h30)
      const minutesFromPrep = checkInMin - (shiftStartMin - (shift.earlyCheckInMinutes || 15));
      if (lateMinutes > 30 || minutesFromPrep > 30) {
        isLateOver30Mins = true;
      }
    }
  }

  if (checkOut) {
    const checkOutMin = dateToMinutes(checkOut);
    if (checkOutMin < shiftEndMin - shift.gracePeriodEarly) {
      earlyMinutes = shiftEndMin - checkOutMin;
      checkOutStatus = 'EARLY';
    }

    // MỤC 4: Quy tắc Tăng ca (OT x2)
    // Thời gian tăng ca từ 15 phút trở lên ngoài ca tiêu chuẩn mới bắt đầu tính OT
    // Hệ số x2: Số phút làm thêm được nhân đôi (x2) vào quỹ giờ tăng ca
    if (checkOutMin >= shiftEndMin + 15) {
      const rawOtMinutes = checkOutMin - shiftEndMin;
      const x2OtMinutes = rawOtMinutes * 2;
      otHours = Math.round((x2OtMinutes / 60) * 10) / 10;
    }
  }

  if (checkIn && checkOut) {
    const inMin = dateToMinutes(checkIn);
    const outMin = dateToMinutes(checkOut);

    // Calculate exact break overlap
    let actualBreakOverlap = 0;
    if (breakStartMin && breakEndMin && breakEndMin > breakStartMin) {
      const overlapStart = Math.max(inMin, breakStartMin);
      const overlapEnd = Math.min(outMin, breakEndMin);
      if (overlapEnd > overlapStart) {
        actualBreakOverlap = overlapEnd - overlapStart;
      }
    }

    let totalMinutes = Math.max(0, outMin - inMin - actualBreakOverlap);
    workHours = Math.max(0, Math.round((totalMinutes / 60) * 10) / 10);

    // Standard work unit calculation
    const baseUnits = shift.workUnits || 1.0;

    // MỤC 3: Quy tắc phạt trễ > 30 phút
    // Đi trễ quá 30 phút (ví dụ: đến lúc 08h31/08h16 làm đến 19h30 trên ca 3 công):
    // Hệ thống tự động hủy công Ca sáng (trừ 1.0 công), chỉ tính công các ca còn lại (ví dụ 2 công cho chiều + tối)
    if (isLateOver30Mins) {
      if (baseUnits >= 3.0) {
        // Ca 3 công cả ngày: Hủy ca sáng, còn 2.0 công
        calculatedWorkUnits = 2.0;
      } else if (baseUnits >= 2.0) {
        // Ca 2 công: Hủy ca sáng, còn 1.0 công
        calculatedWorkUnits = 1.0;
      } else {
        // Ca sáng đơn lẻ (1.0 công): Hủy công ca sáng = 0 công
        calculatedWorkUnits = 0.0;
      }
    } else {
      const standardShiftHours = Math.max(1, (shiftEndMin - shiftStartMin - breakDurationMin) / 60);
      if (workHours >= standardShiftHours * 0.8) {
        calculatedWorkUnits = baseUnits;
      } else if (workHours >= standardShiftHours * 0.4) {
        calculatedWorkUnits = Math.round(baseUnits * 0.5 * 10) / 10;
      } else {
        calculatedWorkUnits = 0;
      }
    }
  }

  return {
    lateMinutes,
    earlyMinutes,
    workHours,
    otHours,
    calculatedWorkUnits,
    checkInStatus,
    checkOutStatus,
    isLateOver30Mins,
  };
}

/**
 * Get all dates in month formatted as YYYY-MM-DD
 */
export function getDaysInMonth(year: number, month: number): string[] {
  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(start);
  const days = eachDayOfInterval({ start, end });
  return days.map((d) => format(d, 'yyyy-MM-dd'));
}

/**
 * Dynamically resolves the actual shift a user is working based on their check-in/out time.
 * This supports the "swapped shift" scenario where a user works a different shift than scheduled.
 */
export function resolveActualShift(checkInTime: Date, checkOutTime: Date | null, scheduledShift: any, allShifts: any[]): any {
  const checkInMin = dateToMinutes(checkInTime);
  
  let workDurationMin = 0;
  if (checkOutTime) {
    const checkOutMin = dateToMinutes(checkOutTime);
    workDurationMin = Math.max(0, (checkOutMin < checkInMin ? checkOutMin + 24 * 60 : checkOutMin) - checkInMin);
  }

  // 1. If scheduledShift exists, check if it's a good fit
  if (scheduledShift) {
    const scheduledStartMin = timeStringToMinutes(scheduledShift.startTime);
    const startDiff = Math.abs(checkInMin - scheduledStartMin);
    
    let durationIsOkay = true;
    if (workDurationMin > 0) {
       let scheduledEndMin = timeStringToMinutes(scheduledShift.endTime);
       if (scheduledEndMin < scheduledStartMin) scheduledEndMin += 24 * 60;
       const scheduledDuration = scheduledEndMin - scheduledStartMin;
       // If they worked > 2.5 hours longer/shorter than scheduled, maybe they swapped.
       if (Math.abs(workDurationMin - scheduledDuration) > 150) {
         durationIsOkay = false;
       }
    }

    // If they check in within 2.5 hours and duration is roughly expected, assume they are working it
    if (startDiff <= 150 && durationIsOkay) {
      return scheduledShift;
    }
  }

  // 2. Otherwise, find the best matching shift based on BOTH checkInTime and duration
  let bestShift = scheduledShift || allShifts[0];
  let minPenalty = Infinity;

  for (const shift of allShifts) {
    const shiftStartMin = timeStringToMinutes(shift.startTime);
    let startDiff = Math.abs(checkInMin - shiftStartMin);
    // Handle overnight start time wrapping
    if (startDiff > 12 * 60) startDiff = Math.abs(startDiff - 24 * 60);
    
    let durationDiff = 0;
    if (workDurationMin > 0) {
       let shiftEndMin = timeStringToMinutes(shift.endTime);
       if (shiftEndMin < shiftStartMin) shiftEndMin += 24 * 60;
       const shiftDuration = shiftEndMin - shiftStartMin;
       durationDiff = Math.abs(workDurationMin - shiftDuration);
    }
    
    // Start time is weighted heavily (2x).
    const penalty = (startDiff * 2) + durationDiff;
    
    if (penalty < minPenalty) {
      minPenalty = penalty;
      bestShift = shift;
    }
  }
  
  return bestShift;
}
