"use client";
export const dynamic = "force-dynamic";

import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, Clock, Loader2, BookPlus, ChevronRight, Printer } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { AppSelect } from "@/components/ui/app-select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

interface RegistrationItem {
  id: string;
  code: string;
  name: string;
  englishName?: string;
  courseType?: string;
  sectionNumber?: string;
  semester?: string;
  credits: number;
  status: "approved" | "pending" | "rejected";
  registrationDate: string;
  reason?: string;
}

export default function StudentRegistration() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedSemester, setSelectedSemester] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: regData, isLoading, isError } = useQuery({
    queryKey: ['studentRegistration'],
    queryFn: async () => {
      const res = await fetch("/api/registration/student");
      if (!res.ok) throw new Error("Failed to fetch registration data");
      return res.json();
    }
  });

  const enrollMutation = useMutation({
    mutationFn: async (enrollments: { courseId: string }[]) => {
      const res = await fetch("/api/registration/student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollments }),
      });
      if (!res.ok) throw new Error("Failed to enroll");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.errors && data.errors.length > 0) {
        toast({
          title: "มีบางรายการผิดพลาด",
          description: `ลงทะเบียนส่วนใหญ่สำเร็จ แต่มีบางรายการผิดพลาด: ${data.errors.join(", ")}`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "สำเร็จ",
          description: "ทำรายการเสร็จสมบูรณ์! สถานะ: รอพิจารณาอนุมัติ",
          className: "bg-green-50 text-green-900 border-green-200"
        });
      }
      queryClient.invalidateQueries({ queryKey: ["studentRegistration"] });
    },
    onError: () => {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "เกิดข้อผิดพลาดในการทำรายการ โปรดลองอีกครั้ง",
        variant: "destructive"
      });
    }
  });

  const allPlannedCourses = regData?.data?.plannedCourses || [];
  const allRegistrations: RegistrationItem[] = regData?.data?.registrations || [];
  const registrationSemesters = allRegistrations.map((r) => r.semester).filter(Boolean) as string[];
  const plannedCourseSemesters = allPlannedCourses.map((c: any) => c.semester) as string[];
  const allSemesters = [...new Set([...plannedCourseSemesters, ...registrationSemesters])]
    .filter(Boolean)
    .sort((a: any, b: any) => {
      const [termA, yearA] = a.split('/');
      const [termB, yearB] = b.split('/');
      if (yearA !== yearB) return parseInt(yearA) - parseInt(yearB);
      return parseInt(termA) - parseInt(termB);
    }) as string[];

  useEffect(() => {
    if (!selectedSemester && allSemesters.length > 0) {
      setSelectedSemester(allSemesters[0]);
    }
  }, [allSemesters, selectedSemester]);

  if (isLoading) {
    return (
      <Layout role="student">
        <div className="flex flex-col items-center justify-center h-[50vh] text-slate-500">
          <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
          <p>กำลังโหลดข้อมูลการลงทะเบียน...</p>
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

  const plannedCourses = allPlannedCourses.filter((c: any) => c.semester === selectedSemester);

  // Filter registrations by selected semester
  const filteredRegistrations = allRegistrations.filter((r) => r.semester === selectedSemester);
  const approved = filteredRegistrations.filter((r) => r.status === "approved");
  const pending = filteredRegistrations.filter((r) => r.status === "pending");
  const totalApprovedCredits = approved.reduce((sum, r) => sum + r.credits, 0);

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "approved":
        return {
          icon: CheckCircle,
          label: "อนุมัติแล้ว",
          color: "bg-green-100 text-green-700",
          bgColor: "bg-green-50",
          borderColor: "border-green-200",
        };
      case "pending":
        return {
          icon: Clock,
          label: "อยู่ระหว่างการตรวจสอบ",
          color: "bg-yellow-100 text-yellow-700",
          bgColor: "bg-yellow-50",
          borderColor: "border-yellow-200",
        };
      case "rejected":
        return {
          icon: AlertCircle,
          label: "ไม่อนุมัติ",
          color: "bg-red-100 text-red-700",
          bgColor: "bg-red-50",
          borderColor: "border-red-200",
        };
      default:
        return {
          icon: AlertCircle,
          label: "ไม่ทราบ",
          color: "bg-gray-100 text-gray-700",
          bgColor: "bg-gray-50",
          borderColor: "border-gray-200",
        };
    }
  };

  const groupedBySemester = (regData?.data?.registrations || []).reduce((acc: any, reg: any) => {
    const sem = reg.semester || "ไม่ระบุภาคเรียน";
    if (!acc[sem]) acc[sem] = [];
    acc[sem].push(reg);
    return acc;
  }, {});

  const studentInfo = regData?.data?.studentInfo || {};

  return (
    <Layout role="student">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start print:hidden">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              ตรวจสอบการลงทะเบียน
            </h1>
            <p className="text-slate-600 mt-1">
              ตรวจสอบสถานะการลงทะเบียนวิชา และรายละเอียดการอนุมัติ
            </p>
          </div>
        </div>

        {/* Semester Selector */}
        <div className="flex items-center gap-3 print:hidden">
          <span className="text-sm font-medium text-slate-700">เลือกภาคเรียน:</span>
          <AppSelect
            value={selectedSemester || ""}
            onValueChange={(v) => setSelectedSemester(v)}
            className="text-sm font-medium w-auto min-w-[16rem] shrink-0"
            options={allSemesters.map((sem) => {
              const [term, yearStr] = sem.split('/');
              const year = parseInt(yearStr);
              let label = `ภาคเรียน ${sem}`;
              if (studentInfo.admissionYear && !isNaN(year)) {
                 const yearLevel = year - studentInfo.admissionYear + 1;
                 if (yearLevel > 0) {
                    label = `ชั้นปีที่ ${yearLevel} เทอม ${term} (ปีการศึกษา ${year})`;
                 }
              }
              return { value: sem, label };
            })}
          />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:hidden">
          <Card className="p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <CheckCircle className="text-green-600" size={32} />
              <div>
                <p className="text-xs text-slate-600">อนุมัติแล้ว</p>
                <p className="text-2xl font-bold text-slate-900">
                  {approved.length} วิชา
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <Clock className="text-yellow-600" size={32} />
              <div>
                <p className="text-xs text-slate-600">อยู่ระหว่างตรวจสอบ</p>
                <p className="text-2xl font-bold text-slate-900">
                  {pending.length} วิชา
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <span className="text-2xl font-bold text-blue-600">
                  {totalApprovedCredits}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-600">รวมหน่วยกิตที่อนุมัติ</p>
                <p className="text-sm text-slate-500">สูงสุด 20 หน่วยกิต</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Plan Listing & Registration */}
        {allPlannedCourses.length > 0 && (
          <Card className="p-6 border border-blue-200 bg-blue-50/30 print:hidden">
            <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <BookPlus className="text-blue-600" size={20} />
                  แผนการเรียนที่รอลงทะเบียน ({plannedCourses.length} วิชา)
                </h2>

              </div>
              <Button
                onClick={() => {
                  if (plannedCourses.length === 0) {
                    toast({
                      title: "คำเตือน",
                      description: "ไม่มีวิชาในแผนให้ลงทะเบียน",
                      variant: "destructive"
                    });
                    return;
                  }
                  setConfirmOpen(true);
                }}
                disabled={enrollMutation.isPending || plannedCourses.length === 0}
                className="bg-primary hover:bg-primary-hover text-white"
              >
                {enrollMutation.isPending ? "กำลังดำเนินการ..." : "ยืนยันการลงทะเบียนเรียน"}
              </Button>

              <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>ยืนยันการลงทะเบียนเรียน</AlertDialogTitle>
                    <AlertDialogDescription>
                      ส่งคำขอลงทะเบียน {plannedCourses.length} วิชา รวม{" "}
                      {plannedCourses.reduce((s: number, c: any) => s + c.credits, 0)} หน่วยกิต
                      {selectedSemester ? ` · ภาคเรียน ${selectedSemester}` : ""} — สถานะจะเป็น “รอพิจารณาอนุมัติ”
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <div className="max-h-56 overflow-y-auto space-y-2 my-1">
                    {plannedCourses.map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between gap-3 text-sm border border-slate-200 rounded-md px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <code className="font-mono font-bold text-primary shrink-0">{c.code}</code>
                          <span className="text-slate-700 truncate">{c.name}</span>
                        </div>
                        <span className="text-slate-500 shrink-0">{c.credits} นก.</span>
                      </div>
                    ))}
                  </div>

                  <AlertDialogFooter>
                    <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        const enrollPayload = plannedCourses.map((c: any) => ({
                          courseId: c.courseId.toString(),
                          semester: selectedSemester
                        }));
                        enrollMutation.mutate(enrollPayload);
                      }}
                      className="bg-primary hover:bg-primary-hover"
                    >
                      ยืนยันลงทะเบียน
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="space-y-3">
              {plannedCourses.map((course: any) => (
                <div key={course.id} className="p-4 rounded-lg border border-slate-200 bg-white">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-sm font-mono font-bold text-primary">{course.code}</code>
                        {course.isCompulsory && (
                          <span className="text-xs px-2 py-1 rounded font-medium bg-red-100 text-red-700">วิชาบังคับ</span>
                        )}
                        <span className="text-xs px-2 py-1 rounded font-medium bg-slate-100 text-slate-700">แผนเทอม {course.semester}</span>
                      </div>
                      <h3 className="font-medium text-slate-900">{course.name}</h3>
                      <p className="text-xs text-slate-500 font-bold mt-1 text-primary">{course.credits} หน่วยกิต</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Approved Registrations */}
        <Card className="p-6 border border-slate-200 print:hidden">
          <h2 className="text-lg font-bold text-slate-900 mb-4 print:text-black print:border-b print:pb-2">
            วิชาที่อนุมัติแล้ว ({approved.length})
          </h2>
          <div className="space-y-3 print:space-y-1">
            {approved.length === 0 ? (
              <p className="text-slate-500 text-center py-8">
                ไม่มีวิชาที่อนุมัติ
              </p>
            ) : (
              approved.map((reg) => {
                const statusInfo = getStatusInfo(reg.status);
                return (
                  <div
                    key={reg.id}
                    className={`p-4 rounded-lg border-2 ${statusInfo.bgColor} ${statusInfo.borderColor} print:bg-white print:border-b print:border-x-0 print:border-t-0 print:border-gray-300 print:rounded-none print:p-2`}
                  >
                    <div className="flex items-start justify-between mb-2 print:mb-0">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 print:mb-0">
                          <code className="text-sm font-mono font-bold text-primary print:text-black">
                            {reg.code}
                          </code>
                          <span
                            className={`text-xs px-2 py-1 rounded font-medium ${statusInfo.color} print:hidden`}
                          >
                            {statusInfo.label}
                          </span>
                        </div>
                        <h3 className="font-medium text-slate-900">
                          {reg.name}
                        </h3>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">
                          {reg.credits} หน่วยกิต
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {reg.registrationDate}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Pending Registrations */}
        {pending.length > 0 && (
          <Card className="p-6 border border-slate-200 print:hidden">
            <h2 className="text-lg font-bold text-slate-900 mb-4 print:text-black print:border-b print:pb-2">
              อยู่ระหว่างการตรวจสอบ ({pending.length})
            </h2>
            <div className="space-y-3 print:space-y-1">
              {pending.map((reg) => {
                const statusInfo = getStatusInfo(reg.status);
                return (
                  <div
                    key={reg.id}
                    className={`p-4 rounded-lg border-2 ${statusInfo.bgColor} ${statusInfo.borderColor} print:bg-white print:border-b print:border-x-0 print:border-t-0 print:border-gray-300 print:rounded-none print:p-2`}
                  >
                    <div className="flex items-start justify-between mb-2 print:mb-0">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 print:mb-0">
                          <code className="text-sm font-mono font-bold text-primary print:text-black">
                            {reg.code}
                          </code>
                          <span
                            className={`text-xs px-2 py-1 rounded font-medium ${statusInfo.color} print:hidden`}
                          >
                            {statusInfo.label}
                          </span>
                        </div>
                        <h3 className="font-medium text-slate-900">
                          {reg.name}
                        </h3>
                        {reg.reason && (
                          <p className="text-sm text-slate-700 mt-1">
                            หมายเหตุ: {reg.reason}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">
                          {reg.credits} หน่วยกิต
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {reg.registrationDate}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
              }
            </div>
          </Card>
        )}

      </div>
    </Layout>
  );
}
