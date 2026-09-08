import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Dữ liệu yêu cầu không hợp lệ (JSON không đúng định dạng)' }, { status: 400 });
    }

    const { content } = body || {};

    // Validate type and non-empty content safely (prevent unhandled TypeError on non-string inputs like numbers, objects, booleans, arrays)
    if (content === undefined || content === null || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Nội dung bình luận không hợp lệ hoặc để trống' }, { status: 400 });
    }

    const sanitizedContent = content.trim();

    if (sanitizedContent.length > 2000) {
      return NextResponse.json({ error: 'Nội dung bình luận quá dài (tối đa 2000 ký tự)' }, { status: 400 });
    }

    const request = await prisma.approvalRequest.findUnique({
      where: { id },
      include: { creator: true },
    });

    if (!request) {
      return NextResponse.json({ error: 'Không tìm thấy đơn yêu cầu' }, { status: 404 });
    }

    const comment = await prisma.approvalComment.create({
      data: {
        requestId: id,
        userId: user.id,
        content: sanitizedContent,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            role: true,
            position: true,
          },
        },
      },
    });

    // Notify creator if comment from someone else
    if (user.id !== request.creatorId) {
      await prisma.notification.create({
        data: {
          userId: request.creatorId,
          title: `Bình luận mới trên đơn ${request.code}`,
          message: `${user.name}: "${sanitizedContent.substring(0, 80)}..."`,
          link: `/approvals/${request.id}`,
          type: 'APPROVAL',
        },
      });
    }

    return NextResponse.json({ success: true, comment });
  } catch (error: any) {
    console.error('Error adding comment:', error);
    return NextResponse.json({ error: 'Lỗi thêm bình luận' }, { status: 500 });
  }
}
