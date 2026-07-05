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

    const teacher = await (prisma as any).teacher.findUnique({
      where: { userId: payload.userId }
    });

    if (!teacher) {
      return NextResponse.json({ message: "Teacher not found" }, { status: 404 });
    }

    const sections = await (prisma as any).courseSection.findMany({
      where: { teacherId: teacher.id },
      include: {
        course: true,
        enrollments: {
          include: {
            student: {
              include: { user: true }
            }
          }
        }
      }
    });

    let students: any[] = [];
    const courseOptions: Record<string, string> = {};

    sections.forEach((section: any) => {
      // แสดงเฉพาะวิชาที่มีเด็กลงทะเบียนเรียน
      if (section.enrollments && section.enrollments.length > 0) {
        if (!courseOptions[section.course.code]) {
          courseOptions[section.course.code] = section.course.name;
        }

        section.enrollments.forEach((enrollment: any) => {
          students.push({
            id: enrollment.id.toString(),
            studentId: enrollment.student.studentCode,
            name: `${enrollment.student.user.firstName} ${enrollment.student.user.lastName}`,
            email: enrollment.student.user.email,
            course: section.course.code,
            grade: enrollment.grade || "-",
            attendance: enrollment.attendanceScore ?? null,
            assignment: enrollment.assignmentScore ?? null,
            midterm: enrollment.midtermScore ?? null,
            final: enrollment.finalScore ?? null
          });
        });
      }
    });

    const courses = Object.keys(courseOptions).map(code => ({
      code,
      name: courseOptions[code]
    }));

    return NextResponse.json({
      success: true,
      data: { students, courses }
    }, { status: 200 });

  } catch (error: any) {
    console.error("Teacher Students API Error:", error);
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

    const teacher = await (prisma as any).teacher.findUnique({
      where: { userId: payload.userId }
    });

    if (!teacher) {
      return NextResponse.json({ message: "Teacher not found" }, { status: 404 });
    }

    const body = await request.json();
    const { grades } = body;

    if (!Array.isArray(grades) || grades.length === 0) {
      return NextResponse.json({ message: "ไม่มีข้อมูลที่จะบันทึก" }, { status: 400 });
    }

    const validGrades = ["A", "B+", "B", "C+", "C", "D+", "D", "F", "W", "I"];

    // Verify ownership
    const enrollmentIds = grades.map((g: any) => parseInt(g.enrollmentId));
    const enrollments = await (prisma as any).enrollment.findMany({
      where: { id: { in: enrollmentIds } },
      include: { section: true }
    });

    const teacherSectionIds = new Set(
      (await (prisma as any).courseSection.findMany({
        where: { teacherId: teacher.id },
        select: { id: true }
      })).map((s: any) => s.id)
    );

    for (const enrollment of enrollments) {
      if (!teacherSectionIds.has(enrollment.sectionId)) {
        return NextResponse.json({ message: "ไม่มีสิทธิ์แก้ไขรายวิชานี้" }, { status: 403 });
      }
    }

    let updated = 0;
    for (const g of grades) {
      const updateData: any = {};

      if (g.grade && validGrades.includes(g.grade)) {
        updateData.grade = g.grade;
        // When a final grade is recorded, the enrollment is no longer
        // "in progress". Passing or failing, the section is done being taught,
        // so mark it completed to keep status in sync with the grade. This
        // keeps dashboards that still read status consistent with graduation-check
        // (which reads the grade).
        updateData.status = "completed";
      }
      if (g.attendance !== undefined && g.attendance !== null) {
        updateData.attendanceScore = Math.min(100, Math.max(0, parseInt(g.attendance) || 0));
      }
      if (g.assignment !== undefined && g.assignment !== null) {
        updateData.assignmentScore = Math.min(100, Math.max(0, parseInt(g.assignment) || 0));
      }
      if (g.midterm !== undefined && g.midterm !== null) {
        updateData.midtermScore = Math.min(100, Math.max(0, parseInt(g.midterm) || 0));
      }
      if (g.final !== undefined && g.final !== null) {
        updateData.finalScore = Math.min(100, Math.max(0, parseInt(g.final) || 0));
      }

      if (Object.keys(updateData).length > 0) {
        await (prisma as any).enrollment.update({
          where: { id: parseInt(g.enrollmentId) },
          data: updateData
        });
        updated++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `บันทึก ${updated} รายการสำเร็จ`,
      count: updated
    });

  } catch (error: any) {
    console.error("Teacher Grade PATCH Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
