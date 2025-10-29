import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
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
  
  // Filter states
  const [selectedGovernorate, setSelectedGovernorate] = useState('');
  const [agents, setAgents] = useState([]);
  const [filteredAgents, setFilteredAgents] = useState([]);
  
  // Selected agent and their commission rates
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [agentCommissionRates, setAgentCommissionRates] = useState([]);
  
  // Form states
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRate, setEditingRate] = useState(null);
  
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
  }, [selectedGovernorate, agents]);

  useEffect(() => {
    if (selectedAgent) {
      fetchAgentCommissionRates(selectedAgent.id);
    }
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
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const updateTier = (index, field, value) => {
    const newTiers = [...tiers];
    newTiers[index][field] = value;
    setTiers(newTiers);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.agent_id) {
      toast.error('يرجى اختيار الصراف');
      return;
    }

    setLoading(true);

    try {
      const submitData = {
        agent_id: formData.agent_id,
        currency: formData.currency,
        bulletin_type: formData.bulletin_type,
        date: formData.date,
        tiers: tiers.map(tier => ({
          from_amount: parseFloat(tier.from_amount) || 0,
          to_amount: parseFloat(tier.to_amount) || 0,
          percentage: parseFloat(tier.percentage) || 0,
          city: tier.city === '(جميع المدن)' ? null : tier.city,
          country: tier.country === '(جميع البلدان)' ? null : tier.country,
          currency_type: tier.currency_type,
          type: tier.type
        }))
      };

      await axios.post(`${API}/commission-rates`, submitData);
      toast.success('تم حفظ نشرة الأسعار بنجاح!');
      
      // Reset form
      setFormData({
        agent_id: '',
        currency: 'IQD',
        bulletin_type: 'transfers',
        date: new Date().toISOString().split('T')[0],
      });
      setTiers([{
        from_amount: 0,
        to_amount: 1000000000,
        percentage: 0.25,
        city: 'بغداد',
        country: 'العراق',
        currency_type: 'normal',
        type: 'outgoing'
      }]);
      
    } catch (error) {
      console.error('Error saving commission rate:', error);
      toast.error('خطأ في حفظ نشرة الأسعار', {
        description: error.response?.data?.detail || 'حدث خطأ غير متوقع'
      });
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <Navbar />
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Header */}
        <Card className="shadow-lg border-0">
          <CardHeader className="bg-gradient-to-l from-secondary/20 to-secondary/10 p-6">
            <CardTitle className="text-3xl text-primary">💰 إدارة العمولات - نشرة الأسعار</CardTitle>
            <p className="text-gray-600 mt-2">تحديد نسب العمولات لكل صراف حسب شرائح المبالغ</p>
          </CardHeader>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Main Settings */}
          <Card className="shadow-lg">
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date" className="text-base font-bold">تاريخ النشرة</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="h-12"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency" className="text-base font-bold">العملة</Label>
                  <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                    <SelectTrigger className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IQD">دينار عراقي</SelectItem>
                      <SelectItem value="USD">دولار أمريكي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agent" className="text-base font-bold">الصراف *</Label>
                  <Select value={formData.agent_id} onValueChange={(value) => setFormData({ ...formData, agent_id: value })}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="اختر الصراف" />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bulletin_type" className="text-base font-bold">نوع النشرة</Label>
                  <Select value={formData.bulletin_type} onValueChange={(value) => setFormData({ ...formData, bulletin_type: value })}>
                    <SelectTrigger className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transfers">حوالات</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tiers Table */}
          <Card className="shadow-lg">
            <CardHeader className="bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl text-primary">شرائح العمولات</CardTitle>
                <Button
                  type="button"
                  onClick={addTier}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  ➕ إضافة شريحة
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-primary text-white">
                    <tr>
                      <th className="p-3 text-right text-sm">حذف</th>
                      <th className="p-3 text-right text-sm">البلد</th>
                      <th className="p-3 text-right text-sm">المدينة</th>
                      <th className="p-3 text-right text-sm">النوع</th>
                      <th className="p-3 text-right text-sm">نوع العملة</th>
                      <th className="p-3 text-right text-sm">حتى مبلغ</th>
                      <th className="p-3 text-right text-sm">نسبة من المبلغ</th>
                      <th className="p-3 text-right text-sm">خدمات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map((tier, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeTier(index)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            🗑️
                          </Button>
                        </td>
                        <td className="p-3">
                          <Select 
                            value={tier.country} 
                            onValueChange={(value) => updateTier(index, 'country', value)}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="(جميع البلدان)">(جميع البلدان)</SelectItem>
                              <SelectItem value="العراق">العراق</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3">
                          <Select 
                            value={tier.city} 
                            onValueChange={(value) => updateTier(index, 'city', value)}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              <SelectItem value="(جميع المدن)">(جميع المدن)</SelectItem>
                              {IRAQI_GOVERNORATES.map((gov) => (
                                <SelectItem key={gov.code} value={gov.name}>
                                  {gov.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3">
                          <Select 
                            value={tier.type} 
                            onValueChange={(value) => updateTier(index, 'type', value)}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="outgoing">صادر</SelectItem>
                              <SelectItem value="incoming">وارد</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3">
                          <Select 
                            value={tier.currency_type} 
                            onValueChange={(value) => updateTier(index, 'currency_type', value)}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="normal">عادية</SelectItem>
                              <SelectItem value="payable">علينا</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            value={tier.to_amount}
                            onChange={(e) => updateTier(index, 'to_amount', e.target.value)}
                            className="h-10 w-full"
                            step="0.01"
                            dir="ltr"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            value={tier.percentage}
                            onChange={(e) => updateTier(index, 'percentage', e.target.value)}
                            className="h-10 w-full"
                            step="0.01"
                            dir="ltr"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            value={0}
                            disabled
                            className="h-10 w-20 bg-gray-100"
                            dir="ltr"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden p-4 space-y-4">
                {tiers.map((tier, index) => (
                  <Card key={index} className="border-2 border-gray-200 shadow-md">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between mb-3 pb-3 border-b-2">
                        <span className="text-lg font-bold text-primary">شريحة #{index + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTier(index)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          🗑️ حذف
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-bold">البلد</Label>
                        <Select 
                          value={tier.country} 
                          onValueChange={(value) => updateTier(index, 'country', value)}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="(جميع البلدان)">(جميع البلدان)</SelectItem>
                            <SelectItem value="العراق">العراق</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-bold">المدينة</Label>
                        <Select 
                          value={tier.city} 
                          onValueChange={(value) => updateTier(index, 'city', value)}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            <SelectItem value="(جميع المدن)">(جميع المدن)</SelectItem>
                            {IRAQI_GOVERNORATES.map((gov) => (
                              <SelectItem key={gov.code} value={gov.name}>
                                {gov.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-sm font-bold">النوع</Label>
                          <Select 
                            value={tier.type} 
                            onValueChange={(value) => updateTier(index, 'type', value)}
                          >
                            <SelectTrigger className="h-11">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="outgoing">صادر</SelectItem>
                              <SelectItem value="incoming">وارد</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-bold">نوع العملة</Label>
                          <Select 
                            value={tier.currency_type} 
                            onValueChange={(value) => updateTier(index, 'currency_type', value)}
                          >
                            <SelectTrigger className="h-11">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="normal">عادية</SelectItem>
                              <SelectItem value="payable">علينا</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-sm font-bold">حتى مبلغ</Label>
                          <Input
                            type="number"
                            value={tier.to_amount}
                            onChange={(e) => updateTier(index, 'to_amount', e.target.value)}
                            className="h-11"
                            step="0.01"
                            dir="ltr"
                            placeholder="0"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-bold">نسبة %</Label>
                          <Input
                            type="number"
                            value={tier.percentage}
                            onChange={(e) => updateTier(index, 'percentage', e.target.value)}
                            className="h-11"
                            step="0.01"
                            dir="ltr"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/dashboard')}
              className="flex-1 h-12 text-lg border-2"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-secondary hover:bg-secondary/90 text-primary h-12 text-lg font-bold"
            >
              {loading ? 'جاري الحفظ...' : '💾 حفظ'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CommissionsManagementPage;
