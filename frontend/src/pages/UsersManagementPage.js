import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Checkbox } from '../components/ui/checkbox';
import { Pencil, Trash2, Plus, Shield } from 'lucide-react';
import api from '../services/api';


// قائمة الصلاحيات المتاحة
const AVAILABLE_PERMISSIONS = [
  { id: 'dashboard', label: 'الرئيسية', icon: '🏠' },
  { id: 'transfers', label: 'الحوالات', icon: '💸' },
  { id: 'create_transfer', label: 'إرسال حوالة', icon: '📤' },
  { id: 'visual_designer', label: 'مصمم القوالب', icon: '🎨' },
  { id: 'admin_dashboard', label: 'إدارة الوكلاء', icon: '👥' },
  { id: 'agents', label: 'عناوين الوكلاء', icon: '📋' },
  { id: 'wallet_manage', label: 'إدارة المحافظ', icon: '💳' },
  { id: 'notifications', label: 'الإشعارات', icon: '🔔' },
  { id: 'trial_balance', label: 'ميزان المراجعة', icon: '⚖️' },
  { id: 'chart_of_accounts', label: 'الدليل المحاسبي', icon: '📊' },
  { id: 'ledger', label: 'دفتر الأستاذ', icon: '📖' },
  { id: 'journal', label: 'دفتر اليومية', icon: '📝' },
  { id: 'manual_journal', label: 'قيد التسوية', icon: '✏️' },
  { id: 'journal_transfer', label: 'القيد المزدوج', icon: '🔄' },
  { id: 'reports', label: 'التقارير المالية', icon: '📈' },
  { id: 'journal_by_period', label: 'قيود يومية حسب الفترة', icon: '📅' },
  { id: 'users_management', label: 'إدارة المستخدمين', icon: '👤' },
];

const UsersManagementPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    display_name: '',
    email: '',
    password: '',
    permissions: []
  });

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('صلاحية الوصول مرفوضة');
      navigate('/dashboard');
      return;
    }
    fetchUsers();
  }, [user, navigate]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/users');
      // Filter only admin users (not agents or regular users)
      const adminUsers = response.data.filter(u => u.role === 'admin' || u.role === 'admin_user');
      setUsers(adminUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('خطأ في تحميل المستخدمين');
    }
    setLoading(false);
  };

  const handleAddUser = async () => {
    if (!formData.username || !formData.display_name || !formData.password) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    setLoading(true);
    try {
      await api.post('/admin/users', {
        username: formData.username,
        display_name: formData.display_name,
        email: formData.email || null,
        password: formData.password,
        role: 'admin_user', // مستخدم إداري
        permissions: formData.permissions
      });
      toast.success('تم إضافة المستخدم بنجاح');
      setShowAddDialog(false);
      setFormData({ username: '', display_name: '', email: '', password: '', permissions: [] });
      fetchUsers();
    } catch (error) {
      console.error('Error adding user:', error);
      toast.error(error.response?.data?.detail || 'خطأ في إضافة المستخدم');
    }
    setLoading(false);
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    setLoading(true);
    try {
      await api.put('/admin/users/${selectedUser.id}', {
        display_name: formData.display_name,
        email: formData.email || null,
        permissions: formData.permissions,
        ...(formData.password && { password: formData.password }) // Update password only if provided
      });
      toast.success('تم تحديث المستخدم بنجاح');
      setShowEditDialog(false);
      setSelectedUser(null);
      setFormData({ username: '', display_name: '', email: '', password: '', permissions: [] });
      fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('خطأ في تحديث المستخدم');
    }
    setLoading(false);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setLoading(true);
    try {
      await api.delete('/admin/users/${selectedUser.id}');
      toast.success('تم حذف المستخدم بنجاح');
      setShowDeleteDialog(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('خطأ في حذف المستخدم');
    }
    setLoading(false);
  };

  const openEditDialog = (user) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      display_name: user.display_name,
      email: user.email || '',
      password: '',
      permissions: user.permissions || []
    });
    setShowEditDialog(true);
  };

  const togglePermission = (permissionId) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-l from-blue-50 to-blue-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="text-2xl sm:text-3xl">👤 إدارة المستخدمين</CardTitle>
                <CardDescription className="text-base">
                  إنشاء وإدارة المستخدمين الإداريين والصلاحيات
                </CardDescription>
              </div>
              <Button onClick={() => setShowAddDialog(true)} className="w-full sm:w-auto">
                <Plus className="w-4 h-4 ml-2" />
                إضافة مستخدم جديد
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Users List */}
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="text-center py-8">جاري التحميل...</div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-gray-500">لا يوجد مستخدمين</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-3 text-right">اسم المستخدم</th>
                      <th className="p-3 text-right">الاسم الكامل</th>
                      <th className="p-3 text-right">البريد الإلكتروني</th>
                      <th className="p-3 text-center">عدد الصلاحيات</th>
                      <th className="p-3 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-t hover:bg-gray-50">
                        <td className="p-3 font-semibold">{u.username}</td>
                        <td className="p-3">{u.display_name}</td>
                        <td className="p-3 text-gray-600">{u.email || '-'}</td>
                        <td className="p-3 text-center">
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                            {u.permissions?.length || 0} صلاحية
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex gap-2 justify-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(u)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(u);
                                setShowDeleteDialog(true);
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add User Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>إضافة مستخدم جديد</DialogTitle>
              <DialogDescription>أدخل بيانات المستخدم وحدد الصلاحيات</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>اسم المستخدم <span className="text-red-500">*</span></Label>
                  <Input
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label>الاسم الكامل <span className="text-red-500">*</span></Label>
                  <Input
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    placeholder="الاسم الكامل"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>البريد الإلكتروني</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>كلمة المرور <span className="text-red-500">*</span></Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="********"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  الصلاحيات
                </Label>
                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {AVAILABLE_PERMISSIONS.map((perm) => (
                      <div key={perm.id} className="flex items-center space-x-2 space-x-reverse">
                        <Checkbox
                          id={`perm-${perm.id}`}
                          checked={formData.permissions.includes(perm.id)}
                          onCheckedChange={() => togglePermission(perm.id)}
                        />
                        <label
                          htmlFor={`perm-${perm.id}`}
                          className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
                        >
                          <span>{perm.icon}</span>
                          <span>{perm.label}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                إلغاء
              </Button>
              <Button onClick={handleAddUser} disabled={loading}>
                {loading ? 'جاري الإضافة...' : 'إضافة المستخدم'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>تعديل المستخدم</DialogTitle>
              <DialogDescription>تحديث بيانات المستخدم والصلاحيات</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>اسم المستخدم</Label>
                  <Input value={formData.username} disabled />
                </div>
                <div className="space-y-2">
                  <Label>الاسم الكامل <span className="text-red-500">*</span></Label>
                  <Input
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>البريد الإلكتروني</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>كلمة المرور الجديدة (اختياري)</Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="اتركه فارغاً للإبقاء على كلمة المرور الحالية"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  الصلاحيات
                </Label>
                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {AVAILABLE_PERMISSIONS.map((perm) => (
                      <div key={perm.id} className="flex items-center space-x-2 space-x-reverse">
                        <Checkbox
                          id={`edit-perm-${perm.id}`}
                          checked={formData.permissions.includes(perm.id)}
                          onCheckedChange={() => togglePermission(perm.id)}
                        />
                        <label
                          htmlFor={`edit-perm-${perm.id}`}
                          className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
                        >
                          <span>{perm.icon}</span>
                          <span>{perm.label}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                إلغاء
              </Button>
              <Button onClick={handleEditUser} disabled={loading}>
                {loading ? 'جاري التحديث...' : 'حفظ التغييرات'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>⚠️ تأكيد الحذف</DialogTitle>
              <DialogDescription>
                هل أنت متأكد من حذف المستخدم "{selectedUser?.display_name}"؟
                <br />
                هذا الإجراء لا يمكن التراجع عنه.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                إلغاء
              </Button>
              <Button variant="destructive" onClick={handleDeleteUser} disabled={loading}>
                {loading ? 'جاري الحذف...' : 'حذف المستخدم'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default UsersManagementPage;
