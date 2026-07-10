import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { getPassedCourseIds, computeUnmetPrereqs } from "@/lib/prerequisites";

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
        user: true,
        department: true,
        advisor: {
          include: {
            user: true
          }
        },
        enrollments: {
          include: {
            section: {
              include: {
                course: true,
                semester: true
              }
            }
          },
          orderBy: { enrolledAt: 'desc' }
        },
        coursePlans: {
          include: {
            course: {
              include: {
                courseSections: {
                  include: {
                    teacher: true,
                    schedules: true
                  }
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

    // Map enrollment status to registration status
    const mapStatus = (status: string | null): "approved" | "pending" | "rejected" => {
      switch (status) {
        case "enrolled": return "approved";
        case "dropped": return "rejected";
        case "withdrawn": return "rejected";
        default: return "pending";
      }
    };

    const registrations = (student as any).enrollments.map((enrollment: any) => {
      const course = enrollment.section.course;
      const enrolledDate = enrollment.enrolledAt
        ? new Date(enrollment.enrolledAt).toLocaleDateString("th-TH", {
            day: "numeric",
            month: "long",
            year: "numeric"
          })
        : "ไม่ระบุวันที่";

      const status = mapStatus(enrollment.status);

      let reason = "";
      if (status === "rejected") {
        reason = enrollment.status === "dropped"
          ? "ถอนวิชา"
          : "ถอนวิชาโดยได้รับ W";
      }

      return {
        id: String(enrollment.id),
        code: course.code,
        name: course.name,
        credits: course.credits,
        status,
        registrationDate: enrolledDate,
        reason,
        semester: enrollment.section?.semester 
          ? `${enrollment.section.semester.semesterNumber}/${enrollment.section.semester.academicYear}` 
          : "ไม่ระบุภาคเรียน",
        sectionNumber: enrollment.section?.sectionNumber || "-",
        courseType: course.type || "C"
      };
    });

    const approved = registrations.filter(r => r.status === "approved");
    const pending = registrations.filter(r => r.status === "pending");
    const rejected = registrations.filter(r => r.status === "rejected");
    const totalApprovedCredits = approved.reduce((sum, r) => sum + r.credits, 0);

    const studentInfo = {
      studentCode: (student as any).studentCode,
      firstName: (student as any).user?.firstName,
      lastName: (student as any).user?.lastName,
      departmentName: (student as any).department?.name || "",
      advisorName: (student as any).advisor?.user ? `${(student as any).advisor.user.firstName} ${(student as any).advisor.user.lastName}` : "",
      admissionYear: (student as any).admissionYear
    };

    // Format course plans. NOTE: CoursePlan.plannedYear is the YEAR LEVEL (1–4),
    // the same convention the course-planner writes. Convert it to an academic
    // year for the semester label so registration and planner stay consistent.
    const plannedCourses = (student as any).coursePlans.map((plan: any) => {
      const planAcademicYear = (student.admissionYear ?? 0) + plan.plannedYear - 1;
      return {
        id: plan.id,
        semester: `${plan.plannedSemester}/${planAcademicYear}`,
        courseId: plan.course.id,
        code: plan.course.code,
        name: plan.course.name,
        credits: plan.course.credits,
        isCompulsory: plan.course.type === 'required',
        availableSections: plan.course.courseSections.map((sec: any) => ({
          sectionId: sec.id,
          sectionNumber: sec.sectionNumber,
          teacherName: sec.teacher?.name || "ไม่ระบุ",
          currentStudents: sec.currentStudents || 0,
          maxStudents: sec.maxStudents || 50,
          schedules: sec.schedules.map((sch: any) => ({
            day: sch.dayOfWeek,
            time: `${new Date(sch.startTime).toISOString().slice(11, 16)} - ${new Date(sch.endTime).toISOString().slice(11, 16)}`,
            room: sch.room || "TBA"
          }))
        }))
      };
    });

    // --- AUTO-PULL COURSES FOR THE ACTIVE REGISTRATION TERM ONLY ---
    // Registration is scoped to the single semester currently open for
    // registration — NOT the whole 4-year curriculum. We offer:
    //   (a) this term's required curriculum courses not yet passed, and
    //   (b) any previously-failed course (retake, e.g. an F), shown under
    //       the active term so the student can re-register it.
    let activeSemester = await prisma.semester.findFirst({ where: { isCurrent: true } });
    if (!activeSemester) {
      activeSemester = await prisma.semester.findFirst({ orderBy: [{ academicYear: 'desc' }, { semesterNumber: 'desc' }] });
    }
    const activeSemesterLabel = activeSemester
      ? `${activeSemester.semesterNumber}/${activeSemester.academicYear}`
      : null;

    const enrollmentsForPull = (student as any).enrollments;
    const passedForPull = getPassedCourseIds(enrollmentsForPull);
    // Currently studying or awaiting approval — don't offer again.
    const inProgressCourseIds = new Set(
      enrollmentsForPull
        .filter((e: any) => e.status === 'enrolled' || e.status === 'pending')
        .map((e: any) => e.section.courseId)
    );
    // Attempted but not passed (has a final grade that isn't a pass) => retake.
    const needRetakeCourseIds = new Set(
      enrollmentsForPull
        .filter((e: any) => e.grade && !passedForPull.has(e.section.courseId))
        .map((e: any) => e.section.courseId)
    );
    const existingPlanCourseIds = new Set((student as any).coursePlans.map((p: any) => p.courseId));

    let curriculumCoursesToAdd: any[] = [];
    if (student.admissionYear && activeSemester) {
      const studentYearLevel = Math.max(1, activeSemester.academicYear - student.admissionYear + 1);

      const studentCurriculum = await prisma.curriculum.findFirst({
        where: { departmentId: student.departmentId, year: { lte: student.admissionYear } },
        orderBy: { year: 'desc' }
      });

      if (studentCurriculum) {
        const curriculumCourses = await prisma.curriculumCourse.findMany({
          where: { curriculumId: studentCurriculum.id },
          include: {
            course: {
              include: {
                courseSections: {
                  include: { teacher: true, schedules: true, semester: true }
                }
              }
            }
          }
        });

        for (const req of curriculumCourses) {
          const isCurrentTerm =
            (req.yearLevel || 1) === studentYearLevel &&
            (req.semester || 1) === activeSemester.semesterNumber;
          const isRetake = needRetakeCourseIds.has(req.courseId);

          if (!isCurrentTerm && !isRetake) continue;             // not this term's course, not a retake
          if (passedForPull.has(req.courseId)) continue;         // already passed
          if (existingPlanCourseIds.has(req.courseId)) continue; // already in student's plan
          if (inProgressCourseIds.has(req.courseId)) continue;   // already registering / studying

          curriculumCoursesToAdd.push({
            id: `curr-${req.id}`,
            semester: activeSemesterLabel,
            courseId: req.course.id,
            code: req.course.code,
            name: req.course.name,
            credits: req.course.credits,
            isCompulsory: req.course.type === 'required',
            isRetake,
            availableSections: req.course.courseSections
              .filter((sec: any) => sec.semesterId === activeSemester!.id)
              .map((sec: any) => ({
                sectionId: sec.id,
                sectionNumber: sec.sectionNumber,
                teacherName: sec.teacher?.name || "ไม่ระบุ",
                currentStudents: sec.currentStudents || 0,
                maxStudents: sec.maxStudents || 50,
                schedules: sec.schedules.map((sch: any) => ({
                  day: sch.dayOfWeek,
                  time: `${new Date(sch.startTime).toISOString().slice(11, 16)} - ${new Date(sch.endTime).toISOString().slice(11, 16)}`,
                  room: sch.room || "TBA"
                }))
              }))
          });
        }
      }
    }

    // Retakes not covered above (a failed course not in the curriculum backbone,
    // e.g. a failed math course) — offer them in the active term so the student
    // can re-register and clear the prerequisite.
    if (activeSemester) {
      const alreadyPulled = new Set(curriculumCoursesToAdd.map((c: any) => c.courseId));
      const retakeOnly = [...needRetakeCourseIds].filter((cid: any) =>
        !alreadyPulled.has(cid) && !passedForPull.has(cid) &&
        !existingPlanCourseIds.has(cid) && !inProgressCourseIds.has(cid)
      );
      if (retakeOnly.length > 0) {
        const retakeCourses = await prisma.course.findMany({
          where: { id: { in: retakeOnly as number[] } },
          include: { courseSections: { include: { teacher: true, schedules: true, semester: true } } },
        });
        for (const course of retakeCourses) {
          curriculumCoursesToAdd.push({
            id: `retake-${course.id}`,
            semester: activeSemesterLabel,
            courseId: course.id,
            code: course.code,
            name: course.name,
            credits: course.credits,
            isCompulsory: course.type === 'required',
            isRetake: true,
            availableSections: course.courseSections
              .filter((sec: any) => sec.semesterId === activeSemester!.id)
              .map((sec: any) => ({
                sectionId: sec.id,
                sectionNumber: sec.sectionNumber,
                teacherName: sec.teacher?.name || "ไม่ระบุ",
                currentStudents: sec.currentStudents || 0,
                maxStudents: sec.maxStudents || 50,
                schedules: sec.schedules.map((sch: any) => ({
                  day: sch.dayOfWeek,
                  time: `${new Date(sch.startTime).toISOString().slice(11, 16)} - ${new Date(sch.endTime).toISOString().slice(11, 16)}`,
                  room: sch.room || "TBA"
                }))
              }))
          });
        }
      }
    }

    // Only the active registration term's courses appear in the plan section
    // (student's own coursePlans for that term + auto-pulled). Past/future
    // planned terms are managed on the course-planner page, not here.
    const finalPlannedCourses = [...plannedCourses, ...curriculumCoursesToAdd]
      .filter((c: any) => !activeSemesterLabel || c.semester === activeSemesterLabel);

    // --- Attach prerequisite lock status to each planned course (UI badge) ---
    const passedCourseIds = getPassedCourseIds((student as any).enrollments);
    const plannedCourseIds = finalPlannedCourses
      .map((c: any) => Number(c.courseId))
      .filter((id: number) => !isNaN(id));

    const prereqLinks = plannedCourseIds.length > 0
      ? await prisma.coursePrerequisite.findMany({
          where: { courseId: { in: plannedCourseIds } },
          include: { prerequisite: { select: { id: true, code: true, name: true } } },
        })
      : [];

    const prereqsByCourse = new Map<number, typeof prereqLinks>();
    for (const link of prereqLinks) {
      const arr = prereqsByCourse.get(link.courseId) ?? [];
      arr.push(link);
      prereqsByCourse.set(link.courseId, arr);
    }

    const plannedWithPrereq = finalPlannedCourses.map((c: any) => {
      const links = prereqsByCourse.get(Number(c.courseId)) ?? [];
      const missing = computeUnmetPrereqs(links as any, passedCourseIds);
      return {
        ...c,
        prereqLocked: missing.length > 0,
        missingPrereqs: missing.map((m) => ({ code: m.code, name: m.name })),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        studentInfo,
        registrations,
        plannedCourses: plannedWithPrereq,
        stats: {
          approved: approved.length,
          pending: pending.length,
          rejected: rejected.length,
          totalApprovedCredits
        }
      }
    });

  } catch (error: any) {
    console.error("Registration API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || payload.role !== "student") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { enrollments } = body; // Array of { courseId, semester }

    if (!Array.isArray(enrollments) || enrollments.length === 0) {
      return NextResponse.json({ message: "No courses selected" }, { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { userId: payload.userId },
      include: { enrollments: { include: { section: true } } }
    });
    if (!student) return NextResponse.json({ message: "Student not found" }, { status: 404 });

    // Passed courses (A–D only) — single source of truth in src/lib/prerequisites.
    const passedCourseIds = getPassedCourseIds((student as any).enrollments);

    const results = [];
    const errors = [];

    for (const item of enrollments) {
      const { courseId, semester } = item;
      if (!courseId) continue;

      let targetSemesterRec = null;
      if (semester) {
        const [termStr, yearStr] = semester.split('/');
        const semNum = parseInt(termStr);
        const acadYear = parseInt(yearStr);
        
        targetSemesterRec = await prisma.semester.findFirst({
          where: { semesterNumber: semNum, academicYear: acadYear }
        });

        // Auto-create semester record if it doesn't exist
        if (!targetSemesterRec && semNum && acadYear) {
          targetSemesterRec = await prisma.semester.create({
            data: {
              name: `ภาคเรียนที่ ${semNum}/${acadYear}`,
              academicYear: acadYear,
              semesterNumber: semNum,
              startDate: new Date(acadYear - 543, semNum === 1 ? 5 : 10, 1), // approximate
              endDate: new Date(acadYear - 543, semNum === 1 ? 9 : 2, 30),   // approximate
              isCurrent: false
            }
          });
        }
      }

      if (!targetSemesterRec) {
        targetSemesterRec = await prisma.semester.findFirst({ orderBy: { isCurrent: 'desc' } });
      }

      if (!targetSemesterRec) {
        errors.push(`ไม่พบภาคเรียนในระบบ`);
        continue;
      }

      // Fetch course details for friendly error and prerequisite check
      const course = await prisma.course.findUnique({
        where: { id: Number(courseId) },
        include: { prerequisites: { include: { prerequisite: true } } }
      });

      // --- Prerequisite Check (HARD) ---
      // Unmet prerequisites hard-block registration: no enrolment is created.
      // The student must pass the prerequisite first — no advisor override.
      if (course?.prerequisites && course.prerequisites.length > 0) {
        const unmet = computeUnmetPrereqs(course.prerequisites, passedCourseIds);
        if (unmet.length > 0) {
          const codes = unmet.map(p => p.code).join(", ");
          errors.push(`วิชา ${course.code} ต้องผ่าน ${codes} ก่อนจึงจะลงทะเบียนได้`);
          continue; // hard block — skip this course
        }
      }

      // Find the first available section for this course IN THE SPECIFIED SEMESTER
      let section = await prisma.courseSection.findFirst({
        where: { courseId: Number(courseId), semesterId: targetSemesterRec.id },
        orderBy: { sectionNumber: 'asc' }
      });

      if (!section) {
        // Auto-create a temporary section so the student can register for this semester
        const teacher = await prisma.teacher.findFirst();

        if (teacher) {
          section = await prisma.courseSection.create({
            data: {
              courseId: Number(courseId),
              semesterId: targetSemesterRec.id,
              teacherId: teacher.id,
              sectionNumber: "Auto",
              maxStudents: 999,
            }
          });
        } else {
          errors.push(`ระบบยังไม่ได้ตั้งค่าปีการศึกษาหรืออาจารย์ (วิชา ${course?.code || courseId})`);
          continue;
        }
      }
      
      const sectionId = section.id;

      // Check if already enrolled or pending
      const existing = await prisma.enrollment.findUnique({
        where: {
          studentId_sectionId: {
            studentId: student.id,
            sectionId: sectionId
          }
        }
      });

      if (existing) {
        errors.push(`วิชา ${course?.code || courseId} ลงทะเบียนซ้ำแล้ว`);
        continue;
      }

      if ((section.currentStudents || 0) >= (section.maxStudents || 50)) {
        errors.push(`วิชา ${course?.code || courseId} ที่นั่งเต็มแล้ว`);
        continue;
      }

      // Create enrollment as pending (awaiting advisor approval).
      const newEnrollment = await prisma.enrollment.create({
        data: {
          studentId: student.id,
          sectionId: sectionId,
          status: "pending",
          enrolledAt: new Date()
        }
      });

      // Increase currentStudents counter
      await prisma.courseSection.update({
        where: { id: sectionId },
        data: { currentStudents: { increment: 1 } }
      });

      // Remove from course plan since it is now being enrolled
      await prisma.coursePlan.deleteMany({
        where: { studentId: student.id, courseId: section.courseId }
      });

      results.push(newEnrollment);
    }

    return NextResponse.json({ success: true, results, errors });
  } catch (error: any) {
    console.error("Registration POST Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
