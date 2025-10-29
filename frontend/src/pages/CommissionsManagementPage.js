import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
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

const CommissionsManagementPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Tab state
  const [activeTab, setActiveTab] = useState('manage'); // 'manage' or 'view'
  
  // Filter states
  const [selectedGovernorate, setSelectedGovernorate] = useState('');
  const [agents, setAgents] = useState([]);
  const [filteredAgents, setFilteredAgents] = useState([]);
  
  // Selected agent and their commission rates
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [agentCommissionRates, setAgentCommissionRates] = useState([]);
  
  // All rates for view tab
  const [allRates, setAllRates] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form states
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRate, setEditingRate] = useState(null);
  
  // Delete confirmation dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [rateToDelete, setRateToDelete] = useState(null);
  
  const [formData, setFormData] = useState({
    currency: 'IQD',
    bulletin_type: 'transfers',
    date: new Date().toISOString().split('T')[0],
  });

  const [tiers, setTiers] = useState([
    {
      from_amount: 0,
      to_amount: 1000000000,
      percentage: 0.25,
      city: '(جميع المدن)',
      country: '(جميع البلدان)',
      currency_type: 'normal',
      type: 'outgoing'
    }
  ]);

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('صلاحية الوصول مرفوضة');
      navigate('/dashboard');
      return;
    }
    fetchAgents();
    fetchAllRates();
  }, [user, navigate]);

  useEffect(() => {
    if (selectedGovernorate) {
      const filtered = agents.filter(agent => agent.governorate === selectedGovernorate);
      setFilteredAgents(filtered);
    } else {
      setFilteredAgents([]);
    }
    setSelectedAgent(null);
    setAgentCommissionRates([]);
    setShowAddForm(false);
    setEditingRate(null);
  }, [selectedGovernorate, agents]);

  useEffect(() => {
    if (selectedAgent) {
      fetchAgentCommissionRates(selectedAgent.id);
    } else {
      setAgentCommissionRates([]);
    }
    setShowAddForm(false);
    setEditingRate(null);
  }, [selectedAgent]);

  const fetchAgents = async () => {
    try {
      const response = await axios.get(`${API}/agents`);
      setAgents(response.data);
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast.error('خطأ في تحميل قائمة الصرافين');
    }
  };

  const fetchAgentCommissionRates = async (agentId) => {
    try {
      const response = await axios.get(`${API}/commission-rates/agent/${agentId}`);
      setAgentCommissionRates(response.data);
    } catch (error) {
      console.error('Error fetching commission rates:', error);
      setAgentCommissionRates([]);
    }
  };

  const fetchAllRates = async () => {
    try {
      const response = await axios.get(`${API}/commission-rates`);
      setAllRates(response.data);
    } catch (error) {
      console.error('Error fetching all rates:', error);
      toast.error('خطأ في تحميل النشرات');
    }
  };

  const addTier = () => {
    setTiers([...tiers, {
      from_amount: 0,
      to_amount: 0,
      percentage: 0,
      city: '(جميع المدن)',
      country: '(جميع البلدان)',
      currency_type: 'normal',
      type: 'outgoing'
    }]);
  };

  const removeTier = (index) => {
    if (tiers.length > 1) {
      setTiers(tiers.filter((_, i) => i !== index));
    } else {
      toast.error('يجب أن يكون هناك شريحة واحدة على الأقل');
    }
  };

  const updateTier = (index, field, value) => {
    const newTiers = [...tiers];
    newTiers[index][field] = value;
    setTiers(newTiers);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedAgent) {
      toast.error('يرجى اختيار الصراف');
      return;
    }

    setLoading(true);

    try {
      const submitData = {
        agent_id: selectedAgent.id,
        currency: formData.currency,
        bulletin_type: formData.bulletin_type,
        date: formData.date,
        tiers: tiers.map(tier => ({
          from_amount: parseFloat(tier.from_amount) || 0,
          to_amount: parseFloat(tier.to_amount) || 0,
          percentage: parseFloat(tier.percentage) || 0,
          city: tier.city === '(جميع المدن)' ? '(جميع المدن)' : tier.city,
          country: tier.country === '(جميع البلدان)' ? '(جميع البلدان)' : tier.country,
          currency_type: tier.currency_type,
          type: tier.type
        }))
      };

      if (editingRate) {
        // Update existing rate
        await axios.put(`${API}/commission-rates/${editingRate.id}`, submitData);
        toast.success('تم تحديث نشرة الأسعار بنجاح!');
      } else {
        // Create new rate
        await axios.post(`${API}/commission-rates`, submitData);
        toast.success('تم حفظ نشرة الأسعار بنجاح!');
      }
      
      // Refresh rates and reset form
      if (selectedAgent) {
        await fetchAgentCommissionRates(selectedAgent.id);
      }
      await fetchAllRates();
      handleCancelEdit();
      
    } catch (error) {
      console.error('Error saving commission rate:', error);
      toast.error(editingRate ? 'خطأ في تحديث نشرة الأسعار' : 'خطأ في حفظ نشرة الأسعار', {
        description: error.response?.data?.detail || 'حدث خطأ غير متوقع'
      });
    }

    setLoading(false);
  };

  const handleDeleteRate = async (rateId) => {
    // Show confirmation dialog
    setRateToDelete(rateId);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!rateToDelete) return;
    
    console.log('محاولة إلغاء النشرة:', rateToDelete);
    setLoading(true);
    setShowDeleteDialog(false);
    
    try {
      const response = await axios.delete(`${API}/commission-rates/${rateToDelete}`);
      console.log('استجابة الإلغاء:', response.data);
      toast.success('✅ تم إلغاء النشرة بنجاح');
      
      // Refresh both lists
      console.log('تحديث قوائم النشرات...');
      if (selectedAgent) {
        await fetchAgentCommissionRates(selectedAgent.id);
      }
      await fetchAllRates();
      console.log('تم تحديث القوائم بنجاح');
    } catch (error) {
      console.error('خطأ في إلغاء النشرة:', error);
      console.error('تفاصيل الخطأ:', error.response?.data);
      toast.error('❌ خطأ في إلغاء النشرة: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
      setRateToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteDialog(false);
    setRateToDelete(null);
    console.log('تم إلغاء عملية الحذف من قبل المستخدم');
  };

  const handleEditRate = (rate) => {
    setEditingRate(rate);
    setFormData({
      currency: rate.currency,
      bulletin_type: rate.bulletin_type,
      date: rate.date,
    });
    setTiers(rate.tiers || []);
    setShowAddForm(true);
    // Scroll to form
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingRate(null);
    setShowAddForm(false);
    setFormData({
      currency: 'IQD',
      bulletin_type: 'transfers',
      date: new Date().toISOString().split('T')[0],
    });
    setTiers([{
      from_amount: 0,
      to_amount: 1000000000,
      percentage: 0.25,
      city: '(جميع المدن)',
      country: '(جميع البلدان)',
      currency_type: 'normal',
      type: 'outgoing'
    }]);
  };

  const filteredAllRates = allRates.filter(rate => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      rate.agent_display_name?.toLowerCase().includes(term) ||
      rate.currency?.toLowerCase().includes(term) ||
      rate.bulletin_type?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <Navbar />
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-l from-primary/10 to-primary/5">
            <CardTitle className="text-2xl sm:text-3xl">💰 إدارة العمولات</CardTitle>
            <CardDescription className="text-base">
              إدارة وعرض نشرات الأسعار والعمولات لجميع الصرافين
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Tabs */}
        <div className="flex gap-2 border-b-2">
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-6 py-3 font-bold text-lg transition-all ${
              activeTab === 'manage'
                ? 'border-b-4 border-primary text-primary bg-primary/5'
                : 'text-muted-foreground hover:text-primary'
            }`}
          >
            📝 إدارة العمولات
          </button>
          <button
            onClick={() => setActiveTab('view')}
            className={`px-6 py-3 font-bold text-lg transition-all ${
              activeTab === 'view'
                ? 'border-b-4 border-primary text-primary bg-primary/5'
                : 'text-muted-foreground hover:text-primary'
            }`}
          >
            📊 عرض جميع النشرات ({allRates.length})
          </button>
        </div>

        {/* Tab Content: Manage */}
        {activeTab === 'manage' && (
          <div className="space-y-6">

        {/* Step 1: Select Governorate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">1️⃣ اختر المحافظة</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedGovernorate} onValueChange={setSelectedGovernorate}>
              <SelectTrigger className="w-full h-12">
                <SelectValue placeholder="اختر المحافظة..." />
              </SelectTrigger>
              <SelectContent>
                {IRAQI_GOVERNORATES.map((gov) => (
                  <SelectItem key={gov.code} value={gov.code}>
                    {gov.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Step 2: Select Agent */}
        {selectedGovernorate && filteredAgents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">2️⃣ اختر الصراف</CardTitle>
              <CardDescription>
                {filteredAgents.length} صراف في {IRAQI_GOVERNORATES.find(g => g.code === selectedGovernorate)?.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredAgents.map((agent) => (
                  <Button
                    key={agent.id}
                    variant={selectedAgent?.id === agent.id ? "default" : "outline"}
                    className="h-auto p-4 justify-start text-right"
                    onClick={() => setSelectedAgent(agent)}
                  >
                    <div className="w-full">
                      <p className="font-bold">{agent.display_name}</p>
                      <p className="text-sm opacity-80">{agent.phone}</p>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {selectedGovernorate && filteredAgents.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              لا يوجد صرافين في هذه المحافظة
            </CardContent>
          </Card>
        )}

        {/* Step 3: Manage Commission Rates */}
        {selectedAgent && (
          <>
            {/* Existing Rates */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl">3️⃣ النشرات الحالية للصراف: {selectedAgent.display_name}</CardTitle>
                  <CardDescription>
                    {agentCommissionRates.length} نشرة محفوظة
                  </CardDescription>
                </div>
                <Button
                  onClick={() => {
                    setShowAddForm(true);
                    setEditingRate(null);
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  ➕ إضافة نشرة جديدة
                </Button>
              </CardHeader>
              <CardContent>
                {agentCommissionRates.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    لا توجد نشرات محفوظة لهذا الصراف
                  </div>
                ) : (
                  <div className="space-y-4">
                    {agentCommissionRates.map((rate) => (
                      <Card key={rate.id} className="border-2 shadow-md">
                        <CardHeader className="pb-3 bg-gradient-to-l from-gray-50 to-white">
                          <div className="space-y-3">
                            {/* Header Info */}
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                                    rate.currency === 'IQD' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                  }`}>
                                    {rate.currency}
                                  </span>
                                  <span className="font-bold text-lg">{rate.bulletin_type}</span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  📅 التاريخ: {new Date(rate.date).toLocaleDateString('ar-IQ')}
                                </p>
                              </div>
                              {/* Action Buttons */}
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-blue-500 text-blue-600 hover:bg-blue-50"
                                  onClick={() => handleEditRate(rate)}
                                >
                                  ✏️ تعديل
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteRate(rate.id)}
                                  disabled={loading}
                                >
                                  ❌ إلغاء النشرة
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {/* Tiers Display */}
                          <div className="space-y-3">
                            <Label className="text-base font-bold">الشرائح:</Label>
                            {rate.tiers?.map((tier, idx) => (
                              <div key={idx} className="p-3 bg-gray-50 rounded-lg border-2 border-gray-200 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-gray-600">الشريحة {idx + 1}</span>
                                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                                    tier.type === 'outgoing' 
                                      ? 'bg-orange-100 text-orange-700' 
                                      : 'bg-teal-100 text-teal-700'
                                  }`}>
                                    {tier.type === 'outgoing' ? '📤 صادرة' : '📥 واردة'}
                                  </span>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div className="bg-white p-2 rounded border">
                                    <p className="text-xs text-gray-600">من مبلغ</p>
                                    <p className="font-bold">{tier.from_amount?.toLocaleString()}</p>
                                  </div>
                                  <div className="bg-white p-2 rounded border">
                                    <p className="text-xs text-gray-600">إلى مبلغ</p>
                                    <p className="font-bold">{tier.to_amount?.toLocaleString()}</p>
                                  </div>
                                </div>
                                
                                <div className="bg-purple-50 p-2 rounded border border-purple-200">
                                  <p className="text-xs text-purple-700">نسبة العمولة</p>
                                  <p className="text-2xl font-bold text-purple-900">{tier.percentage}%</p>
                                </div>
                                
                                <div className="flex gap-2 text-xs">
                                  <div className="flex-1 bg-white p-2 rounded border">
                                    <p className="text-gray-600">المدينة</p>
                                    <p className="font-medium">{tier.city || '(جميع المدن)'}</p>
                                  </div>
                                  <div className="flex-1 bg-white p-2 rounded border">
                                    <p className="text-gray-600">البلد</p>
                                    <p className="font-medium">{tier.country || '(جميع البلدان)'}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Add/Edit Form */}
            {showAddForm && (
              <Card className="border-4 border-blue-500">
                <CardHeader className="bg-blue-50">
                  <CardTitle className="text-xl">
                    {editingRate ? '✏️ تعديل النشرة' : '➕ إضافة نشرة جديدة'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Form Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>العملة *</Label>
                        <Select value={formData.currency} onValueChange={(value) => setFormData({...formData, currency: value})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="IQD">دينار عراقي (IQD)</SelectItem>
                            <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>نوع النشرة *</Label>
                        <Select value={formData.bulletin_type} onValueChange={(value) => setFormData({...formData, bulletin_type: value})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="transfers">حوالات</SelectItem>
                            <SelectItem value="exchange">صرافة</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>التاريخ *</Label>
                        <Input
                          type="date"
                          value={formData.date}
                          onChange={(e) => setFormData({...formData, date: e.target.value})}
                          required
                        />
                      </div>
                    </div>

                    {/* Tiers */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <Label className="text-lg font-bold">الشرائح (Tiers)</Label>
                        <Button type="button" onClick={addTier} variant="outline">
                          ➕ إضافة شريحة
                        </Button>
                      </div>

                      {tiers.map((tier, index) => (
                        <Card key={index} className="border-2">
                          <CardContent className="pt-4 space-y-4">
                            <div className="flex justify-between items-center mb-2">
                              <Label className="font-bold">الشريحة {index + 1}</Label>
                              {tiers.length > 1 && (
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => removeTier(index)}
                                >
                                  🗑️ حذف
                                </Button>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <Label>من مبلغ</Label>
                                <Input
                                  type="number"
                                  value={tier.from_amount}
                                  onChange={(e) => updateTier(index, 'from_amount', e.target.value)}
                                  placeholder="0"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>إلى مبلغ</Label>
                                <Input
                                  type="number"
                                  value={tier.to_amount}
                                  onChange={(e) => updateTier(index, 'to_amount', e.target.value)}
                                  placeholder="1000000000"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>النسبة %</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={tier.percentage}
                                  onChange={(e) => updateTier(index, 'percentage', e.target.value)}
                                  placeholder="0.25"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>المدينة</Label>
                                <Select
                                  value={tier.city}
                                  onValueChange={(value) => updateTier(index, 'city', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="(جميع المدن)">(جميع المدن)</SelectItem>
                                    {IRAQI_GOVERNORATES.map((gov) => (
                                      <SelectItem key={gov.code} value={gov.name}>
                                        {gov.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label>النوع</Label>
                                <Select
                                  value={tier.type}
                                  onValueChange={(value) => updateTier(index, 'type', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="outgoing">📤 صادرة (Outgoing)</SelectItem>
                                    <SelectItem value="incoming">📥 واردة (Incoming)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Submit Buttons */}
                    <div className="flex gap-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancelEdit}
                        className="flex-1"
                      >
                        إلغاء
                      </Button>
                      <Button
                        type="submit"
                        disabled={loading}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        {loading ? 'جاري الحفظ...' : editingRate ? 'تحديث النشرة' : 'حفظ النشرة'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </>
        )}
        </div>
        )}

        {/* Tab Content: View All */}
        {activeTab === 'view' && (
          <div className="space-y-6">
            {/* Search and Stats */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-4 items-center mb-6">
                  <Input
                    placeholder="🔍 بحث بالاسم، العملة، أو النوع..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={fetchAllRates} variant="outline" disabled={loading}>
                    {loading ? 'جاري التحديث...' : '🔄 تحديث'}
                  </Button>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-purple-50 p-4 rounded-lg border-2 border-purple-200">
                    <p className="text-sm text-purple-700">إجمالي النشرات</p>
                    <p className="text-3xl font-bold text-purple-900">{allRates.length}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
                    <p className="text-sm text-green-700">نشرات IQD</p>
                    <p className="text-3xl font-bold text-green-900">
                      {allRates.filter(r => r.currency === 'IQD').length}
                    </p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                    <p className="text-sm text-blue-700">نشرات USD</p>
                    <p className="text-3xl font-bold text-blue-900">
                      {allRates.filter(r => r.currency === 'USD').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* All Rates Display */}
            {filteredAllRates.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  {searchTerm ? 'لا توجد نتائج للبحث' : 'لا توجد نشرات محفوظة'}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredAllRates.map((rate) => (
                  <Card key={rate.id} className="border-2 shadow-md">
                    <CardHeader className="pb-3 bg-gradient-to-l from-gray-50 to-white">
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-lg font-bold">{rate.agent_display_name || 'صراف غير معروف'}</span>
                              <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                                rate.currency === 'IQD' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {rate.currency}
                              </span>
                              <span className="font-bold">{rate.bulletin_type}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              📅 التاريخ: {new Date(rate.date).toLocaleDateString('ar-IQ')}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-blue-500 text-blue-600 hover:bg-blue-50"
                              onClick={() => {
                                handleEditRate(rate);
                                setActiveTab('manage');
                              }}
                            >
                              ✏️ تعديل
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteRate(rate.id)}
                              disabled={loading}
                            >
                              {loading ? 'جاري الإلغاء...' : '❌ إلغاء النشرة'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <Label className="text-base font-bold">الشرائح:</Label>
                        {rate.tiers?.map((tier, idx) => (
                          <div key={idx} className="p-3 bg-gray-50 rounded-lg border-2 border-gray-200 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-600">الشريحة {idx + 1}</span>
                              <span className={`px-2 py-1 rounded text-xs font-bold ${
                                tier.type === 'outgoing' 
                                  ? 'bg-orange-100 text-orange-700' 
                                  : 'bg-teal-100 text-teal-700'
                              }`}>
                                {tier.type === 'outgoing' ? '📤 صادرة' : '📥 واردة'}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="bg-white p-2 rounded border">
                                <p className="text-xs text-gray-600">من مبلغ</p>
                                <p className="font-bold">{tier.from_amount?.toLocaleString()}</p>
                              </div>
                              <div className="bg-white p-2 rounded border">
                                <p className="text-xs text-gray-600">إلى مبلغ</p>
                                <p className="font-bold">{tier.to_amount?.toLocaleString()}</p>
                              </div>
                            </div>
                            
                            <div className="bg-purple-50 p-2 rounded border border-purple-200">
                              <p className="text-xs text-purple-700">نسبة العمولة</p>
                              <p className="text-2xl font-bold text-purple-900">{tier.percentage}%</p>
                            </div>
                            
                            <div className="flex gap-2 text-xs">
                              <div className="flex-1 bg-white p-2 rounded border">
                                <p className="text-gray-600">المدينة</p>
                                <p className="font-medium">{tier.city || '(جميع المدن)'}</p>
                              </div>
                              <div className="flex-1 bg-white p-2 rounded border">
                                <p className="text-gray-600">البلد</p>
                                <p className="font-medium">{tier.country || '(جميع البلدان)'}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommissionsManagementPage;
