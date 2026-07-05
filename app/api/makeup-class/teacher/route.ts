import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { thaiDayFromEnum, thaiDayFromDate, formatTime } from "@/lib/schedule";

/**
 * Makeup class API (teacher).
 *
 * Fixes vs original:
 *  - Day-of-week mapping used lowercase full names ("monday") but the DB enum
 *    is MON/TUE/... so every schedule row showed "ไม่ระบุ". Now uses the shared
 *    schedule helper.
 *  - Students are now grouped PER SECTION, so the teacher sees only the students
 *    who actually registered the course they are scheduling a makeup for
 *    (requirement: "ต้องเป็นเด็กในชั้นเรียนที่ลงทะเบียนวิชานี้แล้ว").
 *  - POST now verifies the section belongs to the requesting teacher (authz),
 *    and accepts an explicit originalDate instead of silently using "today".
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || payload.role !== "teacher")
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const teacher = await prisma.teacher.findUnique({
      where: { userId: payload.userId },
      include: {
        courseSections: {
          include: {
            course: true,
            enrollments: {
              where: { status: { in: ["enrolled", "completed"] } },
              include: {
                student: {
                  include: {
                    user: true,
                    enrollments: {
                      include: {
                        section: { include: { course: true, schedules: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        makeupClasses: {
          include: { section: { include: { course: true, enrollments: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!teacher) return NextResponse.json({ message: "Teacher not found" }, { status: 404 });

    // Build a student's full weekly schedule once, reused per section.
    const buildStudentCourses = (studentEnrollments: any[]) =>
      studentEnrollments.map((studentEnr: any) => {
        const sch = studentEnr.section.schedules[0];
        return {
          code: studentEnr.section.course.code,
          name: studentEnr.section.course.name,
          day: sch ? thaiDayFromEnum(sch.dayOfWeek) : "ไม่ระบุ",
          time: sch ? `${formatTime(sch.startTime)} - ${formatTime(sch.endTime)}` : "-",
        };
      });

    // Sections for the selector, each carrying ITS OWN student list.
    const sections = (teacher as any).courseSections.map((section: any) => {
      const students = section.enrollments.map((enr: any) => ({
        id: enr.student.id.toString(),
        studentId: enr.student.studentCode,
        name: `${enr.student.user.firstName} ${enr.student.user.lastName}`,
        courses: buildStudentCourses(enr.student.enrollments),
      }));

      return {
        sectionId: section.id,
        courseCode: section.course.code,
        courseName: section.course.name,
        sectionNumber: section.sectionNumber,
        studentsTotal: section.enrollments.length,
        students,
      };
    });

    // History of makeup requests.
    const requests = (teacher as any).makeupClasses.map((mc: any) => ({
      id: mc.id.toString(),
      sectionId: mc.sectionId,
      courseCode: mc.section.course.code,
      courseName: mc.section.course.name,
      reason: mc.reason || "ไม่ระบุเหตุผล",
      originalDate: new Date(mc.originalDate).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      status: "ส่งนัดแล้ว",
      selectedDate: new Date(mc.makeupDate).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      selectedTime: `${thaiDayFromDate(new Date(mc.makeupDate))} ${formatTime(mc.startTime)} - ${formatTime(mc.endTime)}`,
      studentsTotal: mc.section.enrollments.length,
    }));

    return NextResponse.json({ success: true, data: { sections, requests } }, { status: 200 });
  } catch (error: any) {
    console.error("Makeup Class GET API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload || payload.role !== "teacher")
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const teacher = await prisma.teacher.findUnique({ where: { userId: payload.userId } });
    if (!teacher) return NextResponse.json({ message: "Teacher not found" }, { status: 404 });

    const body = await request.json();
    const { sectionId, originalDate, makeupDate, startTime, endTime, reason } = body;

    if (!sectionId || !makeupDate || !startTime || !endTime) {
      return NextResponse.json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน" }, { status: 400 });
    }

    // Authz: the section must belong to THIS teacher.
    const section = await prisma.courseSection.findUnique({
      where: { id: parseInt(sectionId) },
      include: { course: true, enrollments: { include: { student: true } } },
    });

    if (!section) return NextResponse.json({ message: "ไม่พบกลุ่มเรียน" }, { status: 404 });
    if (section.teacherId !== teacher.id) {
      return NextResponse.json({ message: "คุณไม่มีสิทธิ์ในกลุ่มเรียนนี้" }, { status: 403 });
    }

    const newMakeup = await prisma.makeupClass.create({
      data: {
        sectionId: section.id,
        originalDate: originalDate ? new Date(originalDate) : new Date(),
        makeupDate: new Date(makeupDate),
        startTime: new Date(`1970-01-01T${startTime}:00Z`),
        endTime: new Date(`1970-01-01T${endTime}:00Z`),
        reason: reason || "สอนชดเชย",
        createdBy: teacher.id,
        status: "scheduled",
      },
    });

    // Notify only the students enrolled in this section.
    const notificationsData = section.enrollments.map((enr) => ({
      userId: enr.student.userId,
      title: `นัดสอนชดเชยวิชา ${section.course.name}`,
      message: `นัดชดเชยวันที่ ${new Date(makeupDate).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })} เวลา ${startTime} - ${endTime}`,
      type: "makeup" as const,
      isRead: false,
    }));

    if (notificationsData.length > 0) {
      await prisma.notification.createMany({ data: notificationsData });
    }

    return NextResponse.json({ success: true, data: newMakeup }, { status: 201 });
  } catch (error: any) {
    console.error("Makeup Class POST API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
