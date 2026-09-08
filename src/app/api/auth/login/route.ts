import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { comparePassword, signJwtToken, AUTH_COOKIE_NAME } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Vui lòng nhập đầy đủ email và mật khẩu' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        branch: true,
        department: true,
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Tài khoản hoặc mật khẩu không chính xác' }, { status: 401 });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ error: 'Tài khoản hoặc mật khẩu không chính xác' }, { status: 401 });
    }

    const token = signJwtToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      employeeCode: user.employeeCode,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        employeeCode: user.employeeCode,
        name: user.name,
        email: user.email,
        role: user.role,
        position: user.position,
        branch: user.branch,
        department: user.department,
      },
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi máy chủ khi đăng nhập' }, { status: 500 });
  }
}
