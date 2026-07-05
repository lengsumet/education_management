"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, BookOpen, Users, Clock, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface Course {
  id: string;
  code: string;
  name: string;
  credits: number;
  instructor: string;
  semester: string;
  yearLevel: number | null;
  curriculumSemester: number | null;
  students: number;
  description: string;
  schedule: string;
  type: string;
  prerequisites: { code: string; name: string }[];
}

// Filter value for the elective/general pool (courses with no curriculum year)
const ELECTIVE_KEY = "elective";

export default function CoursesCatalog() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState("ทั้งหมด");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  const { data: catalogData, isLoading, isError } = useQuery({
    queryKey: ['catalogCourses'],
    queryFn: async () => {
      const res = await fetch("/api/catalog/student");
      if (!res.ok) throw new Error("Failed to fetch catalog");
      return res.json();
    }
  });

  const allCourses: Course[] = catalogData?.data?.courses || [];
  const yearLevels: number[] = catalogData?.data?.yearLevels || [];

  const filteredCourses = allCourses.filter((course) => {
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      q === "" ||
      course.code.toLowerCase().includes(q) ||
      course.name.toLowerCase().includes(q) ||
      course.instructor.toLowerCase().includes(q);
    const matchesYear =
      selectedYear === "ทั้งหมด" ||
      (selectedYear === ELECTIVE_KEY ? course.yearLevel == null : String(course.yearLevel) === selectedYear);
    return matchesSearch && matchesYear;
  });

  // Filter options: all → each curriculum year → elective/general pool (if any)
  const hasElectivePool = allCourses.some((c) => c.yearLevel == null);
  const yearFilters: { key: string; label: string }[] = [
    { key: "ทั้งหมด", label: "ทั้งหมด" },
    ...yearLevels.map((y) => ({ key: String(y), label: `ชั้นปีที่ ${y}` })),
    ...(hasElectivePool ? [{ key: ELECTIVE_KEY, label: "วิชาเลือก/ทั่วไป" }] : []),
  ];

  if (isLoading) {
    return (
      <Layout role="student">
        <div className="flex flex-col items-center justify-center h-[50vh] text-slate-500">
          <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
          <p>กำลังโหลดแคตตาล็อกวิชา...</p>
        </div>
      </Layout>
    );
  }

  if (isError) {
    return (
      <Layout role="student">
        <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">
          <p className="font-bold mb-1">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
          <p className="text-sm">โปรดลองรีเฟรชหน้าใหม่อีกครั้ง</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout role="student">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">แคตตาล็อกวิชา</h1>
          <p className="text-slate-600 mt-1">ค้นหาและเรียนรู้เกี่ยวกับวิชาที่มีให้</p>
        </div>

        {/* Search and Filter */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={20} />
            <Input
              placeholder="ค้นหาด้วยรหัสวิชา ชื่อวิชา หรืออาจารย์..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border border-slate-300"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {yearFilters.map((f) => (
              <button
                key={f.key}
                onClick={() => setSelectedYear(f.key)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedYear === f.key
                    ? "bg-primary text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Courses Grid */}
        {filteredCourses.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <BookOpen className="mx-auto mb-3 text-slate-400" size={40} />
            <p>ไม่พบรายวิชาที่ตรงกับเงื่อนไข</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCourses.map((course) => (
              <Card
                key={course.id}
                className="p-5 border border-slate-200 hover:border-primary hover:shadow-lg transition-all cursor-pointer"
                onClick={() => setSelectedCourse(course)}
              >
                <div className="mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-sm font-mono font-bold text-primary">
                      {course.code}
                    </code>
                    {course.yearLevel != null ? (
                      <span className="text-[11px] px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-600">
                        ปี {course.yearLevel}{course.curriculumSemester ? `/${course.curriculumSemester}` : ""}
                      </span>
                    ) : (
                      <span className="text-[11px] px-1.5 py-0.5 rounded font-medium bg-amber-100 text-amber-700">
                        {course.type === "general" ? "ศึกษาทั่วไป" : "วิชาเลือก"}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">
                    {course.name}
                  </h3>
                </div>

                <div className="space-y-2 mb-4">
                  <p className="text-sm text-slate-600">{course.instructor}</p>
                  <p className="text-xs text-slate-500 line-clamp-2">
                    {course.description}
                  </p>
                  {course.prerequisites && course.prerequisites.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <p className="text-xs font-semibold text-orange-600">วิชาบังคับก่อน:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {course.prerequisites.map(p => (
                          <span key={p.code} className="text-xs bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded">
                            {p.code}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-600 border-t border-slate-200 pt-3">
                  <div className="flex items-center gap-1">
                    <BookOpen size={16} />
                    <span>{course.credits} หน่วยกิต</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users size={16} />
                    <span>{course.students} คน</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={16} />
                    <span className="truncate">{course.schedule}</span>
                  </div>
                </div>

                <Button className="w-full mt-4" size="sm">
                  ดูรายละเอียด
                </Button>
              </Card>
            ))}
          </div>
        )}

        {/* Course Detail Modal */}
        {selectedCourse && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-2xl p-8 border border-slate-200">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <code className="text-sm font-mono font-bold text-primary">
                    {selectedCourse.code}
                  </code>
                  <h2 className="text-2xl font-bold text-slate-900 mt-2">
                    {selectedCourse.name}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedCourse(null)}
                  className="text-slate-400 hover:text-slate-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    อาจารย์ผู้สอน
                  </label>
                  <p className="text-slate-900">{selectedCourse.instructor}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      หน่วยกิต
                    </label>
                    <p className="text-slate-900">{selectedCourse.credits}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      จำนวนนิสิต
                    </label>
                    <p className="text-slate-900">{selectedCourse.students}</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    ตารางเรียน
                  </label>
                  <p className="text-slate-900">{selectedCourse.schedule}</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    ตำแหน่งในหลักสูตร
                  </label>
                  <p className="text-slate-900">
                    {selectedCourse.yearLevel != null
                      ? `ชั้นปีที่ ${selectedCourse.yearLevel}${selectedCourse.curriculumSemester ? ` ภาคเรียนที่ ${selectedCourse.curriculumSemester}` : ""}`
                      : selectedCourse.type === "general"
                      ? "วิชาศึกษาทั่วไป"
                      : "วิชาเลือก"}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    รายละเอียดวิชา
                  </label>
                  <p className="text-slate-900">{selectedCourse.description}</p>
                </div>

                {selectedCourse.prerequisites && selectedCourse.prerequisites.length > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <label className="text-sm font-bold text-orange-800 mb-2 flex items-center gap-2">
                      <BookOpen size={16} />
                      รายวิชาบังคับก่อน (Prerequisites)
                    </label>
                    <ul className="list-disc list-inside space-y-1">
                      {selectedCourse.prerequisites.map(p => (
                        <li key={p.code} className="text-sm text-orange-900">
                          <span className="font-mono font-bold mr-2">{p.code}</span>
                          {p.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelectedCourse(null)}
                >
                  ปิด
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
