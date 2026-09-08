import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });

    const branches = await prisma.branch.findMany({
      include: {
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ branches });
  } catch (error: any) {
    return NextResponse.json({ error: 'Lỗi tải danh sách chi nhánh' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Không có quyền tạo chi nhánh' }, { status: 403 });
    }

    const { name, code, address, latitude, longitude, radiusMeters, wifiBssids } = await req.json();

    if (!name || !code || latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: 'Vui lòng nhập tên, mã, và tọa độ kinh độ/vĩ độ' }, { status: 400 });
    }

    const newBranch = await prisma.branch.create({
      data: {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        address: address || '',
        latitude: Number(latitude),
        longitude: Number(longitude),
        radiusMeters: Number(radiusMeters) || 300.0,
        wifiBssids: wifiBssids || null,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, branch: newBranch });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Lỗi tạo chi nhánh' }, { status: 500 });
  }
}
