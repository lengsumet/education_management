import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const payload = await verifyToken(token);

    if (!payload) {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    // Optionally fetch more user data from Prisma if needed
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
      }
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    let profile = null;
    if (user.role === "student") {
      profile = await prisma.student.findFirst({ where: { userId: user.id }});
    } else if (user.role === "teacher") {
      profile = await prisma.teacher.findFirst({ where: { userId: user.id }});
    }

    return NextResponse.json({
      user,
      profile
    });
  } catch (error: any) {
    console.error("Auth me error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
