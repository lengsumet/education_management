import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { CourseType } from "@prisma/client";

async function getNextTbaRoom() {
  const existingTbas = await prisma.schedule.findMany({ where: { room: { startsWith: "TBA" } }, select: { room: true } });
  if (existingTbas.length === 0) return "TBA";
  
  let max = 0;
  let hasBase = false;
  for (const s of existingTbas) {
    const m = s.room.toUpperCase().match(/^TBA(\d*)$/);
    if (m) {
      if (m[1] === "") hasBase = true;
      else {
         const val = parseInt(m[1]);
         if (val > max) max = val;
      }
    }
  }
  if (hasBase && max === 0) return "TBA01";
  else if (max > 0) return `TBA${(max + 1).toString().padStart(2, '0')}`;
  else return "TBA";
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || payload.role !== "admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const searchParams = request.nextUrl.searchParams;
    const curriculumYear = searchParams.get("curriculumYear");

    const courses = await prisma.course.findMany({
      where: curriculumYear ? {
        curriculumCourses: {
          some: {
            curriculum: { year: parseInt(curriculumYear) }
          }
        }
      } : undefined,
      orderBy: { code: 'asc' },
      include: {
        department: true,
        coordinator: { include: { user: true } },
        courseSections: {
          include: { schedules: true }
        },
        prerequisites: {
          include: { prerequisite: true }
        }
      }
    });

    const formattedCourses = courses.map(course => {
      let typeLabel = "วิชาเสรี";
      if (course.type === "required") typeLabel = "วิชาบังคับ";
      else if (course.type === "elective") typeLabel = "วิชาเลือก";
      else if (course.type === "general") typeLabel = "วิชาศึกษาทั่วไป";

      const firstSection = (course as any).courseSections?.[0];
      const schedule = firstSection?.schedules?.[0];
      
      // Attempt to format Time out of DB Date object
      let sTime = "";
      let eTime = "";
      try {
        if (schedule?.startTime) sTime = new Date(schedule.startTime).toISOString().substring(11, 16);
        if (schedule?.endTime) eTime = new Date(schedule.endTime).toISOString().substring(11, 16);
      } catch (e) {}

      return {
        id: course.id.toString(),
        code: course.code,
        name: course.name,
        credits: course.credits,
        type: typeLabel,
        description: course.description || "",
        department: (course as any).department?.name || "ส่วนกลาง",
        coordinatorId: (course as any).coordinatorId?.toString() || "",
        coordinatorName: (course as any).coordinator?.user ? `${(course as any).coordinator.user.firstName} ${(course as any).coordinator.user.lastName}` : "ไม่ระบุ",
        dayOfWeek: schedule?.dayOfWeek || "MON",
        startTime: sTime || "09:00",
        endTime: eTime || "12:00",
        room: schedule?.room || "TBA",
        prerequisites: (course as any).prerequisites?.map((p: any) => ({
          id: p.prerequisite.id.toString(),
          code: p.prerequisite.code,
          name: p.prerequisite.name
        })) || []
      };
    });

    const availableCurricula = await prisma.curriculum.findMany({
      where: { status: "active" },
      orderBy: { year: "desc" },
      select: { id: true, year: true, name: true }
    });

    return NextResponse.json({ success: true, data: formattedCourses, curricula: availableCurricula }, { status: 200 });

  } catch (error: any) {
    console.error("Admin Courses GET API Error:", error);
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
    const { code, name, credits, type, description, dayOfWeek, startTime, endTime, room, coordinatorId, prerequisites } = body;

    const creditsNum = parseInt(credits);
    if (!code || !name || isNaN(creditsNum)) {
      return NextResponse.json({ message: "กรุณากรอกรหัสวิชา ชื่อวิชา และหน่วยกิต (ตัวเลข) ให้ครบถ้วน" }, { status: 400 });
    }

    let pType: CourseType = "general" as CourseType;
    if (type === "วิชาบังคับ") pType = "required" as CourseType;
    else if (type === "วิชาเลือก") pType = "elective" as CourseType;

    const existingCourse = await prisma.course.findUnique({ where: { code } });
    if (existingCourse) {
      return NextResponse.json({ message: "รหัสวิชานี้มีอยู่ในระบบแล้ว" }, { status: 400 });
    }

    // Auto-setup relations for the timetable
    let semester = await prisma.semester.findFirst({ where: { isCurrent: true }}) || await prisma.semester.findFirst();
    if (!semester) {
      semester = await prisma.semester.create({ 
        data: { 
          academicYear: 2567, 
          semesterNumber: 1, 
          name: "1/2567",
          startDate: new Date(),
          endDate: new Date(),
          isCurrent: true 
        }
      });
    }

    let teacher = await prisma.teacher.findFirst();
    if (!teacher) {
      const firstDept = await prisma.department.findFirst() || await prisma.department.create({ data: { name: "ส่วนกลาง", code: "CEN", faculty: { create: { name: "ส่วนกลาง", code: "CEN" } } }});
      const tUser = await prisma.user.create({ data: { email: `t_${Date.now()}@ku.th`, passwordHash: "pwd", firstName: "อจ.", lastName: "อัตโนมัติ", role: "teacher" }});
      teacher = await prisma.teacher.create({ data: { userId: tUser.id, teacherCode: `T${Date.now()}`, departmentId: firstDept.id }});
    }

    let assignedTeacher = teacher;
    if (coordinatorId) {
      const coordinatorTeacher = await prisma.teacher.findUnique({ where: { id: parseInt(coordinatorId) } });
      if (!coordinatorTeacher) {
        return NextResponse.json({ message: "Teacher not found for coordinator" }, { status: 400 });
      }
      assignedTeacher = coordinatorTeacher;
    }

    const firstDept = await prisma.department.findFirst();

    let reqRoom = room?.trim() || "";
    if (reqRoom === "" || reqRoom.toUpperCase() === "TBA" || reqRoom === "-") {
      reqRoom = await getNextTbaRoom();
    }

    const reqDayOfWeek = dayOfWeek || "MON";
    const startObj = new Date(`1970-01-01T${startTime || "09:00"}:00Z`);
    const endObj = new Date(`1970-01-01T${endTime || "12:00"}:00Z`);

    if (!reqRoom.toUpperCase().startsWith("TBA")) {
      const overlapping = await prisma.schedule.findMany({
        where: {
          room: reqRoom,
          dayOfWeek: reqDayOfWeek as any
        }
      });
      const hasOverlap = overlapping.some(s => startObj < s.endTime && endObj > s.startTime);
      if (hasOverlap) {
        return NextResponse.json({ message: `ห้อง ${reqRoom} ถูกใช้งานแล้วในช่วงเวลานี้` }, { status: 400 });
      }
    }

    const newCourse = await prisma.course.create({
      data: {
        code,
        name,
        credits: parseInt(credits),
        type: pType,
        description,
        departmentId: firstDept?.id,
        coordinatorId: coordinatorId ? parseInt(coordinatorId) : null,
        courseSections: {
          create: {
            sectionNumber: "800",
            semesterId: semester.id,
            teacherId: assignedTeacher.id,
              schedules: {
              create: {
                dayOfWeek: reqDayOfWeek as any,
                startTime: startObj,
                endTime: endObj,
                room: reqRoom
              }
            }
          }
        },
        prerequisites: Array.isArray(prerequisites) && prerequisites.length > 0 ? {
          create: prerequisites.map((pId: string) => ({
            prerequisiteId: parseInt(pId)
          }))
        } : undefined
      }
    });

    return NextResponse.json({ success: true, data: newCourse }, { status: 201 });

  } catch (error: any) {
    console.error("Admin Courses POST API Error:", error);
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
    const { id, code, name, credits, type, description, dayOfWeek, startTime, endTime, room, coordinatorId, prerequisites } = body;

    if (!id || !code || !name || isNaN(parseInt(credits))) {
      return NextResponse.json({ message: "กรุณากรอกรหัสวิชา ชื่อวิชา และหน่วยกิต (ตัวเลข) ให้ครบถ้วน" }, { status: 400 });
    }

    let pType: CourseType = "general" as CourseType;
    if (type === "วิชาบังคับ") pType = "required" as CourseType;
    else if (type === "วิชาเลือก") pType = "elective" as CourseType;

    const updatedCourse = await prisma.course.update({
      where: { id: parseInt(id) },
      data: {
        code,
        name,
        credits: parseInt(credits),
        type: pType,
        description,
        coordinatorId: coordinatorId ? parseInt(coordinatorId) : null
      }
    });

    if (Array.isArray(prerequisites)) {
      // Reset and recreate prerequisites
      await prisma.coursePrerequisite.deleteMany({ where: { courseId: parseInt(id) } });
      if (prerequisites.length > 0) {
        await prisma.coursePrerequisite.createMany({
          data: prerequisites.map((pId: string) => ({
            courseId: parseInt(id),
            prerequisiteId: parseInt(pId)
          }))
        });
      }
    }

    if (coordinatorId) {
      const coordinatorTeacher = await prisma.teacher.findUnique({ where: { id: parseInt(coordinatorId) } });
      if (!coordinatorTeacher) {
        return NextResponse.json({ message: "Teacher not found for coordinator" }, { status: 400 });
      }
      await prisma.courseSection.updateMany({
        where: { courseId: parseInt(id) },
        data: { teacherId: coordinatorTeacher.id }
      });
    }

    if (dayOfWeek || startTime || endTime || room !== undefined) {
      const section = await prisma.courseSection.findFirst({ where: { courseId: parseInt(id) } });
      if (section) {
        const schedule = await prisma.schedule.findFirst({ where: { sectionId: section.id } });
        if (schedule) {
          let reqRoom = (room !== undefined ? room : schedule.room)?.trim() || "";
          if (room !== undefined && (room.trim() === "" || room.trim().toUpperCase() === "TBA" || room.trim() === "-")) {
            reqRoom = await getNextTbaRoom();
          }

          const reqDayOfWeek = dayOfWeek || schedule.dayOfWeek;
          const startObj = startTime ? new Date(`1970-01-01T${startTime}:00Z`) : schedule.startTime;
          const endObj = endTime ? new Date(`1970-01-01T${endTime}:00Z`) : schedule.endTime;

          if (!reqRoom.toUpperCase().startsWith("TBA")) {
            const overlapping = await prisma.schedule.findMany({
              where: {
                room: reqRoom,
                dayOfWeek: reqDayOfWeek as any,
                id: { not: schedule.id }
              }
            });
            const hasOverlap = overlapping.some(s => startObj < s.endTime && endObj > s.startTime);
            if (hasOverlap) {
              return NextResponse.json({ message: `ห้อง ${reqRoom} ถูกใช้งานแล้วในช่วงเวลานี้` }, { status: 400 });
            }
          }

          await prisma.schedule.update({
            where: { id: schedule.id },
            data: {
              dayOfWeek: reqDayOfWeek as any,
              startTime: startObj,
              endTime: endObj,
              room: reqRoom
            }
          });
        }
      }
    }

    return NextResponse.json({ success: true, data: updatedCourse }, { status: 200 });

  } catch (error: any) {
    console.error("Admin Courses PUT API Error:", error);
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

    const courseId = parseInt(id);

    // 1. Cascade delete all relation records including student course plans and curriculums
    await prisma.coursePrerequisite.deleteMany({ where: { courseId } });
    await prisma.coursePrerequisite.deleteMany({ where: { prerequisiteId: courseId } });
    await prisma.curriculumCourse.deleteMany({ where: { courseId } });
    await prisma.coursePlan.deleteMany({ where: { courseId } });
    
    // 2. Clear all nested relationships for sections (Enrollments, Schedules, Makeup Classes)
    const sections = await prisma.courseSection.findMany({ select: { id: true }, where: { courseId }});
    if (sections.length > 0) {
      const sectionIds = sections.map(s => s.id);
      await prisma.enrollment.deleteMany({ where: { sectionId: { in: sectionIds } } }); // Cascade delete student enrollments!
      await prisma.makeupClass.deleteMany({ where: { sectionId: { in: sectionIds } } });
      await prisma.schedule.deleteMany({ where: { sectionId: { in: sectionIds } } });
      await prisma.courseSection.deleteMany({ where: { courseId } });
    }

    await prisma.course.delete({
      where: { id: courseId }
    });

    return NextResponse.json({ success: true, message: "Deleted successfully" }, { status: 200 });

  } catch (error: any) {
    console.error("Admin Courses DELETE API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
