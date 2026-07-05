import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Public: the registration form needs the list of departments before the user
// is authenticated. Only non-sensitive id/name/faculty are exposed.
export async function GET() {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { name: "asc" },
      include: { faculty: { select: { name: true } } },
    });

    return NextResponse.json({
      success: true,
      data: departments.map((d: any) => ({
        id: d.id,
        name: d.name,
        faculty: d.faculty?.name || "",
      })),
    });
  } catch (error: any) {
    console.error("Departments GET Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
