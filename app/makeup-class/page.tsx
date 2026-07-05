import { redirect } from "next/navigation";
import { getRole } from "@/lib/server-auth";
import TeacherMakeupClass from "./_variants/teacher";
import StudentMakeupClass from "./_variants/student";

// Role-agnostic URL. Teachers schedule makeup classes; students view the ones
// for the courses they're enrolled in. Middleware guarantees authentication.
export default async function MakeupClassPage() {
  const role = await getRole();
  if (role === "teacher") return <TeacherMakeupClass />;
  if (role === "student") return <StudentMakeupClass />;
  redirect("/dashboard");
}
