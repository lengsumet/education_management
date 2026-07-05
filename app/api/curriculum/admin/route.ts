import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { CourseType } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || payload.role !== "admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const searchParams = request.nextUrl.searchParams;
    const deptParam = searchParams.get("departmentId");
    const curriculumYearParam = searchParams.get("curriculumYear");
    
    // Fallback to department ID 1 if not specified
    let departmentId = deptParam ? parseInt(deptParam) : undefined;
    
    if (!departmentId) {
      const firstDept = await prisma.department.findFirst();
      if (!firstDept) {
        return NextResponse.json({ success: true, data: { plans: [], department: null, availableCurricula: [] } }, { status: 200 });
      }
      departmentId = firstDept.id;
    }

    const department = await prisma.department.findUnique({
      where: { id: departmentId }
    });

    // Fetch all active curricula for the dropdown
    const availableCurricula = await prisma.curriculum.findMany({
      where: {
        departmentId: departmentId,
        status: "active"
      },
      select: { id: true, name: true, year: true },
      orderBy: { year: "desc" }
    });

    // Find the specific curriculum: by curriculumYear param, or latest active
    let curriculum;
    if (curriculumYearParam) {
      curriculum = await prisma.curriculum.findFirst({
        where: { 
          departmentId: departmentId,
          status: "active",
          year: parseInt(curriculumYearParam)
        },
        include: {
          curriculumCourses: {
            include: { course: true },
            orderBy: [
              { yearLevel: 'asc' },
              { semester: 'asc' }
            ]
          }
        }
      });
    } else {
      curriculum = await prisma.curriculum.findFirst({
        where: { 
          departmentId: departmentId,
          status: "active"
        },
        orderBy: { year: "desc" },
        include: {
          curriculumCourses: {
            include: { course: true },
            orderBy: [
              { yearLevel: 'asc' },
              { semester: 'asc' }
            ]
          }
        }
      });
    }

    if (!curriculum) {
       return NextResponse.json({ 
        success: true, 
        data: { 
          plans: [], 
          department: department?.name || "ไม่ระบุภาควิชา",
          availableCurricula,
          currentCurriculumYear: null
        } 
      }, { status: 200 });
    }

    // Group into semesters
    const plansMap = new Map();

    for (const curCourse of (curriculum as any).curriculumCourses) {
      if (!curCourse.yearLevel || !curCourse.semester) continue;
      
      const key = `${curCourse.yearLevel}-${curCourse.semester}`;
      if (!plansMap.has(key)) {
        plansMap.set(key, {
          year: curCourse.yearLevel,
          semester: curCourse.semester,
          courses: []
        });
      }
      
      const plan = plansMap.get(key);
      
      let typeLabel = "วิชาเลือกเสรี";
      switch (curCourse.course.type) {
        case CourseType.required: typeLabel = "วิชาบังคับ"; break;
        case CourseType.elective: typeLabel = "วิชาเลือก"; break;
        case CourseType.general: typeLabel = "วิชาศึกษาทั่วไป"; break;
      }
      
      plan.courses.push({
        id: curCourse.id.toString(),
        code: curCourse.course.code,
        name: curCourse.course.name,
        credits: curCourse.course.credits,
        type: typeLabel,
        prerequisite: undefined // No prerequisite field directly on Course without mapping table
      });
    }

    const plans = Array.from(plansMap.values());
    
    // Sort plans by year then semester
    plans.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.semester - b.semester;
    });

    return NextResponse.json({ 
      success: true, 
      data: {
        plans,
        department: department?.name || "ไม่ระบุภาควิชา",
        curriculumName: curriculum.name,
        availableCurricula,
        currentCurriculumYear: curriculum.year
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error("Admin Curriculum GET API Error:", error);
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
    const { action, year, name, plans, curriculumYear } = body;

    const firstDept = await prisma.department.findFirst();
    if (!firstDept) {
      return NextResponse.json({ message: "No department found" }, { status: 400 });
    }

    if (action === "create") {
      if (!year || !name) {
         return NextResponse.json({ message: "Year and Name are required" }, { status: 400 });
      }
      
      const existing = await prisma.curriculum.findFirst({
         where: { departmentId: firstDept.id, year: parseInt(year) }
      });
      if (existing) {
         return NextResponse.json({ message: "Curriculum for this year already exists" }, { status: 400 });
      }

      await prisma.curriculum.create({
        data: {
          name,
          year: parseInt(year),
          totalCredits: 120,
          departmentId: firstDept.id,
          status: "active"
        }
      });
      return NextResponse.json({ success: true, message: "Curriculum created successfully" });
    } 
    else if (action === "save_plans") {
      let curriculum = null;
      if (curriculumYear) {
         curriculum = await prisma.curriculum.findFirst({
           where: { departmentId: firstDept.id, year: parseInt(curriculumYear) }
         });
      } else {
         curriculum = await prisma.curriculum.findFirst({
           where: { departmentId: firstDept.id, status: "active" },
           orderBy: { year: "desc" }
         });
      }

      if (!curriculum) {
         return NextResponse.json({ message: "Curriculum not found" }, { status: 404 });
      }

      const safePlans = plans || [];

      // Process all courses first to ensure they exist
      for (const plan of safePlans) {
         for (const course of plan.courses) {
           let dbType: CourseType = CourseType.required;
           if (course.type === "วิชาเลือก") dbType = CourseType.elective;
           if (course.type === "วิชาศึกษาทั่วไป") dbType = CourseType.general;
           
           await prisma.course.upsert({
             where: { code: course.code },
             update: {
               name: course.name,
               credits: course.credits || 3,
               type: dbType,
             },
             create: {
               code: course.code,
               name: course.name,
               credits: course.credits || 3,
               type: dbType,
               departmentId: firstDept.id,
               description: "ระบุอัตโนมัติจากหลักสูตร"
             }
           });
         }
      }

      // Use transaction to prevent partial data loss
      await prisma.$transaction(async (tx) => {
        // Delete existing curriculum courses mapping
        await tx.curriculumCourse.deleteMany({
          where: { curriculumId: curriculum.id }
        });

        // Rebuild mapping
        for (const plan of safePlans) {
           for (const course of plan.courses) {
              const dbCourse = await tx.course.findUnique({
                where: { code: course.code }
              });
              if (dbCourse) {
                 // Skip if already exists in this curriculum to prevent unique constraint crash
                 const existingLink = await tx.curriculumCourse.findUnique({
                   where: {
                     curriculumId_courseId: {
                       curriculumId: curriculum.id,
                       courseId: dbCourse.id
                     }
                   }
                 });

                 if (!existingLink) {
                   await tx.curriculumCourse.create({
                     data: {
                       curriculumId: curriculum.id,
                       courseId: dbCourse.id,
                       semester: plan.semester,
                       yearLevel: plan.year
                     }
                   });
                 }
              }
           }
        }
      });

      return NextResponse.json({ success: true, message: "Curriculum saved successfully" });
    }
    
    return NextResponse.json({ message: "Invalid action" }, { status: 400 });

  } catch (error: any) {
    console.error("Admin Curriculum POST API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

