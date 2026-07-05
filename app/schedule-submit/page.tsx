"use client";
export const dynamic = "force-dynamic";

import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle, Clock, BookOpen, Bell, Loader2, Filter, LayoutGrid, List } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { AppSelect } from "@/components/ui/app-select";
import { WeeklyTimetable } from "@/components/WeeklyTimetable";

export default function StudentScheduleSubmit() {
  const { data: scheduleData, isLoading, isError } = useQuery({
    queryKey: ['studentSchedule'],
    queryFn: async () => {
      const res = await fetch("/api/schedule-submit/student");
      if (!res.ok) throw new Error("Failed to fetch schedule data");
      return res.json();
    }
  });

  const [selectedSemester, setSelectedSemester] = useState<string>("all");
  const [view, setView] = useState<"grid" | "list">("grid");

  const registeredCourses = scheduleData?.data?.registeredCourses || [];
  const notifications = scheduleData?.data?.notifications || [];
  const stats = scheduleData?.data?.stats || { totalCourses: 0, pendingMakeups: 0, confirmedMakeups: 0 };

  const uniqueSemesters = useMemo(() => {
    const sems = new Set<string>();
    registeredCourses.forEach((c: any) => {
      if (c.semester) sems.add(c.semester);
    });
    return Array.from(sems).sort();
  }, [registeredCourses]);

  const filteredCourses = useMemo(() => {
    if (selectedSemester === "all") return registeredCourses;
    return registeredCourses.filter((c: any) => c.semester === selectedSemester);
  }, [registeredCourses, selectedSemester]);

  if (isLoading) {
    return (
      <Layout role="student">
        <div className="flex flex-col items-center justify-center h-[50vh] text-slate-500">
          <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
          <p>กำลังโหลดตารางเรียน...</p>
        </div>
      </Layout>
    );
  }

  if (isError) {
    return (
      <Layout role="student">
        <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">
          <p className="font-bold mb-1">เกิดข้อผิดพลาด</p>
          <p className="text-sm">โปรดลองรีเฟรชหน้าใหม่</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout role="student">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">แจ้งตารางเรียน</h1>
          <p className="text-slate-600 mt-1">ตารางเรียนของคุณในภาคเรียนนี้ และแจ้งเตือนนัดสอนชดเชยจากอาจารย์</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-blue-100 text-blue-600"><BookOpen size={20} /></div>
              <div>
                <p className="text-xs text-slate-600">วิชาที่ลงทะเบียน</p>
                <p className="text-2xl font-bold text-slate-900">{stats.totalCourses}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-yellow-100 text-yellow-600"><Bell size={20} /></div>
              <div>
                <p className="text-xs text-slate-600">นัดชดเชยรอดำเนินการ</p>
                <p className="text-2xl font-bold text-slate-900">{stats.pendingMakeups}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-green-100 text-green-600"><CheckCircle size={20} /></div>
              <div>
                <p className="text-xs text-slate-600">ยืนยันแล้ว</p>
                <p className="text-2xl font-bold text-slate-900">{stats.confirmedMakeups}</p>
              </div>
            </div>
          </Card>
        </div>

        {notifications.length > 0 && (
          <Card className="p-6 border border-yellow-200 bg-yellow-50">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Bell size={20} className="text-yellow-600" />
              แจ้งเตือนนัดสอนชดเชย ({notifications.length})
            </h2>
            <div className="space-y-4">
              {notifications.map((notif: any) => (
                <div key={notif.id} className={`p-4 rounded-lg border ${notif.status === "กำลังรอ" ? "border-yellow-300 bg-white" : "border-green-300 bg-green-50"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <code className="text-sm font-mono font-bold text-primary">{notif.courseCode}</code>
                    <span className="font-bold text-slate-900">{notif.courseName}</span>
                    <span className={`text-xs px-2 py-1 rounded font-medium ${notif.status === "กำลังรอ" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>{notif.status}</span>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">อาจารย์: <span className="font-medium">{notif.instructor}</span></p>
                  <p className="text-sm text-slate-600 mb-3">เหตุผล: {notif.reason}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-xs text-red-600 font-medium mb-1">❌ วันเรียนเดิม (งดสอน)</p>
                      <p className="text-red-800">{notif.originalDate}</p>
                    </div>
                    <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-xs text-green-600 font-medium mb-1">✅ วันนัดสอนชดเชย</p>
                      <p className="text-green-800 font-bold">{notif.makeupDate}</p>
                      <p className="text-green-700">เวลา {notif.makeupTime} • ห้อง {notif.makeupRoom}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">📩 แจ้งเตือนเมื่อ: {notif.sentAt}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-6 border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Calendar size={20} className="text-primary" />
              ตารางเรียนของฉัน
            </h2>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setView("grid")}
                  className={`px-2.5 py-1.5 flex items-center gap-1 text-sm ${view === "grid" ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-100"}`}
                  title="ตารางสัปดาห์"
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  onClick={() => setView("list")}
                  className={`px-2.5 py-1.5 flex items-center gap-1 text-sm ${view === "list" ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-100"}`}
                  title="รายการ"
                >
                  <List size={16} />
                </button>
              </div>
              <Filter size={16} className="text-slate-500" />
              <AppSelect
                value={selectedSemester}
                onValueChange={(v) => setSelectedSemester(v)}
                className="text-sm w-48 shrink-0"
                options={[
                  { value: "all", label: "ทุกภาคเรียน" },
                  ...uniqueSemesters.map(sem => ({ value: sem, label: `ภาคเรียน ${sem}` })),
                ]}
              />
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-4">รายวิชาที่แสดง ({filteredCourses.length} วิชา)</p>
          {filteredCourses.length === 0 ? (
            <div className="text-center py-8 text-slate-500"><p>ยังไม่มีตารางเรียน</p></div>
          ) : view === "grid" ? (
            <WeeklyTimetable items={filteredCourses} />
          ) : (
            <div className="space-y-3">
              {filteredCourses.map((course: any, idx: number) => (
                <div key={idx} className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="min-w-[80px] text-center">
                    <p className="text-sm font-bold text-primary">{course.day}</p>
                    <p className="text-xs text-slate-500">{course.time}</p>
                  </div>
                  <div className="h-10 w-px bg-slate-300" />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <code className="text-sm font-mono font-bold text-primary">{course.code}</code>
                      <span className="text-sm font-bold text-slate-900">{course.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>🏫 ห้อง {course.room}</span>
                      <span>👤 {course.instructor}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}
