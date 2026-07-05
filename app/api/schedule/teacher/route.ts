import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { DayOfWeek } from "@prisma/client";

const THAI_DAYS_FULL: Record<string, string> = {
  MON: "จันทร์",
  TUE: "อังคาร",
  WED: "พุธ",
  THU: "พฤหัสบดี",
  FRI: "ศุกร์",
  SAT: "เสาร์",
  SUN: "อาทิตย์",
};

const VALID_DAYS = new Set<string>(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const formatTime = (date: Date) =>
  date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

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
            semester: true,
            schedules: true,
            _count: { select: { enrollments: true } },
          },
        },
      },
    });

    if (!teacher) return NextResponse.json({ message: "Teacher not found" }, { status: 404 });

    const sectionList = (teacher as any).courseSections;

    const items = sectionList.flatMap((section: any) => {
      const course = section.course;
      const semesterStr = section.semester
        ? `${section.semester.semesterNumber}/${section.semester.academicYear}`
        : "";
      const studentsLabel = `${section._count.enrollments} นิสิต`;

      if (section.schedules.length === 0) {
        return [
          {
            code: course.code,
            name: course.name,
            semester: semesterStr,
            day: "ไม่ระบุ",
            time: "ไม่ระบุ",
            room: "ไม่ระบุ",
            instructor: studentsLabel,
          },
        ];
      }

      return section.schedules.map((sch: any) => ({
        code: course.code,
        name: course.name,
        semester: semesterStr,
        day: THAI_DAYS_FULL[sch.dayOfWeek] || sch.dayOfWeek,
        time: `${formatTime(new Date(sch.startTime))} - ${formatTime(new Date(sch.endTime))}`,
        room: sch.room || "ไม่ระบุ",
        instructor: studentsLabel,
      }));
    });

    // Sections the teacher owns — used by the "add teaching day" form.
    const sections = sectionList.map((section: any) => ({
      sectionId: section.id,
      code: section.course.code,
      name: section.course.name,
      semester: section.semester
        ? `${section.semester.semesterNumber}/${section.semester.academicYear}`
        : "",
      scheduleCount: section.schedules.length,
    }));

    return NextResponse.json({
      success: true,
      data: { items, sections, stats: { totalSections: sectionList.length } },
    });
  } catch (error: any) {
    console.error("Teacher Schedule API Error:", error);
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
    const { sectionId, dayOfWeek, startTime, endTime, room } = body;

    // Validation
    if (!sectionId || !dayOfWeek || !startTime || !endTime) {
      return NextResponse.json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน" }, { status: 400 });
    }
    if (!VALID_DAYS.has(dayOfWeek)) {
      return NextResponse.json({ message: "วันไม่ถูกต้อง" }, { status: 400 });
    }
    if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
      return NextResponse.json({ message: "รูปแบบเวลาไม่ถูกต้อง (HH:MM)" }, { status: 400 });
    }
    const startObj = new Date(`1970-01-01T${startTime}:00Z`);
    const endObj = new Date(`1970-01-01T${endTime}:00Z`);
    if (endObj <= startObj) {
      return NextResponse.json({ message: "เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม" }, { status: 400 });
    }

    // Authz: the section must belong to THIS teacher.
    const section = await prisma.courseSection.findUnique({ where: { id: parseInt(sectionId) } });
    if (!section) return NextResponse.json({ message: "ไม่พบกลุ่มเรียน" }, { status: 404 });
    if (section.teacherId !== teacher.id) {
      return NextResponse.json({ message: "คุณไม่มีสิทธิ์ในกลุ่มเรียนนี้" }, { status: 403 });
    }

    const reqRoom = (room || "").trim();

    // Prevent double-booking the same physical room (skip unassigned/TBA rooms).
    if (reqRoom && !reqRoom.toUpperCase().startsWith("TBA")) {
      const sameRoom = await prisma.schedule.findMany({
        where: { room: reqRoom, dayOfWeek: dayOfWeek as DayOfWeek },
      });
      const clash = sameRoom.some((s) => startObj < s.endTime && endObj > s.startTime);
      if (clash) {
        return NextResponse.json(
          { message: `ห้อง ${reqRoom} ถูกใช้งานแล้วในช่วงเวลานี้` },
          { status: 400 }
        );
      }
    }

    const created = await prisma.schedule.create({
      data: {
        sectionId: section.id,
        dayOfWeek: dayOfWeek as DayOfWeek,
        startTime: startObj,
        endTime: endObj,
        room: reqRoom || "TBA",
      },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error: any) {
    console.error("Teacher Schedule POST API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
