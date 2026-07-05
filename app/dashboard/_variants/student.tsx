"use client";
export const dynamic = "force-dynamic";

import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Clock, CheckCircle, AlertCircle, Bell, Loader2, CalendarClock, ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

export default function StudentDashboard() {
  const { data: dashboardData, isLoading, isError, error } = useQuery({
    queryKey: ['studentDashboard'],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/student");
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      return res.json();
    }
  });

  if (isLoading) {
    return (
      <Layout role="student">
        <div className="flex flex-col items-center justify-center h-[50vh] text-slate-500">
          <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
          <p>กำลังดึงข้อมูลแดชบอร์ด...</p>
        </div>
      </Layout>
    );
  }

  if (isError) {
    return (
      <Layout role="student">
        <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">
          <p className="font-bold mb-1">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
          <p className="text-sm">{error instanceof Error ? error.message : "โปรดลองใหม่อีกครั้ง"}</p>
        </div>
      </Layout>
    );
  }

  const { stats, enrolledCourses, announcements, currentSemester, recommendedCourses } =
    dashboardData?.data || { stats: [], enrolledCourses: [], announcements: [], currentSemester: null, recommendedCourses: [] };

  const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  // Registration dates are stored with calendar-date (UTC) semantics — format
  // with getUTC* so the displayed day matches what the admin picked.
  const fmtThai = (iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.getUTCDate()} ${THAI_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear() + 543}`;
  };
  const regStatus = currentSemester?.registrationStatus;
  const typeLabel = (t: string) => (t === "required" ? "วิชาบังคับ" : t === "elective" ? "วิชาเลือก" : "ศึกษาทั่วไป");

  return (
    <Layout role="student">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">แดชบอร์ด</h1>
          <p className="text-slate-600 mt-1">ยินดีต้อนรับกลับมา! นี่คือภาพรวมของวิชาที่ลงทะเบียนของคุณ</p>
        </div>

        {/* Registration window banner */}
        {currentSemester && (regStatus === "open" || regStatus === "before" || regStatus === "closed") && (() => {
          const registered = !!currentSemester.registered;
          const regPending = (currentSemester.regPending as number) ?? 0;
          const regApproved = (currentSemester.regApproved as number) ?? 0;
          const doneState = regStatus === "open" && registered; // registered this term
          return (
          <Card
            className={`p-5 border ${
              doneState
                ? "border-emerald-200 bg-emerald-50/60"
                : regStatus === "open"
                ? "border-primary/30 bg-primary/5"
                : regStatus === "before"
                ? "border-blue-200 bg-blue-50/50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-lg ${doneState ? "bg-emerald-100 text-emerald-600" : regStatus === "open" ? "bg-primary/10 text-primary" : regStatus === "before" ? "bg-blue-100 text-blue-600" : "bg-slate-200 text-slate-500"}`}>
                  {doneState ? <CheckCircle size={22} /> : <CalendarClock size={22} />}
                </div>
                <div>
                  <h2 className="font-bold text-slate-900">
                    {doneState && `ลงทะเบียน ${currentSemester.name} เรียบร้อยแล้ว`}
                    {regStatus === "open" && !registered && `เปิดรับลงทะเบียน ${currentSemester.name}`}
                    {regStatus === "before" && `ยังไม่เปิดรับลงทะเบียน ${currentSemester.name}`}
                    {regStatus === "closed" && `ปิดรับลงทะเบียนแล้ว ${currentSemester.name}`}
                  </h2>
                  <p className="text-sm text-slate-600 mt-0.5">
                    {doneState && (
                      <>
                        {regPending > 0 && <>รอการอนุมัติ <span className="font-bold text-amber-600">{regPending}</span> วิชา</>}
                        {regPending > 0 && regApproved > 0 && " · "}
                        {regApproved > 0 && <>อนุมัติแล้ว <span className="font-bold text-emerald-600">{regApproved}</span> วิชา</>}
                        {regPending === 0 && regApproved === 0 && "ส่งคำขอลงทะเบียนแล้ว"}
                      </>
                    )}
                    {regStatus === "open" && !registered && (
                      <>กรุณาลงทะเบียนภายในวันที่ <span className="font-bold text-primary">{fmtThai(currentSemester.regCloseDate)}</span></>
                    )}
                    {regStatus === "before" && (
                      <>เปิดรับลงทะเบียนวันที่ <span className="font-bold text-blue-700">{fmtThai(currentSemester.regOpenDate)}</span></>
                    )}
                    {regStatus === "closed" && (
                      <>หมดเขตลงทะเบียนเมื่อ {fmtThai(currentSemester.regCloseDate)}</>
                    )}
                  </p>
                </div>
              </div>
              {regStatus === "open" && (
                doneState ? (
                  <Link href="/registration" className="shrink-0">
                    <Button variant="outline" className="gap-2">ดูสถานะการลงทะเบียน</Button>
                  </Link>
                ) : (
                  <Link href="/course-planner" className="shrink-0">
                    <Button className="bg-primary hover:bg-primary-hover text-white gap-2">
                      <Plus size={16} /> ไปเพิ่มรายวิชา
                    </Button>
                  </Link>
                )
              )}
            </div>
          </Card>
          );
        })()}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat: any) => {
            let Icon = BookOpen;
            if (stat.id === "in-progress") Icon = Clock;
            if (stat.id === "completed") Icon = CheckCircle;
            if (stat.id === "credits") Icon = AlertCircle;
            
            return (
              <Card key={stat.label} className="p-4 border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg ${stat.color}`}>
                    <Icon size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">{stat.label}</p>
                    <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Recommended courses for current year/term */}
        {recommendedCourses && recommendedCourses.length > 0 && (
          <Card className="p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen size={20} className="text-primary" />
                  วิชาแนะนำสำหรับชั้นปีที่ {currentSemester?.yearLevel} เทอม {currentSemester?.semesterNumber}
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">ตามแผนการเรียนในหลักสูตรของคุณ</p>
              </div>
              <Link href="/course-planner">
                <Button variant="outline" size="sm" className="gap-1">
                  เพิ่มรายวิชา <ArrowRight size={14} />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recommendedCourses.map((c: any) => (
                <div key={c.code} className="p-4 border border-slate-200 rounded-lg flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sm font-mono font-bold text-primary">{c.code}</code>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${c.type === "required" ? "bg-red-100 text-red-700" : c.type === "elective" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}`}>
                        {typeLabel(c.type)}
                      </span>
                    </div>
                    <h3 className="font-medium text-slate-900 leading-tight">{c.name}</h3>
                    <p className="text-xs text-slate-500 mt-1">{c.credits} หน่วยกิต</p>
                  </div>
                  {c.alreadyRegistered && (
                    <span className="text-xs px-2 py-1 rounded font-medium bg-green-100 text-green-700 whitespace-nowrap shrink-0">ลงแล้ว</span>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="p-6 border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900">วิชาที่ลงทะเบียน</h2>
                <Link href="/courses">
                  <Button variant="outline" size="sm">ดูทั้งหมด</Button>
                </Link>
              </div>

              <div className="space-y-3">
                {enrolledCourses.length > 0 ? (
                  enrolledCourses.map((course: any) => {
                    const failed = course.grade === "F";
                    const done = course.status === "completed" || (course.grade && course.grade !== "-");
                    const passed = done && !failed;
                    return (
                    <div key={course.code} className="p-4 border border-slate-200 rounded-lg hover:border-primary transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <code className="text-sm font-mono font-bold text-primary">{course.code}</code>
                          <h3 className="font-medium text-slate-900 mt-1">{course.name}</h3>
                          <p className="text-sm text-slate-600">{course.instructor}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded font-medium ${failed ? "bg-red-100 text-red-700" : passed ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                          {failed ? "ต้องเรียนซ้ำ" : passed ? "เรียนเสร็จแล้ว" : "กำลังเรียน"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="w-full bg-slate-200 rounded-full h-2 mr-3">
                          <div className={`h-2 rounded-full ${failed ? "bg-red-500" : "bg-primary"}`} style={{ width: done ? "100%" : "75%" }} />
                        </div>
                        <span className={`text-sm font-bold ${failed ? "text-red-600" : "text-slate-900"}`}>{course.grade}</span>
                      </div>
                    </div>
                    );
                  })
                ) : (
                  <div className="text-center py-6 text-slate-500 text-sm">ยังไม่มีรายวิชาที่ลงทะเบียนในขณะนี้</div>
                )}
              </div>
            </Card>
          </div>

          <Card className="p-6 border border-slate-200 h-fit">
            <div className="flex items-center gap-2 mb-4">
              <Bell size={20} className="text-slate-900" />
              <h3 className="font-bold text-slate-900">ประกาศและข่าวสาร</h3>
            </div>
            <div className="space-y-3">
              {announcements.length > 0 ? (
                announcements.map((announcement: any) => (
                  <div key={announcement.id} className="pb-3 border-b border-slate-200 last:border-b-0">
                    <div className="flex gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap ${announcement.type === "important" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                        {announcement.type === "important" ? "สำคัญ" : "ข่าวสาร"}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-900">{announcement.title}</p>
                    <p className="text-xs text-slate-500 mt-1">{announcement.date}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-slate-500 text-sm">ไม่มีประกาศใหม่</div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
