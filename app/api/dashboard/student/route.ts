import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { classifyEnrollment } from "@/lib/grade";

export async function GET(request: NextRequest) {
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

    // 1. Get Student Information
    const student = await prisma.student.findUnique({
      where: { userId: payload.userId },
      include: {
        enrollments: {
          include: {
            section: {
              include: {
                course: true,
                teacher: {
                  include: { user: true }
                }
              }
            }
          }
        }
      }
    });

    if (!student) {
      return NextResponse.json({ message: "Student profile not found" }, { status: 404 });
    }

    // 2. Fetch Announcements
    // If you don't have an Announcement table, we'll return an empty array or mock ones until the table is populated.
    // Looking at the schema, there is an `Announcement` table.
    const rawAnnouncements = await prisma.announcement.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      where: {
        OR: [{ targetRole: 'all' }, { targetRole: 'student' }],
        status: { not: 'แบบร่าง' }
      }
    });

    const notifications = await prisma.notification.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      where: { userId: payload.userId }
    });

    // 3. Transform Data Context
    // Credits are only earned for genuinely passing grades (A..D). An F/W that
    // happens to be marked "completed" must NOT count toward earned credits.
    let totalCredits = 0;
    let completedCoursesCount = 0;
    let inProgressCount = 0;

    const enrolledCourses = (student as any).enrollments.map((enrollment: any) => {
      const kind = classifyEnrollment({ grade: enrollment.grade, status: enrollment.status });
      if (kind === "passed") {
        totalCredits += enrollment.section.course.credits;
        completedCoursesCount++;
      } else if (kind === "in_progress") {
        inProgressCount++;
      }
      // "failed" -> counted in neither earned credits nor in-progress.

      return {
        code: enrollment.section.course.code,
        name: enrollment.section.course.name,
        instructor: enrollment.section.teacher ? `${enrollment.section.teacher.user.firstName} ${enrollment.section.teacher.user.lastName}` : "",
        status: enrollment.status, // "enrolled" | "in-progress" | "completed" | "dropped"
        grade: enrollment.grade || "-",
      };
    });

    const stats = [
      { id: "registered", label: "วิชาลงทะเบียน", value: (student as any).enrollments.length.toString(), color: "bg-blue-100 text-blue-600" },
      { id: "in-progress", label: "กำลังเรียน", value: inProgressCount.toString(), color: "bg-yellow-100 text-yellow-600" },
      { id: "completed", label: "เรียนจบแล้ว", value: completedCoursesCount.toString(), color: "bg-green-100 text-green-600" },
      { id: "credits", label: "หน่วยกิตที่ได้", value: totalCredits.toString(), color: "bg-purple-100 text-purple-600" },
    ];

    const announcements = [
      ...rawAnnouncements.map(a => ({
        id: `announcement-${a.id}`,
        title: a.title,
        date: new Date(a.createdAt || new Date()).toLocaleDateString("th-TH", { day: 'numeric', month: 'long', year: 'numeric' }),
        type: a.isPinned ? "important" : "update"
      })),
      ...notifications.map(n => ({
        id: `notification-${n.id}`,
        title: n.title,
        date: new Date(n.createdAt || new Date()).toLocaleDateString("th-TH", { day: 'numeric', month: 'long', year: 'numeric' }),
        type: n.type === "makeup" ? "important" : "update"
      }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

    // 4. Current semester + registration window + recommended courses for the
    //    student's current year/term (so new students know what to register).
    const currentSem =
      (await prisma.semester.findFirst({
        where: { isCurrent: true },
        orderBy: [{ academicYear: "desc" }, { semesterNumber: "desc" }],
      })) ||
      (await prisma.semester.findFirst({
        orderBy: [{ academicYear: "desc" }, { semesterNumber: "desc" }],
      }));

    let currentSemester: Record<string, unknown> | null = null;
    let recommendedCourses: Record<string, unknown>[] = [];

    if (currentSem) {
      const now = new Date();
      const open = currentSem.regOpenDate ? new Date(currentSem.regOpenDate) : null;
      const close = currentSem.regCloseDate ? new Date(currentSem.regCloseDate) : null;
      let registrationStatus: "not_configured" | "before" | "open" | "closed" = "not_configured";
      if (open && close) {
        registrationStatus = now < open ? "before" : now > close ? "closed" : "open";
      }

      const yearLevel = Math.max(1, currentSem.academicYear - student.admissionYear + 1);

      // Has the student already registered for THIS semester? (so the banner
      // stops nagging once they've submitted). Enrollments link to a section,
      // which belongs to a semester.
      const curTermEnrollments = (student as any).enrollments.filter(
        (e: any) => e.section.semesterId === currentSem.id
      );
      const regPending = curTermEnrollments.filter((e: any) => e.status === "pending").length;
      const regApproved = curTermEnrollments.filter((e: any) => e.status === "enrolled" || e.status === "completed").length;
      const hasRegistered = curTermEnrollments.some((e: any) => e.status !== "dropped");

      currentSemester = {
        name: currentSem.name,
        academicYear: currentSem.academicYear,
        semesterNumber: currentSem.semesterNumber,
        regOpenDate: currentSem.regOpenDate,
        regCloseDate: currentSem.regCloseDate,
        registrationStatus,
        yearLevel,
        registered: hasRegistered,
        regPending,
        regApproved,
      };

      const curriculum = await prisma.curriculum.findFirst({
        where: { departmentId: student.departmentId, status: "active", year: { lte: student.admissionYear } },
        orderBy: { year: "desc" },
        include: { curriculumCourses: { include: { course: true } } },
      });

      const enrolledCourseIds = new Set(
        (student as any).enrollments.map((e: any) => e.section.courseId)
      );

      if (curriculum) {
        recommendedCourses = (curriculum as any).curriculumCourses
          .filter((cc: any) => (cc.yearLevel || 1) === yearLevel && (cc.semester || 1) === currentSem.semesterNumber)
          .map((cc: any) => ({
            courseId: cc.course.id,
            code: cc.course.code,
            name: cc.course.name,
            credits: cc.course.credits,
            type: cc.course.type,
            alreadyRegistered: enrolledCourseIds.has(cc.course.id),
          }));
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        student: {
          code: student.studentCode,
          status: student.status,
          admissionYear: student.admissionYear
        },
        stats,
        enrolledCourses,
        announcements,
        currentSemester,
        recommendedCourses
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
