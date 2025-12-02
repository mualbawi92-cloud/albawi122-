import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AgentUsersPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { agentId } = useParams();
  
  const [agent, setAgent] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Edit Modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editFormData, setEditFormData] = useState({
    display_name: '',
    phone: '',
    password: ''
  });
  const [saving, setSaving] = useState(false);

  // Check if user is admin
  if (user?.role !== 'admin') {
    navigate('/dashboard');
    return null;
  }

  useEffect(() => {
    fetchData();
  }, [agentId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Fetch agent details
      const agentResponse = await axios.get(`${API}/agents/${agentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAgent(agentResponse.data);
      
      // Fetch users for this agent
      const usersResponse = await axios.get(`${API}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Filter users by agent_id
      console.log('=== AgentUsersPage Debug ===');
      console.log('agentId from URL:', agentId);
      console.log('Total users from API:', usersResponse.data.length);
      console.log('Users data:', usersResponse.data);
      const agentUsers = usersResponse.data.filter(u => {
        console.log(`Checking user ${u.username}: role=${u.role}, agent_id=${u.agent_id}, matches=${u.role === 'user' && u.agent_id === agentId}`);
        return u.role === 'user' && u.agent_id === agentId;
      });
      console.log('Filtered agent users:', agentUsers.length);
      setUsers(agentUsers);
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('خطأ في تحميل البيانات');
      setLoading(false);
    }
  };

  const handleOpenEditModal = (user) => {
    setSelectedUser(user);
    setEditFormData({
      display_name: user.display_name || '',
      phone: user.phone || '',
      password: '' // Leave empty, user can optionally update password
    });
    setEditModalOpen(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const token = localStorage.getItem('token');
      const updateData = {
        display_name: editFormData.display_name,
        phone: editFormData.phone
      };

      // Only include password if it's provided
      if (editFormData.password && editFormData.password.trim() !== '') {
        updateData.new_password = editFormData.password;
      }

      await axios.put(`${API}/users/${selectedUser.id}`, updateData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('تم تحديث معلومات المستخدم بنجاح!');
      setEditModalOpen(false);
      fetchData(); // Reload data
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('خطأ في التحديث', {
        description: error.response?.data?.detail || 'حدث خطأ غير متوقع'
      });
    }

    setSaving(false);
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const confirmMsg = newStatus === 'inactive' 
      ? 'هل أنت متأكد من إيقاف هذا المستخدم؟' 
      : 'هل أنت متأكد من تفعيل هذا المستخدم؟';
    
    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/users/${userId}/status`, 
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(newStatus === 'inactive' ? 'تم إيقاف المستخدم!' : 'تم تفعيل المستخدم!');
      fetchData(); // Reload data
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast.error('خطأ في تغيير الحالة', {
        description: error.response?.data?.detail || 'حدث خطأ غير متوقع'
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto p-6 flex items-center justify-center min-h-[50vh]">
          <div className="text-2xl text-primary">جاري التحميل...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="container mx-auto p-4 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            onClick={() => navigate('/admin/dashboard')}
            variant="outline"
            className="mb-2"
          >
            ← رجوع
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-primary p-3 rounded-lg">
            <span className="text-2xl">👥</span>
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">
              مستخدمي الوكيل: {agent?.display_name || agent?.username}
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              إدارة المستخدمين التابعين للوكيل
            </p>
          </div>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader className="border-b bg-gray-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">📋 قائمة المستخدمين</CardTitle>
              <span className="text-sm text-gray-600">إجمالي: {users.length} مستخدم</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {users.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                لا يوجد مستخدمين لهذا الوكيل
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="text-right p-3 font-semibold">اسم المستخدم</th>
                      <th className="text-right p-3 font-semibold">الاسم الثلاثي</th>
                      <th className="text-right p-3 font-semibold">رقم الهاتف</th>
                      <th className="text-right p-3 font-semibold">الحالة</th>
                      <th className="text-center p-3 font-semibold">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user, index) => {
                      const isActive = user.status !== 'inactive';
                      
                      return (
                        <tr key={user.id} className={`border-b hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                              <span className="font-medium">{user.username}</span>
                            </div>
                          </td>
                          <td className="p-3">{user.display_name || 'غير محدد'}</td>
                          <td className="p-3" dir="ltr">{user.phone || 'غير محدد'}</td>
                          <td className="p-3">
                            <span className={`inline-block px-2 py-1 rounded text-xs ${
                              isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {isActive ? 'نشط' : 'موقوف'}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleOpenEditModal(user)}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1"
                                title="تعديل المعلومات"
                              >
                                ✏️ تعديل
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleToggleUserStatus(user.id, user.status || 'active')}
                                className={`text-white text-xs px-3 py-1 ${
                                  isActive 
                                    ? 'bg-red-600 hover:bg-red-700' 
                                    : 'bg-green-600 hover:bg-green-700'
                                }`}
                                title={isActive ? 'إيقاف المستخدم' : 'تفعيل المستخدم'}
                              >
                                {isActive ? '🔴 إيقاف' : '✅ تفعيل'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit User Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">✏️ تعديل معلومات المستخدم</DialogTitle>
            <DialogDescription>
              تعديل معلومات: {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSaveUser} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit_display_name">الاسم الثلاثي *</Label>
              <Input
                id="edit_display_name"
                value={editFormData.display_name}
                onChange={(e) => setEditFormData({ ...editFormData, display_name: e.target.value })}
                required
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_phone">رقم الهاتف *</Label>
              <Input
                id="edit_phone"
                type="tel"
                value={editFormData.phone}
                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                required
                className="h-10"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_password">كلمة المرور الجديدة (اختياري)</Label>
              <Input
                id="edit_password"
                type="password"
                value={editFormData.password}
                onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                className="h-10"
                placeholder="اتركه فارغاً إذا لم ترد التغيير"
                minLength={6}
              />
              <p className="text-xs text-gray-500">* اترك الحقل فارغاً إذا لم ترد تغيير كلمة المرور</p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                onClick={() => setEditModalOpen(false)}
                variant="outline"
                className="flex-1"
                disabled={saving}
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="flex-1 bg-secondary hover:bg-secondary/90 text-primary"
              >
                {saving ? 'جاري الحفظ...' : '💾 حفظ التغييرات'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgentUsersPage;
