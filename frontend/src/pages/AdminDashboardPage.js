import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const IRAQI_GOVERNORATES = [
  { code: 'BG', name: 'بغداد' },
  { code: 'BS', name: 'البصرة' },
  { code: 'NJ', name: 'النجف' },
  { code: 'KR', name: 'كربلاء' },
  { code: 'BB', name: 'بابل' },
  { code: 'AN', name: 'الأنبار' },
  { code: 'DY', name: 'ديالى' },
  { code: 'WS', name: 'واسط' },
  { code: 'SA', name: 'صلاح الدين' },
  { code: 'NI', name: 'نينوى' },
  { code: 'DQ', name: 'ذي قار' },
  { code: 'QA', name: 'القادسية' },
  { code: 'MY', name: 'المثنى' },
  { code: 'MI', name: 'ميسان' },
  { code: 'KI', name: 'كركوك' },
  { code: 'ER', name: 'أربيل' },
  { code: 'SU', name: 'السليمانية' },
  { code: 'DH', name: 'دهوك' }
];

const DashboardPageNew = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [filteredAgents, setFilteredAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  
  // Filters
  const [cityFilter, setCityFilter] = useState('all');
  const [nameFilter, setNameFilter] = useState('');
  
  // Modal state for Edit
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [editFormData, setEditFormData] = useState({
    display_name: '',
    phone: '',
    governorate: '',
    address: '',
    account_id: ''
  });
  
  // Modal state for Add Agent
  const [addAgentModalOpen, setAddAgentModalOpen] = useState(false);
  const [addAgentFormData, setAddAgentFormData] = useState({
    username: '',
    password: '',
    display_name: '',
    phone: '',
    governorate: '',
    address: '',
    account_id: ''
  });
  
  // Modal state for Add User to Agent
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [addUserFormData, setAddUserFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    phone: '',
    agent_id: ''
  });
  
  const [saving, setSaving] = useState(false);

  // Check if user is admin
  if (user?.role !== 'admin') {
    navigate('/dashboard');
    return null;
  }

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [agents, cityFilter, nameFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Fetch agents (users with role=agent)
      const agentsResponse = await axios.get(`${API}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Filter only agents
      const agentUsers = agentsResponse.data.filter(u => u.role === 'agent');
      
      // Fetch chart of accounts
      const accountsResponse = await axios.get(`${API}/accounting/accounts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const accountsData = accountsResponse.data.accounts || accountsResponse.data || [];
      setAccounts(accountsData);
      
      // Enrich agents with account info
      const enrichedAgents = agentUsers.map(agent => {
        const linkedAccount = accountsData.find(acc => acc.code === agent.account_id);
        return {
          ...agent,
          account_name: linkedAccount ? (linkedAccount.name_ar || linkedAccount.name) : 'غير محدد'
        };
      });
      
      setAgents(enrichedAgents);
      setFilteredAgents(enrichedAgents);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('خطأ في تحميل البيانات');
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...agents];
    
    // Filter by city
    if (cityFilter && cityFilter !== 'all') {
      filtered = filtered.filter(agent => agent.governorate === cityFilter);
    }
    
    // Filter by name
    if (nameFilter) {
      const searchTerm = nameFilter.toLowerCase();
      filtered = filtered.filter(agent => 
        (agent.display_name || '').toLowerCase().includes(searchTerm) ||
        (agent.username || '').toLowerCase().includes(searchTerm)
      );
    }
    
    setFilteredAgents(filtered);
  };

  const handleOpenEditModal = (agent) => {
    setSelectedAgent(agent);
    setEditFormData({
      display_name: agent.display_name || '',
      phone: agent.phone || '',
      governorate: agent.governorate || '',
      address: agent.address || '',
      account_id: agent.account_id || ''
    });
    setEditModalOpen(true);
  };

  const handleOpenAddModal = () => {
    setAddFormData({
      username: '',
      password: '',
      display_name: '',
      phone: '',
      governorate: '',
      address: '',
      account_id: ''
    });
    setAddModalOpen(true);
  };

  const handleSaveAgent = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const token = localStorage.getItem('token');
      const updateData = {
        display_name: editFormData.display_name,
        phone: editFormData.phone,
        governorate: editFormData.governorate,
        address: editFormData.address,
        account_id: editFormData.account_id
      };

      await axios.put(`${API}/users/${selectedAgent.id}`, updateData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('تم تحديث معلومات الصراف بنجاح!');
      setEditModalOpen(false);
      fetchData(); // Reload data
    } catch (error) {
      console.error('Error updating agent:', error);
      toast.error('خطأ في التحديث', {
        description: error.response?.data?.detail || 'حدث خطأ غير متوقع'
      });
    }

    setSaving(false);
  };

  const handleAddAgent = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Validation
      if (!addFormData.username || !addFormData.password) {
        toast.error('يرجى إدخال اسم المستخدم وكلمة المرور');
        setSaving(false);
        return;
      }

      if (!addFormData.display_name || !addFormData.phone || !addFormData.governorate) {
        toast.error('يرجى إدخال جميع الحقول المطلوبة');
        setSaving(false);
        return;
      }

      if (!addFormData.account_id) {
        toast.error('يرجى اختيار الحساب المحاسبي');
        setSaving(false);
        return;
      }

      const token = localStorage.getItem('token');
      const newAgentData = {
        username: addFormData.username,
        password: addFormData.password,
        display_name: addFormData.display_name,
        phone: addFormData.phone,
        governorate: addFormData.governorate,
        address: addFormData.address,
        account_id: addFormData.account_id,
        role: 'agent'
      };

      await axios.post(`${API}/register`, newAgentData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('تم إضافة الصراف بنجاح!');
      setAddModalOpen(false);
      fetchData(); // Reload data
    } catch (error) {
      console.error('Error adding agent:', error);
      toast.error('خطأ في الإضافة', {
        description: error.response?.data?.detail || 'حدث خطأ غير متوقع'
      });
    }

    setSaving(false);
  };

  const copyAgentInfo = (agent) => {
    const govName = IRAQI_GOVERNORATES.find(g => g.code === agent.governorate)?.name || agent.governorate;
    const info = `اسم الصيرفة: ${agent.display_name}
المدينة: ${govName}
العنوان: ${agent.address || 'غير محدد'}
رقم الهاتف: ${agent.phone || 'غير محدد'}`;
    
    navigator.clipboard.writeText(info);
    toast.success('تم نسخ المعلومات!');
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
          <div className="bg-primary p-3 rounded-lg">
            <span className="text-2xl">🏢</span>
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">لوحة التحكم - الصراف المسجل</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">إدارة ومراقبة جميع الصراف والتحويلات</p>
          </div>
        </div>

        {/* Filters and Add Button */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              {/* City Filter */}
              <div className="flex-1 space-y-2">
                <Label className="text-sm">المدينة</Label>
                <Select value={cityFilter} onValueChange={setCityFilter}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="كل المحافظات" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    <SelectItem value="all">كل المحافظات</SelectItem>
                    {IRAQI_GOVERNORATES.map((gov) => (
                      <SelectItem key={gov.code} value={gov.code}>{gov.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Name Filter */}
              <div className="flex-1 space-y-2">
                <Label className="text-sm">اسم الوكيل</Label>
                <Input
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                  placeholder="بحث بالاسم أو اسم المستخدم..."
                  className="h-10"
                />
              </div>

              {/* Add Button */}
              <Button
                onClick={handleOpenAddModal}
                className="bg-green-600 hover:bg-green-700 text-white h-10 px-6 flex items-center gap-2"
              >
                <span className="text-lg">+</span>
                <span>إضافة صيرفة جديدة</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="border-b bg-gray-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">📋 قائمة الصراف المسجل</CardTitle>
              <span className="text-sm text-gray-600">إجمالي: {filteredAgents.length} صيرفة</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredAgents.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                لا توجد صرافين متاحين
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="text-right p-3 font-semibold">اسم الصيرفة</th>
                      <th className="text-right p-3 font-semibold">اسم المالك</th>
                      <th className="text-right p-3 font-semibold">اسم الحساب المرتبط</th>
                      <th className="text-right p-3 font-semibold">مدينة الوكيل</th>
                      <th className="text-right p-3 font-semibold">عنوان الوكيل</th>
                      <th className="text-right p-3 font-semibold">رقم هاتف الوكيل</th>
                      <th className="text-right p-3 font-semibold">آخر نشاط</th>
                      <th className="text-center p-3 font-semibold">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAgents.map((agent, index) => {
                      const govName = IRAQI_GOVERNORATES.find(g => g.code === agent.governorate)?.name || agent.governorate;
                      
                      return (
                        <tr key={agent.id} className={`border-b hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                              <span className="font-medium">{agent.display_name || agent.username}</span>
                            </div>
                          </td>
                          <td className="p-3">{agent.display_name || agent.username}</td>
                          <td className="p-3">
                            <div className="space-y-1">
                              <div className="font-medium text-gray-800">{agent.account_name}</div>
                              {agent.account_id && (
                                <div className="text-xs text-gray-500">كود: {agent.account_id}</div>
                              )}
                            </div>
                          </td>
                          <td className="p-3">{govName || 'غير محدد'}</td>
                          <td className="p-3">{agent.address || 'غير محدد'}</td>
                          <td className="p-3" dir="ltr">{agent.phone || 'غير محدد'}</td>
                          <td className="p-3 text-gray-500 text-xs">
                            لا توجد حركات
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleOpenEditModal(agent)}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1"
                              >
                                عرض
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyAgentInfo(agent)}
                                className="text-xs px-3 py-1"
                              >
                                📋
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

      {/* Edit Agent Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">✏️ تعديل معلومات الصراف</DialogTitle>
            <DialogDescription>
              تعديل معلومات: {selectedAgent?.display_name || selectedAgent?.username}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSaveAgent} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit_display_name">اسم الوكيل *</Label>
              <Input
                id="edit_display_name"
                value={editFormData.display_name}
                onChange={(e) => setEditFormData({ ...editFormData, display_name: e.target.value })}
                required
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_phone">رقم هاتف الوكيل *</Label>
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
              <Label htmlFor="edit_governorate">المحافظة *</Label>
              <Select 
                value={editFormData.governorate} 
                onValueChange={(value) => setEditFormData({ ...editFormData, governorate: value })}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="اختر المحافظة" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {IRAQI_GOVERNORATES.map((gov) => (
                    <SelectItem key={gov.code} value={gov.code}>{gov.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_address">عنوان الوكيل</Label>
              <Input
                id="edit_address"
                value={editFormData.address}
                onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_account_id">الحساب المحاسبي المرتبط *</Label>
              <Select 
                value={editFormData.account_id} 
                onValueChange={(value) => setEditFormData({ ...editFormData, account_id: value })}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="اختر الحساب المحاسبي" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {accounts.length > 0 ? (
                    accounts
                      .filter(acc => 
                        acc.code?.startsWith('501') || 
                        acc.parent_code === '501' ||
                        (acc.category && (acc.category.includes('شركات') || acc.category.includes('صرافة')))
                      )
                      .map((acc) => (
                        <SelectItem key={acc.code} value={acc.code}>
                          {acc.code} - {acc.name_ar || acc.name}
                        </SelectItem>
                      ))
                  ) : (
                    <SelectItem value="none" disabled>
                      لا توجد حسابات
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
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

      {/* Add Agent Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">➕ إضافة صيرفة جديدة</DialogTitle>
            <DialogDescription>
              إضافة وكيل جديد إلى النظام
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleAddAgent} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="add_username">اسم المستخدم (Username) *</Label>
              <Input
                id="add_username"
                value={addFormData.username}
                onChange={(e) => setAddFormData({ ...addFormData, username: e.target.value })}
                required
                className="h-10"
                placeholder="مثال: agent_najaf"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add_password">كلمة المرور (Password) *</Label>
              <Input
                id="add_password"
                type="password"
                value={addFormData.password}
                onChange={(e) => setAddFormData({ ...addFormData, password: e.target.value })}
                required
                className="h-10"
                placeholder="كلمة المرور"
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add_display_name">اسم الوكيل *</Label>
              <Input
                id="add_display_name"
                value={addFormData.display_name}
                onChange={(e) => setAddFormData({ ...addFormData, display_name: e.target.value })}
                required
                className="h-10"
                placeholder="مثال: صيرفة النجف"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add_phone">رقم هاتف الوكيل *</Label>
              <Input
                id="add_phone"
                type="tel"
                value={addFormData.phone}
                onChange={(e) => setAddFormData({ ...addFormData, phone: e.target.value })}
                required
                className="h-10"
                dir="ltr"
                placeholder="+9647801234567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add_governorate">المحافظة *</Label>
              <Select 
                value={addFormData.governorate} 
                onValueChange={(value) => setAddFormData({ ...addFormData, governorate: value })}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="اختر المحافظة" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {IRAQI_GOVERNORATES.map((gov) => (
                    <SelectItem key={gov.code} value={gov.code}>{gov.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="add_address">عنوان الوكيل</Label>
              <Input
                id="add_address"
                value={addFormData.address}
                onChange={(e) => setAddFormData({ ...addFormData, address: e.target.value })}
                className="h-10"
                placeholder="مثال: شارع الرشيد، قرب ساحة التحرير"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add_account_id">الحساب المحاسبي المرتبط *</Label>
              <Select 
                value={addFormData.account_id} 
                onValueChange={(value) => setAddFormData({ ...addFormData, account_id: value })}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="اختر الحساب المحاسبي" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {accounts.length > 0 ? (
                    accounts
                      .filter(acc => 
                        acc.code?.startsWith('501') || 
                        acc.parent_code === '501' ||
                        (acc.category && (acc.category.includes('شركات') || acc.category.includes('صرافة')))
                      )
                      .map((acc) => (
                        <SelectItem key={acc.code} value={acc.code}>
                          {acc.code} - {acc.name_ar || acc.name}
                        </SelectItem>
                      ))
                  ) : (
                    <SelectItem value="none" disabled>
                      لا توجد حسابات
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                onClick={() => setAddModalOpen(false)}
                variant="outline"
                className="flex-1"
                disabled={saving}
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                {saving ? 'جاري الإضافة...' : '➕ إضافة الصيرفة'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardPageNew;
