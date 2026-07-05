import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";

const THAI_DAYS: Record<string, string> = {
  "MON": "จ",
  "TUE": "อ",
  "WED": "พ",
  "THU": "พฤ",
  "FRI": "ศ",
  "SAT": "ส",
  "SUN": "อา"
};

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
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

    // Fetch user and student enrollments
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
                },
                schedules: true
              }
            }
          }
        }
      }
    });

    if (!student) {
      return NextResponse.json({ message: "Student profile not found" }, { status: 404 });
    }

    // Fetch course-scoped announcements for all enrolled sections in one query
    // (avoids an N+1 across enrollments), then group them by sectionId.
    const sectionIds: number[] = (student as any).enrollments.map(
      (e: any) => e.section.id
    );
    const announcementsBySection = new Map<number, any[]>();
    if (sectionIds.length > 0) {
      const announcementRows = await prisma.announcement.findMany({
        where: { sectionId: { in: sectionIds }, status: "เผยแพร่" },
        orderBy: { createdAt: "desc" },
      });
      for (const a of announcementRows) {
        const list = announcementsBySection.get(a.sectionId as number) || [];
        list.push({
          id: a.id.toString(),
          title: a.title,
          content: a.content,
          date: a.createdAt
            ? new Date(a.createdAt).toISOString().split("T")[0]
            : "",
        });
        announcementsBySection.set(a.sectionId as number, list);
      }
    }

    // Map enrollments to courses array
    const courses = (student as any).enrollments.map((enrollment: any) => {
      const section = enrollment.section;
      const courseStr = section.course;
      const teacher = section.teacher?.user;
      const schedules = section.schedules;

      // Format schedule string (e.g. "จ 14:00-16:50 น.")
      let scheduleStr = "ไม่ระบุเวลาเรียน";
      if (schedules && schedules.length > 0) {
        const sch = schedules[0];
        const day = THAI_DAYS[sch.dayOfWeek] || sch.dayOfWeek;
        const start = formatTime(new Date(sch.startTime));
        const end = formatTime(new Date(sch.endTime));
        scheduleStr = `${day} ${start}-${end} น.`;
      }

      // Map DB status to UI status
      const dbStatus = enrollment.status || "enrolled";
      const hasGrade = enrollment.grade && enrollment.grade !== "-" && enrollment.grade !== "";
      const isCompleted = dbStatus === "completed" || hasGrade;
      const uiStatus = isCompleted ? "completed" : "active";
      const progress = isCompleted ? 100 : 50;

      const sectionAnnouncements = announcementsBySection.get(section.id) || [];

      return {
        id: String(enrollment.id),
        code: courseStr.code,
        name: courseStr.name,
        instructor: teacher ? `${teacher.firstName} ${teacher.lastName}` : "อาจารย์ไม่ระบุ",
        grade: enrollment.grade || "-",
        progress: progress,
        status: uiStatus,
        announcement: sectionAnnouncements.length,
        schedule: scheduleStr,
        announcements: sectionAnnouncements
      };
    });

    // Calculate Summary statistics
    let totalCredits = 0;
    let earnedPoints = 0;
    let countedCredits = 0;

    const gradePoints: Record<string, number> = {
      "A": 4.0, "B+": 3.5, "B": 3.0, "C+": 2.5, "C": 2.0, "D+": 1.5, "D": 1.0, "F": 0.0
    };

    (student as any).enrollments.forEach((enrollment: any) => {
      const hasGrade = enrollment.grade && enrollment.grade !== "-" && enrollment.grade !== "";
      const isCompleted = enrollment.status === "completed" || hasGrade;
      
      if (isCompleted && enrollment.grade) {
        const credits = enrollment.section.course.credits;
        totalCredits += credits;
        
        if (gradePoints[enrollment.grade] !== undefined) {
          earnedPoints += gradePoints[enrollment.grade] * credits;
          countedCredits += credits;
        }
      }
    });

    const gpa = countedCredits > 0 ? (earnedPoints / countedCredits).toFixed(2) : "0.00";

    return NextResponse.json({
      success: true,
      data: {
        courses: courses,
        stats: {
          total: courses.length,
          active: courses.filter(c => c.status === "active").length,
          completed: courses.filter(c => c.status === "completed").length,
          gpa: gpa
        }
      }
    });

  } catch (error: any) {
    console.error("Courses API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
