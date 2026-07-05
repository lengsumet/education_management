import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || payload.role !== "admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const teachers = await prisma.teacher.findMany({
      include: { user: true },
      orderBy: { user: { firstName: 'asc' } }
    });

    const data = teachers.map((t: any) => ({
      id: t.id,
      name: `${t.user.firstName} ${t.user.lastName}`,
      code: t.teacherCode
    }));

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error: any) {
    console.error("Admin Teachers GET API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
