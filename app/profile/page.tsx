import { redirect } from "next/navigation";
import { getRole } from "@/lib/server-auth";
import StudentProfile from "./_variants/student";
import TeacherProfile from "./_variants/teacher";

export default async function ProfilePage() {
  const role = await getRole();
  if (role === "student") return <StudentProfile />;
  if (role === "teacher") return <TeacherProfile />;
  // admin has no profile page -> send to dashboard
  redirect("/dashboard");
}
