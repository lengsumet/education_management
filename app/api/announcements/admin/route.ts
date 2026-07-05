import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { AnnouncementTarget } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || payload.role !== "admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const announcementsDb = await prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' }
    });

    const announcements = announcementsDb.map(a => {
      let targetLabel = "ทั้งหมด";
      if (a.targetRole === "student") targetLabel = "นิสิต";
      else if (a.targetRole === "teacher") targetLabel = "อาจารย์";

      return {
        id: a.id.toString(),
        title: a.title,
        content: a.content,
        // Calculate date from createdAt or use empty
        date: a.createdAt ? new Date(a.createdAt).toISOString().split('T')[0] : "N/A",
        target: targetLabel,
        status: a.status || "เผยแพร่",
        views: 0 // no view tracking on announcements (was a random mock)
      };
    });

    return NextResponse.json({ success: true, data: announcements }, { status: 200 });

  } catch (error: any) {
    console.error("Admin Announcements GET API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || payload.role !== "admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { title, content, target, status } = body;

    let targetRoleEnum: AnnouncementTarget = AnnouncementTarget.all;
    if (target === "นิสิต") targetRoleEnum = AnnouncementTarget.student;
    else if (target === "อาจารย์") targetRoleEnum = AnnouncementTarget.teacher;

    const newAnnouncement = await prisma.announcement.create({
      data: {
        title,
        content,
        targetRole: targetRoleEnum,
        status: status || "เผยแพร่",
        createdBy: payload.userId as number
      }
    });

    return NextResponse.json({ success: true, data: newAnnouncement }, { status: 201 });

  } catch (error: any) {
    console.error("Admin Announcements POST API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || payload.role !== "admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ message: "ID parameter missing" }, { status: 400 });

    await prisma.announcement.delete({
      where: { id: parseInt(id) }
    });

    return NextResponse.json({ success: true, message: "Deleted successfully" }, { status: 200 });

  } catch (error: any) {
    console.error("Admin Announcements DELETE API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || payload.role !== "admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { id, title, content, target, status } = body;
    
    if (!id) return NextResponse.json({ message: "ID is required" }, { status: 400 });

    let targetRoleEnum: AnnouncementTarget = AnnouncementTarget.all;
    if (target === "นิสิต") targetRoleEnum = AnnouncementTarget.student;
    else if (target === "อาจารย์") targetRoleEnum = AnnouncementTarget.teacher;

    const updatedAnnouncement = await prisma.announcement.update({
      where: { id: parseInt(id) },
      data: {
        title,
        content,
        targetRole: targetRoleEnum,
        status: status || "เผยแพร่",
      }
    });

    return NextResponse.json({ success: true, data: updatedAnnouncement }, { status: 200 });

  } catch (error: any) {
    console.error("Admin Announcements PUT API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
