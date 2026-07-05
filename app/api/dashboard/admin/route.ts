import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || payload.role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const [totalUsers, totalCourses, activeStudents] = await Promise.all([
      prisma.user.count(),
      prisma.course.count(),
      prisma.student.count({ where: { status: 'active' } }),
    ]);

    const stats = [
      { id: "total-users", label: "ผู้ใช้ทั้งหมด", value: totalUsers.toLocaleString(), color: "bg-blue-100 text-blue-600" },
      { id: "total-courses", label: "วิชาทั้งหมด", value: totalCourses.toLocaleString(), color: "bg-green-100 text-green-600" },
      { id: "active-students", label: "นิสิตที่ใช้งาน", value: activeStudents.toLocaleString(), color: "bg-purple-100 text-purple-600" },
    ];

    return NextResponse.json({
      success: true,
      data: { stats }
    }, { status: 200 });

  } catch (error: any) {
    console.error("Admin Dashboard API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
