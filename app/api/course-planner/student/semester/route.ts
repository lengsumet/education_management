import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || payload.role !== "student") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const student = await prisma.student.findUnique({
      where: { userId: payload.userId }
    });

    if (!student) {
      return NextResponse.json({ message: "Student profile not found" }, { status: 404 });
    }

    const body = await request.json();
    const { semester } = body;

    if (!semester) {
      return NextResponse.json({ message: "Missing semester" }, { status: 400 });
    }

    // Get current custom semesters
    let currentCustom = [];
    try {
      const studentAny = student as any;
      if (studentAny.customSemesters) {
        currentCustom = typeof studentAny.customSemesters === 'string' 
          ? JSON.parse(studentAny.customSemesters) 
          : studentAny.customSemesters;
      }
    } catch(e) {}

    // Add new semester if it doesn't exist
    if (!currentCustom.includes(semester)) {
      currentCustom.push(semester);
      
      // Update in database
      await prisma.student.update({
        where: { id: student.id },
        data: {
          customSemesters: currentCustom
        } as any // Use any because Prisma types might not be generated yet
      });
    }

    return NextResponse.json({
      success: true,
      data: currentCustom
    });

  } catch (error: any) {
    console.error("Course Planner Semester API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
