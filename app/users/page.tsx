"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Edit2, Trash2, Download, Loader2, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AppSelect } from "@/components/ui/app-select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: "student" | "teacher" | "admin";
  status: "active" | "inactive";
  approvalStatus: "pending" | "approved" | "rejected";
  joinDate: string;
}

export default function AdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("ทั้งหมด");
  const [pendingDeleteUser, setPendingDeleteUser] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [newUser, setNewUser] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "student"
  });

  const { data: usersResponse, isLoading, isError, error } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      const res = await fetch('/api/users/admin');
      if (!res.ok) throw new Error('Failed to fetch users data');
      return res.json();
    }
  });

  const addUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const res = await fetch('/api/users/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      if (!res.ok) throw new Error('Failed to create user');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setShowAddModal(false);
      setNewUser({ firstName: "", lastName: "", email: "", password: "", role: "student" });
      toast({
        title: "สำเร็จ",
        description: "เพิ่มผู้ใช้สำเร็จ!",
      });
    },
    onError: (error) => {
      console.error(error);
      toast({
        title: "ข้อผิดพลาด",
        description: "เกิดข้อผิดพลาดในการเพิ่มผู้ใช้",
        variant: "destructive",
      });
    }
  });

  const handleAddUser = () => {
    if (!newUser.firstName || !newUser.lastName || !newUser.email || !newUser.password) {
      toast({
        title: "ข้อมูลไม่ครบ",
        description: "กรุณากรอกข้อมูลให้ครบถ้วน รวมถึงรหัสผ่าน",
        variant: "destructive",
      });
      return;
    }
    addUserMutation.mutate({
      ...newUser,
      passwordHash: newUser.password // passing password to API as passwordHash for backend
    });
  };

  const editUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const res = await fetch('/api/users/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      if (!res.ok) throw new Error('Failed to update user');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setEditingUser(null);
      toast({ title: "สำเร็จ", description: "อัปเดตข้อมูลผู้ใช้สำเร็จ" });
    },
    onError: (error) => {
      console.error(error);
      toast({ title: "ข้อผิดพลาด", description: "เกิดข้อผิดพลาดในการอัปเดตผู้ใช้", variant: "destructive" });
    }
  });

  const approvalMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approve" | "reject" }) => {
      const res = await fetch('/api/users/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) throw new Error('Failed to update approval');
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      toast({
        title: "สำเร็จ",
        description: variables.action === "approve" ? "อนุมัติบัญชีแล้ว" : "ปฏิเสธบัญชีแล้ว",
      });
    },
    onError: () => {
      toast({ title: "ข้อผิดพลาด", description: "ดำเนินการไม่สำเร็จ", variant: "destructive" });
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/admin?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete user');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      toast({ title: "สำเร็จ", description: "ลบผู้ใช้สำเร็จ" });
    },
    onError: (error) => {
      console.error(error);
      toast({ title: "ข้อผิดพลาด", description: "เกิดข้อผิดพลาดในการลบผู้ใช้", variant: "destructive" });
    }
  });

  const handleEditUser = () => {
    if (!editingUser.firstName || !editingUser.lastName || !editingUser.email) {
      toast({ title: "ข้อมูลไม่ครบ", description: "กรุณากรอกข้อมูลให้ครบถ้วน", variant: "destructive" });
      return;
    }
    editUserMutation.mutate(editingUser);
  };

  const handleDeleteUser = (id: string) => {
    setPendingDeleteUser(id);
  };

  const handleExportCSV = () => {
    if (!filteredUsers || filteredUsers.length === 0) {
      toast({ title: "ไม่มีข้อมูล", description: "ไม่มีข้อมูลผู้ใช้ให้ส่งออก", variant: "destructive" });
      return;
    }
    
    // Create CSV content ensuring UTF-8 with BOM
    const headers = ["ชื่อผู้ใช้", "ชื่อเต็ม", "อีเมล", "บทบาท", "สถานะ", "วันเข้างาน"];
    const rows = filteredUsers.map(u => [
      u.username,
      u.fullName,
      u.email,
      u.role,
      u.status,
      u.joinDate
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ผู้ใช้ในระบบ.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "สำเร็จ", description: "ส่งออกไฟล์ข้อมูลสำเร็จ" });
  };

  const users: User[] = usersResponse?.data || [];

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.fullName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === "ทั้งหมด" || user.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "student":
        return "นิสิต";
      case "teacher":
        return "อาจารย์";
      case "admin":
        return "ผู้ดูแล";
      default:
        return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "student":
        return "bg-blue-100 text-blue-700";
      case "teacher":
        return "bg-green-100 text-green-700";
      case "admin":
        return "bg-purple-100 text-purple-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

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
          <p className="text-red-500 font-medium mb-2">ไม่สามารถโหลดข้อมูลผู้ใช้ได้</p>
          <p className="text-slate-500 text-sm">{error instanceof Error ? error.message : "ระบบขัดข้อง"}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">จัดการผู้ใช้</h1>
            <p className="text-slate-600 mt-1">ดูและจัดการบัญชีผู้ใช้ทั้งหมด</p>
          </div>
          <Button className="flex items-center gap-2" onClick={() => setShowAddModal(true)}>
            <Plus size={16} />
            เพิ่มผู้ใช้
          </Button>
        </div>

        {/* Pending Approval Queue */}
        {(() => {
          const pendingUsers = users.filter((u) => u.approvalStatus === "pending");
          if (pendingUsers.length === 0) return null;
          return (
            <Card className="p-6 border-2 border-amber-300 bg-amber-50">
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold">
                  {pendingUsers.length}
                </span>
                <h2 className="text-lg font-bold text-amber-900">บัญชีรอการอนุมัติ</h2>
              </div>
              <div className="space-y-2">
                {pendingUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white rounded-lg border border-amber-200"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {u.fullName}{" "}
                        <span className="text-xs font-normal text-slate-500">({getRoleLabel(u.role)})</span>
                      </p>
                      <p className="text-sm text-slate-500">
                        {u.email} • <span className="font-mono">{u.username}</span> • สมัคร {u.joinDate}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => approvalMutation.mutate({ id: u.id, action: "approve" })}
                        disabled={approvalMutation.isPending}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        อนุมัติ
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => approvalMutation.mutate({ id: u.id, action: "reject" })}
                        disabled={approvalMutation.isPending}
                        className="border-red-300 text-red-600 hover:bg-red-50"
                      >
                        ปฏิเสธ
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })()}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 border border-slate-200">
            <p className="text-sm text-slate-600">ผู้ใช้ทั้งหมด</p>
            <p className="text-2xl font-bold text-slate-900">{users.length}</p>
          </Card>
          <Card className="p-4 border border-slate-200">
            <p className="text-sm text-slate-600">นิสิต</p>
            <p className="text-2xl font-bold text-blue-600">
              {users.filter((u) => u.role === "student").length}
            </p>
          </Card>
          <Card className="p-4 border border-slate-200">
            <p className="text-sm text-slate-600">อาจารย์</p>
            <p className="text-2xl font-bold text-green-600">
              {users.filter((u) => u.role === "teacher").length}
            </p>
          </Card>
          <Card className="p-4 border border-slate-200">
            <p className="text-sm text-slate-600">ใช้งาน</p>
            <p className="text-2xl font-bold text-slate-900">
              {users.filter((u) => u.status === "active").length}
            </p>
          </Card>
        </div>

        {/* Search and Filter */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={20} />
            <Input
              placeholder="ค้นหาด้วยชื่อผู้ใช้ อีเมล หรือชื่อ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border border-slate-300"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {["ทั้งหมด", "student", "teacher", "admin"].map((role) => (
              <button
                key={role}
                onClick={() =>
                  setSelectedRole(
                    role === "student"
                      ? "student"
                      : role === "teacher"
                      ? "teacher"
                      : role === "admin"
                      ? "admin"
                      : "ทั้งหมด"
                  )
                }
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedRole === role
                    ? "bg-primary text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {role === "student"
                  ? "นิสิต"
                  : role === "teacher"
                  ? "อาจารย์"
                  : role === "admin"
                  ? "ผู้ดูแล"
                  : "ทั้งหมด"}
              </button>
            ))}
          </div>
        </div>

        {/* Users Table */}
        <Card className="p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">
              ผู้ใช้ ({filteredUsers.length})
            </h2>
            <Button variant="outline" size="sm" className="flex items-center gap-2" onClick={handleExportCSV}>
              <Download size={16} />
              ส่งออก
            </Button>
          </div>

          {filteredUsers.length === 0 ? (
            <p className="text-slate-500 text-center py-8">ไม่พบข้อมูล</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">
                      ชื่อผู้ใช้
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">
                      ชื่อเต็ม
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">
                      อีเมล
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-900">
                      บทบาท
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-900">
                      สถานะ
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">
                      วันเข้างาน
                    </th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-900">
                      ดำเนินการ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-slate-200 hover:bg-slate-50"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-primary">
                        {user.username}
                      </td>
                      <td className="py-3 px-4">{user.fullName}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {user.email}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-xs px-2 py-1 rounded font-medium ${getRoleColor(
                            user.role
                          )}`}
                        >
                          {getRoleLabel(user.role)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-xs px-2 py-1 rounded font-medium ${
                            user.status === "active"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {user.status === "active" ? "ใช้งาน" : "ปิด"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {user.joinDate}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => {
                              // We split fullName to prefill firstName and lastName
                              const parts = user.fullName.split(" ");
                              setEditingUser({
                                id: user.id,
                                firstName: parts[0] || "",
                                lastName: parts.slice(1).join(" ") || "",
                                email: user.email,
                                role: user.role,
                                isActive: user.status === "active"
                              });
                            }}
                            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            <Edit2 size={16} className="text-slate-600" />
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} className="text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Add User Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">เพิ่มผู้ใช้ใหม่</h2>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อ</label>
                    <Input 
                      placeholder="สมชาย" 
                      value={newUser.firstName}
                      onChange={(e) => setNewUser({...newUser, firstName: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">นามสกุล</label>
                    <Input 
                      placeholder="ใจดี" 
                      value={newUser.lastName}
                      onChange={(e) => setNewUser({...newUser, lastName: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">อีเมล</label>
                    <Input 
                      type="email"
                      placeholder="somchai@ku.th" 
                      value={newUser.email}
                      onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">รหัสผ่าน</label>
                    <Input 
                      type="password"
                      placeholder="••••••••" 
                      value={newUser.password}
                      onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ประเภทบัญชี (Role)</label>
                  <AppSelect
                    value={newUser.role}
                    onValueChange={(v) => setNewUser({...newUser, role: v})}
                    className="w-full"
                    options={[
                      { value: "student", label: "นิสิต (Student)" },
                      { value: "teacher", label: "อาจารย์ (Teacher)" },
                      { value: "admin", label: "ผู้ดูแล (Admin)" },
                    ]}
                  />
                </div>
              </div>
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAddModal(false)}>
                  ยกเลิก
                </Button>
                <Button 
                  onClick={handleAddUser}
                  disabled={addUserMutation.isPending}
                  className="flex items-center gap-2"
                >
                  {addUserMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                  ยืนยันการเพิ่มผู้ใช้
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {editingUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">แก้ไขข้อมูลผู้ใช้</h2>
                <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อ</label>
                    <Input 
                      placeholder="สมชาย" 
                      value={editingUser.firstName}
                      onChange={(e) => setEditingUser({...editingUser, firstName: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">นามสกุล</label>
                    <Input 
                      placeholder="ใจดี" 
                      value={editingUser.lastName}
                      onChange={(e) => setEditingUser({...editingUser, lastName: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">อีเมล</label>
                  <Input 
                    type="email"
                    placeholder="somchai@ku.th" 
                    value={editingUser.email}
                    onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">ประเภทบัญชี (Role)</label>
                    <AppSelect
                      value={editingUser.role}
                      onValueChange={(v) => setEditingUser({...editingUser, role: v})}
                      className="w-full"
                      options={[
                        { value: "student", label: "นิสิต (Student)" },
                        { value: "teacher", label: "อาจารย์ (Teacher)" },
                        { value: "admin", label: "ผู้ดูแล (Admin)" },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">สถานะ</label>
                    <AppSelect
                      value={editingUser.isActive ? "true" : "false"}
                      onValueChange={(v) => setEditingUser({...editingUser, isActive: v === "true"})}
                      className="w-full"
                      options={[
                        { value: "true", label: "ใช้งาน (Active)" },
                        { value: "false", label: "ระงับ (Inactive)" },
                      ]}
                    />
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingUser(null)}>
                  ยกเลิก
                </Button>
                <Button 
                  onClick={handleEditUser}
                  disabled={editUserMutation.isPending}
                  className="flex items-center gap-2"
                >
                  {editUserMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                  บันทึกการเปลี่ยนแปลง
                </Button>
              </div>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={!!pendingDeleteUser}
          onOpenChange={(o) => !o && setPendingDeleteUser(null)}
          title="ลบผู้ใช้"
          description="คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้รายนี้? การกระทำนี้ไม่สามารถย้อนกลับได้"
          confirmLabel="ลบผู้ใช้"
          variant="danger"
          loading={deleteUserMutation.isPending}
          onConfirm={() => {
            if (pendingDeleteUser) deleteUserMutation.mutate(pendingDeleteUser);
            setPendingDeleteUser(null);
          }}
        />
      </div>
    </Layout>
  );
}
