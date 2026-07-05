import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";

/**
 * Course-scoped announcements managed by the teacher who owns the section.
 * A teacher may manage announcements for a section when they are the assigned
 * teacher of that section OR they coordinate its parent course. Global
 * (section-less) announcements stay admin-only under /api/announcements/admin.
 */

async function getTeacherContext(userId: number) {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    include: {
      courseSections: { select: { id: true } },
      coordinatedCourses: {
        select: { courseSections: { select: { id: true } } },
      },
    },
  });
  if (!teacher) return null;

  const manageableSectionIds = new Set<number>();
  teacher.courseSections.forEach((s) => manageableSectionIds.add(s.id));
  teacher.coordinatedCourses.forEach((c) =>
    c.courseSections.forEach((s) => manageableSectionIds.add(s.id))
  );

  return { teacher, manageableSectionIds };
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload || payload.role !== "teacher")
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const ctx = await getTeacherContext(payload.userId as number);
    if (!ctx) return NextResponse.json({ message: "Teacher not found" }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const sectionIdParam = searchParams.get("sectionId");

    let sectionFilter: number[];
    if (sectionIdParam) {
      const sid = parseInt(sectionIdParam);
      if (!ctx.manageableSectionIds.has(sid)) {
        return NextResponse.json({ message: "คุณไม่มีสิทธิ์ในกลุ่มเรียนนี้" }, { status: 403 });
      }
      sectionFilter = [sid];
    } else {
      sectionFilter = Array.from(ctx.manageableSectionIds);
    }

    if (sectionFilter.length === 0) {
      return NextResponse.json({ success: true, data: [] }, { status: 200 });
    }

    const announcementsDb = await prisma.announcement.findMany({
      where: { sectionId: { in: sectionFilter } },
      orderBy: { createdAt: "desc" },
    });

    const data = announcementsDb.map((a) => ({
      id: a.id.toString(),
      title: a.title,
      content: a.content,
      sectionId: a.sectionId,
      status: a.status || "เผยแพร่",
      date: a.createdAt ? new Date(a.createdAt).toISOString().split("T")[0] : "N/A",
    }));

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error: any) {
    console.error("Teacher Announcements GET API Error:", error);
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

    const ctx = await getTeacherContext(payload.userId as number);
    if (!ctx) return NextResponse.json({ message: "Teacher not found" }, { status: 404 });

    const body = await request.json();
    const { sectionId, title, content, status } = body;

    if (!sectionId || !title?.trim() || !content?.trim()) {
      return NextResponse.json({ message: "กรุณากรอกหัวข้อและเนื้อหาให้ครบถ้วน" }, { status: 400 });
    }

    const sid = parseInt(sectionId);
    if (!ctx.manageableSectionIds.has(sid)) {
      return NextResponse.json({ message: "คุณไม่มีสิทธิ์ในกลุ่มเรียนนี้" }, { status: 403 });
    }

    const section = await prisma.courseSection.findUnique({
      where: { id: sid },
      include: { course: true, enrollments: { include: { student: true } } },
    });
    if (!section) return NextResponse.json({ message: "ไม่พบกลุ่มเรียน" }, { status: 404 });

    const created = await prisma.announcement.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        sectionId: sid,
        targetRole: "student",
        status: status || "เผยแพร่",
        createdBy: payload.userId as number,
      },
    });

    // Notify only the students enrolled in this section.
    const notificationsData = section.enrollments.map((enr) => ({
      userId: enr.student.userId,
      title: `ประกาศใหม่: ${section.course.name}`,
      message: title.trim(),
      type: "announcement" as const,
      isRead: false,
    }));
    if (notificationsData.length > 0) {
      await prisma.notification.createMany({ data: notificationsData });
    }

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error: any) {
    console.error("Teacher Announcements POST API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload || payload.role !== "teacher")
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const ctx = await getTeacherContext(payload.userId as number);
    if (!ctx) return NextResponse.json({ message: "Teacher not found" }, { status: 404 });

    const body = await request.json();
    const { id, title, content, status } = body;
    if (!id) return NextResponse.json({ message: "ID is required" }, { status: 400 });

    const existing = await prisma.announcement.findUnique({ where: { id: parseInt(id) } });
    if (!existing || existing.sectionId === null || !ctx.manageableSectionIds.has(existing.sectionId)) {
      return NextResponse.json({ message: "ไม่พบประกาศหรือไม่มีสิทธิ์" }, { status: 404 });
    }

    const updated = await prisma.announcement.update({
      where: { id: parseInt(id) },
      data: {
        ...(title !== undefined ? { title: String(title).trim() } : {}),
        ...(content !== undefined ? { content: String(content).trim() } : {}),
        ...(status !== undefined ? { status } : {}),
      },
    });

    return NextResponse.json({ success: true, data: updated }, { status: 200 });
  } catch (error: any) {
    console.error("Teacher Announcements PUT API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload || payload.role !== "teacher")
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const ctx = await getTeacherContext(payload.userId as number);
    if (!ctx) return NextResponse.json({ message: "Teacher not found" }, { status: 404 });

    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ message: "ID parameter missing" }, { status: 400 });

    const existing = await prisma.announcement.findUnique({ where: { id: parseInt(id) } });
    if (!existing || existing.sectionId === null || !ctx.manageableSectionIds.has(existing.sectionId)) {
      return NextResponse.json({ message: "ไม่พบประกาศหรือไม่มีสิทธิ์" }, { status: 404 });
    }

    await prisma.announcement.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true, message: "Deleted successfully" }, { status: 200 });
  } catch (error: any) {
    console.error("Teacher Announcements DELETE API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
