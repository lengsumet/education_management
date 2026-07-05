import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

// GET /api/prerequisites?courseId=X — ดู prerequisites ของวิชา + reverse dependencies
// GET /api/prerequisites?courseId=X&action=check&studentId=Y — ตรวจสอบว่านิสิตลงวิชานี้ได้ไหม
// GET /api/prerequisites?courseId=X&action=impact — ถ้าไม่ผ่านวิชานี้ จะลงวิชาอะไรต่อไม่ได้ (Reverse Dependency Tree)
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("auth-token")?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const session = await verifyToken(token);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");
    const action = searchParams.get("action") || "view";

    if (!courseId) {
      // ถ้าไม่ส่ง courseId → ดึง prerequisites ทั้งหมด (สำหรับ admin)
      const allPrereqs = await prisma.coursePrerequisite.findMany({
        include: {
          course: { select: { id: true, code: true, name: true, credits: true } },
          prerequisite: { select: { id: true, code: true, name: true, credits: true } },
        },
      });
      return NextResponse.json({ success: true, data: allPrereqs });
    }

    const cId = parseInt(courseId);

    // ========== VIEW: แสดง prerequisites + reverse dependencies ของวิชานี้ ==========
    if (action === "view") {
      // วิชาที่ต้องผ่านก่อน (prerequisites)
      const prerequisites = await prisma.coursePrerequisite.findMany({
        where: { courseId: cId },
        include: {
          prerequisite: { select: { id: true, code: true, name: true, credits: true, type: true } },
        },
      });

      // วิชาที่ต้องรอวิชานี้ก่อน (reverse: ถ้าไม่ผ่านวิชานี้ จะลงวิชาเหล่านี้ไม่ได้)
      const dependents = await prisma.coursePrerequisite.findMany({
        where: { prerequisiteId: cId },
        include: {
          course: { select: { id: true, code: true, name: true, credits: true, type: true } },
        },
      });

      const course = await prisma.course.findUnique({
        where: { id: cId },
        select: { id: true, code: true, name: true, credits: true, type: true },
      });

      return NextResponse.json({
        success: true,
        data: {
          course,
          prerequisites: prerequisites.map((p) => p.prerequisite),
          dependents: dependents.map((d) => d.course),
        },
      });
    }

    // ========== CHECK: ตรวจสอบว่านิสิตลงวิชานี้ได้ไหม ==========
    if (action === "check") {
      const student = await prisma.student.findFirst({
        where: { userId: session.userId },
        include: {
          enrollments: {
            where: { status: "completed" },
            include: { section: { select: { courseId: true } } },
          },
        },
      });

      if (!student) {
        return NextResponse.json({ success: false, message: "Student not found" }, { status: 404 });
      }

      // วิชาที่ผ่านแล้ว (completed + grade ไม่ใช่ F)
      const passedCourseIds = new Set<number>();
      for (const enrollment of (student as any).enrollments) {
        if (enrollment.grade && enrollment.grade !== "F") {
          passedCourseIds.add(enrollment.section.courseId);
        }
      }

      // prerequisites ของวิชาที่จะลง
      const prerequisites = await prisma.coursePrerequisite.findMany({
        where: { courseId: cId },
        include: {
          prerequisite: { select: { id: true, code: true, name: true, credits: true } },
        },
      });

      const missingPrereqs = prerequisites
        .filter((p) => !passedCourseIds.has(p.prerequisiteId))
        .map((p) => p.prerequisite);

      return NextResponse.json({
        success: true,
        data: {
          canEnroll: missingPrereqs.length === 0,
          missingPrerequisites: missingPrereqs,
          totalRequired: prerequisites.length,
          passed: prerequisites.length - missingPrereqs.length,
        },
      });
    }

    // ========== IMPACT: ถ้าไม่ผ่านวิชานี้ จะกระทบวิชาไหนบ้าง (Recursive) ==========
    if (action === "impact") {
      // BFS/DFS หาทุกวิชาที่จะถูก block ถ้าไม่ผ่านวิชานี้
      const visited = new Set<number>();
      const queue = [cId];
      const blockedCourses: any[] = [];

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        const dependents = await prisma.coursePrerequisite.findMany({
          where: { prerequisiteId: currentId },
          include: {
            course: { select: { id: true, code: true, name: true, credits: true, type: true } },
          },
        });

        for (const dep of dependents) {
          if (!visited.has(dep.courseId)) {
            blockedCourses.push({
              ...dep.course,
              blockedBy: currentId,
              depth: visited.size,
            });
            queue.push(dep.courseId);
          }
        }
      }

      const course = await prisma.course.findUnique({
        where: { id: cId },
        select: { id: true, code: true, name: true, credits: true },
      });

      // ถ้ามี student → แสดงด้วยว่าวิชาไหน block อยู่จริง (ยังไม่ผ่าน)
      let studentImpact = null;
      if (session.role === "student") {
        const student = await prisma.student.findFirst({
          where: { userId: session.userId },
          include: {
            enrollments: {
              where: { status: "completed" },
              include: { section: { select: { courseId: true } } },
            },
          },
        });

        if (student) {
          const passedCourseIds = new Set<number>();
          for (const enrollment of (student as any).enrollments) {
            if (enrollment.grade && enrollment.grade !== "F") {
              passedCourseIds.add(enrollment.section.courseId);
            }
          }

          studentImpact = {
            actuallyBlocked: blockedCourses.filter((c) => !passedCourseIds.has(c.id)),
            alreadyPassed: blockedCourses.filter((c) => passedCourseIds.has(c.id)),
          };
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          course,
          blockedCourses,
          totalBlocked: blockedCourses.length,
          totalBlockedCredits: blockedCourses.reduce((sum: number, c: any) => sum + c.credits, 0),
          studentImpact,
        },
      });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Prerequisites API Error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
