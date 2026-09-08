import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isWithinBranchRadius } from '@/lib/geo';
import { getWorkDateString, calculateAttendanceMetrics } from '@/lib/time';
import { saveBase64Image } from '@/lib/upload';

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const body = await req.json();
    const { latitude, longitude, photo, note } = body;

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: 'Không lấy được tọa độ GPS. Vui lòng bật định vị trên thiết bị.' }, { status: 400 });
    }

    if (!photo) {
      return NextResponse.json({ error: 'Vui lòng chụp ảnh selfie để xác thực khuôn mặt khi chấm công.' }, { status: 400 });
    }

    const todayStr = body.workDate || getWorkDateString(new Date());

    // Check if already checked in
    const existing = await prisma.attendance.findUnique({
      where: {
        userId_workDate: {
          userId: user.id,
          workDate: todayStr,
        },
      },
    });

    if (existing && existing.checkInTime) {
      return NextResponse.json({ error: 'Bạn đã check-in vào ca hôm nay rồi!' }, { status: 400 });
    }

    // Resolve branch
    let branch = user.branch;
    if (!branch && user.branchId) {
      branch = await prisma.branch.findUnique({ where: { id: user.branchId } });
    }
    if (!branch) {
      branch = await prisma.branch.findFirst({ where: { isActive: true } });
    }

    if (!branch) {
      return NextResponse.json({ error: 'Không tìm thấy chi nhánh làm việc' }, { status: 400 });
    }

    // Verify GPS Geofence
    const geoCheck = isWithinBranchRadius(
      Number(latitude),
      Number(longitude),
      branch.latitude,
      branch.longitude,
      branch.radiusMeters
    );

    // Save selfie photo
    const photoUrl = await saveBase64Image(photo, `checkin_${user.employeeCode}`);

    // Resolve shift
    let shift = null;
    const schedule = await prisma.userShiftSchedule.findUnique({
      where: {
        userId_workDate: {
          userId: user.id,
          workDate: todayStr,
        },
      },
      include: { shift: true },
    });

    if (schedule && schedule.shift) {
      shift = schedule.shift;
    } else {
      const dayOfWeek = new Date().getDay();
      if (dayOfWeek === 0) {
        shift = await prisma.shift.findFirst({ where: { code: 'CA_CN_SANG', isActive: true } });
      } else {
        shift = await prisma.shift.findFirst({ where: { code: 'CA_1_SANG', isActive: true } });
      }
      if (!shift) {
        shift = await prisma.shift.findFirst({ where: { code: 'CA_ALL_DAY', isActive: true } });
      }
      if (!shift) {
        shift = await prisma.shift.findFirst({ where: { code: 'CA_HC', isActive: true } });
      }
      if (!shift) {
        shift = await prisma.shift.findFirst({ where: { isActive: true } });
      }
    }

    if (!shift) {
      return NextResponse.json({ error: 'Không tìm thấy ca làm việc' }, { status: 400 });
    }

    const now = body.time ? new Date(body.time) : new Date();
    const metrics = calculateAttendanceMetrics(now, null, shift);

    const checkInStatus = geoCheck.isInside
      ? metrics.checkInStatus
      : 'INVALID_LOCATION';

    // Get client IP & User-Agent
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown Device';

    const attendance = await prisma.attendance.upsert({
      where: {
        userId_workDate: {
          userId: user.id,
          workDate: todayStr,
        },
      },
      update: {
        branchId: branch.id,
        shiftId: shift.id,
        checkInTime: now,
        checkInLat: Number(latitude),
        checkInLng: Number(longitude),
        checkInDistance: geoCheck.distance,
        checkInPhotoUrl: photoUrl,
        checkInIp: ip,
        checkInDevice: userAgent.substring(0, 150),
        checkInStatus,
        lateMinutes: metrics.lateMinutes,
        status: geoCheck.isInside ? (metrics.lateMinutes > 0 ? 'LATE' : 'PRESENT') : 'INVALID',
        note: note || undefined,
      },
      create: {
        userId: user.id,
        branchId: branch.id,
        shiftId: shift.id,
        workDate: todayStr,
        checkInTime: now,
        checkInLat: Number(latitude),
        checkInLng: Number(longitude),
        checkInDistance: geoCheck.distance,
        checkInPhotoUrl: photoUrl,
        checkInIp: ip,
        checkInDevice: userAgent.substring(0, 150),
        checkInStatus,
        lateMinutes: metrics.lateMinutes,
        status: geoCheck.isInside ? (metrics.lateMinutes > 0 ? 'LATE' : 'PRESENT') : 'INVALID',
        note: note || undefined,
      },
      include: {
        shift: true,
        branch: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: geoCheck.isInside
        ? (metrics.lateMinutes > 0 ? `Check-in thành công (Bạn đã đi muộn ${metrics.lateMinutes} phút)` : 'Check-in thành công đúng giờ!')
        : `Check-in ngoài vùng phủ sóng (${geoCheck.distance}m > ${branch.radiusMeters}m). Bạn có thể gửi Đơn Giải Trình nếu cần.`,
      attendance,
      isInside: geoCheck.isInside,
      distance: geoCheck.distance,
    });
  } catch (error: any) {
    console.error('Check-in error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi xử lý check-in' }, { status: 500 });
  }
}
