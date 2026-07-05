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
    if (!payload || payload.role !== "teacher") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { userId: payload.userId },
      include: {
        user: true,
        department: {
          include: {
            faculty: true
          }
        },
        courseSections: {
          include: {
            course: true,
            semester: true
          }
        }
      }
    });

    if (!teacher) {
      return NextResponse.json({ message: "Teacher profile not found" }, { status: 404 });
    }

    // Count active sections
    const activeSections = (teacher as any).courseSections.length;

    return NextResponse.json({
      success: true,
      data: {
        teacherId: teacher.teacherCode,
        firstName: (teacher as any).user.firstName,
        lastName: (teacher as any).user.lastName,
        email: (teacher as any).user.email,
        phone: (teacher as any).user.phone || "",
        department: (teacher as any).department?.name || "ไม่ระบุภาควิชา",
        faculty: (teacher as any).department?.faculty?.name || "ไม่ระบุคณะ",
        position: teacher.position || "",
        officeRoom: teacher.officeRoom || "",
        specialization: teacher.specialization || "",
        activeSections: activeSections,
        avatarUrl: (teacher as any).user.avatarUrl || null
      }
    });

  } catch (error: any) {
    console.error("Teacher Profile API GET Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || payload.role !== "teacher") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { firstName, lastName, phone, position, officeRoom, specialization, avatarUrl } = body;

    const teacher = await prisma.teacher.findUnique({
      where: { userId: payload.userId }
    });

    if (!teacher) {
      return NextResponse.json({ message: "Teacher profile not found" }, { status: 404 });
    }

    // Update User table (firstName, lastName, phone, avatarUrl)
    await prisma.user.update({
      where: { id: payload.userId },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      }
    });

    // Update Teacher table (position, officeRoom, specialization)
    await prisma.teacher.update({
      where: { id: teacher.id },
      data: {
        ...(position !== undefined && { position }),
        ...(officeRoom !== undefined && { officeRoom }),
        ...(specialization !== undefined && { specialization }),
      }
    });

    return NextResponse.json({
      success: true,
      message: "อัปเดตข้อมูลโปรไฟล์สำเร็จ",
    });

  } catch (error: any) {
    console.error("Teacher Profile API PATCH Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
