import "dotenv/config";
import prisma from "./src/lib/prisma";

/**
 * Seed course prerequisites for the CS 2565 (หลักสูตร 65) curriculum.
 *
 * Source: handwritten curriculum sheet. Codes were reconciled against the real
 * courses in the DB by course NAME where the handwriting was ambiguous:
 *   370 -> 390 (การเตรียมความพร้อมสหกิจศึกษา)
 *   391 -> 371 (การบริหารโครงการและสตาร์ทอัพดิจิทัล)
 *   352 -> 332 (ความมั่นคงในระบบสารสนเทศ)
 *   สัมมนา = 497, โครงงาน = 499
 *
 * Each pair is [course, requires]. Idempotent: re-running only fills gaps.
 */
const PREREQUISITES: Array<[string, string]> = [
  ["01418112", "01418111"], // แนวคิดการโปรแกรมเบื้องต้น <- วิทยาการคอมพิวเตอร์เบื้องต้น
  ["01418211", "01418113"], // การสร้างซอฟต์แวร์ <- การโปรแกรมคอมพิวเตอร์
  ["01418231", "01418113"], // โครงสร้างข้อมูลและขั้นตอนวิธี <- การโปรแกรมคอมพิวเตอร์
  ["01418233", "01418113"], // สถาปัตยกรรมคอมพิวเตอร์ <- การโปรแกรมคอมพิวเตอร์
  ["01418221", "01418113"], // ระบบฐานข้อมูลเบื้องต้น <- การโปรแกรมคอมพิวเตอร์
  ["01418236", "01418233"], // ระบบปฏิบัติการ <- สถาปัตยกรรมคอมพิวเตอร์
  ["01418232", "01418231"], // การออกแบบและวิเคราะห์ขั้นตอนวิธี <- โครงสร้างข้อมูลและขั้นตอนวิธี
  ["01418321", "01418221"], // การวิเคราะห์และการออกแบบระบบ <- ระบบฐานข้อมูลเบื้องต้น
  ["01418331", "01418132"], // ทฤษฎีการคำนวณ <- หลักมูลการคณนา
  ["01418351", "01418236"], // หลักการสื่อสารคอมพิวเตอร์และคลาวด์ <- ระบบปฏิบัติการ
  ["01418371", "01418221"], // การบริหารโครงการและสตาร์ทอัพดิจิทัล <- ระบบฐานข้อมูลเบื้องต้น
  ["01418332", "01418236"], // ความมั่นคงในระบบสารสนเทศ <- ระบบปฏิบัติการ
  ["01418490", "01418390"], // สหกิจศึกษา <- การเตรียมความพร้อมสหกิจศึกษา
  ["01418499", "01418321"], // โครงงานวิทยาการคอมพิวเตอร์ <- การวิเคราะห์และการออกแบบระบบ

  // --- Inferred (not on the sheet), confirmed by user ---
  ["01417112", "01417111"], // แคลคูลัส II <- แคลคูลัส I
];

async function main() {
  // Resolve every referenced code to its id in one query.
  const codes = [...new Set(PREREQUISITES.flat())];
  const courses = await prisma.course.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true },
  });
  const idByCode = new Map(courses.map((c) => [c.code, c.id]));

  let created = 0;
  let existed = 0;
  const missing: string[] = [];

  for (const [courseCode, prereqCode] of PREREQUISITES) {
    const courseId = idByCode.get(courseCode);
    const prerequisiteId = idByCode.get(prereqCode);

    if (!courseId || !prerequisiteId) {
      missing.push(`${courseCode} <- ${prereqCode} (${!courseId ? courseCode : prereqCode} not found)`);
      continue;
    }

    const existing = await prisma.coursePrerequisite.findUnique({
      where: { courseId_prerequisiteId: { courseId, prerequisiteId } },
    });

    if (existing) {
      existed++;
      continue;
    }

    await prisma.coursePrerequisite.create({ data: { courseId, prerequisiteId } });
    created++;
    console.log(`  + ${courseCode} requires ${prereqCode}`);
  }

  console.log(`\nDone. created=${created}, already-present=${existed}, missing=${missing.length}`);
  if (missing.length > 0) {
    console.log("MISSING (skipped):");
    for (const m of missing) console.log("  - " + m);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
