import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPassword, signToken } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Throttle credential-stuffing / brute force: 10 attempts / 5 min per IP.
    const rl = rateLimit(`login:${clientIp(request)}`, 10, 5 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { message: "พยายามเข้าสู่ระบบบ่อยเกินไป กรุณาลองใหม่ภายหลัง" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    const body = await request.json();
    const { email, password, rememberMe } = body;

    // "Remember me": persist the session for 30 days; otherwise the default 1 day.
    // The JWT expiry and the cookie maxAge are kept in sync.
    const sessionSeconds = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24;

    if (!email || !password) {
      return NextResponse.json(
        { message: "Missing email or password" },
        { status: 400 }
      );
    }

    // Try to find user by email
    let user = await prisma.user.findUnique({
      where: { email },
    });

    // If not found by email, try to find by student or teacher code
    if (!user) {
      const student = await prisma.student.findUnique({ where: { studentCode: email }});
      if (student) {
        user = await prisma.user.findUnique({ where: { id: student.userId }});
      } else {
        const teacher = await prisma.teacher.findUnique({ where: { teacherCode: email }});
        if (teacher) {
          user = await prisma.user.findUnique({ where: { id: teacher.userId }});
        }
      }
    }

    if (!user) {
      return NextResponse.json(
        { message: "Invalid credentials" },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
      return NextResponse.json(
        { message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" },
        { status: 401 }
      );
    }

    // Approval gate: new self-registered accounts must be approved by an admin.
    if (user.approvalStatus === "pending") {
      return NextResponse.json(
        { message: "บัญชีของคุณอยู่ระหว่างรอผู้ดูแลระบบอนุมัติ", pendingApproval: true },
        { status: 403 }
      );
    }
    if (user.approvalStatus === "rejected") {
      return NextResponse.json(
        { message: "บัญชีของคุณไม่ได้รับการอนุมัติ กรุณาติดต่อผู้ดูแลระบบ" },
        { status: 403 }
      );
    }

    // Suspended / deactivated accounts cannot log in.
    if (user.isActive === false) {
      return NextResponse.json(
        { message: "บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ" },
        { status: 403 }
      );
    }

    // Create session token
    const token = await signToken(
      {
        userId: user.id,
        role: user.role,
        email: user.email,
      },
      rememberMe ? "30d" : "1d"
    );

    // Set cookie
    const response = NextResponse.json(
      { message: "Login successful", user: { id: user.id, role: user.role, email: user.email } },
      { status: 200 }
    );

    response.cookies.set({
      name: "auth-token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: sessionSeconds, // 30 days if "remember me", else 1 day
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
