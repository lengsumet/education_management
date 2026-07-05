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

    // Get filter from query params
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") || "pending";
    const search = searchParams.get("search") || "";
    const semesterFilter = searchParams.get("semester") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    // Build where clause
    const where: any = {
      status: statusFilter as any
    };

    // Filter by semester
    if (semesterFilter) {
      const [termStr, yearStr] = semesterFilter.split('/');
      where.section = {
        semester: {
          semesterNumber: parseInt(termStr),
          academicYear: parseInt(yearStr)
        }
      };
    }

    // If search query is provided, filter by student name/code or course code/name
    if (search) {
      where.OR = [
        { student: { studentCode: { contains: search} } },
        { student: { user: { firstName: { contains: search} } } },
        { student: { user: { lastName: { contains: search} } } },
        { section: { course: { code: { contains: search} } } },
        { section: { course: { name: { contains: search} } } },
      ];
    }

    // Get total count for pagination
    const totalCount = await prisma.enrollment.count({ where });

    // Fetch paginated enrollments
    const enrollments = await prisma.enrollment.findMany({
      where,
      include: {
        student: {
          include: {
            user: true,
            department: true
          }
        },
        section: {
          include: {
            course: true,
            semester: true
          }
        }
      },
      orderBy: { enrolledAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    });

    const registrations = enrollments.map((enrollment: any) => {
      const course = enrollment.section.course;
      const student = enrollment.student;
      const semester = enrollment.section?.semester;

      return {
        id: String(enrollment.id),
        studentId: String(student.id),
        studentCode: student.studentCode,
        studentName: `${student.user.firstName} ${student.user.lastName}`,
        departmentName: student.department?.name || "-",
        courseCode: course.code,
        courseName: course.name,
        credits: course.credits,
        semester: semester
          ? `${semester.semesterNumber}/${semester.academicYear}`
          : "ไม่ระบุ",
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt
          ? new Date(enrollment.enrolledAt).toLocaleDateString("th-TH", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : "-",
      };
    });

    // Group stats
    const allEnrollments = await prisma.enrollment.groupBy({
      by: ['status'],
      _count: { id: true }
    });

    const stats: Record<string, number> = {};
    allEnrollments.forEach((e: any) => {
      stats[e.status || 'pending'] = e._count.id;
    });

    // Get available semesters for the dropdown
    const allSemesters = await prisma.semester.findMany({
      where: {
        courseSections: {
          some: {
            enrollments: { some: {} }
          }
        }
      },
      orderBy: [{ academicYear: 'asc' }, { semesterNumber: 'asc' }],
      select: { semesterNumber: true, academicYear: true }
    });
    const availableSemesters = allSemesters.map(s => `${s.semesterNumber}/${s.academicYear}`);

    return NextResponse.json({
      success: true,
      data: {
        registrations,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
        availableSemesters,
        stats: {
          pending: stats['pending'] || 0,
          enrolled: stats['enrolled'] || 0,
          dropped: stats['dropped'] || 0,
          withdrawn: stats['withdrawn'] || 0,
        }
      }
    });

  } catch (error: any) {
    console.error("Admin Registration API Error:", error);
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
    if (!payload || payload.role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { enrollmentIds, action } = body; // action: "approve" | "reject"

    if (!Array.isArray(enrollmentIds) || enrollmentIds.length === 0) {
      return NextResponse.json({ message: "ไม่ได้เลือกรายการ" }, { status: 400 });
    }

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ message: "Invalid action" }, { status: 400 });
    }

    const newStatus = action === "approve" ? "enrolled" : "dropped";

    const updated = await prisma.enrollment.updateMany({
      where: {
        id: { in: enrollmentIds.map(Number) },
        status: "pending"
      },
      data: {
        status: newStatus
      }
    });

    return NextResponse.json({
      success: true,
      message: action === "approve"
        ? `อนุมัติ ${updated.count} รายการสำเร็จ`
        : `ปฏิเสธ ${updated.count} รายการสำเร็จ`,
      count: updated.count
    });

  } catch (error: any) {
    console.error("Admin Registration PATCH Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
