import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";

// HH:mm from a Prisma @db.Time value (stored as a Date on the 1970 epoch).
function hhmm(t: Date | null | undefined): string {
  if (!t) return "";
  const d = new Date(t);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function thaiDate(d: Date | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear() + 543}`;
}

// Makeup classes for the courses a student is enrolled in.
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || payload.role !== "student") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const student = await prisma.student.findUnique({
      where: { userId: payload.userId },
      include: {
        enrollments: { select: { section: { select: { id: true } } } },
      },
    });
    if (!student) return NextResponse.json({ message: "Student profile not found" }, { status: 404 });

    const sectionIds = Array.from(
      new Set((student as any).enrollments.map((e: any) => e.section.id))
    ) as number[];

    if (sectionIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const makeups = await prisma.makeupClass.findMany({
      where: { sectionId: { in: sectionIds } },
      orderBy: { makeupDate: "asc" },
      include: {
        section: {
          include: {
            course: true,
            teacher: { include: { user: true } },
          },
        },
      },
    });

    const data = (makeups as any[]).map((m) => ({
      id: m.id,
      courseCode: m.section.course.code,
      courseName: m.section.course.name,
      sectionNumber: m.section.sectionNumber,
      originalDate: thaiDate(m.originalDate),
      makeupDate: thaiDate(m.makeupDate),
      makeupDateRaw: m.makeupDate,
      startTime: hhmm(m.startTime),
      endTime: hhmm(m.endTime),
      room: m.room || "",
      reason: m.reason || "",
      status: m.status,
      teacherName: m.section.teacher?.user
        ? `${m.section.teacher.user.firstName} ${m.section.teacher.user.lastName}`
        : "",
    }));

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("Student Makeup API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
