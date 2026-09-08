import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const templates = await prisma.approvalTemplate.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    const parsed = templates.map((t) => ({
      ...t,
      schemaFields: JSON.parse(t.schemaFields || '[]'),
      defaultSteps: JSON.parse(t.defaultSteps || '[]'),
    }));

    return NextResponse.json({ templates: parsed });
  } catch (error: any) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Lỗi tải mẫu đơn' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Không có quyền tạo mẫu đơn mới' }, { status: 403 });
    }

    const body = await req.json();
    const { name, code, icon, description, schemaFields, approvalFlowType, defaultSteps } = body;

    if (!name || !code) {
      return NextResponse.json({ error: 'Vui lòng nhập tên và mã mẫu đơn' }, { status: 400 });
    }

    const newTemplate = await prisma.approvalTemplate.create({
      data: {
        name,
        code: code.toUpperCase().trim(),
        icon: icon || 'FileText',
        description,
        schemaFields: typeof schemaFields === 'string' ? schemaFields : JSON.stringify(schemaFields || []),
        approvalFlowType: approvalFlowType || 'DYNAMIC',
        defaultSteps: typeof defaultSteps === 'string' ? defaultSteps : JSON.stringify(defaultSteps || []),
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, template: newTemplate });
  } catch (error: any) {
    console.error('Error creating template:', error);
    return NextResponse.json({ error: error.message || 'Lỗi tạo mẫu đơn' }, { status: 500 });
  }
}
