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

    // Get optional semester filter from query params
    const { searchParams } = new URL(request.url);
    const semesterIdParam = searchParams.get("semesterId");
    const curriculumYearParam = searchParams.get("curriculumYear");
    const rawYear = curriculumYearParam ? parseInt(curriculumYearParam) : NaN;
    const selectedCurriculumYear = Number.isFinite(rawYear)
      ? (rawYear < 100 ? 2500 + rawYear : rawYear)
      : null;

    // 1. Get Teacher Information & their courses
    const teacher = await prisma.teacher.findUnique({
      where: { userId: payload.userId },
      include: {
        courseSections: {
          include: {
            course: true,
            semester: true,
            enrollments: {
              select: { grade: true }
            },
            _count: {
              select: { enrollments: true }
            }
          }
        },
        coordinatedCourses: {
          include: {
            courseSections: {
              include: {
                semester: true,
                enrollments: {
                  select: { grade: true }
                },
                _count: {
                  select: { enrollments: true }
                }
              }
            }
          }
        }
      }
    });

    if (!teacher) {
      return NextResponse.json({ message: "Teacher profile not found" }, { status: 404 });
    }

    const combinedSections: any[] = [...(teacher as any).courseSections];
    for (const course of (teacher as any).coordinatedCourses || []) {
      for (const section of course.courseSections || []) {
        combinedSections.push({
          ...section,
          course
        });
      }
    }

    const courseIds = new Set<number>();
    combinedSections.forEach((section: any) => courseIds.add(section.course.id));
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

    const uniqueSections: any[] = [];
    const sectionIdSet = new Set<number>();
    for (const section of combinedSections) {
      if (sectionIdSet.has(section.id)) continue;
      sectionIdSet.add(section.id);
      uniqueSections.push(section);
    }

    // 2. Build semester list from teacher's sections
    const semesterMap = new Map<number, { id: number; name: string; isCurrent: boolean }>();
    uniqueSections.forEach((section: any) => {
      if (!semesterMap.has(section.semester.id)) {
        semesterMap.set(section.semester.id, {
          id: section.semester.id,
          name: `${section.semester.academicYear}/${section.semester.semesterNumber}`,
          isCurrent: section.semester.isCurrent || false,
        });
      }
    });
    const semesters = Array.from(semesterMap.values()).sort((a, b) => {
      // Sort by name descending (latest first)
      return b.name.localeCompare(a.name);
    });

    // Determine which semester to filter by
    let selectedSemesterId: number | null = null;
    if (semesterIdParam) {
      selectedSemesterId = parseInt(semesterIdParam);
    } else {
      // Default = current semester, or the latest one
      const currentSem = semesters.find(s => s.isCurrent);
      selectedSemesterId = currentSem?.id || semesters[0]?.id || null;
    }

    // 3. Fetch Announcements
    const rawAnnouncements = await prisma.announcement.findMany({
      take: 4,
      orderBy: { createdAt: 'desc' },
      where: {
        OR: [{ targetRole: 'all' }, { targetRole: 'teacher' }],
        status: { not: 'แบบร่าง' }
      }
    });

    // 4. Filter courses by selected semester & compute stats
    const filteredBySemester = selectedSemesterId
      ? uniqueSections.filter((s: any) => s.semester.id === selectedSemesterId)
      : uniqueSections;

    const filteredSections = selectedCurriculumYear
      ? filteredBySemester.filter((s: any) => {
          const years = courseYearMap.get(s.course.id);
          return years ? years.has(selectedCurriculumYear) : false;
        })
      : filteredBySemester;

    let totalStudents = 0;
    let totalGradePoints = 0;
    let gradedCount = 0;

    const gradePoints: Record<string, number> = {
      "A": 4.0, "B+": 3.5, "B": 3.0, "C+": 2.5, "C": 2.0, "D+": 1.5, "D": 1.0, "F": 0.0
    };

    // Convert an average grade-point value to a letter label (shared by the
    // per-course figure and the aggregate stat).
    const labelFromAvg = (avg: number, count: number): string => {
      if (count === 0) return "-";
      if (avg >= 3.75) return "A";
      if (avg >= 3.25) return "B+";
      if (avg >= 2.75) return "B";
      if (avg >= 2.25) return "C+";
      if (avg >= 1.75) return "C";
      if (avg >= 1.25) return "D+";
      if (avg >= 0.5) return "D";
      return "F";
    };

    const myCourses = filteredSections.map((section: any) => {
      totalStudents += section._count.enrollments;

      // Calculate average grade for THIS section (per-course), while also
      // accumulating into the tenant-wide aggregate used by the stat card.
      let sectionPoints = 0;
      let sectionGraded = 0;
      section.enrollments.forEach(enr => {
        if (enr.grade && gradePoints[enr.grade] !== undefined) {
          sectionPoints += gradePoints[enr.grade];
          sectionGraded++;
          totalGradePoints += gradePoints[enr.grade];
          gradedCount++;
        }
      });
      const sectionAvg = sectionGraded > 0 ? sectionPoints / sectionGraded : 0;

      return {
        code: section.course.code,
        name: section.course.name,
        students: section._count.enrollments,
        avgGrade: labelFromAvg(sectionAvg, sectionGraded),
        gradedCount: sectionGraded,
        semester: `${section.semester.academicYear}/${section.semester.semesterNumber}`,
        status: section.semester.isCurrent ? "Active" : "Completed"
      };
    });

    const coordinatorOnlyCourses = (teacher as any).coordinatedCourses?.filter(
      (course: any) => (course.courseSections || []).length === 0
    ) || [];

    for (const course of coordinatorOnlyCourses) {
      if (selectedCurriculumYear) {
        const years = courseYearMap.get(course.id);
        if (!years || !years.has(selectedCurriculumYear)) continue;
      }
      myCourses.push({
        code: course.code,
        name: course.name,
        students: 0,
        avgGrade: "-",
        gradedCount: 0,
        semester: "-",
        status: "Active"
      });
    }

    // Sort active first
    myCourses.sort((a, b) => (a.status === "Active" ? -1 : 1));

    // Aggregate average grade across all sections (stat card)
    const avgGradeValue = gradedCount > 0 ? totalGradePoints / gradedCount : 0;
    const avgGradeLabel = labelFromAvg(avgGradeValue, gradedCount);

    const stats = [
      { id: "my-courses", label: "วิชาของฉัน", value: myCourses.length.toString(), color: "bg-blue-100 text-blue-600" },
      { id: "total-students", label: "จำนวนนิสิตทั้งหมด", value: totalStudents.toString(), color: "bg-green-100 text-green-600" },
      { id: "avg-grade", label: "เกรดเฉลี่ยนิสิต", value: avgGradeLabel, color: "bg-purple-100 text-purple-600" },
    ];

    const announcements = rawAnnouncements.map(a => ({
      id: a.id,
      title: a.title,
      content: a.content,
      date: new Date(a.createdAt || new Date()).toLocaleDateString("th-TH", { day: 'numeric', month: 'long', year: 'numeric' }),
      type: a.isPinned ? "important" : "update"
    }));

    return NextResponse.json({
      success: true,
      data: {
        semesters,
        selectedSemesterId,
        selectedCurriculumYear,
        availableCurriculumYears,
        stats,
        myCourses,
        announcements
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error("Teacher Dashboard API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
