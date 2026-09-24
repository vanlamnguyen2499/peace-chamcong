import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getDaysInMonth } from '@/lib/time';

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || (sessionUser.role !== 'SUPER_ADMIN' && sessionUser.role !== 'HR_ADMIN' && sessionUser.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Không có quyền xem lịch phân ca' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : null;
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : null;

    const whereClause: any = {};
    if (userId) {
      whereClause.userId = userId;
    }

    if (month && year) {
      const padMonth = String(month).padStart(2, '0');
      const startPrefix = `${year}-${padMonth}-01`;
      const endPrefix = `${year}-${padMonth}-31`;
      whereClause.workDate = {
        gte: startPrefix,
        lte: endPrefix,
      };
    }

    const [rawSchedules, userObj, allShifts] = await Promise.all([
      prisma.userShiftSchedule.findMany({
        where: whereClause,
        include: {
          shift: true,
          user: {
            select: {
              id: true,
              employeeCode: true,
              name: true,
              branchId: true,
              departmentId: true,
              department: { select: { id: true, name: true } },
              branch: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { workDate: 'asc' },
      }),
      userId
        ? prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, employeeCode: true, weeklySchedule: true, overrideWorkUnits: true },
          })
        : null,
      prisma.shift.findMany({ where: { isActive: true } }),
    ]);

    let schedules = [...rawSchedules];
    let weeklyScheduleObj: any = null;

    if (userObj?.weeklySchedule) {
      try {
        weeklyScheduleObj = JSON.parse(userObj.weeklySchedule);
      } catch (e) {
        weeklyScheduleObj = null;
      }
    }

    // If userId, month, and year are provided, synthesize/project any unassigned days from weeklySchedule
    if (userId && month && year && weeklyScheduleObj && userObj) {
      const explicitDatesMap = new Map<string, any>();
      rawSchedules.forEach((s) => explicitDatesMap.set(s.workDate, s));

      const daysInMonthList = getDaysInMonth(year, month);
      daysInMonthList.forEach((dateStr) => {
        if (!explicitDatesMap.has(dateStr)) {
          const d = new Date(dateStr);
          const dow = d.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat

          // Check if Sunday is flexible
          if (dow === 0 && weeklyScheduleObj.sundayFlexible?.enabled) {
            const flexShift = allShifts.find(
              (s) =>
                s.id === weeklyScheduleObj.sundayFlexible?.shiftId ||
                s.code === weeklyScheduleObj.sundayFlexible?.shiftId
            );
            schedules.push({
              id: `virtual-flex-${userId}-${dateStr}`,
              userId,
              workDate: dateStr,
              shiftId: flexShift?.id || null,
              shift: flexShift || null,
              isOffDay: false,
              isSundayFlexible: true,
              sundayFlexibleShiftsCount: weeklyScheduleObj.sundayFlexible.shiftsCount,
              createdAt: new Date(),
              user: {
                id: userObj.id,
                name: userObj.name,
                employeeCode: userObj.employeeCode,
                branchId: null,
                departmentId: null,
                department: null,
                branch: null,
              },
            } as any);
          } else {
            const assignedVal = weeklyScheduleObj![String(dow)] || weeklyScheduleObj![dow];

            if (assignedVal) {
              if (assignedVal === 'OFF') {
                schedules.push({
                  id: `virtual-${userId}-${dateStr}`,
                  userId,
                  workDate: dateStr,
                  shiftId: null,
                  shift: null,
                  isOffDay: true,
                  createdAt: new Date(),
                  user: {
                    id: userObj.id,
                    name: userObj.name,
                    employeeCode: userObj.employeeCode,
                    branchId: null,
                    departmentId: null,
                    department: null,
                    branch: null,
                  },
                } as any);
              } else if (assignedVal !== 'FLEXIBLE') {
                const matchedShift = allShifts.find((s) => s.id === assignedVal || s.code === assignedVal);
                if (matchedShift) {
                  schedules.push({
                    id: `virtual-${userId}-${dateStr}`,
                    userId,
                    workDate: dateStr,
                    shiftId: matchedShift.id,
                    shift: matchedShift,
                    isOffDay: false,
                    createdAt: new Date(),
                    user: {
                      id: userObj.id,
                      name: userObj.name,
                      employeeCode: userObj.employeeCode,
                      branchId: null,
                      departmentId: null,
                      department: null,
                      branch: null,
                    },
                  } as any);
                }
              }
            }
          }
        }
      });

      // Sort synthesized schedules by workDate
      schedules.sort((a, b) => a.workDate.localeCompare(b.workDate));
    }

    return NextResponse.json({
      schedules,
      weeklySchedule: weeklyScheduleObj,
    });
  } catch (error: any) {
    console.error('Fetch schedule error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi tải lịch phân ca' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || (sessionUser.role !== 'SUPER_ADMIN' && sessionUser.role !== 'HR_ADMIN' && sessionUser.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Không có quyền phân ca' }, { status: 403 });
    }

    const body = await req.json();
    const {
      userId,
      mode,
      workDate,
      shiftId,
      isOffDay,
      selectedDaysOfWeek,
      month,
      year,
      saveAsWeeklyPattern = true,
      weeklyPattern,
    } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Thiếu thông tin nhân viên' }, { status: 400 });
    }

    const allShifts = await prisma.shift.findMany({ where: { isActive: true } });

    // 0. Update Sunday Flexible Schedule Mode
    if (mode === 'UPDATE_SUNDAY_FLEXIBLE') {
      const { sundayFlexible } = body;
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { weeklySchedule: true },
      });

      let currentWeekly: any = {};
      if (u?.weeklySchedule) {
        try {
          currentWeekly = JSON.parse(u.weeklySchedule);
        } catch (e) {
          currentWeekly = {};
        }
      }

      currentWeekly.sundayFlexible = sundayFlexible;
      if (sundayFlexible?.enabled) {
        currentWeekly['0'] = 'FLEXIBLE';
      } else if (currentWeekly['0'] === 'FLEXIBLE') {
        currentWeekly['0'] = '';
      }

      await prisma.user.update({
        where: { id: userId },
        data: { weeklySchedule: JSON.stringify(currentWeekly) },
      });

      return NextResponse.json({
        success: true,
        weeklySchedule: currentWeekly,
        message: sundayFlexible?.enabled
          ? `Đã lưu cấu hình Chủ Nhật linh động: ${sundayFlexible.shiftsCount || 1} ngày/tháng!`
          : 'Đã tắt Chủ Nhật linh động!',
      });
    }

    // 1. Bulk Custom Weekdays mode: Apply shift across specified weekdays and optionally save as permanent weekly pattern
    if (mode === 'CUSTOM_WEEKDAYS' || mode === 'ALL_DAYS') {
      if (!month || !year) {
        return NextResponse.json({ error: 'Thiếu thông tin tháng/năm' }, { status: 400 });
      }

      const isOff = shiftId === 'OFF' || Boolean(isOffDay);
      const matchedShift = allShifts.find((s) => s.id === shiftId || s.code === shiftId);
      const finalShiftId = isOff ? null : matchedShift?.id;

      if (!isOff && !finalShiftId) {
        return NextResponse.json({ error: 'Ca làm việc không hợp lệ' }, { status: 400 });
      }

      const days = getDaysInMonth(Number(year), Number(month));
      const targetDaysOfWeek: number[] =
        mode === 'ALL_DAYS' ? [0, 1, 2, 3, 4, 5, 6] : (selectedDaysOfWeek || []);

      if (targetDaysOfWeek.length === 0) {
        return NextResponse.json({ error: 'Vui lòng chọn ít nhất một thứ trong tuần' }, { status: 400 });
      }

      // If saveAsWeeklyPattern is enabled, persist into user.weeklySchedule
      let updatedWeeklySchedule: { [key: string]: string } = {};
      if (saveAsWeeklyPattern) {
        const u = await prisma.user.findUnique({
          where: { id: userId },
          select: { weeklySchedule: true },
        });

        if (u?.weeklySchedule) {
          try {
            updatedWeeklySchedule = JSON.parse(u.weeklySchedule);
          } catch (e) {
            updatedWeeklySchedule = {};
          }
        }

        targetDaysOfWeek.forEach((dow) => {
          updatedWeeklySchedule[String(dow)] = isOff ? 'OFF' : (finalShiftId || shiftId);
        });

        await prisma.user.update({
          where: { id: userId },
          data: { weeklySchedule: JSON.stringify(updatedWeeklySchedule) },
        });
      }

      // Batch upsert into database for this month
      const datesToApply = days.filter((dateStr) => {
        const d = new Date(dateStr);
        return targetDaysOfWeek.includes(d.getDay());
      });

      await prisma.$transaction(async (tx) => {
        await tx.userShiftSchedule.deleteMany({
          where: {
            userId,
            workDate: { in: datesToApply },
          },
        });

        if (!isOff && finalShiftId) {
          for (const dateStr of datesToApply) {
            await tx.userShiftSchedule.create({
              data: {
                userId,
                workDate: dateStr,
                shiftId: finalShiftId,
                isOffDay: false,
              },
            });
          }
        }
      });

      return NextResponse.json({
        success: true,
        appliedCount: datesToApply.length,
        weeklySchedule: saveAsWeeklyPattern ? updatedWeeklySchedule : undefined,
        message: `Đã gán ca cho ${datesToApply.length} ngày và tự động lưu làm khung ca cố định cho các tháng sau!`,
      });
    }

    // 2. Full Weekly Pattern Save Mode
    if (mode === 'SET_WEEKLY_PATTERN' && weeklyPattern) {
      await prisma.user.update({
        where: { id: userId },
        data: { weeklySchedule: JSON.stringify(weeklyPattern) },
      });

      if (month && year) {
        const days = getDaysInMonth(Number(year), Number(month));
        await prisma.$transaction(async (tx) => {
          await tx.userShiftSchedule.deleteMany({
            where: {
              userId,
              workDate: { startsWith: `${year}-${String(month).padStart(2, '0')}` },
            },
          });

          for (const dateStr of days) {
            const d = new Date(dateStr);
            const dow = String(d.getDay());
            const patternVal = weeklyPattern[dow];
            if (patternVal && patternVal !== 'OFF' && patternVal !== 'FLEXIBLE') {
              const matchedShift = allShifts.find((s) => s.id === patternVal || s.code === patternVal);
              if (matchedShift) {
                await tx.userShiftSchedule.create({
                  data: {
                    userId,
                    workDate: dateStr,
                    shiftId: matchedShift.id,
                    isOffDay: false,
                  },
                });
              }
            }
          }
        });
      }

      return NextResponse.json({
        success: true,
        weeklySchedule: weeklyPattern,
        message: 'Đã lưu khung ca làm việc cố định hàng tuần!',
      });
    }

    // 3. Single Date Assignment Mode
    if (!workDate) {
      return NextResponse.json({ error: 'Thiếu ngày làm việc' }, { status: 400 });
    }

    const isOff = Boolean(isOffDay) || shiftId === 'OFF';
    const matchedShift = allShifts.find((s) => s.id === shiftId || s.code === shiftId);
    const finalShiftId = isOff ? null : (matchedShift?.id || null);

    // Delete existing schedules for this date
    await prisma.userShiftSchedule.deleteMany({
      where: { userId, workDate },
    });

    if (isOff || !shiftId) {
      // If saving weekly pattern as OFF
      if (saveAsWeeklyPattern) {
        const d = new Date(workDate);
        const dow = String(d.getDay());
        const u = await prisma.user.findUnique({
          where: { id: userId },
          select: { weeklySchedule: true },
        });
        let currentWeekly: any = {};
        if (u?.weeklySchedule) {
          try {
            currentWeekly = JSON.parse(u.weeklySchedule);
          } catch (e) {}
        }
        currentWeekly[dow] = 'OFF';
        await prisma.user.update({
          where: { id: userId },
          data: { weeklySchedule: JSON.stringify(currentWeekly) },
        });
      }

      return NextResponse.json({
        success: true,
        schedule: {
          id: `off-${userId}-${workDate}`,
          userId,
          workDate,
          shiftId: null,
          shift: null,
          isOffDay: true,
        },
        message: isOff ? 'Đã đặt làm ngày nghỉ' : 'Đã xóa lịch ca ngày này',
      });
    }

    if (!finalShiftId) {
      return NextResponse.json({ error: 'Ca làm việc không hợp lệ' }, { status: 400 });
    }

    const schedule = await prisma.userShiftSchedule.create({
      data: {
        userId,
        workDate,
        shiftId: finalShiftId,
        isOffDay: false,
      },
      include: { shift: true },
    });

    // Optionally update single day in weekly pattern
    if (saveAsWeeklyPattern) {
      const d = new Date(workDate);
      const dow = String(d.getDay());
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { weeklySchedule: true },
      });
      let currentWeekly: any = {};
      if (u?.weeklySchedule) {
        try {
          currentWeekly = JSON.parse(u.weeklySchedule);
        } catch (e) {}
      }
      currentWeekly[dow] = finalShiftId;
      await prisma.user.update({
        where: { id: userId },
        data: { weeklySchedule: JSON.stringify(currentWeekly) },
      });
    }

    return NextResponse.json({ success: true, schedule });
  } catch (error: any) {
    console.error('Save schedule error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi lưu lịch ca' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || (sessionUser.role !== 'SUPER_ADMIN' && sessionUser.role !== 'HR_ADMIN' && sessionUser.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Không có quyền xóa phân ca' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const workDate = searchParams.get('workDate');
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const clearWeekly = searchParams.get('clearWeekly') === 'true';

    if (!userId) {
      return NextResponse.json({ error: 'Thiếu thông tin nhân viên' }, { status: 400 });
    }

    if (workDate) {
      await prisma.userShiftSchedule.deleteMany({
        where: { userId, workDate },
      });
    } else if (month && year) {
      const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
      await prisma.userShiftSchedule.deleteMany({
        where: {
          userId,
          workDate: { startsWith: monthPrefix },
        },
      });
    }

    if (clearWeekly) {
      await prisma.user.update({
        where: { id: userId },
        data: { weeklySchedule: null },
      });
    }

    return NextResponse.json({ success: true, message: 'Đã xóa phân ca thành công' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Lỗi xóa phân ca' }, { status: 500 });
  }
}
