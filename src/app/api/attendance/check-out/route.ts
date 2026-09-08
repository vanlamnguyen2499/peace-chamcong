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
      return NextResponse.json({ error: 'Vui lòng chụp ảnh selfie để xác thực khuôn mặt khi check-out.' }, { status: 400 });
    }

    const todayStr = body.workDate || getWorkDateString(new Date());

    const existing = await prisma.attendance.findUnique({
      where: {
        userId_workDate: {
          userId: user.id,
          workDate: todayStr,
        },
      },
      include: {
        shift: true,
        branch: true,
      },
    });

    if (!existing || !existing.checkInTime) {
      return NextResponse.json({ error: 'Bạn chưa check-in vào ca hôm nay, không thể check-out!' }, { status: 400 });
    }

    if (existing.checkOutTime) {
      return NextResponse.json({ error: 'Bạn đã check-out hết ca hôm nay rồi!' }, { status: 400 });
    }

    // Resolve branch
    const branch = existing.branch || user.branch || (await prisma.branch.findFirst({ where: { isActive: true } }));
    if (!branch) {
      return NextResponse.json({ error: 'Không tìm thấy chi nhánh làm việc' }, { status: 400 });
    }

    const geoCheck = isWithinBranchRadius(
      Number(latitude),
      Number(longitude),
      branch.latitude,
      branch.longitude,
      branch.radiusMeters
    );

    // Save selfie photo
    const photoUrl = await saveBase64Image(photo, `checkout_${user.employeeCode}`);

    // Resolve shift
    let shift = existing.shift;
    if (!shift) {
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
    const metrics = calculateAttendanceMetrics(existing.checkInTime, now, shift);

    const checkOutStatus = geoCheck.isInside
      ? metrics.checkOutStatus
      : 'INVALID_LOCATION';

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown Device';
    // If check-out is outside geofence or check-in was invalid, the attendance status is INVALID with 0.0 work units
    const isInvalid = !geoCheck.isInside || existing.status === 'INVALID' || existing.checkInStatus === 'INVALID_LOCATION';
    const finalStatus = isInvalid ? 'INVALID' : (metrics.earlyMinutes > 0 ? 'EARLY' : 'PRESENT');
    const finalCalculatedWorkUnits = finalStatus === 'INVALID' ? 0.0 : metrics.calculatedWorkUnits;

    const updatedAttendance = await prisma.attendance.update({
      where: { id: existing.id },
      data: {
        checkOutTime: now,
        checkOutLat: Number(latitude),
        checkOutLng: Number(longitude),
        checkOutDistance: geoCheck.distance,
        checkOutPhotoUrl: photoUrl,
        checkOutIp: ip,
        checkOutDevice: userAgent.substring(0, 150),
        checkOutStatus,
        earlyMinutes: metrics.earlyMinutes,
        workHours: metrics.workHours,
        otHours: metrics.otHours,
        calculatedWorkUnits: finalCalculatedWorkUnits,
        status: finalStatus,
        note: note ? (existing.note ? `${existing.note} | ${note}` : note) : existing.note,
      },
      include: {
        shift: true,
        branch: true,
      },
    });

    const message = finalStatus === 'INVALID'
      ? `Check-out ngoài vùng phủ sóng (${geoCheck.distance}m > ${branch.radiusMeters}m). Tính: 0.0 công. Bạn có thể gửi Đơn Giải Trình nếu cần.`
      : `Check-out thành công! Tổng giờ làm: ${metrics.workHours}h (Tính: ${finalCalculatedWorkUnits} công)${metrics.earlyMinutes > 0 ? ` (Về sớm ${metrics.earlyMinutes} phút)` : ''}${metrics.otHours > 0 ? ` [OT: ${metrics.otHours}h]` : ''}`;

    return NextResponse.json({
      success: true,
      message,
      attendance: updatedAttendance,
      isInside: geoCheck.isInside,
      distance: geoCheck.distance,
    });
  } catch (error: any) {
    console.error('Check-out error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi xử lý check-out' }, { status: 500 });
  }
}
