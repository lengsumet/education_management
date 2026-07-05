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
    if (!payload || payload.role !== "student") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const student = await prisma.student.findUnique({
      where: { userId: payload.userId },
      include: {
        department: { include: { faculty: true } },
        user: true,
        coursePlans: {
          include: { course: true },
          orderBy: [{ plannedYear: "asc" }, { plannedSemester: "asc" }],
        },
        enrollments: {
          include: {
            section: { include: { course: true, semester: true } },
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ message: "Student profile not found" }, { status: 404 });
    }

    // Find the curriculum matching student's admissionYear:
    // Get the latest active curriculum where curriculum.year <= student.admissionYear
    const curriculum = await prisma.curriculum.findFirst({
      where: {
        departmentId: student.departmentId,
        status: "active",
        year: { lte: student.admissionYear },
      },
      orderBy: { year: "desc" },
      include: {
        curriculumCourses: {
          include: { course: true },
          orderBy: [{ yearLevel: "asc" }, { semester: "asc" }],
        },
      },
    });

    // Build completed/enrolled course sets
    const studentWithEnrollments = student as any;
    const completedCourseIds = new Set(
      studentWithEnrollments.enrollments
        .filter((e: any) => e.grade && e.grade !== "F")
        .map((e: any) => e.section.courseId)
    );
    const enrolledCourseIds = new Set(
      studentWithEnrollments.enrollments.map((e: any) => e.section.courseId)
    );

    // A CoursePlan row for a course that IS in the curriculum acts as a
    // term OVERRIDE (the "ย้ายเทอม" feature) — the student moved that course to
    // a different term. A CoursePlan for a course NOT in the curriculum is a
    // free elective the student added beyond the curriculum.
    const overrideByCourseId = new Map<number, any>();
    for (const plan of studentWithEnrollments.coursePlans) {
      overrideByCourseId.set(plan.courseId, plan);
    }

    const curriculumData = curriculum as any;
    const curriculumCourseIds = new Set<number>();

    // Backbone = every course the curriculum places at a year/term (required +
    // general + elective). This is the student's recommended plan, shown in full.
    const backbone: any[] = [];
    if (curriculumData) {
      for (const cc of curriculumData.curriculumCourses) {
        const course = cc.course;
        curriculumCourseIds.add(course.id);
        const ov = overrideByCourseId.get(course.id);
        let status: "completed" | "in-progress" | "planned" = "planned";
        if (completedCourseIds.has(course.id)) status = "completed";
        else if (enrolledCourseIds.has(course.id)) status = "in-progress";

        backbone.push({
          id: ov ? `plan-${ov.id}` : `req-${cc.id}`,
          courseId: course.id,
          code: course.code,
          name: course.name,
          credits: course.credits,
          type: course.type, // required | elective | general
          yearLevel: ov ? ov.plannedYear : cc.yearLevel || 1,
          semester: ov ? ov.plannedSemester : cc.semester || 1,
          status,
          inCurriculum: true,            // part of the recommended plan
          isRequired: course.type === "required",
          // Only "moved" when the override term actually differs from the
          // curriculum default (an override at the same slot is not a move).
          moved: !!ov && (ov.plannedYear !== (cc.yearLevel || 1) || ov.plannedSemester !== (cc.semester || 1)),
          curriculumYear: cc.yearLevel || 1,
          curriculumSemester: cc.semester || 1,
        });
      }
    }

    // Free electives = CoursePlan rows for courses NOT in the curriculum. These
    // are the student's own additions and can be removed.
    const freeElectives: any[] = studentWithEnrollments.coursePlans
      .filter((plan: any) => !curriculumCourseIds.has(plan.courseId))
      .map((plan: any) => {
        let status: "completed" | "in-progress" | "planned" = (plan.status as any) || "planned";
        if (completedCourseIds.has(plan.courseId)) status = "completed";
        else if (enrolledCourseIds.has(plan.courseId)) status = "in-progress";
        return {
          id: `plan-${plan.id}`,
          courseId: plan.courseId,
          code: plan.course.code,
          name: plan.course.name,
          credits: plan.course.credits,
          type: plan.course.type,
          yearLevel: plan.plannedYear,
          semester: plan.plannedSemester,
          status,
          inCurriculum: false,
          isRequired: false,
          moved: false,
        };
      });

    let allCourses = [...backbone, ...freeElectives];

    // Fetch prerequisites for warning evaluation
    const allPrereqs = await prisma.coursePrerequisite.findMany({
      include: { prerequisite: true }
    });

    allCourses = allCourses.map(course => {
      const prereqs = allPrereqs.filter(p => p.courseId === course.courseId);
      let prerequisiteWarning = null;

      if (prereqs.length > 0) {
        for (const p of prereqs) {
          // If already completed, then it's fine
          if (completedCourseIds.has(p.prerequisiteId)) continue;
          
          // Find when the prerequisite is planned
          const plannedPrereq = allCourses.find(c => c.courseId === p.prerequisiteId);
          if (!plannedPrereq) {
            prerequisiteWarning = `ต้องผ่าน ${p.prerequisite.code} ก่อน`;
            break;
          }

          // If planned in same or later semester, it's a warning
          if (
            plannedPrereq.yearLevel > course.yearLevel || 
            (plannedPrereq.yearLevel === course.yearLevel && plannedPrereq.semester >= course.semester)
          ) {
            prerequisiteWarning = `ต้องเรียน ${p.prerequisite.code} ก่อน (จัดแผนผิดลำดับ)`;
            break;
          }
        }
      }

      return { ...course, prerequisiteWarning };
    });

    // Determine max year levels
    const maxYear = Math.max(
      4,
      ...allCourses.map((c) => c.yearLevel)
    );

    // Addable pool = elective/general courses the student may choose, minus
    // any they've already added to their plan or already enrolled in. Required
    // courses are the curriculum backbone (above) and are never "addable".
    const availableCourses = await prisma.course.findMany({
      where: {
        type: { in: ["elective", "general"] },
      },
      select: { id: true, code: true, name: true, credits: true, type: true },
      orderBy: { code: "asc" },
    });

    const plannedCourseIds = new Set(allCourses.map((c) => c.courseId));
    const addableCourses = availableCourses.filter(
      (c) => !plannedCourseIds.has(c.id) && !enrolledCourseIds.has(c.id)
    );

    // Current year/term for the student, so the planner can gate what they see
    // to "their level and below" (e.g. a Year 3 term 1 student sees 1.1–3.1).
    const currentSem =
      (await prisma.semester.findFirst({
        where: { isCurrent: true },
        orderBy: [{ academicYear: "desc" }, { semesterNumber: "desc" }],
      })) ||
      (await prisma.semester.findFirst({
        orderBy: [{ academicYear: "desc" }, { semesterNumber: "desc" }],
      }));
    // Raw (uncapped) year level: if it exceeds the program length the student
    // is past their timeline, so the client shows everything (no gating).
    const currentYearLevel = currentSem
      ? Math.max(1, currentSem.academicYear - student.admissionYear + 1)
      : 99;
    const currentSemesterNumber = currentSem?.semesterNumber || 1;

    const su = student as any;
    return NextResponse.json({
      success: true,
      data: {
        courses: allCourses,
        maxYear, // reflects the curriculum's actual length (min 4, or higher if a 5+ year program)
        addableCourses,
        curriculumName: curriculumData?.name || null,
        currentYearLevel,
        currentSemesterNumber,
        studentInfo: {
          name: su.user ? `${su.user.firstName} ${su.user.lastName}` : "",
          code: student.studentCode,
          department: su.department?.name || "",
          faculty: su.department?.faculty?.name || "",
        },
      },
    });
  } catch (error: any) {
    console.error("Course Planner API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

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
      where: { userId: payload.userId },
    });

    if (!student) {
      return NextResponse.json({ message: "Student profile not found" }, { status: 404 });
    }

    const body = await request.json();
    const { courseCode, yearLevel, semester } = body;

    const course = await prisma.course.findUnique({
      where: { code: courseCode },
    });

    if (!course) {
      return NextResponse.json({ message: "ไม่พบรหัสวิชานี้ในระบบ" }, { status: 404 });
    }

    // Check duplicate
    const existing = await prisma.coursePlan.findFirst({
      where: { studentId: student.id, courseId: course.id },
    });
    if (existing) {
      return NextResponse.json({ message: "วิชานี้อยู่ในแผนแล้ว" }, { status: 400 });
    }

    const plan = await prisma.coursePlan.create({
      data: {
        studentId: student.id,
        courseId: course.id,
        plannedSemester: parseInt(semester) || 1,
        plannedYear: parseInt(yearLevel) || 1,
        status: "planned",
      },
      include: { course: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: `plan-${plan.id}`,
        code: plan.course.code,
        name: plan.course.name,
        credits: plan.course.credits,
        type: plan.course.type,
        yearLevel: plan.plannedYear,
        semester: plan.plannedSemester,
        status: "planned",
        isRequired: false,
      },
    });
  } catch (error: any) {
    console.error("Course Planner POST Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const rawId = searchParams.get("id"); // "plan-123"

    if (!rawId || !rawId.startsWith("plan-")) {
      return NextResponse.json({ message: "ไม่สามารถลบวิชาบังคับได้" }, { status: 400 });
    }

    const planId = parseInt(rawId.replace("plan-", ""));

    const student = await prisma.student.findUnique({
      where: { userId: payload.userId },
    });

    if (!student) {
      return NextResponse.json({ message: "Student not found" }, { status: 404 });
    }

    const plan = await prisma.coursePlan.findFirst({
      where: { id: planId, studentId: student.id },
    });

    if (!plan) {
      return NextResponse.json({ message: "Plan not found" }, { status: 404 });
    }

    await prisma.coursePlan.delete({ where: { id: plan.id } });

    return NextResponse.json({ success: true, message: "ลบวิชาออกจากแผนสำเร็จ" });
  } catch (error: any) {
    console.error("Course Planner DELETE Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

// Move a course to a different term ("ย้ายเทอม"). Persists as a CoursePlan
// override keyed by (student, course). Works for curriculum courses (backbone)
// and free electives alike.
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || payload.role !== "student") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const student = await prisma.student.findUnique({ where: { userId: payload.userId } });
    if (!student) return NextResponse.json({ message: "Student profile not found" }, { status: 404 });

    const body = await request.json();
    const courseId = parseInt(body.courseId);
    const yearLevel = parseInt(body.yearLevel);
    const semester = parseInt(body.semester);
    if (!courseId || !yearLevel || !semester) {
      return NextResponse.json({ message: "ข้อมูลไม่ครบ (courseId, yearLevel, semester)" }, { status: 400 });
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return NextResponse.json({ message: "ไม่พบวิชานี้" }, { status: 404 });

    const existing = await prisma.coursePlan.findFirst({
      where: { studentId: student.id, courseId },
    });
    if (existing) {
      await prisma.coursePlan.update({
        where: { id: existing.id },
        data: { plannedYear: yearLevel, plannedSemester: semester },
      });
    } else {
      await prisma.coursePlan.create({
        data: { studentId: student.id, courseId, plannedYear: yearLevel, plannedSemester: semester, status: "planned" },
      });
    }

    return NextResponse.json({ success: true, message: "ย้ายเทอมสำเร็จ" });
  } catch (error: any) {
    console.error("Course Planner PATCH Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
