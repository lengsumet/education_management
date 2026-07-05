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

    const { searchParams } = new URL(request.url);
    const curriculumYearParam = searchParams.get("curriculumYear");
    const rawYear = curriculumYearParam ? parseInt(curriculumYearParam) : NaN;
    const selectedCurriculumYear = Number.isFinite(rawYear)
      ? (rawYear < 100 ? 2500 + rawYear : rawYear)
      : null;

    const teacher = await prisma.teacher.findUnique({
      where: { userId: payload.userId },
      include: {
        courseSections: {
          include: {
            course: true,
            semester: true,
            schedules: true,
            _count: {
              select: { enrollments: true, announcements: true }
            }
          }
        },
        coordinatedCourses: {
          include: {
            courseSections: {
              include: {
                semester: true,
                schedules: true,
                _count: {
                  select: { enrollments: true, announcements: true }
                }
              }
            }
          }
        }
      }
    });

    if (!teacher) {
      return NextResponse.json({ message: "Teacher not found" }, { status: 404 });
    }

    const courseIds = new Set<number>();
    (teacher as any).courseSections.forEach((section: any) => courseIds.add(section.course.id));
    ((teacher as any).coordinatedCourses || []).forEach((course: any) => courseIds.add(course.id));

    const curriculumLinks = await prisma.curriculumCourse.findMany({
      where: { courseId: { in: Array.from(courseIds) } },
      include: { curriculum: true }
    });

    const courseYearMap = new Map<number, Set<number>>();
    for (const link of curriculumLinks) {
      const set = courseYearMap.get(link.courseId) || new Set<number>();
      set.add(link.curriculum.year);
      courseYearMap.set(link.courseId, set);
    }

    const availableCurriculumYears = Array.from(
      new Set(curriculumLinks.map((link: any) => link.curriculum.year as number))
    ).sort((a: number, b: number) => b - a);

    const formatCourseEntry = (section: any, course: any) => {
      // Real announcement count for this section.
      const announcements = section._count?.announcements ?? 0;

      // Weekly contact hours summed from the section's schedule slots.
      let weeklyHours = 0;
      for (const s of section.schedules || []) {
        if (s.startTime && s.endTime) {
          const diffMs = new Date(s.endTime).getTime() - new Date(s.startTime).getTime();
          if (diffMs > 0) weeklyHours += diffMs / (1000 * 60 * 60);
        }
      }
      const classes = Math.round(weeklyHours * 10) / 10;

      let scheduleStr = "ไม่ได้กำหนด";
      if (section.schedules.length > 0) {
        // e.g. "จ 14:00-16:50 น." (Mapping day to Thai is needed)
        const thaiDays: Record<string, string> = {
          "monday": "จ", "tuesday": "อ", "wednesday": "พ", 
          "thursday": "พฤ", "friday": "ศ", "saturday": "ส", "sunday": "อา"
        };
        const s = section.schedules[0];
        const day = thaiDays[s.dayOfWeek.toLowerCase()] || s.dayOfWeek;
        
        let startTimeStr = "00:00";
        let endTimeStr = "00:00";
        if (s.startTime) {
           const d = new Date(s.startTime);
           startTimeStr = d.toLocaleTimeString("en-US", { hour12: false, hour: '2-digit', minute: '2-digit' });
        }
        if (s.endTime) {
           const d = new Date(s.endTime);
           endTimeStr = d.toLocaleTimeString("en-US", { hour12: false, hour: '2-digit', minute: '2-digit' });
        }
        
        scheduleStr = `${day} ${startTimeStr}-${endTimeStr} น.`;
      }

      return {
        id: section.id.toString(),
        sectionId: section.id,
        courseId: course.id,
        code: course.code,
        name: course.name,
        semester: `${section.semester.academicYear}/${section.semester.semesterNumber}`,
        students: section._count.enrollments,
        classes,
        announcements,
        schedule: scheduleStr,
        status: section.semester.isCurrent ? "active" : "completed",
      };
    };

    // Format for frontend (sections assigned to teacher)
    const courses = (teacher as any).courseSections.map((section: any) => {
      return formatCourseEntry(section, section.course);
    });

    const courseIdSet = new Set((teacher as any).courseSections.map((section: any) => section.course.id));

    // Also include courses where teacher is coordinator
    for (const course of (teacher as any).coordinatedCourses || []) {
      if (courseIdSet.has(course.id)) continue;

      const firstSection = course.courseSections?.[0];
      if (firstSection) {
        courses.push(formatCourseEntry(firstSection, course));
        continue;
      }

      courses.push({
        id: `coord-${course.id}`,
        sectionId: null,
        courseId: course.id,
        code: course.code,
        name: course.name,
        semester: "-",
        students: 0,
        classes: 0,
        announcements: 0,
        schedule: "ไม่ได้กำหนด",
        status: "active",
      });
    }

    const filteredCourses = selectedCurriculumYear
      ? courses.filter((course: any) => {
          const years = courseYearMap.get(course.courseId);
          return years ? years.has(selectedCurriculumYear) : false;
        })
      : courses;

    // sort to have active and newest semesters first
    filteredCourses.sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      return b.semester.localeCompare(a.semester);
    });

    return NextResponse.json({
      success: true,
      data: filteredCourses,
      meta: {
        availableCurriculumYears,
        selectedCurriculumYear
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error("Teacher Courses API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
