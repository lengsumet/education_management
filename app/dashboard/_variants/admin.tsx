"use client";
export const dynamic = "force-dynamic";

import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, BookOpen, Upload, Loader2 } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

interface DashboardData {
  stats: {
    id: string;
    label: string;
    value: string;
    color: string;
  }[];
}

export default function AdminDashboard() {
  const { data: dashboardResponse, isLoading, isError, error } = useQuery({
    queryKey: ['adminDashboard'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/admin');
      if (!res.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      return res.json();
    }
  });

  if (isLoading) {
    return (
      <Layout role="admin">
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (isError) {
    return (
      <Layout role="admin">
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <p className="text-red-500 font-medium mb-2">ไม่สามารถโหลดข้อมูลแดชบอร์ดได้</p>
          <p className="text-slate-500 text-sm">{error instanceof Error ? error.message : "เกิดข้อผิดพลาดบางอย่าง"}</p>
        </div>
      </Layout>
    );
  }

  const data: DashboardData = dashboardResponse?.data;

  const getIcon = (id: string) => {
    switch (id) {
      case "total-users": return Users;
      case "total-courses": return BookOpen;
      case "active-students": return Users;
      default: return Users;
    }
  };

  return (
    <Layout role="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">แดชบอร์ดผู้ดูแลระบบ</h1>
          <p className="text-slate-600 mt-1">ภาพรวมระบบและเครื่องมือจัดการ</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.stats.map((stat) => {
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6 border border-slate-200">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">จัดการข้อมูล</h2>
                <p className="text-sm text-slate-600 mt-1">นำเข้าและจัดการข้อมูลระบบ</p>
              </div>
              <Upload className="text-primary" size={24} />
            </div>
            <div className="space-y-2">
              <Link href="/import">
                <Button className="w-full justify-start" variant="outline">นำเข้าข้อมูล (CSV)</Button>
              </Link>
              <Link href="/announcements">
                <Button className="w-full justify-start" variant="outline">จัดการประกาศ</Button>
              </Link>
              <Link href="/registration">
                <Button className="w-full justify-start" variant="outline">อนุมัติการลงทะเบียน</Button>
              </Link>
            </div>
          </Card>

          <Card className="p-6 border border-slate-200">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">จัดการผู้ใช้</h2>
                <p className="text-sm text-slate-600 mt-1">จัดการผู้ใช้และสิทธิ์การใช้งาน</p>
              </div>
              <Users className="text-primary" size={24} />
            </div>
            <div className="space-y-2">
              <Link href="/users">
                <Button className="w-full justify-start" variant="outline">ดูผู้ใช้</Button>
              </Link>
              <Link href="/users">
                <Button className="w-full justify-start" variant="outline">เพิ่มผู้ใช้</Button>
              </Link>
            </div>
          </Card>

          <Card className="p-6 border border-slate-200">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">วิชา</h2>
                <p className="text-sm text-slate-600 mt-1">จัดการวิชาและหลักสูตร</p>
              </div>
              <BookOpen className="text-primary" size={24} />
            </div>
            <div className="space-y-2">
              <Link href="/courses">
                <Button className="w-full justify-start" variant="outline">ดูวิชา</Button>
              </Link>
              <Link href="/courses">
                <Button className="w-full justify-start" variant="outline">สร้างวิชา</Button>
              </Link>
              <Link href="/curriculum">
                <Button className="w-full justify-start" variant="outline">จัดการหลักสูตร</Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
