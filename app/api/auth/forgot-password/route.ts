import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/mail";
import { generateResetToken } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * Changes vs original:
 *  - Always returns a generic success message (no email enumeration).
 *  - Uses a cryptographically secure token (generateResetToken) instead of
 *    Math.random().
 *  - Builds the reset URL from APP_BASE_URL / request origin instead of a
 *    hard-coded http://localhost:3000.
 */
export async function POST(request: NextRequest) {
  const GENERIC = NextResponse.json(
    { message: "หากอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์รีเซ็ตรหัสผ่านให้แล้ว" },
    { status: 200 }
  );

  try {
    // Throttle reset-email spam / user probing: 5 / 15 min per IP.
    const rl = rateLimit(`forgot:${clientIp(request)}`, 5, 15 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { message: "ขอรีเซ็ตรหัสผ่านบ่อยเกินไป กรุณาลองใหม่ภายหลัง" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ message: "กรุณากรอกอีเมล" }, { status: 400 });
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const student = await prisma.student.findUnique({ where: { studentCode: email } });
      if (student) user = await prisma.user.findUnique({ where: { id: student.userId } });
      else {
        const teacher = await prisma.teacher.findUnique({ where: { teacherCode: email } });
        if (teacher) user = await prisma.user.findUnique({ where: { id: teacher.userId } });
      }
    }

    // Do not reveal whether the account exists.
    if (!user) return GENERIC;

    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.oTPVerification.deleteMany({
      where: { userId: user.id, purpose: "reset_password" },
    });
    await prisma.oTPVerification.create({
      data: {
        userId: user.id,
        otpCode: token,
        purpose: "reset_password",
        expiresAt,
        isUsed: false,
      },
    });

    const origin =
      process.env.APP_BASE_URL ||
      request.nextUrl.origin ||
      "http://localhost:3000";
    const resetUrl = `${origin}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;

    await sendPasswordResetEmail(user.email, resetUrl);

    return GENERIC;
  } catch (error: any) {
    console.error("Forgot pass error:", error);
    // Even on error, avoid leaking details.
    return GENERIC;
  }
}
