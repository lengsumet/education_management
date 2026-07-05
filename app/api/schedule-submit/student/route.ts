import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";

const THAI_DAYS_FULL: Record<string, string> = {
  "MON": "จันทร์",
  "TUE": "อังคาร",
  "WED": "พุธ",
  "THU": "พฤหัสบดี",
  "FRI": "ศุกร์",
  "SAT": "เสาร์",
  "SUN": "อาทิตย์"
};

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
};

const formatDate = (date: Date) => {
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
};

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
        enrollments: {
          where: { status: "enrolled" },
          include: {
            section: {
              include: {
                course: true,
                teacher: {
                  include: { user: true }
                },
                semester: true,
                schedules: true,
                makeupClasses: {
                  include: {
                    teacher: {
                      include: { user: true }
                    }
                  },
                  orderBy: { createdAt: 'desc' }
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

    // Build registered courses from enrollments + schedules
    const registeredCourses = (student as any).enrollments.flatMap((enrollment: any) => {
      const section = enrollment.section;
      const course = section.course;
      const teacher = section.teacher?.user;
      const instructorName = teacher ? `${teacher.firstName} ${teacher.lastName}` : "ไม่ระบุ";
      const semesterStr = section.semester ? `${section.semester.semesterNumber}/${section.semester.academicYear}` : "";

      if (section.schedules.length === 0) {
        return [{
          code: course.code,
          name: course.name,
          semester: semesterStr,
          day: "ไม่ระบุ",
          time: "ไม่ระบุ",
          room: "ไม่ระบุ",
          instructor: instructorName
        }];
      }

      return section.schedules.map(sch => ({
        code: course.code,
        name: course.name,
        semester: semesterStr,
        day: THAI_DAYS_FULL[sch.dayOfWeek] || sch.dayOfWeek,
        time: `${formatTime(new Date(sch.startTime))} - ${formatTime(new Date(sch.endTime))}`,
        room: sch.room || "ไม่ระบุ",
        instructor: instructorName
      }));
    });

    // Collect makeup class notifications
    const notifications = (student as any).enrollments.flatMap((enrollment: any) => {
      const section = enrollment.section;
      const course = section.course;

      return section.makeupClasses.map(makeup => {
        const teacher = makeup.teacher?.user;
        const instructorName = teacher ? `${teacher.firstName} ${teacher.lastName}` : "ไม่ระบุ";

        // Find the original schedule for this section
        const originalSchedule = section.schedules[0];
        let originalDateStr = `${formatDate(new Date(makeup.originalDate))}`;
        if (originalSchedule) {
          originalDateStr += ` เวลา ${formatTime(new Date(originalSchedule.startTime))} - ${formatTime(new Date(originalSchedule.endTime))}`;
        }

        return {
          id: String(makeup.id),
          courseCode: course.code,
          courseName: course.name,
          instructor: instructorName,
          reason: makeup.reason || "ไม่ระบุเหตุผล",
          originalDate: originalDateStr,
          makeupDate: formatDate(new Date(makeup.makeupDate)),
          makeupTime: `${formatTime(new Date(makeup.startTime))} - ${formatTime(new Date(makeup.endTime))}`,
          makeupRoom: makeup.room || "ไม่ระบุ",
          sentAt: makeup.createdAt
            ? new Date(makeup.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
              + " เวลา " + formatTime(new Date(makeup.createdAt))
            : "ไม่ระบุ",
          status: makeup.status === "completed" || makeup.status === "scheduled"
            ? (makeup.status === "completed" ? "ยืนยันแล้ว" : "กำลังรอ")
            : "ยกเลิก"
        };
      });
    });

    const pendingCount = notifications.filter(n => n.status === "กำลังรอ").length;
    const confirmedCount = notifications.filter(n => n.status === "ยืนยันแล้ว").length;

    return NextResponse.json({
      success: true,
      data: {
        registeredCourses,
        notifications,
        stats: {
          totalCourses: registeredCourses.length,
          pendingMakeups: pendingCount,
          confirmedMakeups: confirmedCount
        }
      }
    });

  } catch (error: any) {
    console.error("Schedule Submit API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
