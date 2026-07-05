"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/app-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Users, Calendar, Clock, CheckCircle, Send, BookOpen, Loader2, ChevronRight, ArrowLeft } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface StudentCourse {
  code: string;
  name: string;
  day: string;
  time: string;
}

interface StudentInfo {
  id: string;
  studentId: string;
  name: string;
  courses: StudentCourse[];
}

interface TeacherSection {
  sectionId: number;
  courseCode: string;
  courseName: string;
  sectionNumber: string;
  studentsTotal: number;
  students: StudentInfo[];
}

interface MakeupRequest {
  id: string;
  sectionId: number;
  courseCode: string;
  courseName: string;
  reason: string;
  originalDate: string;
  status: "ส่งนัดแล้ว";
  selectedDate?: string;
  selectedTime?: string;
  studentsTotal: number;
}

// 3 steps: 1) เลือกวิชา  2) ยืนยันข้อมูล  3) เลือกวันเวลา
type Step = "select-course" | "confirm-info" | "pick-date";

export default function TeacherMakeupClass() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Wizard state
  const [step, setStep] = useState<Step>("select-course");
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [reason, setReason] = useState("วันหยุดราชการ (ติดภารกิจ)");

  // Date picker state
  const [originalDate, setOriginalDate] = useState("");
  const [makeupDate, setMakeupDate] = useState("");
  const [makeupTime, setMakeupTime] = useState("");

  // Student expansion
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

  const { data: makeupResponse, isLoading, isError, error } = useQuery({
    queryKey: ["teacherMakeupClass"],
    queryFn: async () => {
      const res = await fetch("/api/makeup-class/teacher");
      if (!res.ok) throw new Error("Failed to fetch makeup class data");
      return res.json();
    },
  });

  const sendMakeupMutation = useMutation({
    mutationFn: async (payload: { sectionId: number; originalDate: string; makeupDate: string; startTime: string; endTime: string; reason: string }) => {
      const res = await fetch("/api/makeup-class/teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to send makeup request");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacherMakeupClass"] });
      setOriginalDate("");
      setMakeupDate("");
      setMakeupTime("");
      setStep("select-course");
      setSelectedSectionId(null);
      setReason("วันหยุดราชการ (ติดภารกิจ)");
      toast({
        title: "✅ ส่งนัดสอนชดเชยสำเร็จ",
        description: "ระบบส่งแจ้งเตือนให้นิสิตทุกคนแล้ว",
        className: "bg-green-50 text-green-900 border-green-200",
      });
    },
    onError: () => {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถส่งนัดสอนชดเชยได้ กรุณาลองใหม่",
        variant: "destructive",
      });
    },
  });

  const sections: TeacherSection[] = makeupResponse?.data?.sections || [];
  const existingRequests: MakeupRequest[] = makeupResponse?.data?.requests || [];

  const selectedSection = sections.find((s) => s.sectionId === selectedSectionId);
  // Students are now scoped to the selected section (only those who registered this course).
  const students: StudentInfo[] = selectedSection?.students || [];

  const handleSendMakeup = () => {
    if (!makeupDate || !makeupTime || !selectedSectionId) return;

    const timeParts = makeupTime.split(" ");
    let startTime = "08:00";
    let endTime = "10:50";
    if (timeParts.length >= 3) {
      startTime = timeParts[0];
      endTime = timeParts[2];
    }

    sendMakeupMutation.mutate({
      sectionId: selectedSectionId,
      originalDate,
      makeupDate,
      startTime,
      endTime,
      reason,
    });
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
          <p className="text-red-500 font-medium mb-2">ไม่สามารถโหลดข้อมูลได้</p>
          <p className="text-slate-500 text-sm">{error instanceof Error ? error.message : "ระบบขัดข้อง"}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout role="teacher">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">นัดสอนชดเชย</h1>
          <p className="text-slate-600 mt-1">
            เลือกวิชา → ยืนยันข้อมูล → เลือกวันเวลาชดเชย
          </p>
        </div>

        {/* Step Indicator */}
        <Card className="p-4 border border-slate-200">
          <div className="flex items-center justify-center gap-2 text-sm">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-medium ${step === "select-course" ? "bg-primary text-white" : "bg-green-100 text-green-700"}`}>
              {step !== "select-course" ? <CheckCircle size={16} /> : <span className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center text-xs">1</span>}
              เลือกวิชา
            </div>
            <ChevronRight size={16} className="text-slate-400" />
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-medium ${step === "confirm-info" ? "bg-primary text-white" : step === "pick-date" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
              {step === "pick-date" ? <CheckCircle size={16} /> : <span className={`w-5 h-5 rounded-full ${step === "confirm-info" ? "bg-white/30" : "bg-slate-200"} flex items-center justify-center text-xs`}>2</span>}
              ยืนยันข้อมูล
            </div>
            <ChevronRight size={16} className="text-slate-400" />
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-medium ${step === "pick-date" ? "bg-primary text-white" : "bg-slate-100 text-slate-500"}`}>
              <span className={`w-5 h-5 rounded-full ${step === "pick-date" ? "bg-white/30" : "bg-slate-200"} flex items-center justify-center text-xs`}>3</span>
              เลือกวันเวลา
            </div>
          </div>
        </Card>

        {/* ========== Step 1: Select Course ========== */}
        {step === "select-course" && (
          <Card className="p-6 border border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-2">เลือกวิชาที่ต้องการสอนชดเชย</h2>
            <p className="text-sm text-slate-600 mb-4">เลือกวิชาจากรายการ Section ที่คุณสอนอยู่</p>

            {sections.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <BookOpen size={40} className="mx-auto mb-3 text-slate-300" />
                <p>ยังไม่มีวิชาที่สอนในระบบ</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sections.map((sec) => (
                  <div
                    key={sec.sectionId}
                    onClick={() => {
                      setSelectedSectionId(sec.sectionId);
                      setStep("confirm-info");
                    }}
                    className="p-4 border border-slate-200 rounded-lg cursor-pointer hover:border-primary hover:bg-green-50 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-sm font-mono font-bold text-primary">{sec.courseCode}</code>
                        <span className="font-bold text-slate-900">{sec.courseName}</span>
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">หมู่ {sec.sectionNumber}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Users size={14} />
                        <span>{sec.studentsTotal} นิสิต</span>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-slate-400" />
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* ========== Step 2: Confirm Info ========== */}
        {step === "confirm-info" && selectedSection && (
          <>
            <Card className="p-6 border border-primary bg-green-50">
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => { setStep("select-course"); setSelectedSectionId(null); }} className="p-1.5 rounded hover:bg-white/60 transition-colors">
                  <ArrowLeft size={18} className="text-slate-600" />
                </button>
                <h2 className="text-lg font-bold text-slate-900">ยืนยันข้อมูลก่อนนัดสอนชดเชย</h2>
              </div>

              <div className="space-y-4">
                {/* Selected course info */}
                <div className="p-4 bg-white rounded-lg border border-slate-200">
                  <p className="text-sm text-slate-600 mb-1">วิชาที่เลือก</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono font-bold text-primary">{selectedSection.courseCode}</code>
                    <span className="font-bold text-slate-900">{selectedSection.courseName}</span>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">หมู่ {selectedSection.sectionNumber}</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{selectedSection.studentsTotal} นิสิตในเซกชัน</p>
                </div>

                {/* Reason input */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">เหตุผลการสอนชดเชย</label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="เช่น วันหยุดราชการ, ติดภารกิจ, ป่วย"
                    className="border border-slate-300 bg-white"
                  />
                </div>

                <Button
                  onClick={() => setStep("pick-date")}
                  disabled={!reason.trim()}
                  className="flex items-center gap-2"
                >
                  <CheckCircle size={16} />
                  ยืนยัน — ไปเลือกวันเวลา
                </Button>
              </div>
            </Card>

            {/* Student List */}
            <Card className="p-6 border border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 mb-2">
                ตารางเรียนของนิสิต — {selectedSection.courseName}
              </h2>
              <p className="text-sm text-slate-600 mb-4">
                ดึงจากระบบลงทะเบียนโดยตรง • คลิกที่ชื่อนิสิตเพื่อดูตารางเรียนทั้งหมด
              </p>

              <div className="space-y-2">
                {students.map((student) => (
                  <div key={student.id}>
                    <div
                      onClick={() => setSelectedStudent(selectedStudent === student.id ? null : student.id)}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedStudent === student.id
                          ? "border-primary bg-green-50"
                          : "border-slate-200 hover:border-slate-300 bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{student.name}</p>
                          <p className="text-xs text-slate-500 font-mono">{student.studentId}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{student.courses.length} วิชา</span>
                        <BookOpen size={16} className="text-slate-400" />
                      </div>
                    </div>

                    {selectedStudent === student.id && (
                      <div className="ml-11 mt-2 mb-3 space-y-1">
                        {student.courses.map((course, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-3 p-2 bg-white border border-slate-200 rounded-lg text-sm"
                          >
                            <span className="min-w-[70px] font-bold text-primary text-xs">{course.day}</span>
                            <span className="text-xs text-slate-500 min-w-[100px]">{course.time}</span>
                            <code className="text-xs font-mono text-slate-700">{course.code}</code>
                            <span className="text-xs text-slate-900">{course.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {/* ========== Step 3: Pick Date ========== */}
        {step === "pick-date" && selectedSection && (
          <>
            <Card className="p-6 border border-primary bg-green-50">
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setStep("confirm-info")} className="p-1.5 rounded hover:bg-white/60 transition-colors">
                  <ArrowLeft size={18} className="text-slate-600" />
                </button>
                <h2 className="text-lg font-bold text-slate-900">
                  📅 กำหนดวันนัดสอนชดเชย — {selectedSection.courseName}
                </h2>
              </div>

              {/* Summary of confirmed info */}
              <div className="p-3 bg-white rounded-lg border border-slate-200 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-slate-600">วิชา: </span>
                    <code className="font-mono font-bold text-primary">{selectedSection.courseCode}</code>
                    <span className="font-bold text-slate-900 ml-1">{selectedSection.courseName}</span>
                  </div>
                  <span className="text-slate-500">{selectedSection.studentsTotal} นิสิต</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">เหตุผล: {reason}</p>
              </div>

              <p className="text-sm text-slate-600 mb-4">
                เลือกวันกับเวลาแล้วระบบจะส่งแจ้งเตือนให้นิสิตทุกคนในวิชานี้
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">วันเดิมที่งดสอน (ไม่บังคับ)</label>
                  <DatePicker value={originalDate} onChange={setOriginalDate} placeholder="เลือกวันเดิม" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">วันที่นัดชดเชย</label>
                  <DatePicker value={makeupDate} onChange={setMakeupDate} placeholder="เลือกวันนัดชดเชย" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ช่วงเวลา</label>
                  <AppSelect
                    value={makeupTime}
                    onValueChange={setMakeupTime}
                    placeholder="เลือกเวลา..."
                    options={[
                      { value: "08:00 - 10:50", label: "08:00 - 10:50" },
                      { value: "09:00 - 11:50", label: "09:00 - 11:50" },
                      { value: "13:00 - 15:50", label: "13:00 - 15:50" },
                      { value: "15:00 - 17:50", label: "15:00 - 17:50" },
                      { value: "17:00 - 19:50", label: "17:00 - 19:50" },
                    ]}
                  />
                </div>
              </div>
              <Button
                onClick={handleSendMakeup}
                disabled={!makeupDate || !makeupTime || sendMakeupMutation.isPending}
                className="flex items-center gap-2"
              >
                {sendMakeupMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send size={16} />}
                ส่งนัดให้นิสิตทั้ง {selectedSection.studentsTotal} คน
              </Button>
            </Card>

            {/* Student schedules for reference */}
            <Card className="p-6 border border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 mb-2">
                ตารางเรียนของนิสิต (อ้างอิง)
              </h2>
              <p className="text-sm text-slate-600 mb-4">
                ดึงจากระบบลงทะเบียนโดยตรง • คลิกที่ชื่อนิสิตเพื่อดูตารางเรียนทั้งหมด
              </p>
              <div className="space-y-2">
                {students.map((student) => (
                  <div key={student.id}>
                    <div
                      onClick={() => setSelectedStudent(selectedStudent === student.id ? null : student.id)}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedStudent === student.id
                          ? "border-primary bg-green-50"
                          : "border-slate-200 hover:border-slate-300 bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{student.name}</p>
                          <p className="text-xs text-slate-500 font-mono">{student.studentId}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{student.courses.length} วิชา</span>
                        <BookOpen size={16} className="text-slate-400" />
                      </div>
                    </div>

                    {selectedStudent === student.id && (
                      <div className="ml-11 mt-2 mb-3 space-y-1">
                        {student.courses.map((course, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-3 p-2 bg-white border border-slate-200 rounded-lg text-sm"
                          >
                            <span className="min-w-[70px] font-bold text-primary text-xs">{course.day}</span>
                            <span className="text-xs text-slate-500 min-w-[100px]">{course.time}</span>
                            <code className="text-xs font-mono text-slate-700">{course.code}</code>
                            <span className="text-xs text-slate-900">{course.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {/* ========== Existing Makeup Requests (History) ========== */}
        {existingRequests.length > 0 && (
          <Card className="p-6 border border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-4">ประวัติรายการสอนชดเชย</h2>
            <div className="space-y-3">
              {existingRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-4 border border-green-200 bg-green-50 rounded-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-sm font-mono font-bold text-primary">{req.courseCode}</code>
                        <span className="font-bold text-slate-900">{req.courseName}</span>
                        <span className="text-xs px-2 py-1 rounded font-medium bg-green-100 text-green-700">
                          {req.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">เหตุผล: {req.reason}</p>
                      <p className="text-xs text-slate-500 mt-1">วันเดิม: {req.originalDate}</p>
                      {req.selectedDate && (
                        <p className="text-xs text-green-600 font-medium mt-1">
                          📅 นัดชดเชย: {req.selectedDate} ({req.selectedTime})
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm">
                        <Users size={16} className="text-slate-500" />
                        <span className="font-bold text-slate-700">{req.studentsTotal}</span>
                      </div>
                      <p className="text-xs text-slate-500">นิสิต</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}
