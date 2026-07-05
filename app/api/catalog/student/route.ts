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

    const student = await prisma.student.findUnique({
      where: { userId: payload.userId }
    });

    if (!student) {
      return NextResponse.json({ message: "Student not found" }, { status: 404 });
    }

    // Find student's curriculum
    const curriculum = await prisma.curriculum.findFirst({
      where: {
        departmentId: student.departmentId,
        year: { lte: student.admissionYear },
        status: 'active'
      },
      orderBy: { year: 'desc' }
    });

    let allowedCourseIds: number[] | null = null;
    // Map each curriculum course to its year/term so the catalog can be browsed
    // by year level (meaningful across all years) instead of by the single term
    // that happens to have offered sections.
    const courseYearMap = new Map<number, { yearLevel: number | null; semester: number | null }>();
    if (curriculum) {
      const curCourses = await prisma.curriculumCourse.findMany({
        where: { curriculumId: curriculum.id },
        select: { courseId: true, yearLevel: true, semester: true }
      });
      allowedCourseIds = curCourses.map(c => c.courseId);
      curCourses.forEach(c => courseYearMap.set(c.courseId, { yearLevel: c.yearLevel, semester: c.semester }));
    }

    // Fetch all courses with their sections, schedules, and teacher info
    const courses = await prisma.course.findMany({
      where: allowedCourseIds ? {
        OR: [
          { id: { in: allowedCourseIds } },
          { type: { in: ["elective", "general"] } }
        ]
      } : undefined,
      include: {
        department: true,
        courseSections: {
          include: {
            teacher: {
              include: { user: true }
            },
            schedules: true,
            semester: true,
            _count: {
              select: { enrollments: true }
            }
          }
        },
        prerequisites: {
          include: {
            prerequisite: true
          }
        }
      },
      orderBy: { code: 'asc' }
    });

    const result = courses.map(course => {
      // Get the latest/current section for display
      const latestSection = (course as any).courseSections?.[0];
      const teacher = latestSection?.teacher?.user;
      const schedule = latestSection?.schedules?.[0];
      const semester = latestSection?.semester;

      let scheduleStr = "ไม่ระบุเวลาเรียน";
      if (schedule) {
        const day = THAI_DAYS[schedule.dayOfWeek] || schedule.dayOfWeek;
        const start = formatTime(new Date(schedule.startTime));
        const end = formatTime(new Date(schedule.endTime));
        scheduleStr = `${day} ${start}-${end} น.`;
      }

      const semesterStr = semester
        ? `${semester.academicYear}/${semester.semesterNumber}`
        : "ไม่ระบุ";

      const cur = courseYearMap.get(course.id);

      return {
        id: String(course.id),
        code: course.code,
        name: course.name,
        credits: course.credits,
        instructor: teacher ? `${teacher.firstName} ${teacher.lastName}` : "ไม่ระบุอาจารย์",
        semester: semesterStr,
        yearLevel: cur?.yearLevel ?? null,        // curriculum year (null = elective pool)
        curriculumSemester: cur?.semester ?? null, // curriculum term
        students: latestSection?._count?.enrollments || 0,
        description: course.description || "ไม่มีคำอธิบายรายวิชา",
        schedule: scheduleStr,
        type: course.type,
        prerequisites: (course as any).prerequisites?.map((p: any) => ({
          code: p.prerequisite.code,
          name: p.prerequisite.name
        })) || []
      };
    });

    // Available curriculum year levels for the filter (ascending)
    const yearLevels = [...new Set(result.map(c => c.yearLevel).filter((y): y is number => y != null))].sort((a, b) => a - b);
    // Keep semesters for backward-compat (unused by new UI)
    const semesters = [...new Set(result.map(c => c.semester).filter(s => s !== "ไม่ระบุ"))];

    return NextResponse.json({
      success: true,
      data: {
        courses: result,
        semesters,
        yearLevels
      }
    });

  } catch (error: any) {
    console.error("Catalog API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
