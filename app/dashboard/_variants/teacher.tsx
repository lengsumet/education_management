"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, BookOpen, BarChart3, Bell, Loader2 } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AppSelect } from "@/components/ui/app-select";

interface SemesterOption {
  id: number;
  name: string;
  isCurrent: boolean;
}

interface DashboardData {
  semesters: SemesterOption[];
  selectedSemesterId: number | null;
  selectedCurriculumYear?: number | null;
  availableCurriculumYears?: number[];
  stats: {
    id: string;
    label: string;
    value: string;
    color: string;
  }[];
  myCourses: {
    code: string;
    name: string;
    students: number;
    avgGrade: string;
    gradedCount: number;
    semester: string;
    status: string;
  }[];
  announcements: {
    id: number;
    title: string;
    content: string;
    date: string;
    type: string;
  }[];
}

export default function TeacherDashboard() {
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [selectedCurriculumYear, setSelectedCurriculumYear] = useState<number | null>(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any | null>(null);

  const { data: dashboardResponse, isLoading, isError, error } = useQuery({
    queryKey: ['teacherDashboard', selectedSemesterId, selectedCurriculumYear],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedSemesterId) params.set("semesterId", String(selectedSemesterId));
      if (selectedCurriculumYear) params.set("curriculumYear", String(selectedCurriculumYear));
      const query = params.toString();
      const url = query ? `/api/dashboard/teacher?${query}` : `/api/dashboard/teacher`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      return res.json();
    }
  });

  if (isLoading) {
    return (
      <Layout role="teacher">
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (isError) {
    return (
      <Layout role="teacher">
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <p className="text-red-500 font-medium mb-2">ไม่สามารถโหลดข้อมูลแดชบอร์ดได้</p>
          <p className="text-slate-500 text-sm">{error instanceof Error ? error.message : "เกิดข้อผิดพลาดบางอย่าง"}</p>
        </div>
      </Layout>
    );
  }

  const data: DashboardData = dashboardResponse?.data;
  const availableCurriculumYears: number[] = data?.availableCurriculumYears || [];

  const getIcon = (id: string) => {
    switch (id) {
      case "my-courses": return BookOpen;
      case "total-students": return Users;
      case "avg-grade": return BarChart3;
      default: return BookOpen;
    }
  };

  const activeSemesterId = selectedSemesterId || data.selectedSemesterId;

  return (
    <Layout role="teacher">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">แดชบอร์ด</h1>
            <p className="text-slate-600 mt-1">จัดการวิชาและนิสิตของคุณ</p>
          </div>
        </div>

        {/* Semester Selector */}
        {data.semesters.length > 0 && (
          <Card className="p-4 border border-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-700 mr-1">ภาคเรียน:</span>
              {data.semesters.map((sem) => (
                <button
                  key={sem.id}
                  onClick={() => setSelectedSemesterId(sem.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    activeSemesterId === sem.id
                      ? "bg-primary border-primary text-white"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                  }`}
                >
                  ภาค {sem.name}
                  {sem.isCurrent && (
                    <span className={`ml-1.5 text-xs ${activeSemesterId === sem.id ? "text-white/80" : "text-green-600"}`}>
                      
                    </span>
                  )}
                </button>
              ))}
            </div>
          </Card>
        )}

        {availableCurriculumYears.length > 0 && (
          <Card className="p-4 border border-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-700 mr-1">หลักสูตร:</span>
              <AppSelect
                value={selectedCurriculumYear ? String(selectedCurriculumYear) : "all"}
                onValueChange={(v) => setSelectedCurriculumYear(v === "all" ? null : Number(v))}
                className="w-48"
                options={[
                  { value: "all", label: "ทั้งหมด" },
                  ...availableCurriculumYears.map((year) => ({
                    value: String(year),
                    label: `หลักสูตร ${year % 100}`,
                  })),
                ]}
              />
            </div>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.stats.map((stat) => {
            const Icon = getIcon(stat.id);
            return (
              <Card key={stat.id} className="p-4 border border-slate-200">
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

        {/* My Courses Table */}
        <Card className="p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">วิชาของฉัน</h2>
            <Link href="/courses">
              <Button variant="outline" size="sm">ดูทั้งหมด</Button>
            </Link>
          </div>
          <div className="overflow-x-auto">
            {data.myCourses.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">รหัสวิชา</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">ชื่อวิชา</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">นิสิต</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">เกรดเฉลี่ย</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.myCourses.map((course, idx) => (
                    // key by index: a teacher can have >1 section of the same course
                    // (e.g. 01418221 sec1/sec2 in the same semester), so course.code
                    // is not unique here.
                    <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-primary">{course.code}</td>
                      <td className="py-3 px-4">{course.name}</td>
                      <td className="py-3 px-4">{course.students}</td>
                      <td className="py-3 px-4">
                        {course.gradedCount > 0 ? (
                          <span className="font-bold text-slate-900">{course.avgGrade}</span>
                        ) : (
                          <span className="text-slate-400" title="ยังไม่มีการให้เกรด">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${course.status === "Active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"}`}>
                          {course.status === "Active" ? "ใช้งาน" : "สิ้นสุด"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-6 text-slate-500">
                ไม่มีวิชาในภาคเรียนนี้
              </div>
            )}
          </div>
        </Card>

        {/* Announcements */}
        <Card className="p-6 border border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={20} className="text-slate-900" />
            <h3 className="font-bold text-slate-900">ประกาศและข่าวสาร</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.announcements.length > 0 ? data.announcements.map((announcement) => (
              <div 
                key={announcement.id} 
                onClick={() => setSelectedAnnouncement(announcement)}
                className="p-3 border border-slate-200 rounded-lg cursor-pointer hover:border-primary/50 hover:bg-slate-50/50 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex gap-2 mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap ${announcement.type === "important" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                      {announcement.type === "important" ? "สำคัญ" : "ข่าวสาร"}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 line-clamp-1">{announcement.title}</p>
                  <p className="text-xs text-slate-600 mt-1.5 line-clamp-3 whitespace-pre-line">{announcement.content}</p>
                </div>
                <p className="text-xs text-slate-500 mt-3">{announcement.date}</p>
              </div>
            )) : (
              <div className="col-span-full text-sm text-slate-500">ไม่มีประกาศใหม่</div>
            )}
          </div>
        </Card>

        {/* Announcement Detail Modal */}
        {selectedAnnouncement && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200">
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4">
                <div>
                  <div className="flex gap-2 mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${selectedAnnouncement.type === "important" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                      {selectedAnnouncement.type === "important" ? "สำคัญ" : "ข่าวสาร"}
                    </span>
                    <span className="text-xs text-slate-500">{selectedAnnouncement.date}</span>
                  </div>
                  <h3 className="font-bold text-lg text-slate-900 leading-snug">{selectedAnnouncement.title}</h3>
                </div>
                <button 
                  onClick={() => setSelectedAnnouncement(null)}
                  className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors font-semibold"
                >
                  ✕
                </button>
              </div>
              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-1 text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                {selectedAnnouncement.content}
              </div>
              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 flex justify-end">
                <Button onClick={() => setSelectedAnnouncement(null)}>ปิดหน้าต่าง</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
