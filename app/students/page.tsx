"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Download, Save, Loader2, CheckCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AppSelect } from "@/components/ui/app-select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Student {
  id: string;
  studentId: string;
  name: string;
  email: string;
  course: string;
  grade: string;
  attendance: number | null;
  assignment: number | null;
  midterm: number | null;
  final: number | null;
}

interface EditedRow {
  grade?: string;
  attendance?: number;
  assignment?: number;
  midterm?: number;
  final?: number;
}

const GRADE_OPTIONS = ["A", "B+", "B", "C+", "C", "D+", "D", "F", "W", "I"];

export default function TeacherStudentList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [editedRows, setEditedRows] = useState<Record<string, EditedRow>>({});
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);

  const { data: studentsResponse, isLoading, isError, error } = useQuery({
    queryKey: ['teacherStudents'],
    queryFn: async () => {
      const res = await fetch('/api/students/teacher');
      if (!res.ok) throw new Error('Failed to fetch students data');
      return res.json();
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (grades: any[]) => {
      const res = await fetch('/api/students/teacher', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grades })
      });
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "สำเร็จ",
        description: data.message || "บันทึกเรียบร้อย",
        className: "bg-green-50 text-green-900 border-green-200"
      });
      setEditedRows({});
      queryClient.invalidateQueries({ queryKey: ['teacherStudents'] });
    },
    onError: () => {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "เกิดข้อผิดพลาดในการบันทึก",
        variant: "destructive"
      });
    }
  });

  const students: Student[] = studentsResponse?.data?.students || [];
  const courses: { code: string; name: string }[] = studentsResponse?.data?.courses || [];

  useEffect(() => {
    if (courses.length > 0 && !selectedCourse) {
      setSelectedCourse(courses[0].code);
    }
  }, [courses, selectedCourse]);

  const calculateGrade = (att: number, asg: number, mid: number, fin: number): string => {
    const total = att + asg + mid + fin; // นำคะแนนดิบมาบวกกันตรงๆ (คะแนนเต็มควรจะอยู่ที่ 100)
    if (total >= 80) return "A";
    if (total >= 75) return "B+";
    if (total >= 70) return "B";
    if (total >= 65) return "C+";
    if (total >= 60) return "C";
    if (total >= 55) return "D+";
    if (total >= 50) return "D";
    return "F";
  };

  const handleFieldChange = (enrollmentId: string, field: keyof EditedRow, value: string | number) => {
    setEditedRows(prev => {
      const current = prev[enrollmentId] || {};
      const updated = { ...current, [field]: value };

      // Auto-grade เมื่อกรอกคะแนนครบ 4 ช่อง
      if (field === "attendance" || field === "assignment" || field === "midterm" || field === "final") {
        const student = students.find(s => s.id === enrollmentId);
        if (student) {
          const att = (field === "attendance" ? Number(value) : updated.attendance) ?? student.attendance;
          const asg = (field === "assignment" ? Number(value) : updated.assignment) ?? student.assignment;
          const mid = (field === "midterm" ? Number(value) : updated.midterm) ?? student.midterm;
          const fin = (field === "final" ? Number(value) : updated.final) ?? student.final;

          // คำนวณเมื่อ กรอกครบทุกช่องและมีค่ามากกว่า 0
          if (att && att > 0 && asg && asg > 0 && mid && mid > 0 && fin && fin > 0) {
            updated.grade = calculateGrade(att, asg, mid, fin);
          }
        }
      }

      return { ...prev, [enrollmentId]: updated };
    });
  };

  const handleSave = () => {
    const grades = Object.entries(editedRows).map(([enrollmentId, data]) => ({
      enrollmentId,
      ...data
    }));
    if (grades.length === 0) {
      toast({
        title: "คำเตือน",
        description: "ยังไม่มีข้อมูลที่เปลี่ยนแปลง",
        variant: "destructive"
      });
      return;
    }
    setConfirmSaveOpen(true);
  };

  const doSaveGrades = () => {
    const grades = Object.entries(editedRows).map(([enrollmentId, data]) => ({
      enrollmentId,
      ...data
    }));
    saveMutation.mutate(grades);
    setConfirmSaveOpen(false);
  };

  const getGradeColor = (grade: string) => {
    if (!grade || grade === "-") return "text-slate-400";
    if (grade === "A") return "text-green-600";
    if (grade.startsWith("B")) return "text-blue-600";
    if (grade.startsWith("C")) return "text-yellow-600";
    if (grade.startsWith("D")) return "text-orange-600";
    if (grade === "F") return "text-red-600";
    return "text-slate-600";
  };

  const getGradeBg = (grade: string) => {
    if (grade === "A") return "bg-green-50 border-green-300";
    if (grade.startsWith("B")) return "bg-blue-50 border-blue-300";
    if (grade.startsWith("C")) return "bg-yellow-50 border-yellow-300";
    if (grade.startsWith("D")) return "bg-orange-50 border-orange-300";
    if (grade === "F") return "bg-red-50 border-red-300";
    return "bg-slate-50 border-slate-300";
  };

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
          <p className="text-red-500 font-medium mb-2">ไม่สามารถโหลดข้อมูลรายชื่อนิสิตได้</p>
          <p className="text-slate-500 text-sm">{error instanceof Error ? error.message : "ระบบขัดข้อง"}</p>
        </div>
      </Layout>
    );
  }

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.studentId.includes(searchTerm.toLowerCase()) ||
      student.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCourse = student.course === selectedCourse;
    return matchesSearch && matchesCourse;
  });

  const handleExport = () => {
    if (filteredStudents.length === 0) {
      toast({ title: "ไม่มีข้อมูล", description: "ไม่มีข้อมูลสำหรับส่งออก", variant: "destructive" });
      return;
    }
    const headers = ["รหัสนิสิต", "ชื่อ-นามสกุล", "อีเมล", "เข้าเรียน", "งาน", "กลางภาค", "ปลายภาค", "เกรด"];
    const csvContent = [
      headers.join(","),
      ...filteredStudents.map(s => {
        const edited = editedRows[s.id] || {};
        const att = edited.attendance ?? s.attendance ?? "-";
        const asg = edited.assignment ?? s.assignment ?? "-";
        const mid = edited.midterm ?? s.midterm ?? "-";
        const fin = edited.final ?? s.final ?? "-";
        const grade = edited.grade ?? s.grade ?? "-";
        return `${s.studentId},"${s.name}",${s.email},${att},${asg},${mid},${fin},${grade}`;
      })
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `students_${selectedCourse}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const editCount = Object.keys(editedRows).length;

  return (
    <Layout role="teacher">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">รายชื่อนิสิต & ให้เกรด</h1>
            <p className="text-slate-600 mt-1">กรอกคะแนนครบทุกช่อง → เกรดจะคำนวณอัตโนมัติ</p>
          </div>
          <div className="flex gap-2">
            {editCount > 0 && (
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
              >
                {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                บันทึก ({editCount})
              </Button>
            )}
            <Button variant="outline" className="flex items-center gap-2" onClick={handleExport}>
              <Download size={16} />
              ส่งออก
            </Button>
          </div>
        </div>

        {/* Course Selection */}
        <Card className="p-4 border border-slate-200">
          <label className="block text-sm font-medium text-slate-700 mb-2">เลือกวิชา</label>
          <div className="flex flex-wrap gap-2">
            {courses.length > 0 ? courses.map((course) => (
              <button
                key={course.code}
                onClick={() => setSelectedCourse(course.code)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedCourse === course.code
                    ? "bg-primary text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {course.code} - {course.name}
              </button>
            )) : <div className="text-sm text-slate-500 py-1">ยังไม่มีวิชา</div>}
          </div>
        </Card>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 text-slate-400" size={20} />
          <Input
            placeholder="ค้นหาด้วยรหัสนิสิต หรือ ชื่อ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 border border-slate-300"
          />
        </div>

        {/* Edited badge */}
        {editCount > 0 && (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
            <CheckCircle size={16} />
            <span>มีข้อมูลที่เปลี่ยนแปลง {editCount} รายการ — อย่าลืมกด <strong>"บันทึก"</strong></span>
          </div>
        )}

        {/* Students Table */}
        <Card className="border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <h2 className="text-lg font-bold text-slate-900">นิสิต ({filteredStudents.length})</h2>
          </div>

          {filteredStudents.length === 0 ? (
            <p className="text-slate-500 text-center py-12">ไม่พบข้อมูลนิสิต</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">รหัสนิสิต</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">ชื่อ-นามสกุล</th>
                    <th className="text-center py-3 px-2 font-semibold text-slate-700 w-20">เข้าเรียน</th>
                    <th className="text-center py-3 px-2 font-semibold text-slate-700 w-20">งาน</th>
                    <th className="text-center py-3 px-2 font-semibold text-slate-700 w-20">กลางภาค</th>
                    <th className="text-center py-3 px-2 font-semibold text-slate-700 w-20">ปลายภาค</th>
                    <th className="text-center py-3 px-2 font-semibold text-slate-700 w-24">เกรด</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => {
                    const edited = editedRows[student.id] || {};
                    const currentGrade = edited.grade ?? student.grade;
                    const currentAtt = edited.attendance ?? student.attendance;
                    const currentAsg = edited.assignment ?? student.assignment;
                    const currentMid = edited.midterm ?? student.midterm;
                    const currentFin = edited.final ?? student.final;
                    const isEdited = !!editedRows[student.id];

                    return (
                      <tr
                        key={student.id}
                        className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${isEdited ? "bg-amber-50/30" : ""}`}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-primary">{student.studentId}</td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-slate-900">{student.name}</span>
                        </td>
                        <td className="py-2 px-2">
                          <input type="number" min={0} max={100} placeholder="-"
                            value={currentAtt ? currentAtt : ""}
                            onChange={(e) => handleFieldChange(student.id, "attendance", e.target.value === "" ? null as any : parseInt(e.target.value))}
                            className={`w-full text-center text-sm font-medium px-1 py-1.5 rounded-lg border outline-none focus:ring-2 focus:ring-primary ${isEdited && edited.attendance !== undefined ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white"}`}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input type="number" min={0} max={100} placeholder="-"
                            value={currentAsg ? currentAsg : ""}
                            onChange={(e) => handleFieldChange(student.id, "assignment", e.target.value === "" ? null as any : parseInt(e.target.value))}
                            className={`w-full text-center text-sm font-medium px-1 py-1.5 rounded-lg border outline-none focus:ring-2 focus:ring-primary ${isEdited && edited.assignment !== undefined ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white"}`}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input type="number" min={0} max={100} placeholder="-"
                            value={currentMid ? currentMid : ""}
                            onChange={(e) => handleFieldChange(student.id, "midterm", e.target.value === "" ? null as any : parseInt(e.target.value))}
                            className={`w-full text-center text-sm font-medium px-1 py-1.5 rounded-lg border outline-none focus:ring-2 focus:ring-primary ${isEdited && edited.midterm !== undefined ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white"}`}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input type="number" min={0} max={100} placeholder="-"
                            value={currentFin ? currentFin : ""}
                            onChange={(e) => handleFieldChange(student.id, "final", e.target.value === "" ? null as any : parseInt(e.target.value))}
                            className={`w-full text-center text-sm font-medium px-1 py-1.5 rounded-lg border outline-none focus:ring-2 focus:ring-primary ${isEdited && edited.final !== undefined ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white"}`}
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <AppSelect
                            value={(currentGrade === "-" || currentGrade === "Waiting") ? "" : currentGrade}
                            onValueChange={(v) => handleFieldChange(student.id, "grade", v)}
                            placeholder="-- เลือก --"
                            className={`w-full text-center font-bold text-sm ${
                              (currentGrade === "-" || currentGrade === "Waiting") || currentGrade === ""
                                ? "bg-slate-100 border-slate-300 text-slate-400"
                                : `${getGradeBg(currentGrade)} ${getGradeColor(currentGrade)}`
                            } ${isEdited && edited.grade !== undefined ? "ring-2 ring-amber-400" : ""}`}
                            options={GRADE_OPTIONS.map(g => ({ value: g, label: g }))}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4 border border-slate-200">
            <p className="text-sm text-slate-600">เกรด A</p>
            <p className="text-2xl font-bold text-green-600">
              {filteredStudents.filter(s => (editedRows[s.id]?.grade ?? s.grade) === "A").length}
            </p>
          </Card>
          <Card className="p-4 border border-slate-200">
            <p className="text-sm text-slate-600">เกรด B+/B</p>
            <p className="text-2xl font-bold text-blue-600">
              {filteredStudents.filter(s => (editedRows[s.id]?.grade ?? s.grade).startsWith("B")).length}
            </p>
          </Card>
          <Card className="p-4 border border-slate-200">
            <p className="text-sm text-slate-600">เกรด C+/C</p>
            <p className="text-2xl font-bold text-yellow-600">
              {filteredStudents.filter(s => (editedRows[s.id]?.grade ?? s.grade).startsWith("C")).length}
            </p>
          </Card>
          <Card className="p-4 border border-slate-200">
            <p className="text-sm text-slate-600">รอให้เกรด</p>
            <p className="text-2xl font-bold text-slate-400">
              {filteredStudents.filter(s => {
                const g = editedRows[s.id]?.grade ?? s.grade;
                return g === "-" || g === "Waiting" || !g;
              }).length}
            </p>
          </Card>
        </div>

        <ConfirmDialog
          open={confirmSaveOpen}
          onOpenChange={setConfirmSaveOpen}
          title="บันทึกคะแนน/เกรด"
          description={`ยืนยันบันทึกข้อมูล ${Object.keys(editedRows).length} รายการ?`}
          confirmLabel="บันทึก"
          loading={saveMutation.isPending}
          onConfirm={doSaveGrades}
        />
      </div>
    </Layout>
  );
}
