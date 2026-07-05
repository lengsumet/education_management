import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";

// Resolve the "current" semester: the one flagged isCurrent, else the latest by
// academic year + semester number. Shared by the student dashboard (read) and
// the admin registration-window editor (write).
async function getCurrentSemester() {
  const current = await prisma.semester.findFirst({
    where: { isCurrent: true },
    orderBy: [{ academicYear: "desc" }, { semesterNumber: "desc" }],
  });
  if (current) return current;
  return prisma.semester.findFirst({
    orderBy: [{ academicYear: "desc" }, { semesterNumber: "desc" }],
  });
}

function shape(sem: Awaited<ReturnType<typeof getCurrentSemester>>) {
  if (!sem) return null;
  const now = new Date();
  const open = sem.regOpenDate ? new Date(sem.regOpenDate) : null;
  const close = sem.regCloseDate ? new Date(sem.regCloseDate) : null;
  let registrationStatus: "not_configured" | "before" | "open" | "closed" = "not_configured";
  if (open && close) {
    if (now < open) registrationStatus = "before";
    else if (now > close) registrationStatus = "closed";
    else registrationStatus = "open";
  }
  return {
    id: sem.id,
    name: sem.name,
    academicYear: sem.academicYear,
    semesterNumber: sem.semesterNumber,
    regOpenDate: sem.regOpenDate,
    regCloseDate: sem.regCloseDate,
    registrationStatus,
  };
}

// Any authenticated user can read the current semester + registration window.
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const sem = await getCurrentSemester();
    return NextResponse.json({ success: true, data: shape(sem) });
  } catch (error: unknown) {
    console.error("Semester GET Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

// Admin only: update the registration window for the current semester.
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || payload.role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const sem = await getCurrentSemester();
    if (!sem) return NextResponse.json({ message: "No semester found" }, { status: 404 });

    const body = await request.json();
    const { regOpenDate, regCloseDate } = body as { regOpenDate?: string | null; regCloseDate?: string | null };

    const open: Date | null = regOpenDate ? new Date(regOpenDate) : null;
    const close: Date | null = regCloseDate ? new Date(regCloseDate) : null;

    if (open && isNaN(open.getTime())) {
      return NextResponse.json({ message: "วันเปิดลงทะเบียนไม่ถูกต้อง" }, { status: 400 });
    }
    if (close && isNaN(close.getTime())) {
      return NextResponse.json({ message: "วันปิดลงทะเบียนไม่ถูกต้อง" }, { status: 400 });
    }
    if (open && close && open > close) {
      return NextResponse.json({ message: "วันเปิดลงทะเบียนต้องมาก่อนวันปิด" }, { status: 400 });
    }

    const updated = await prisma.semester.update({
      where: { id: sem.id },
      data: { regOpenDate: open, regCloseDate: close },
    });

    return NextResponse.json({ success: true, data: shape(updated) });
  } catch (error: unknown) {
    console.error("Semester PATCH Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
