"use client";
export const dynamic = "force-dynamic";

import { useState, useRef, useEffect } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Download, Plus, X, Loader2, CheckCircle, Lock, BookOpen, Printer } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface Course {
  id: string; // 'req-1' or 'plan-2'
  courseId: number;
  code: string;
  name: string;
  credits: number;
  type: "required" | "elective" | "general";
  yearLevel: number;
  semester: number;
  status: "planned" | "completed" | "in-progress" | "failed";
  isRequired: boolean;
  inCurriculum: boolean;   // part of the curriculum plan (locked, can be moved)
  moved?: boolean;         // moved to a non-default term
  curriculumYear?: number;
  curriculumSemester?: number;
  prerequisiteWarning?: string;
}

export default function StudentCoursePlanner() {
  const [selectedYear, setSelectedYear] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  // Land on the student's current year the first time data arrives. Kept at the
  // top with the other hooks (never after an early return) per Rules of Hooks.
  const didInitYear = useRef(false);

  // State for Add Course UI per semester
  const [addingToSemester, setAddingToSemester] = useState<number | null>(null); // 1 or 2
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const previewFrameRef = useRef<HTMLIFrameElement>(null);

  const { data: plannerData, isLoading, isError } = useQuery({
    queryKey: ['coursePlanner'],
    queryFn: async () => {
      const res = await fetch("/api/course-planner/student");
      if (!res.ok) throw new Error("Failed to fetch course planner");
      return res.json();
    }
  });

  useEffect(() => {
    const d = plannerData?.data;
    if (!didInitYear.current && d) {
      const my = d.maxYear || 4;
      const cyl = d.currentYearLevel ?? 99;
      setSelectedYear(cyl <= my ? Math.min(cyl, my) : 1);
      didInitYear.current = true;
    }
  }, [plannerData]);

  const addMutation = useMutation({
    mutationFn: async (courseData: { courseCode: string; yearLevel: number; semester: number }) => {
      const res = await fetch("/api/course-planner/student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(courseData)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to add course");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coursePlanner'] });
      setAddingToSemester(null);
      setSearchQuery("");
      toast({
        title: "สำเร็จ",
        description: "เพิ่มวิชาในแผนการเรียนแล้ว",
        className: "bg-green-50 text-green-900 border-green-200"
      });
    },
    onError: (error: any) => {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await fetch(`/api/course-planner/student?id=${planId}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to delete");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coursePlanner'] });
      toast({
        title: "สำเร็จ",
        description: "ลบวิชาออกจากแผนแล้ว",
        className: "bg-green-50 text-green-900 border-green-200"
      });
    },
    onError: (error: any) => {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message,
        variant: "destructive"
      });
    }
  });


  if (isLoading) {
    return (
      <Layout role="student">
        <div className="flex flex-col items-center justify-center h-[50vh] text-slate-500">
          <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
          <p>กำลังโหลดแผนการเรียนและวิชาบังคับ...</p>
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

  const courses: Course[] = plannerData?.data?.courses || [];
  const maxYear = plannerData?.data?.maxYear || 4;
  const curriculumName = plannerData?.data?.curriculumName || "แผนการเรียน";
  const addableCourses = plannerData?.data?.addableCourses || [];

  // Year tabs follow the curriculum's actual length (maxYear from the API).
  const years = Array.from({ length: maxYear }, (_, i) => i + 1);

  // Gate the planner to "the student's level and below": a Year 3 term 1 student
  // sees years 1–3, and within year 3 only term 1. Students past their program
  // timeline (currentYearLevel > maxYear) see everything.
  const currentYearLevel = plannerData?.data?.currentYearLevel ?? 99;
  const currentSemesterNumber = plannerData?.data?.currentSemesterNumber ?? 2;
  // Students see only their level and below ("เห็นแค่ชั้นปีตัวเอง"). Students
  // past the program timeline (currentYearLevel > maxYear) see everything.
  const gated = currentYearLevel <= maxYear;
  const visibleYears = gated ? years.filter((y) => y <= currentYearLevel) : years;
  const showSem2 = !gated || selectedYear < currentYearLevel || currentSemesterNumber >= 2;

  // Export the visible plan as a single CSV with one section per year/term.
  // (Excel/Sheets opens Thai correctly thanks to the UTF-8 BOM prefix.)
  const handleDownloadCsv = () => {
    const csvEscape = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const typeTh = (t: string) => (t === "required" ? "วิชาบังคับ" : t === "elective" ? "วิชาเลือก" : "ศึกษาทั่วไป");
    const statusTh = (s: string) => (s === "completed" ? "เรียนผ่านแล้ว" : s === "failed" ? "ต้องเรียนซ้ำ" : s === "in-progress" ? "กำลังเรียน" : "ในแผน");

    const rows: (string | number)[][] = [];
    rows.push([`แผนการเรียน — ${curriculumName || ""}`]);
    rows.push([]);
    let grand = 0;
    for (const y of visibleYears) {
      const terms = gated && y === currentYearLevel ? Array.from({ length: currentSemesterNumber }, (_, i) => i + 1) : [1, 2];
      for (const t of terms) {
        const list = courses.filter((c) => c.yearLevel === y && c.semester === t);
        rows.push([`ชั้นปีที่ ${y} / ภาคเรียน ${t}`]);
        rows.push(["รหัสวิชา", "ชื่อวิชา", "หน่วยกิต", "ประเภท", "สถานะ"]);
        let sub = 0;
        for (const c of list) {
          sub += c.credits;
          grand += c.credits;
          rows.push([c.code, c.name, c.credits, typeTh(c.type), statusTh(c.status)]);
        }
        if (list.length === 0) rows.push(["(ไม่มีวิชา)"]);
        rows.push(["", "รวมหน่วยกิต", sub]);
        rows.push([]);
      }
    }
    rows.push(["", "หน่วยกิตสะสมทั้งหมด", grand]);

    const csv = "﻿" + rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `แผนการเรียน-${curriculumName || "plan"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Build a clean, real-text study-plan report (grouped by year/term) for the
  // print preview. Printing the preview iframe prints only this document.
  const buildPlanReportHtml = (): string => {
    const si = plannerData?.data?.studentInfo || {};
    const esc = (x: unknown) =>
      String(x ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
    const typeTh = (t: string) => (t === "required" ? "วิชาบังคับ/แกน" : t === "elective" ? "วิชาเลือก" : "ศึกษาทั่วไป");
    const statusTh = (s: string) => (s === "completed" ? "เรียนผ่านแล้ว" : s === "failed" ? "ต้องเรียนซ้ำ" : s === "in-progress" ? "กำลังเรียน" : "ในแผน");
    const statusColor = (s: string) => (s === "completed" ? "#059669" : s === "failed" ? "#dc2626" : s === "in-progress" ? "#2563eb" : "#6b7280");

    let grand = 0;
    let body = "";
    // Only the student's own years/terms (same gate as the on-screen view + CSV).
    for (const y of visibleYears) {
      const yearCourses = courses.filter((c) => c.yearLevel === y);
      if (yearCourses.length === 0) continue;
      const termList = gated && y === currentYearLevel ? Array.from({ length: currentSemesterNumber }, (_, i) => i + 1) : [1, 2];
      let yearCredits = 0;
      let terms = "";
      for (const t of termList) {
        const list = yearCourses.filter((c) => c.semester === t).sort((a, b) => a.code.localeCompare(b.code));
        if (list.length === 0) continue;
        let sub = 0;
        const rows = list
          .map((c) => {
            sub += c.credits;
            return `<tr><td>${esc(c.code)}</td><td>${esc(c.name)}</td><td class="c">${c.credits}</td><td>${typeTh(c.type)}</td><td style="color:${statusColor(c.status)}">${statusTh(c.status)}</td></tr>`;
          })
          .join("");
        yearCredits += sub;
        terms += `<div class="term"><div class="thd">ภาคเรียนที่ ${t}<span class="sub">${sub} หน่วยกิต</span></div>
          <table><thead><tr><th>รหัสวิชา</th><th>ชื่อวิชา</th><th>นก.</th><th>ประเภท</th><th>สถานะ</th></tr></thead><tbody>${rows}</tbody></table></div>`;
      }
      grand += yearCredits;
      body += `<div class="year"><h2>ชั้นปีที่ ${y} <span class="yc">รวม ${yearCredits} หน่วยกิต</span></h2>${terms}</div>`;
    }

    const printedAt = new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });

    return `<!doctype html><html lang="th"><head><meta charset="utf-8">
      <title>แผนการเรียน - ${esc(si.code)}</title>
      <style>
        *{font-family:'Sarabun','Leelawadee UI','Tahoma','Noto Sans Thai',system-ui,sans-serif;box-sizing:border-box;}
        body{margin:0;padding:28px;color:#111827;font-size:13px;}
        h1{font-size:20px;margin:0 0 2px;}
        .csub{color:#6b7280;margin:0 0 14px;}
        .info{display:grid;grid-template-columns:1fr 1fr;gap:3px 32px;margin-bottom:14px;}
        .info span{color:#6b7280;}
        .grand{border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;margin-bottom:16px;background:#f9fafb;font-size:14px;}
        .year{margin-bottom:16px;}
        .year h2{font-size:15px;margin:0 0 8px;padding-bottom:4px;border-bottom:2px solid #e5e7eb;}
        .yc{font-size:12px;color:#6b7280;font-weight:normal;float:right;}
        .term{margin:0 0 10px;}
        .thd{background:#eef2ff;padding:5px 10px;font-weight:bold;border-radius:6px 6px 0 0;}
        .thd .sub{float:right;font-weight:normal;color:#4b5563;}
        table{width:100%;border-collapse:collapse;}
        th,td{border:1px solid #e5e7eb;padding:4px 8px;text-align:left;}
        th{background:#f3f4f6;}
        td.c{text-align:center;}
        .foot{margin-top:18px;color:#9ca3af;font-size:11px;display:flex;justify-content:space-between;}
        @media print{body{padding:0;}.year{break-inside:avoid;}}
      </style></head><body>
      <h1>แผนการเรียน (Course Plan)</h1>
      <p class="csub">${esc(plannerData?.data?.curriculumName || curriculumName)}</p>
      <div class="info">
        <div><span>ชื่อ-นามสกุล:</span> ${esc(si.name)}</div>
        <div><span>รหัสนิสิต:</span> ${esc(si.code)}</div>
        <div><span>คณะ:</span> ${esc(si.faculty)}</div>
        <div><span>สาขาวิชา:</span> ${esc(si.department)}</div>
      </div>
      <div class="grand">หน่วยกิตรวมในแผน <b>${grand}</b> หน่วยกิต</div>
      ${body}
      <div class="foot"><span>พิมพ์เมื่อ ${printedAt}</span><span>มก. วิทยาเขตกำแพงแสน</span></div>
    </body></html>`;
  };

  const handlePrintPlan = () => {
    const win = previewFrameRef.current?.contentWindow;
    if (!win) {
      toast({ title: "พิมพ์ไม่ได้", description: "กรุณาลองใหม่อีกครั้ง", variant: "destructive" });
      return;
    }
    win.focus();
    win.print();
  };

  const handleAddCourse = (courseCode: string, semester: number) => {
    addMutation.mutate({
      courseCode,
      yearLevel: selectedYear,
      semester
    });
  };

  const handleRemoveCourse = (id: string, isRequired: boolean) => {
    if (isRequired) return; // safeguard
    deleteMutation.mutate(id);
  };

  const renderSemesterBox = (semesterNum: number) => {
    const semCourses = courses.filter(c => c.yearLevel === selectedYear && c.semester === semesterNum);
    const totalCredits = semCourses.reduce((sum, c) => sum + c.credits, 0);

    // Search results for autocomplete
    const searchResults = addableCourses
      .filter((ac: any) => 
        ac.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ac.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .slice(0, 5);

    return (
      <Card className="flex flex-col border border-slate-200 h-full">
        {/* Header */}
        <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center rounded-t-xl">
          <h2 className="font-bold text-slate-900 flex items-center gap-2">
            <BookOpen size={18} className="text-primary" />
            ภาคเรียนที่ {semesterNum}
          </h2>
          <span className="text-sm font-semibold bg-white border border-slate-200 px-3 py-1 rounded-full text-slate-700">
            {totalCredits} หน่วยกิต
          </span>
        </div>

        {/* Course List */}
        <div className="p-4 flex-1 flex flex-col gap-3">
          {semCourses.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm py-8 border-2 border-dashed border-slate-100 rounded-lg">
              ไม่มีวิชาในภาคเรียนนี้
            </div>
          ) : (
            semCourses.map((course) => (
              <div
                key={course.id}
                className={`relative flex items-start justify-between p-3 rounded-lg border transition-colors ${
                  course.status === "completed"
                    ? "bg-green-50 border-green-200 hover:border-green-300"
                    : course.status === "failed"
                    ? "bg-red-50 border-red-200 hover:border-red-300"
                    : course.status === "in-progress"
                    ? "bg-blue-50 border-blue-200 hover:border-blue-300"
                    : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
                }`}
              >
                <div className="pr-8">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-sm font-bold text-slate-800">
                      {course.code}
                    </code>
                    {course.inCurriculum ? (
                      <>
                        <span className="text-[10px] bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                          <Lock size={10} /> ต้องเรียน
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                          {course.type === "required" ? "วิชาแกน" : course.type === "general" ? "ศึกษาทั่วไป" : "วิชาเลือก"}
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-medium">เลือกเสรี</span>
                    )}
                    {course.status === "completed" && (
                      <span className="text-[10px] bg-green-200 text-green-800 px-1.5 py-0.5 rounded font-medium">เรียนแล้ว</span>
                    )}
                    {course.status === "failed" && (
                      <span className="text-[10px] bg-red-200 text-red-800 px-1.5 py-0.5 rounded font-medium">ต้องเรียนซ้ำ</span>
                    )}
                    {course.status === "in-progress" && (
                      <span className="text-[10px] bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded font-medium">กำลังเรียน</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-700 leading-tight">
                    {course.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {course.credits} หน่วยกิต
                  </p>
                  {course.prerequisiteWarning && course.status === "planned" && (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-orange-700 bg-orange-100/50 border border-orange-200 px-2 py-1 rounded-md">
                      <span className="font-bold">⚠️ แจ้งเตือน:</span> {course.prerequisiteWarning}
                    </div>
                  )}
                </div>

                {!course.inCurriculum && (
                  <button
                    onClick={() => handleRemoveCourse(course.id, course.isRequired)}
                    className="absolute top-3 right-3 p-1.5 bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-md transition-colors border border-transparent hover:border-red-100"
                    disabled={deleteMutation.isPending}
                    title="ลบวิชานี้"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))
          )}

          {/* Add Course Section */}
          {addingToSemester === semesterNum ? (
            <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg relative">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-xs font-bold text-slate-700">เพิ่มวิชาเลือก / หมวดทั่วไป</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">วิชาบังคับถูกจัดให้ในแผนอัตโนมัติแล้ว ที่นี่เพิ่มได้เฉพาะวิชาเลือก/หมวดทั่วไป</p>
                </div>
                <button
                  onClick={() => { setAddingToSemester(null); setSearchQuery(""); }}
                  className="text-slate-400 hover:text-slate-700 shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
              <Input
                placeholder="พิมพ์ชื่อหรือรหัสวิชาเลือก..."
                className="bg-white border-slate-300 text-sm mb-2"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                autoFocus
              />
              
              {/* Autocomplete Dropdown */}
              {showDropdown && searchQuery && (
                <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                  {searchResults.length === 0 ? (
                    <div className="p-3 text-sm text-center text-slate-500">
                      ไม่พบในรายการวิชาเลือกที่เพิ่มได้
                      <span className="block text-[11px] text-slate-400 mt-1">วิชาบังคับ (เช่น 01418xxx ที่เป็นวิชาแกน) จะอยู่ในแผนอัตโนมัติตามชั้นปี · ดูวิชาทั้งหมดได้ที่เมนู “แคตตาล็อกวิชา”</span>
                    </div>
                  ) : (
                    searchResults.map((ac: any) => (
                      <div
                        key={ac.code}
                        onClick={() => {
                          setShowDropdown(false);
                          handleAddCourse(ac.code, semesterNum);
                        }}
                        className="px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                      >
                        <div className="flex justify-between items-start mb-0.5">
                          <code className="text-xs font-bold text-primary">{ac.code}</code>
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{ac.credits} นก.</span>
                        </div>
                        <p className="text-sm text-slate-700 line-clamp-1">{ac.name}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            <Button 
              variant="outline" 
              className="mt-2 w-full border-dashed border-2 text-slate-500 hover:text-primary hover:border-primary hover:bg-primary/5 transition-all text-sm h-10"
              onClick={() => {
                setAddingToSemester(semesterNum);
                setSearchQuery("");
              }}
            >
              <Plus size={16} className="mr-2" />
              เพิ่มวิชาเลือก
            </Button>
          )}
        </div>
      </Card>
    );
  };

  return (
    <Layout role="student">
      <div className="space-y-6" ref={printRef}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">แผนการเรียน (Course Planner)</h1>
            <p className="text-slate-500 text-sm mt-1">{curriculumName}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" className="flex items-center gap-2" onClick={() => setShowPreview(true)}>
              <Printer size={16} />
              พิมพ์แผน (PDF)
            </Button>
            <Button variant="outline" className="flex items-center gap-2" onClick={handleDownloadCsv}>
              <Download size={16} />
              CSV
            </Button>
          </div>
        </div>

        {/* Year Tabs */}
        <div className="flex border-b border-slate-200 overflow-x-auto scroolbar-hide">
          {visibleYears.map(year => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`px-6 py-3 font-bold text-sm whitespace-nowrap border-b-2 transition-colors ${
                selectedYear === year
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              ชั้นปีที่ {year}
            </button>
          ))}
        </div>

        {/* Semesters Grid */}
        <div className={showSem2 ? "grid grid-cols-1 md:grid-cols-2 gap-6 items-start" : "grid grid-cols-1 gap-6 items-start md:max-w-xl"}>
          {renderSemesterBox(1)}
          {showSem2 && renderSemesterBox(2)}
        </div>

        {/* Legend */}
        <div className="flex gap-4 items-center justify-center pt-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5"><Lock size={12} className="text-sky-600"/> ต้องเรียน — วิชาในหลักสูตร (ลบไม่ได้)</div>
          <div className="w-2 h-2 rounded-full bg-green-400"></div> เรียนผ่านแล้ว
          <div className="w-2 h-2 rounded-full bg-red-400"></div> ต้องเรียนซ้ำ
          <div className="w-2 h-2 rounded-full bg-blue-400"></div> กำลังเรียน
          <div className="w-2 h-2 rounded-full bg-slate-300"></div> ยังไม่ได้เรียน(วางแผน)
        </div>
      </div>

      {/* In-page print preview (no new browser window) */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/50 p-3 sm:p-6" onClick={() => setShowPreview(false)}>
          <div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="font-bold text-slate-900">ตัวอย่างแผนการเรียน</h3>
              <div className="flex items-center gap-2">
                <Button size="sm" className="gap-2 bg-primary hover:bg-primary-hover text-white" onClick={handlePrintPlan}>
                  <Printer size={15} /> พิมพ์ / บันทึก PDF
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowPreview(false)}>ปิด</Button>
              </div>
            </div>
            <iframe
              ref={previewFrameRef}
              title="แผนการเรียน"
              srcDoc={buildPlanReportHtml()}
              className="flex-1 w-full bg-white"
            />
          </div>
        </div>
      )}
    </Layout>
  );
}
