import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
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

const EditAgentPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agent, setAgent] = useState(null);
  const [formData, setFormData] = useState({
    display_name: '',
    phone: '',
    governorate: '',
    wallet_limit_iqd: '',
    wallet_limit_usd: '',
    new_password: '',
    confirm_password: ''
  });

  // Check if user is admin
  if (user?.role !== 'admin') {
    navigate('/dashboard');
    return null;
  }

  useEffect(() => {
    fetchAgent();
  }, [id]);

  const fetchAgent = async () => {
    try {
      const response = await axios.get(`${API}/agents`);
      const foundAgent = response.data.find(a => a.id === id);
      
      if (foundAgent) {
        setAgent(foundAgent);
        setFormData({
          display_name: foundAgent.display_name,
          phone: foundAgent.phone,
          governorate: foundAgent.governorate,
          new_password: '',
          confirm_password: ''
        });
      } else {
        toast.error('الصراف غير موجود');
        navigate('/agents');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching agent:', error);
      toast.error('خطأ في تحميل بيانات الصراف');
      navigate('/agents');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Validate password confirmation
      if (formData.new_password && formData.new_password !== formData.confirm_password) {
        toast.error('كلمات المرور غير متطابقة');
        setSaving(false);
        return;
      }

      const updateData = {
        display_name: formData.display_name,
        phone: formData.phone,
        governorate: formData.governorate
      };

      if (formData.new_password) {
        updateData.new_password = formData.new_password;
      }

      await axios.put(`${API}/users/${id}`, updateData);
      
      toast.success('تم تحديث معلومات الصراف بنجاح!');
      navigate('/agents');
    } catch (error) {
      console.error('Error updating agent:', error);
      toast.error('خطأ في التحديث', {
        description: error.response?.data?.detail || 'حدث خطأ غير متوقع'
      });
    }

    setSaving(false);
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
    <div className="min-h-screen bg-background" data-testid="edit-agent-page">
      <Navbar />
      <div className="container mx-auto p-3 sm:p-6 max-w-2xl">
        <Card className="shadow-2xl border-2 border-secondary">
          <CardHeader className="bg-gradient-to-l from-secondary/20 to-secondary/10 p-4 sm:p-6">
            <CardTitle className="text-2xl sm:text-3xl text-primary">✏️ تعديل معلومات الصراف</CardTitle>
            <CardDescription className="text-sm sm:text-base">تعديل معلومات: {agent?.display_name}</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-base">اسم المستخدم</Label>
                <Input
                  id="username"
                  value={agent?.username || ''}
                  disabled
                  className="bg-muted text-base h-12"
                />
                <p className="text-xs text-muted-foreground">لا يمكن تغيير اسم المستخدم</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="display_name" className="text-base font-bold">اسم الصيرفة *</Label>
                <Input
                  id="display_name"
                  data-testid="display-name-input"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  required
                  className="text-base h-12"
                  placeholder="اسم الصيرفة"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-base font-bold">رقم الهاتف *</Label>
                <Input
                  id="phone"
                  data-testid="phone-input"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                  className="text-base h-12"
                  placeholder="+9647801234567"
                  dir="ltr"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="governorate" className="text-base font-bold">المحافظة *</Label>
                <Select value={formData.governorate} onValueChange={(value) => setFormData({ ...formData, governorate: value })}>
                  <SelectTrigger data-testid="governorate-select" className="h-12 text-base">
                    <SelectValue placeholder="اختر المحافظة" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {IRAQI_GOVERNORATES.map((gov) => (
                      <SelectItem key={gov.code} value={gov.code}>{gov.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Password Change Section */}
              <div className="bg-yellow-50 border-2 border-yellow-300 p-4 rounded-lg space-y-4">
                <h3 className="text-lg font-bold text-yellow-900">تغيير كلمة المرور (اختياري)</h3>
                <p className="text-sm text-yellow-800">كمدير، يمكنك تغيير كلمة مرور الصراف مباشرة</p>

                <div className="space-y-2">
                  <Label htmlFor="new_password" className="text-base">كلمة المرور الجديدة</Label>
                  <Input
                    id="new_password"
                    data-testid="new-password-input"
                    type="password"
                    value={formData.new_password}
                    onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                    className="text-base h-12"
                    placeholder="كلمة المرور الجديدة (6 أحرف على الأقل)"
                    minLength={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm_password" className="text-base">تأكيد كلمة المرور</Label>
                  <Input
                    id="confirm_password"
                    data-testid="confirm-password-input"
                    type="password"
                    value={formData.confirm_password}
                    onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                    className="text-base h-12"
                    placeholder="أعد إدخال كلمة المرور الجديدة"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
                <Button
                  type="button"
                  onClick={() => navigate('/agents')}
                  variant="outline"
                  className="w-full sm:flex-1 h-12 text-base sm:text-lg font-bold border-2"
                  data-testid="cancel-btn"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:flex-1 bg-secondary hover:bg-secondary/90 text-primary h-12 text-base sm:text-lg font-bold"
                  data-testid="save-btn"
                >
                  {saving ? 'جاري الحفظ...' : '💾 حفظ التغييرات'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EditAgentPage;
