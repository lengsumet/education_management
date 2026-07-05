import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * Self-registration endpoint.
 *
 * Changes vs original:
 *  - New accounts are created with approvalStatus = "pending" and isActive = false.
 *    They CANNOT log in until an admin approves them (see login route + admin users API).
 *  - No longer auto-creates a junk "Faculty of Defaults" department. If a
 *    departmentId is provided it is used; otherwise the first real department
 *    is used and, only if the DB is truly empty, a clearly-labelled placeholder
 *    is created.
 *  - admissionYear is stored in Thai Buddhist year (พ.ศ.) to match curriculum data.
 */
export async function POST(request: NextRequest) {
  try {
    // Throttle abuse: 5 registrations / hour per IP.
    const rl = rateLimit(`register:${clientIp(request)}`, 5, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { message: "สมัครสมาชิกบ่อยเกินไป กรุณาลองใหม่ภายหลัง" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    const body = await request.json();
    const { studentId, firstName, lastName, email, phone, password, role, departmentId } = body;

    if (!email || !password || !firstName || !lastName || !role) {
      return NextResponse.json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน" }, { status: 400 });
    }

    if (role !== "student" && role !== "teacher") {
      return NextResponse.json({ message: "บทบาทไม่ถูกต้อง" }, { status: 400 });
    }

    if (typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ message: "อีเมลนี้มีการใช้งานแล้ว" }, { status: 409 });
    }

    if (studentId) {
      if (role === "student") {
        const existing = await prisma.student.findUnique({ where: { studentCode: studentId } });
        if (existing) {
          return NextResponse.json({ message: "รหัสนิสิตนี้มีการลงทะเบียนแล้วในระบบ" }, { status: 409 });
        }
      } else {
        const existing = await prisma.teacher.findUnique({ where: { teacherCode: studentId } });
        if (existing) {
          return NextResponse.json({ message: "รหัสอาจารย์นี้มีการลงทะเบียนแล้วในระบบ" }, { status: 409 });
        }
      }
    }

    // Resolve a department without creating junk data.
    let dept = null;
    if (departmentId) {
      dept = await prisma.department.findUnique({ where: { id: Number(departmentId) } });
    }
    if (!dept) {
      dept = await prisma.department.findFirst({ orderBy: { id: "asc" } });
    }
    if (!dept) {
      return NextResponse.json(
        { message: "ระบบยังไม่มีข้อมูลสาขาวิชา กรุณาให้ผู้ดูแลระบบตั้งค่าก่อน" },
        { status: 503 }
      );
    }

    const passwordHash = await hashPassword(password);

    // Buddhist year for admission (matches curriculum.year e.g. 2560 / 2565)
    const admissionYearBE = new Date().getFullYear() + 543;

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: role as any,
          firstName,
          lastName,
          phone: phone || null,
          isActive: false,
          approvalStatus: "pending",
        },
      });

      if (role === "student") {
        await tx.student.create({
          data: {
            studentCode: studentId || `S${user.id}`,
            userId: user.id,
            departmentId: dept!.id,
            admissionYear: admissionYearBE,
            status: "active",
          },
        });
      } else {
        await tx.teacher.create({
          data: {
            teacherCode: studentId || `T${user.id}`,
            userId: user.id,
            departmentId: dept!.id,
          },
        });
      }
    });

    return NextResponse.json(
      {
        message: "สมัครสมาชิกสำเร็จ บัญชีของคุณอยู่ระหว่างรอผู้ดูแลระบบอนุมัติ",
        pendingApproval: true,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Register error:", error);
    return NextResponse.json({ message: "เกิดข้อผิดพลาดในระบบ" }, { status: 500 });
  }
}
