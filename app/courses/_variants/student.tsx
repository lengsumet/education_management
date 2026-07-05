"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { BarChart3, Clock, BookOpen, MessageSquare, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface Announcement {
  id: string;
  title: string;
  date: string;
  content: string;
}

interface StudentCourse {
  id: string;
  code: string;
  name: string;
  instructor: string;
  grade: string;
  progress: number;
  status: "active" | "completed";
  announcement: number;
  schedule: string;
  announcements: Announcement[];
}

export default function StudentCourses() {
  const [selectedCourse, setSelectedCourse] = useState<StudentCourse | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "announcements">("details");

  const { data: coursesResponse, isLoading, isError } = useQuery({
    queryKey: ['studentCoursesList'],
    queryFn: async () => {
      const res = await fetch("/api/courses/student");
      if (!res.ok) throw new Error("Failed to fetch courses");
      return res.json();
    }
  });

  const courses: StudentCourse[] = coursesResponse?.data?.courses || [];
  const stats = coursesResponse?.data?.stats || { total: 0, active: 0, completed: 0, gpa: "0.00" };

  if (isLoading) {
    return (
      <Layout role="student">
        <div className="flex flex-col items-center justify-center h-[50vh] text-slate-500">
          <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
          <p>กำลังโหลดรายการวิชาเรียน...</p>
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
          <h1 className="text-3xl font-bold text-slate-900">วิชาของฉัน</h1>
          <p className="text-slate-600 mt-1">
            ดูและจัดการวิชาที่ลงทะเบียนทั้งหมด
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: BookOpen,
              label: "วิชาเรียนทั้งหมด",
              value: String(stats.total),
              color: "bg-blue-100 text-blue-600",
            },
            {
              icon: Clock,
              label: "กำลังเรียน",
              value: String(stats.active),
              color: "bg-yellow-100 text-yellow-600",
            },
            {
              icon: BookOpen,
              label: "เรียนจบแล้ว",
              value: String(stats.completed),
              color: "bg-green-100 text-green-600",
            },
            {
              icon: BarChart3,
              label: "เกรดเฉลี่ย",
              value: String(stats.gpa),
              color: "bg-purple-100 text-purple-600",
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="p-4 border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg ${stat.color}`}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">{stat.label}</p>
                    <p className="text-xl font-bold text-slate-900">
                      {stat.value}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Active Courses */}
        <Card className="p-6 border border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            วิชาที่กำลังเรียน
          </h2>
          <div className="space-y-4">
            {courses
              .filter((c) => c.status === "active")
              .map((course) => (
                <div
                  key={course.id}
                  className="p-4 border border-slate-200 rounded-lg hover:border-primary transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-sm font-mono font-bold text-primary">
                          {course.code}
                        </code>
                        {course.announcement > 0 && (
                          <div className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-medium">
                            <MessageSquare size={14} />
                            {course.announcement}
                          </div>
                        )}
                      </div>
                      <h3 className="font-bold text-slate-900">
                        {course.name}
                      </h3>
                      <p className="text-sm text-slate-600 mt-1">
                        {course.instructor}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">
                        {course.grade}
                      </p>
                      <p className="text-xs text-slate-500">{course.schedule}</p>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-slate-600">ความก้าวหน้า</span>
                      <span className="text-xs font-medium text-slate-900">
                        {course.progress}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setSelectedCourse(course)}
                    >
                      ดูรายละเอียด
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </Card>

        {/* Completed Courses */}
        <Card className="p-6 border border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            วิชาที่เรียนจบแล้ว
          </h2>
          <div className="space-y-3">
            {courses
              .filter((c) => c.status === "completed")
              .map((course) => {
                const failed = course.grade === "F";
                return (
                <div
                  key={course.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${failed ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sm font-mono font-bold text-primary">
                        {course.code}
                      </code>
                      <span className={`text-xs px-2 py-1 rounded font-medium ${failed ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                        {failed ? "ต้องเรียนซ้ำ" : "เรียนจบแล้ว"}
                      </span>
                    </div>
                    <h3 className="font-medium text-slate-900">
                      {course.name}
                    </h3>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${failed ? "text-red-600" : "text-green-600"}`}>
                      {course.grade}
                    </p>
                  </div>
                </div>
                );
              })}
          </div>
        </Card>

        {/* Course Details Modal */}
        <Dialog open={!!selectedCourse} onOpenChange={() => {
          setSelectedCourse(null);
          setActiveTab("details");
        }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">
                {selectedCourse?.name}
              </DialogTitle>
              <DialogClose />
            </DialogHeader>
            {selectedCourse && (
              <div className="space-y-6">
                {/* Tabs */}
                <div className="flex gap-2 border-b border-slate-200">
                  <button
                    onClick={() => setActiveTab("details")}
                    className={`px-4 py-2 font-medium transition-colors ${
                      activeTab === "details"
                        ? "text-primary border-b-2 border-primary"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    รายละเอียดวิชา
                  </button>
                  <button
                    onClick={() => setActiveTab("announcements")}
                    className={`px-4 py-2 font-medium transition-colors ${
                      activeTab === "announcements"
                        ? "text-primary border-b-2 border-primary"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    ประกาศ ({selectedCourse.announcement})
                  </button>
                </div>

                {/* Details Tab */}
                {activeTab === "details" && (
                  <div className="space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-600">รหัสวิชา</p>
                        <p className="text-lg font-bold text-primary">
                          {selectedCourse.code}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">อาจารย์ผู้สอน</p>
                        <p className="text-lg font-medium text-slate-900">
                          {selectedCourse.instructor}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">เกรด</p>
                        <p className="text-lg font-bold text-primary">
                          {selectedCourse.grade}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">เวลาเรียน</p>
                        <p className="text-lg font-medium text-slate-900">
                          {selectedCourse.schedule}
                        </p>
                      </div>
                    </div>

                    {/* Progress */}
                    <div>
                      <div className="flex justify-between mb-2">
                        <p className="text-sm font-medium text-slate-900">
                          ความก้าวหน้า
                        </p>
                        <p className="text-sm font-bold text-slate-900">
                          {selectedCourse.progress}%
                        </p>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-3">
                        <div
                          className="bg-primary h-3 rounded-full transition-all"
                          style={{ width: `${selectedCourse.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Status */}
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-600">สถานะ</p>
                      <p
                        className={`text-sm font-bold mt-1 ${
                          selectedCourse.status === "completed" || (selectedCourse.grade && selectedCourse.grade !== "-")
                            ? "text-green-600"
                            : "text-blue-600"
                        }`}
                      >
                        {selectedCourse.status === "completed" || (selectedCourse.grade && selectedCourse.grade !== "-")
                          ? "เรียนเสร็จแล้ว"
                          : "กำลังเรียน"}
                      </p>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-2 pt-4 border-t border-slate-200">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setActiveTab("announcements")}
                      >
                        ดูรายการประกาศ
                      </Button>
                    </div>
                  </div>
                )}

                {/* Announcements Tab */}
                {activeTab === "announcements" && (
                  <div className="space-y-3">
                    {selectedCourse.announcements.length > 0 ? (
                      selectedCourse.announcements.map((announcement) => (
                        <div
                          key={announcement.id}
                          className="p-4 border border-slate-200 rounded-lg hover:border-primary transition-colors"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-bold text-slate-900">
                              {announcement.title}
                            </h3>
                            <span className="text-xs text-slate-500 whitespace-nowrap ml-2">
                              {announcement.date}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700">
                            {announcement.content}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-slate-600">
                        ไม่มีประกาศในวิชานี้
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
