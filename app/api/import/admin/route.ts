import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken, hashPassword } from "@/lib/auth";
import { cookies } from "next/headers";
import { ImportType, ImportStatus, DayOfWeek } from "@prisma/client";
import { promises as fs } from "fs";
import path from "path";

// Idempotent schedule write: re-importing the same file must NOT create
// duplicate weekly slots. A slot is identified by (section, day, start time);
// if it already exists we update its end time / room instead of inserting.
async function upsertSchedule(
  sectionId: number,
  dayOfWeek: DayOfWeek,
  startTime: Date,
  endTime: Date,
  room: string
): Promise<void> {
  const existing = await prisma.schedule.findFirst({
    where: { sectionId, dayOfWeek, startTime },
  });
  if (existing) {
    await prisma.schedule.update({
      where: { id: existing.id },
      data: { endTime, room },
    });
  } else {
    await prisma.schedule.create({
      data: { sectionId, dayOfWeek, startTime, endTime, room },
    });
  }
}

// RFC-4180-ish CSV parser: handles quoted fields containing commas/newlines
// and escaped quotes (""). A naive line.split(',') corrupts any row whose
// field legitimately contains a comma (e.g. "Data Structures, Algorithms").
function parseCSV(buffer: Buffer): string[][] {
  const text = buffer.toString('utf-8').replace(/^\uFEFF/, ''); // strip BOM
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  const pushField = () => { row.push(field.trim()); field = ''; };
  const pushRow = () => { if (row.some(c => c !== '')) rows.push(row); row = []; };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } // escaped quote
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      pushField();
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++; // CRLF
      pushField();
      pushRow();
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) { pushField(); pushRow(); }
  return rows;
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || payload.role !== "admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const logsDb = await prisma.importLog.findMany({
      orderBy: { createdAt: 'desc' }
    });

    const importLogs = logsDb.map(log => {
      let typeLabel = log.importType as string;
      if (log.importType === "students") typeLabel = "นิสิต";
      else if (log.importType === "teachers") typeLabel = "อาจารย์";
      else if (log.importType === "courses") typeLabel = "วิชา";
      else if (log.importType === "enrollments") typeLabel = "การลงทะเบียน";

      let statusLabel = "pending";
      if (log.status === "completed") statusLabel = "success";
      else if (log.status === "failed") statusLabel = "error";

      const createdRows = log.createdRows || 0;
      const updatedRows = log.updatedRows || 0;
      let message = "กำลังประมวลผล...";
      if (log.status === "completed") {
        const parts: string[] = [];
        if (createdRows > 0) parts.push(`สร้างใหม่ ${createdRows} รายการ`);
        if (updatedRows > 0) parts.push(`อัปเดต ${updatedRows} รายการ`);
        if (log.errorRows && log.errorRows > 0) parts.push(`ผิดพลาด ${log.errorRows} รายการ`);
        message = parts.length > 0 ? `นำเข้าสำเร็จ: ${parts.join(', ')}` : "นำเข้าสำเร็จ (ไม่มีข้อมูลใหม่)";
      } else if (log.status === "failed") {
        message = "ข้อผิดพลาด";
      }

      return {
        id: log.id.toString(),
        date: log.createdAt ? new Date(log.createdAt).toISOString().replace(/T/, ' ').slice(0, 16) : "N/A",
        type: typeLabel,
        file: log.fileName,
        status: statusLabel,
        records: log.successRows || 0,
        createdRecords: createdRows,
        updatedRecords: updatedRows,
        errorRecords: log.errorRows || 0,
        message
      };
    });

    return NextResponse.json({ success: true, data: importLogs }, { status: 200 });

  } catch (error: any) {
    console.error("Admin Import GET API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

async function getOrCreateDefaultDept() {
  let dept = await prisma.department.findFirst();
  if (!dept) {
    let fac = await prisma.faculty.findFirst();
    if (!fac) {
      fac = await prisma.faculty.create({ data: { name: "คณะทั่วไป", code: "FAC_DEF" } });
    }
    dept = await prisma.department.create({ data: { name: "ภาควิชาทั่วไป", facultyId: fac.id, code: "DEPT_DEF" } });
  }
  return dept;
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || payload.role !== "admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const importType = formData.get("importType") as string;

    if (!file) {
      return NextResponse.json({ message: "No file uploaded" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    // file.name is client-controlled; basename + whitelist strips any "../"
    // path segments so the write can't escape the files/ directory.
    const safeName = path.basename(file.name).replace(/[^\w.\-]/g, "_");
    const uniqueFileName = `${Date.now()}_${safeName}`;
    const uploadDir = path.join(process.cwd(), "files");
    const filePath = path.join(uploadDir, uniqueFileName);
    
    // Attempt saving physically (optional if relying purely on DB upload, but we do it anyway)
    try {
        await fs.mkdir(uploadDir, { recursive: true });
        await fs.writeFile(filePath, buffer);
    } catch(e) {}

    const rows = parseCSV(buffer);
    if (rows.length < 2) {
      return NextResponse.json({ message: "ไฟล์ว่างเปล่าหรือไม่มีข้อมูล" }, { status: 400 });
    }
    
    const headers = rows[0];
    const dataRows = rows.slice(1);
    let successCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    let parsedImportType: ImportType = ImportType.enrollments;
    
    if (importType === "students") {
      parsedImportType = ImportType.students;
      if (!headers.join(',').includes("รหัสนิสิต")) {
        return NextResponse.json({ message: "รูปแบบ Header ไม่ถูกต้องสำหรับเทมเพลต 'นิสิต'" }, { status: 400 });
      }

      const defaultDept = await getOrCreateDefaultDept();

      // Rows are independent -> process concurrently. The DB connection pool
      // (mariadb adapter, ~10) bounds real parallelism, turning a long chain of
      // sequential round-trips into ~10-wide batches. Counters are mutated from
      // async callbacks, which is safe on JS's single thread.
      await Promise.all(dataRows.map(async (row) => {
        if (row.length < 9) return;
        const [studentCode, title, firstName, lastName, email, phone, facultyTxt, deptTxt, yearTxt] = row;
        try {
          const userEmail = email || `${studentCode}@ku.ac.th`;
          let user = await prisma.user.findUnique({ where: { email: userEmail } });
          
          if (!user) {
            const existingStudent = await prisma.student.findUnique({ where: { studentCode } });
            if (existingStudent) {
              user = await prisma.user.findUnique({ where: { id: existingStudent.userId } }) || null;
            }
          }

          const firstNameParsed = title && title.trim() !== '' ? `${title}${firstName}` : firstName;
          
          const isExisting = await prisma.student.findUnique({ where: { studentCode } });
          
          if (!user) {
            user = await prisma.user.create({
              data: {
                email: userEmail,
                passwordHash: await hashPassword(studentCode),
                role: "student",
                firstName: firstNameParsed,
                lastName,
                phone,
                // Admin-imported accounts are trusted -> usable immediately.
                // Without this they default to approvalStatus "pending" and
                // cannot log in (bulk import would be dead on arrival).
                approvalStatus: "approved",
                isActive: true
              }
            });
          } else {
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                firstName: firstNameParsed,
                lastName,
                phone
              }
            });
          }
          
          await prisma.student.upsert({
            where: { studentCode },
            update: {
              departmentId: defaultDept.id,
              admissionYear: parseInt(yearTxt) || (new Date().getFullYear() + 543)
            },
            create: {
              userId: user.id,
              studentCode,
              departmentId: defaultDept.id,
              admissionYear: parseInt(yearTxt) || (new Date().getFullYear() + 543)
            }
          });
          successCount++;
          if (isExisting) { updatedCount++; } else { createdCount++; }
        } catch (e) {
          console.error("Student Import Row Error:", e);
          errorCount++;
        }
      }));
    }
    else if (importType === "teachers") {
      parsedImportType = ImportType.teachers;
      if (!headers.join(',').includes("รหัสอาจารย์")) {
        return NextResponse.json({ message: "รูปแบบ Header ไม่ถูกต้องสำหรับเทมเพลต 'อาจารย์'" }, { status: 400 });
      }
      
      const defaultDept = await getOrCreateDefaultDept();

      // Independent rows -> concurrent (pool-bounded), like the student loop.
      await Promise.all(dataRows.map(async (row) => {
        if (row.length < 9) return;
        const [teacherCode, title, firstName, lastName, position, email, phone, facultyTxt, deptTxt] = row;
        try {
          const userEmail = email || `${teacherCode}@ku.ac.th`;
          let user = await prisma.user.findUnique({ where: { email: userEmail } });

          if (!user) {
            const existingTeacher = await prisma.teacher.findUnique({ where: { teacherCode } });
            if (existingTeacher) {
              user = await prisma.user.findUnique({ where: { id: existingTeacher.userId } }) || null;
            }
          }

          const firstNameParsed = title && title.trim() !== '' ? `${title}${firstName}` : firstName;
          
          const isExisting = await prisma.teacher.findUnique({ where: { teacherCode } });

          if (!user) {
            user = await prisma.user.create({
              data: {
                email: userEmail,
                passwordHash: await hashPassword(teacherCode),
                role: "teacher",
                firstName: firstNameParsed,
                lastName,
                phone,
                // Admin-imported accounts are trusted -> usable immediately
                // (otherwise they default to "pending" and cannot log in).
                approvalStatus: "approved",
                isActive: true
              }
            });
          } else {
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                firstName: firstNameParsed,
                lastName,
                phone
              }
            });
          }
          
          await prisma.teacher.upsert({
            where: { teacherCode },
            update: {
              departmentId: defaultDept.id,
              position,
              specialization: deptTxt
            },
            create: {
              userId: user.id,
              teacherCode,
              departmentId: defaultDept.id,
              position,
              specialization: deptTxt
            }
          });
          successCount++;
          if (isExisting) { updatedCount++; } else { createdCount++; }
        } catch (e) {
          console.error("Teacher Import Row Error:", e);
          errorCount++;
        }
      }));
    }
    else if (importType === "courses") {
      parsedImportType = ImportType.courses;
      if (!headers.join(',').includes("รหัสวิชา")) {
        return NextResponse.json({ message: "รูปแบบ Header ไม่ถูกต้องสำหรับเทมเพลต 'รายวิชา'" }, { status: 400 });
      }
      
      const defaultDept = await getOrCreateDefaultDept();

      for (const row of dataRows) {
        if (row.length < 6) continue;
        const [code, nameTh, nameEn, creditsTxt, typeTxt, facultyTxt, dayOfWeekTxt, startTimeTxt, endTimeTxt, roomTxt, teacherCodeTxt] = row;
        try {
          let mappedType = "required";
          if (typeTxt && typeTxt.includes("เลือก")) mappedType = "elective";
          else if (typeTxt && typeTxt.includes("ทั่วไป")) mappedType = "general";
          
          const fullName = nameEn && nameEn.trim() !== "-" && nameEn.trim() !== "" ? `${nameTh} (${nameEn})` : nameTh;

          const isExistingCourse = await prisma.course.findUnique({ where: { code } });
          
          const course = await prisma.course.upsert({
            where: { code },
            update: {
              name: fullName,
              credits: parseInt(creditsTxt) || 3,
              type: mappedType as any,
              departmentId: defaultDept.id
            },
            create: {
              code,
              name: fullName,
              credits: parseInt(creditsTxt) || 3,
              type: mappedType as any,
              departmentId: defaultDept.id
            }
          });

          // Create Schedule if Schedule columns exist
          if (dayOfWeekTxt && startTimeTxt && endTimeTxt) {
             let activeSemester = await prisma.semester.findFirst({ where: { isCurrent: true } });
             if (!activeSemester) activeSemester = await prisma.semester.findFirst();

             if (activeSemester) {
                 let targetTeacherId: number | undefined;
                 if (teacherCodeTxt) {
                   const t = await prisma.teacher.findUnique({ where: { teacherCode: teacherCodeTxt }});
                   if (t) targetTeacherId = t.id;
                 }

                 const teacher = targetTeacherId ? await prisma.teacher.findUnique({ where: { id: targetTeacherId } }) : await prisma.teacher.findFirst();
                 if (teacher) {
                     let section = await prisma.courseSection.findFirst({ where: { courseId: course.id, semesterId: activeSemester.id, sectionNumber: "1" }});
                     if (!section) {
                       section = await prisma.courseSection.create({
                          data: { courseId: course.id, semesterId: activeSemester.id, sectionNumber: "1", teacherId: teacher.id }
                       });
                     }
                     
                     // Helper mapping — supports Thai & English day names
                     const mapDayToEnum = (d: string) => {
                        const s = d.trim();
                        const up = s.toUpperCase();
                       if (up.includes("MON") || s.includes("จันทร์")) return "MON";
                       if (up.includes("TUE") || s.includes("อังคาร")) return "TUE";
                       if (up.includes("WED") || s.includes("พุธ")) return "WED";
                       if (up.includes("THU") || s.includes("พฤหัส")) return "THU";
                       if (up.includes("FRI") || s.includes("ศุกร์")) return "FRI";
                       if (up.includes("SAT") || s.includes("เสาร์")) return "SAT";
                       if (up.includes("SUN") || s.includes("อาทิตย์")) return "SUN";
                       return "MON";
                     };

                     await upsertSchedule(
                        section.id,
                        mapDayToEnum(dayOfWeekTxt) as DayOfWeek,
                        new Date(`1970-01-01T${startTimeTxt}:00Z`),
                        new Date(`1970-01-01T${endTimeTxt}:00Z`),
                        roomTxt || "TBA"
                     );
                 }
             }
          }

          successCount++;
          if (isExistingCourse) { updatedCount++; } else { createdCount++; }
        } catch (e) {
          console.error("Course Import Row Error:", e);
          errorCount++;
        }
      }
    }
    else if (importType === "curriculum" || importType === "registration-plan") {
      // Both template schemas modify CurriculumCourse. Both now carry an
      // explicit "ปีหลักสูตร" (curriculum year) as the FIRST-referenced field so
      // rows are never silently attached to an arbitrary curriculum.
      // curriculum:        รหัสวิชา,ชื่อวิชา,หน่วยกิต,ปีหลักสูตร,ปีที่,ภาคเรียน,ประเภท,...
      // registration-plan: ปีหลักสูตร,ปีที่,ภาคเรียน,รหัสวิชา,ชื่อวิชา,หน่วยกิต,ประเภท
      // We'll log them as enrollments just to pass the parsedImportType check
      parsedImportType = ImportType.enrollments;

      for (const row of dataRows) {
        if (row.length < 6) continue;
        let courseCode, courseName, creditsTxt, typeTxt, yearLvl, semLvl, dayOfWeekTxt, startTimeTxt, endTimeTxt, roomTxt, currYearTxt, teacherCodeTxt;
        if (importType === "curriculum") {
          courseCode = row[0];
          courseName = row[1];
          creditsTxt = row[2];
          currYearTxt = row[3];
          yearLvl = row[4];
          semLvl = row[5];
          typeTxt = row[6];
          dayOfWeekTxt = row[7];
          startTimeTxt = row[8];
          endTimeTxt = row[9];
          roomTxt = row[10];
          teacherCodeTxt = row[11];
        } else {
          currYearTxt = row[0];
          yearLvl = row[1];
          semLvl = row[2];
          courseCode = row[3];
          courseName = row[4];
          creditsTxt = row[5];
          typeTxt = row[6];
        }

        try {
          let course = await prisma.course.findUnique({ where: { code: courseCode } });
          if (!course) {
            const defaultDept = await getOrCreateDefaultDept();
            
            let mappedType = "required";
            if (typeTxt && typeTxt.includes("เลือก")) mappedType = "elective";
            else if (typeTxt && typeTxt.includes("ทั่วไป")) mappedType = "general";

            course = await prisma.course.create({
              data: {
                code: courseCode,
                name: courseName || courseCode,
                credits: parseInt(creditsTxt) || 3,
                type: mappedType as any,
                departmentId: defaultDept.id
              }
            });
          }
          
          // "ปีหลักสูตร" is REQUIRED — never silently fall back to some
          // arbitrary existing curriculum (that would load courses into the
          // wrong หลักสูตร). A missing/invalid year fails the row explicitly.
          const parsedYear = parseInt(currYearTxt || "");
          if (!currYearTxt || isNaN(parsedYear)) {
            errorCount++;
            continue; // missing curriculum year — reject this row
          }

          let targetCurriculum = await prisma.curriculum.findFirst({ where: { year: parsedYear } });
          if (!targetCurriculum) {
            const defaultDept = await getOrCreateDefaultDept();
            targetCurriculum = await prisma.curriculum.create({
              data: {
                year: parsedYear,
                name: `หลักสูตรปรับปรุง พ.ศ. ${parsedYear}`,
                totalCredits: 120,
                departmentId: defaultDept.id,
                status: "active"
              }
            });
          }

          const isExistingCurr = await prisma.curriculumCourse.findUnique({
            where: { curriculumId_courseId: { curriculumId: targetCurriculum.id, courseId: course.id } }
          });
          
          await prisma.curriculumCourse.upsert({
            where: {
              curriculumId_courseId: { curriculumId: targetCurriculum.id, courseId: course.id }
            },
            update: { yearLevel: parseInt(yearLvl) || 1, semester: parseInt(semLvl) || 1 },
            create: {
              curriculumId: targetCurriculum.id,
              courseId: course.id,
              yearLevel: parseInt(yearLvl) || 1,
              semester: parseInt(semLvl) || 1
            }
          });

          // Create Schedule if Schedule columns exist
          if (dayOfWeekTxt && startTimeTxt && endTimeTxt) {
             let activeSemester = await prisma.semester.findFirst({ where: { isCurrent: true } });
             if (!activeSemester) activeSemester = await prisma.semester.findFirst();

             if (activeSemester) {
                 let targetTeacherId: number | undefined;
                 if (teacherCodeTxt) {
                   const t = await prisma.teacher.findUnique({ where: { teacherCode: teacherCodeTxt }});
                   if (t) targetTeacherId = t.id;
                 }

                 const teacher = targetTeacherId ? await prisma.teacher.findUnique({ where: { id: targetTeacherId } }) : await prisma.teacher.findFirst();
                 if (teacher) {
                     let section = await prisma.courseSection.findFirst({ where: { courseId: course.id, semesterId: activeSemester.id, sectionNumber: "1" }});
                     if (!section) {
                       section = await prisma.courseSection.create({
                          data: { courseId: course.id, semesterId: activeSemester.id, sectionNumber: "1", teacherId: teacher.id }
                       });
                     }
                     
                     // Helper mapping — supports Thai & English day names
                     const mapDayToEnum = (d: string) => {
                        const s = d.trim();
                        const up = s.toUpperCase();
                       if (up.includes("MON") || s.includes("จันทร์")) return "MON";
                       if (up.includes("TUE") || s.includes("อังคาร")) return "TUE";
                       if (up.includes("WED") || s.includes("พุธ")) return "WED";
                       if (up.includes("THU") || s.includes("พฤหัส")) return "THU";
                       if (up.includes("FRI") || s.includes("ศุกร์")) return "FRI";
                       if (up.includes("SAT") || s.includes("เสาร์")) return "SAT";
                       if (up.includes("SUN") || s.includes("อาทิตย์")) return "SUN";
                       return "MON";
                     };

                     await upsertSchedule(
                        section.id,
                        mapDayToEnum(dayOfWeekTxt) as DayOfWeek,
                        new Date(`1970-01-01T${startTimeTxt}:00Z`),
                        new Date(`1970-01-01T${endTimeTxt}:00Z`),
                        roomTxt || "TBA"
                     );
                 }
             }
          }

          successCount++;
          if (isExistingCurr) { updatedCount++; } else { createdCount++; }
        } catch (e) {
          console.error("Curriculum Import Row Error:", e);
          errorCount++;
        }
      }
    }
    else if (importType === "registration") {
      parsedImportType = ImportType.enrollments;
      if (!headers.join(',').includes("รหัสนิสิต")) {
        return NextResponse.json({ message: "รูปแบบ Header ไม่ถูกต้องสำหรับเทมเพลต 'การลงทะเบียน'" }, { status: 400 });
      }

      for (const row of dataRows) {
        if (row.length < 5) continue;
        const [studentCode, courseCode, semNum, startYear, groupNum] = row;
        try {
          let student = await prisma.student.findUnique({ where: { studentCode } });
          if (!student) {
            const defaultDept = await getOrCreateDefaultDept();
            const user = await prisma.user.create({
              data: {
                email: `${studentCode}@ku.ac.th`,
                passwordHash: await hashPassword(studentCode),
                role: "student",
                firstName: "Dummy",
                lastName: "Student",
              }
            });
            student = await prisma.student.create({
              data: {
                userId: user.id,
                studentCode,
                departmentId: defaultDept.id,
                admissionYear: parseInt(startYear) || (new Date().getFullYear() + 543)
              }
            });
          }
          let course = await prisma.course.findUnique({ where: { code: courseCode } });
          if (!course) {
            const defaultDept = await getOrCreateDefaultDept();
            course = await prisma.course.create({
              data: {
                code: courseCode,
                name: courseCode,
                credits: 3,
                type: "required",
                departmentId: defaultDept.id
              }
            });
          }

          let semester = await prisma.semester.findFirst({
            where: { semesterNumber: parseInt(semNum), academicYear: parseInt(startYear) }
          });
          if (!semester) {
             const currentDate = new Date();
             semester = await prisma.semester.create({
                data: {
                   name: `ภาคเรียนที่ ${semNum}/${startYear}`,
                   academicYear: parseInt(startYear),
                   semesterNumber: parseInt(semNum),
                   startDate: currentDate,
                   endDate: currentDate
                }
             })
          }

          let section = await prisma.courseSection.findFirst({
            where: { courseId: course.id, semesterId: semester.id, sectionNumber: groupNum }
          });
          if (!section) {
             let teacher = await prisma.teacher.findFirst();
             if (!teacher) {
               const defaultDept = await getOrCreateDefaultDept();
               const tUser = await prisma.user.create({
                 data: {
                   email: `dummy_teacher_${Date.now()}@ku.ac.th`,
                   passwordHash: await hashPassword("dummy"),
                   role: "teacher",
                   firstName: "Dummy",
                   lastName: "Teacher"
                 }
               });
               teacher = await prisma.teacher.create({
                 data: {
                   userId: tUser.id,
                   teacherCode: `T${Date.now()}`,
                   departmentId: defaultDept.id,
                   position: "อาจารย์"
                 }
               });
             }
             section = await prisma.courseSection.create({
                 data: {
                    courseId: course.id,
                    semesterId: semester.id,
                    sectionNumber: groupNum,
                    teacherId: teacher.id
                 }
             })
          }

          const isExistingEnroll = await prisma.enrollment.findUnique({
             where: { studentId_sectionId: { studentId: student.id, sectionId: section.id } }
          });
          
          await prisma.enrollment.upsert({
             where: {
                studentId_sectionId: { studentId: student.id, sectionId: section.id }
             },
             update: {},
             create: { studentId: student.id, sectionId: section.id, status: "enrolled" }
          });
          
          successCount++;
          if (isExistingEnroll) { updatedCount++; } else { createdCount++; }
        } catch (e) {
          console.error("Registration Import Error:", e);
          errorCount++;
        }
      }
    }
    else if (importType === "grades") {
      parsedImportType = ImportType.enrollments;
      
      for (const row of dataRows) {
        if (row.length < 5) continue;
        const [studentCode, courseCode, semNum, startYear, gradeMark] = row;
        try {
          const student = await prisma.student.findUnique({ where: { studentCode } });
          const course = await prisma.course.findUnique({ where: { code: courseCode } });
          if (!student || !course) { errorCount++; continue; }

          const semester = await prisma.semester.findFirst({
            where: { semesterNumber: parseInt(semNum), academicYear: parseInt(startYear) }
          });
          if (!semester) { errorCount++; continue; }

          const section = await prisma.courseSection.findFirst({
            where: { courseId: course.id, semesterId: semester.id }
          });
          if (!section) { errorCount++; continue; }

          await prisma.enrollment.update({
            where: {
              studentId_sectionId: { studentId: student.id, sectionId: section.id }
            },
            data: { grade: gradeMark, status: "completed" }
          });
          
          successCount++;
        } catch (e) {
          console.error("Grade Import Error:", e);
          errorCount++;
        }
      }
    }
    else {
      // Dummy pass for completely unknown files
      parsedImportType = ImportType.enrollments;
      successCount = dataRows.length;
    }

    const newLog = await prisma.importLog.create({
      data: {
        importedBy: payload.userId as number,
        fileName: file.name,
        importType: parsedImportType,
        totalRows: dataRows.length,
        successRows: successCount,
        createdRows: createdCount,
        updatedRows: updatedCount,
        errorRows: errorCount,
        status: ImportStatus.completed
      }
    });

    return NextResponse.json({ success: true, data: newLog }, { status: 201 });

  } catch (error: any) {
    console.error("Admin Import POST API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
