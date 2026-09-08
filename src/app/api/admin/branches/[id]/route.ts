import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Không có quyền cập nhật chi nhánh' }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();
    const { name, address, latitude, longitude, radiusMeters, wifiBssids, isActive } = body;

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (address !== undefined) updateData.address = address;
    if (latitude !== undefined) updateData.latitude = Number(latitude);
    if (longitude !== undefined) updateData.longitude = Number(longitude);
    if (radiusMeters !== undefined) updateData.radiusMeters = Number(radiusMeters);
    if (wifiBssids !== undefined) updateData.wifiBssids = wifiBssids;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const updated = await prisma.branch.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, branch: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Lỗi cập nhật chi nhánh' }, { status: 500 });
  }
}
