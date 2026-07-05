import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken, verifyPassword, hashPassword } from "@/lib/auth";
import { cookies } from "next/headers";

export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ message: "ข้อมูลรหัสผ่านไม่ครบถ้วน" }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ message: "รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
    }

    // Identify user
    const user = await prisma.user.findUnique({
      where: { id: payload.userId }
    });

    if (!user) {
      return NextResponse.json({ message: "ไม่พบผู้ใช้งานในระบบ" }, { status: 404 });
    }

    // Verify current password
    const isPasswordValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json({ message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" }, { status: 401 });
    }

    // Hash new password and update
    const newPasswordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash
      }
    });

    return NextResponse.json({
      success: true,
      message: "รหัสผ่านถูกเปลี่ยนแปลงเรียบร้อยแล้ว"
    }, { status: 200 });

  } catch (error: any) {
    console.error("Change Password API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
