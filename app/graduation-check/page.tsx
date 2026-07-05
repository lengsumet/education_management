"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, Clock, BookOpen, Printer, Loader2, Ban, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface CurriculumRequirement {
  id: string;
  code: string;
  name: string;
  credits: number;
  type: string;
  status: "ผ่าน" | "กำลังเรียน" | "ต้องเรียนซ้ำ" | "ยังไม่ลงทะเบียน";
  grade?: string;
  year: number;
  semester: number;
}

export default function StudentGraduationCheck() {
  const { data: gradData, isLoading, isError } = useQuery({
    queryKey: ['graduationCheck'],
    queryFn: async () => {
      const res = await fetch("/api/graduation-check/student");
      if (!res.ok) throw new Error("Failed to fetch graduation data");
      return res.json();
    }
  });

  const requirements: CurriculumRequirement[] = gradData?.data?.requirements || [];
  const failed = requirements.filter((r) => r.grade === "F");

  const printRef = useRef<HTMLDivElement>(null);
  const previewFrameRef = useRef<HTMLIFrameElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  // Build a clean, real-text report (not a screenshot) as a standalone HTML
  // document. Shown in an in-page preview iframe; printing the iframe prints
  // only the report (no browser popup, no app chrome). Thai renders natively.
  const buildReportHtml = (): string => {
    const d = gradData?.data;
    if (!d) return "";
    const si = d.studentInfo || {};
    const reqs: CurriculumRequirement[] = d.requirements || [];
    const st = d.stats || {};
    const reqCredits = st.requiredCredits || st.totalCredits || 0;
    const eligible = d.isEligible;

    const esc = (x: unknown) =>
      String(x ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
    const statusColor = (s: string) =>
      s === "ผ่าน" ? "#059669" : s === "กำลังเรียน" ? "#2563eb" : s === "ต้องเรียนซ้ำ" ? "#ea580c" : "#dc2626";

    const groupsMap = new Map<string, { year: number; semester: number; items: CurriculumRequirement[] }>();
    reqs.forEach((r) => {
      const key = `${r.year}-${r.semester}`;
      if (!groupsMap.has(key)) groupsMap.set(key, { year: r.year, semester: r.semester, items: [] });
      groupsMap.get(key)!.items.push(r);
    });
    const groups = Array.from(groupsMap.values()).sort((a, b) => a.year - b.year || a.semester - b.semester);

    const rowsHtml = groups
      .map(
        (g) => `
        <tr class="grouphdr"><td colspan="6">ชั้นปีที่ ${g.year} / ภาคเรียนที่ ${g.semester}</td></tr>
        ${g.items
          .map(
            (r) => `<tr>
            <td>${esc(r.code)}</td>
            <td>${esc(r.name)}</td>
            <td class="c">${r.credits}</td>
            <td>${esc(r.type)}</td>
            <td style="color:${statusColor(r.status)};font-weight:600">${esc(r.status)}</td>
            <td class="c">${esc(r.grade || "-")}</td>
          </tr>`
          )
          .join("")}`
      )
      .join("");

    const printedAt = new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });

    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8">
      <title>รายงานตรวจสอบจบ - ${esc(si.code)}</title>
      <style>
        *{font-family:'Sarabun','Leelawadee UI','Tahoma','Noto Sans Thai',system-ui,sans-serif;box-sizing:border-box;}
        body{margin:0;padding:28px;color:#111827;font-size:13px;}
        h1{font-size:20px;margin:0 0 2px;}
        .sub{color:#6b7280;margin:0 0 14px;}
        .info{display:grid;grid-template-columns:1fr 1fr;gap:3px 32px;margin-bottom:14px;}
        .info span{color:#6b7280;}
        .summary{border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;margin-bottom:16px;background:#f9fafb;line-height:1.7;}
        table{width:100%;border-collapse:collapse;}
        th,td{border:1px solid #e5e7eb;padding:5px 8px;text-align:left;vertical-align:top;}
        th{background:#f3f4f6;}
        td.c{text-align:center;}
        .grouphdr td{background:#eef2ff;font-weight:bold;}
        .eligible{color:#059669;font-weight:bold;}
        .noteligible{color:#d97706;font-weight:bold;}
        .foot{margin-top:18px;color:#9ca3af;font-size:11px;display:flex;justify-content:space-between;}
        @media print{body{padding:0;}}
      </style></head><body>
      <h1>รายงานตรวจสอบสำเร็จการศึกษา</h1>
      <p class="sub">${esc(d.curriculumName || "")}</p>
      <div class="info">
        <div><span>ชื่อ-นามสกุล:</span> ${esc(si.name)}</div>
        <div><span>รหัสนิสิต:</span> ${esc(si.code)}</div>
        <div><span>คณะ:</span> ${esc(si.faculty)}</div>
        <div><span>สาขาวิชา:</span> ${esc(si.department)}</div>
      </div>
      <div class="summary">
        สถานะ: <span class="${eligible ? "eligible" : "noteligible"}">${eligible ? "ครบเงื่อนไขสำเร็จการศึกษา" : "ยังไม่ครบเงื่อนไขสำเร็จการศึกษา"}</span><br/>
        หน่วยกิตที่ผ่าน <b>${st.passedCredits}</b> / ${reqCredits} หน่วยกิต<br/>
        ผ่าน ${st.passed} วิชา · กำลังเรียน ${st.inProgress} วิชา · ต้องเรียนซ้ำ ${st.retake} วิชา · ยังไม่ลงทะเบียน ${st.remaining} วิชา
      </div>
      <table>
        <thead><tr><th>รหัสวิชา</th><th>ชื่อวิชา</th><th>นก.</th><th>ประเภท</th><th>สถานะ</th><th>เกรด</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="foot"><span>พิมพ์เมื่อ ${printedAt}</span><span>มก. วิทยาเขตกำแพงแสน</span></div>
    </body></html>`;

    return html;
  };

  const handlePrint = () => {
    const win = previewFrameRef.current?.contentWindow;
    if (!win) {
      toast({ title: "พิมพ์ไม่ได้", description: "กรุณาลองใหม่อีกครั้ง", variant: "destructive" });
      return;
    }
    win.focus();
    win.print();
  };

  // Fetch prerequisite impact for failed courses — must be before any early returns
  const [impactData, setImpactData] = useState<any[]>([]);
  useEffect(() => {
    if (failed.length === 0) {
      setImpactData([]);
      return;
    }
    const fetchImpact = async () => {
      const results = [];
      for (const f of failed) {
        try {
          const allPrereqs = await fetch(`/api/prerequisites`);
          const allData = await allPrereqs.json();
          if (allData.success) {
            const matchedPrereqs = allData.data.filter((p: any) => p.prerequisite.code === f.code);
            if (matchedPrereqs.length > 0) {
              results.push({
                failedCourse: f,
                blockedCourses: matchedPrereqs.map((p: any) => p.course),
              });
            }
          }
        } catch (e) {
          console.error('Impact fetch error:', e);
        }
      }
      setImpactData(results);
    };
    fetchImpact();
  }, [requirements.length]);

  if (isLoading) {
    return (
      <Layout role="student">
        <div className="flex flex-col items-center justify-center h-[50vh] text-slate-500">
          <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
          <p>กำลังโหลดข้อมูลหลักสูตร...</p>
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

  const stats = gradData?.data?.stats || { 
    passed: 0, 
    inProgress: 0, 
    retake: 0,
    remaining: 0, 
    totalCredits: 0, 
    passedCredits: 0, 
    inProgressCredits: 0,
    requiredCredits: 0
  };
  const curriculumName = gradData?.data?.curriculumName || "ตรวจสอบหลักสูตร";
  const isEligible = gradData?.data?.isEligible || false;

  const passed = requirements.filter((r) => r.status === "ผ่าน");
  const inProgress = requirements.filter((r) => r.status === "กำลังเรียน");
  const retake = requirements.filter((r) => r.status === "ต้องเรียนซ้ำ");
  const remaining = requirements.filter((r) => r.status === "ยังไม่ลงทะเบียน");
  
  // Single source of truth for the graduation credit requirement, so the
  // banner, progress bar and stat card all show the same number.
  const requiredCredits = stats.requiredCredits || stats.totalCredits;
  const progressPercent = requiredCredits > 0
    ? Math.min(100, Math.round((stats.passedCredits / requiredCredits) * 100))
    : 0;

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "ผ่าน": return { icon: CheckCircle, color: "bg-green-100 text-green-700", iconColor: "text-green-600" };
      case "กำลังเรียน": return { icon: Clock, color: "bg-blue-100 text-blue-700", iconColor: "text-blue-600" };
      case "ต้องเรียนซ้ำ": return { icon: AlertCircle, color: "bg-orange-100 text-orange-700", iconColor: "text-orange-500" };
      case "ยังไม่ลงทะเบียน": return { icon: AlertCircle, color: "bg-red-100 text-red-700", iconColor: "text-red-500" };
      default: return { icon: AlertCircle, color: "bg-slate-100 text-slate-700", iconColor: "text-slate-500" };
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "วิชาบังคับ": return "bg-blue-100 text-blue-700";
      case "วิชาเลือก": return "bg-purple-100 text-purple-700";
      case "วิชาศึกษาทั่วไป": return "bg-green-100 text-green-700";
      case "วิชาเสรี": return "bg-orange-100 text-orange-700";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  // Extract unique years from the requirements
  const availableYears = [...new Set(requirements.map(r => r.year))].sort();

  return (
    <Layout role="student">
      <div className="space-y-6" ref={printRef}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">ตรวจสอบจบ</h1>
            <p className="text-slate-600 mt-1">
              ตรวจสอบรายวิชาที่ยังติดค้างหรือขาดเรียน เพื่อวางแผนให้จบหลักสูตร ({curriculumName})
            </p>
          </div>
          <Button variant="outline" className="flex items-center gap-2" onClick={() => setShowPreview(true)}>
            <Printer size={16} />
            ดูตัวอย่าง / พิมพ์รายงาน
          </Button>
        </div>

        {/* Eligibility Banner */}
        <Card className={`p-4 border-2 ${isEligible ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"}`}>
          <div className="flex items-center gap-3">
            {isEligible ? (
              <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
            ) : (
              <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
            )}
            <div>
              <p className={`font-bold ${isEligible ? "text-green-900" : "text-amber-900"}`}>
                {isEligible ? "มีสิทธิ์สำเร็จการศึกษา" : "ยังไม่ครบเงื่อนไขสำเร็จการศึกษา"}
              </p>
              <p className="text-sm text-slate-600">
                หน่วยกิตที่ผ่าน {stats.passedCredits} / {stats.requiredCredits || stats.totalCredits} หน่วยกิต
                {stats.retake > 0 && ` • ต้องเรียนซ้ำ ${stats.retake} วิชา`}
                {stats.remaining > 0 && ` • ยังไม่ลง ${stats.remaining} วิชา`}
                {stats.inProgress > 0 && ` • กำลังเรียน ${stats.inProgress} วิชา`}
              </p>
            </div>
          </div>
        </Card>

        {/* Overall Progress */}
        <Card className="p-6 border border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-4">ความก้าวหน้าในหลักสูตร</h2>
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-slate-600">
                หน่วยกิตที่ผ่าน: <span className="font-bold text-slate-900">{stats.passedCredits}</span> / {requiredCredits}
              </span>
              <span className="text-sm font-bold text-primary">{progressPercent}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-4">
              <div
                className="bg-primary h-4 rounded-full transition-all relative"
                style={{ width: `${progressPercent}%` }}
              >
                {stats.inProgressCredits > 0 && (
                  <div
                    className="absolute right-0 top-0 h-4 bg-blue-300 rounded-r-full"
                    style={{ width: `${(stats.inProgressCredits / requiredCredits) * 100 / (progressPercent / 100 || 1)}%`, maxWidth: '100%' }}
                  />
                )}
              </div>
            </div>
            <div className="flex items-center gap-6 mt-2 text-xs text-slate-600">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-primary" /> ผ่านแล้ว ({stats.passedCredits} หน่วยกิต)</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-300" /> กำลังเรียน ({stats.inProgressCredits} หน่วยกิต)</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-200" /> ยังไม่ลง ({Math.max(0, requiredCredits - stats.passedCredits - stats.inProgressCredits)} หน่วยกิต)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
              <CheckCircle className="mx-auto mb-1 text-green-600" size={24} />
              <p className="text-2xl font-bold text-green-700">{stats.passed}</p>
              <p className="text-xs text-green-600">วิชาที่ผ่าน</p>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
              <Clock className="mx-auto mb-1 text-blue-600" size={24} />
              <p className="text-2xl font-bold text-blue-700">{stats.inProgress}</p>
              <p className="text-xs text-blue-600">กำลังเรียน</p>
            </div>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
              <AlertCircle className="mx-auto mb-1 text-red-500" size={24} />
              <p className="text-2xl font-bold text-red-600">{stats.remaining}</p>
              <p className="text-xs text-red-500">ยังไม่ลงทะเบียน</p>
            </div>
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-center">
              <BookOpen className="mx-auto mb-1 text-purple-600" size={24} />
              <p className="text-2xl font-bold text-purple-700">{requiredCredits}</p>
              <p className="text-xs text-purple-600">หน่วยกิตที่ต้องการ</p>
            </div>
          </div>
        </Card>

        {/* Failed Courses Impact Analysis */}
        {impactData.length > 0 && (
          <Card className="p-6 border-2 border-orange-300 bg-orange-50">
            <h2 className="text-lg font-bold text-orange-800 mb-2 flex items-center gap-2">
              <Ban size={20} className="text-orange-600" />
              ผลกระทบจากวิชาที่ไม่ผ่าน (Reverse Dependency)
            </h2>
            <p className="text-sm text-orange-700 mb-4">
              วิชาที่ได้เกรด F ทำให้ไม่สามารถลงทะเบียนวิชาต่อไปนี้ได้ จนกว่าจะเรียนผ่าน
            </p>
            <div className="space-y-4">
              {impactData.map((impact, idx) => (
                <div key={idx} className="bg-white rounded-lg border border-orange-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded">F</span>
                    <code className="text-sm font-mono font-bold text-red-600">{impact.failedCourse.code}</code>
                    <span className="text-sm font-medium text-slate-900">{impact.failedCourse.name}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-4 mb-2">
                    <ArrowRight size={14} className="text-orange-500" />
                    <span className="text-xs text-orange-700 font-medium">วิชาที่ถูกบล็อค:</span>
                  </div>
                  <div className="space-y-1 ml-8">
                    {impact.blockedCourses.map((blocked: any) => (
                      <div key={blocked.id} className="flex items-center gap-2 p-2 bg-orange-50 rounded border border-orange-100">
                        <Ban size={14} className="text-orange-500" />
                        <code className="text-xs font-mono font-bold text-slate-700">{blocked.code}</code>
                        <span className="text-xs text-slate-600">{blocked.name}</span>
                        <span className="text-xs text-slate-500 ml-auto">{blocked.credits} หน่วยกิต</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Remaining Highlight */}
        {remaining.length > 0 && (
          <Card className="p-6 border border-red-200 bg-red-50">
            <h2 className="text-lg font-bold text-red-800 mb-2">
              ⚠️ วิชาที่ยังขาด ({remaining.length} วิชา)
            </h2>
            <p className="text-sm text-red-700 mb-4">
              รายวิชาที่ยังไม่ได้ลงทะเบียนและจำเป็นต้องเรียนเพื่อจบหลักสูตร
            </p>
            <div className="space-y-2">
              {remaining.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-200">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="text-red-500" />
                    <code className="text-sm font-mono font-bold text-primary">{r.code}</code>
                    <span className="text-sm text-slate-900">{r.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${getTypeColor(r.type)}`}>{r.type}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-700">{r.credits} หน่วยกิต</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Year by Year Breakdown */}
        {availableYears.map((year) => {
          const yearCourses = requirements.filter((r) => r.year === year);
          if (yearCourses.length === 0) return null;
          return (
            <Card key={year} className="p-6 border border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 mb-4">
                ปีที่ {year}
                <span className="text-sm text-slate-500 ml-2 font-normal">
                  ({yearCourses.filter((r) => r.status === "ผ่าน").length}/{yearCourses.length} วิชาผ่าน)
                </span>
              </h2>
              <div className="space-y-2">
                {yearCourses.map((course) => {
                  const statusInfo = getStatusInfo(course.status);
                  const StatusIcon = statusInfo.icon;
                  return (
                    <div
                      key={course.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        course.status === "ผ่าน"
                          ? "bg-green-50 border-green-200"
                          : course.status === "กำลังเรียน"
                          ? "bg-blue-50 border-blue-200"
                          : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <StatusIcon size={18} className={statusInfo.iconColor} />
                        <div>
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono font-bold text-primary">{course.code}</code>
                            <span className="text-sm font-medium text-slate-900">{course.name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${getTypeColor(course.type)}`}>
                              {course.type}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            ภาคเรียนที่ {course.semester} • {course.credits} หน่วยกิต
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-1 rounded font-medium ${statusInfo.color}`}>
                          {course.status}
                        </span>
                        {course.grade && (
                          <p className="text-sm font-bold text-green-600 mt-1">{course.grade}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
        
        {requirements.length === 0 && (
          <div className="text-center py-12 text-slate-500 border rounded-lg bg-slate-50 border-slate-200">
            <BookOpen className="mx-auto mb-3 text-slate-400" size={40} />
            <p className="font-bold text-lg mb-1">ไม่พบข้อมูลหลักสูตรของคุณ</p>
            <p className="text-sm">โปรดติดต่อฝ่ายวิชาการเพื่ออัปเดตข้อมูลหลักสูตรในระบบ</p>
          </div>
        )}
      </div>

      {/* In-page report preview (no new browser window). Printing the iframe
          prints only the report. */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/50 p-3 sm:p-6" onClick={() => setShowPreview(false)}>
          <div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="font-bold text-slate-900">ตัวอย่างรายงานตรวจสอบจบ</h3>
              <div className="flex items-center gap-2">
                <Button size="sm" className="gap-2 bg-primary hover:bg-primary-hover text-white" onClick={handlePrint}>
                  <Printer size={15} /> พิมพ์ / บันทึก PDF
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowPreview(false)}>ปิด</Button>
              </div>
            </div>
            <iframe
              ref={previewFrameRef}
              title="รายงานตรวจสอบจบ"
              srcDoc={buildReportHtml()}
              className="flex-1 w-full bg-white"
            />
          </div>
        </div>
      )}
    </Layout>
  );
}
