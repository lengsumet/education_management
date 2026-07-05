import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Defense-in-depth against reset-token guessing: 10 / 15 min per IP.
    const rl = rateLimit(`reset:${clientIp(request)}`, 10, 15 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { message: "พยายามบ่อยเกินไป กรุณาลองใหม่ภายหลัง" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    const { email, token, newPassword } = await request.json();

    if (!email || !token || !newPassword) {
      return NextResponse.json({ message: "ข้อมูลไม่ครบถ้วน" }, { status: 400 });
    }

    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return NextResponse.json({ message: "รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
    }

    // Do NOT reveal whether the account exists — a missing user, a bad token and
    // an expired token all return the same generic response. Otherwise this
    // endpoint re-introduces the email enumeration that forgot-password guards
    // against.
    const INVALID = NextResponse.json(
      { message: "ลิงก์นี้ไม่ถูกต้องหรือหมดอายุแล้ว" },
      { status: 400 }
    );

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return INVALID;
    }

    // Check OTP record
    const otpRecord = await prisma.oTPVerification.findFirst({
      where: {
        userId: user.id,
        otpCode: token,
        purpose: "reset_password",
        isUsed: false,
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!otpRecord) {
      return INVALID;
    }

    // Check expiration
    if (new Date() > otpRecord.expiresAt) {
      return INVALID;
    }

    // Hash the new password and run in transaction
    const passwordHash = await hashPassword(newPassword);

    await prisma.$transaction([
      // Update password
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash }
      }),
      // Mark token as used
      prisma.oTPVerification.update({
        where: { id: otpRecord.id },
        data: { isUsed: true }
      })
    ]);

    return NextResponse.json({ message: "เปลี่ยนรหัสผ่านสำเร็จ!" }, { status: 200 });

  } catch (error: any) {
    console.error("Reset pass error:", error);
    return NextResponse.json({ message: "ระบบเกิดข้อผิดพลาด" }, { status: 500 });
  }
}
