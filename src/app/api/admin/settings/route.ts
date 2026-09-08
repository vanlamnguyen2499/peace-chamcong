import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Không có quyền truy cập cấu hình hệ thống' }, { status: 403 });
    }

    const settings = await prisma.systemSetting.findMany();
    const settingsMap: { [key: string]: string } = {};
    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    return NextResponse.json({ settings: settingsMap });
  } catch (error: any) {
    return NextResponse.json({ error: 'Lỗi tải cấu hình hệ thống' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Không có quyền thay đổi cấu hình' }, { status: 403 });
    }

    const body = await req.json();
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string') {
        await prisma.systemSetting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        });
      }
    }

    return NextResponse.json({ success: true, message: 'Đã lưu cấu hình hệ thống thành công' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Lỗi lưu cấu hình' }, { status: 500 });
  }
}
