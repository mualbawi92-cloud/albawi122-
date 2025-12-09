import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// المحافظات العراقية الكاملة
const IRAQI_GOVERNORATES = [
  { code: 'BG', name: 'بغداد', nameEn: 'Baghdad' },
  { code: 'BS', name: 'البصرة', nameEn: 'Basra' },
  { code: 'NJ', name: 'النجف', nameEn: 'Najaf' },
  { code: 'KR', name: 'كربلاء', nameEn: 'Karbala' },
  { code: 'BB', name: 'بابل', nameEn: 'Babel' },
  { code: 'AN', name: 'الأنبار', nameEn: 'Anbar' },
  { code: 'DY', name: 'ديالى', nameEn: 'Diyala' },
  { code: 'WS', name: 'واسط', nameEn: 'Wasit' },
  { code: 'SA', name: 'صلاح الدين', nameEn: 'Salah al-Din' },
  { code: 'NI', name: 'نينوى', nameEn: 'Nineveh' },
  { code: 'DQ', name: 'ذي قار', nameEn: 'Dhi Qar' },
  { code: 'QA', name: 'القادسية', nameEn: 'Al-Qadisiyyah' },
  { code: 'MY', name: 'المثنى', nameEn: 'Al-Muthanna' },
  { code: 'MI', name: 'ميسان', nameEn: 'Maysan' },
  { code: 'KI', name: 'كركوك', nameEn: 'Kirkuk' },
  { code: 'ER', name: 'أربيل', nameEn: 'Erbil' },
  { code: 'SU', name: 'السليمانية', nameEn: 'Sulaymaniyah' },
  { code: 'DH', name: 'دهوك', nameEn: 'Dohuk' }
];

const AddAgentPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    display_name: '',
    owner_name: '',
    phone: '',
    governorate: '',
    address: '',
    account_code: '', // رقم الحساب المحاسبي - إجباري
    wallet_limit_iqd: '',
    wallet_limit_usd: ''
  });

  // Fetch available accounts on mount
  useEffect(() => {
    fetchAvailableAccounts();
  }, []);

  const fetchAvailableAccounts = async () => {
    try {
      const response = await axios.get(`${API}/agents/available-accounts`);
      setAccounts(response.data.accounts || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast.error('خطأ في تحميل الحسابات');
    }
  };

  // Check if user is admin
  if (user?.role !== 'admin') {
    navigate('/dashboard');
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.account_code) {
      toast.error('⚠️ يجب اختيار حساب مالي من قسم شركات الصرافة قبل حفظ الصراف');
      return;
    }

    setLoading(true);

    try {
      const submitData = {
        username: formData.username,
        password: formData.password,
        display_name: formData.display_name,
        governorate: formData.governorate,
        phone: formData.phone,
        address: formData.address,
        account_code: formData.account_code, // إجباري
        role: 'agent',
        wallet_limit_iqd: parseFloat(formData.wallet_limit_iqd) || 0,
        wallet_limit_usd: parseFloat(formData.wallet_limit_usd) || 0
      };

      await axios.post(`${API}/register`, submitData);
      
      toast.success('تم إضافة الصراف بنجاح!', {
        description: `تم إنشاء حساب ${formData.display_name}`
      });
      
      navigate('/agents');
    } catch (error) {
      console.error('Error creating agent:', error);
      
      // Handle specific errors
      if (error.response?.status === 401) {
        toast.error('انتهت صلاحية الجلسة', {
          description: 'يرجى تسجيل الدخول مرة أخرى'
        });
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        toast.error('خطأ في إضافة الصراف', {
          description: error.response?.data?.detail || 'حدث خطأ غير متوقع'
        });
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="add-agent-page">
      
      <div className="container mx-auto p-6 max-w-2xl">
        <Card className="shadow-2xl border-2 border-secondary">
          <CardHeader className="bg-gradient-to-l from-secondary/20 to-secondary/10">
            <CardTitle className="text-3xl text-primary">➕ إضافة صراف جديد</CardTitle>
            <CardDescription className="text-base">املأ بيانات الصراف بعناية</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="display_name" className="text-base font-bold">اسم الصيرفة *</Label>
                <Input
                  id="display_name"
                  data-testid="display-name-input"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  required
                  className="text-base h-12"
                  placeholder="مثال: صيرفة بغداد المركزية"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="owner_name" className="text-base font-bold">اسم المالك (اختياري)</Label>
                <Input
                  id="owner_name"
                  data-testid="owner-name-input"
                  value={formData.owner_name}
                  onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                  className="text-base h-12"
                  placeholder="مثال: أحمد محمد علي"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username" className="text-base font-bold">اسم المستخدم *</Label>
                <Input
                  id="username"
                  data-testid="username-input"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                  required
                  className="text-base h-12"
                  placeholder="مثال: baghdad_central"
                />
                <p className="text-xs text-muted-foreground">سيتم تحويل المسافات إلى (_)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-base font-bold">كلمة المرور *</Label>
                <Input
                  id="password"
                  data-testid="password-input"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                  className="text-base h-12"
                  placeholder="كلمة مرور قوية (6 أحرف على الأقل)"
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
                  placeholder="مثال: +9647801234567"
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
                      <SelectItem key={gov.code} value={gov.code}>
                        {gov.name} ({gov.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address" className="text-base font-bold">عنوان الصيرفة</Label>
                <Input
                  id="address"
                  data-testid="address-input"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="text-base h-12"
                  placeholder="مثال: شارع الرشيد، قرب ساحة التحرير"
                />
              </div>

              {/* Accounting Account Selection - REQUIRED */}
              <div className="space-y-2 bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
                <Label htmlFor="account_code" className="text-base font-bold text-red-600">
                  🔗 الحساب المحاسبي المرتبط * (إجباري)
                </Label>
                <select
                  id="account_code"
                  data-testid="account-code-select"
                  value={formData.account_code}
                  onChange={(e) => setFormData({ ...formData, account_code: e.target.value })}
                  required
                  className="w-full border rounded-md p-3 text-base h-12"
                >
                  <option value="">اختر حساب من قسم شركات الصرافة</option>
                  {accounts
                    .filter(acc => !acc.is_linked) // فقط الحسابات غير المرتبطة
                    .map(acc => (
                      <option key={acc.code} value={acc.code}>
                        [{acc.code}] {acc.name || acc.name_ar}
                      </option>
                    ))
                  }
                </select>
                <p className="text-sm text-gray-600 mt-1">
                  💡 يجب اختيار حساب من قسم "شركات الصرافة" لربطه بالصراف
                </p>
                {accounts.filter(acc => !acc.is_linked).length === 0 && (
                  <p className="text-sm text-red-600 mt-1">
                    ⚠️ لا توجد حسابات متاحة! يرجى إنشاء حساب جديد من الدليل المحاسبي أولاً
                  </p>
                )}
              </div>

              {/* Wallet Limits */}
              <div className="space-y-2">
                <Label htmlFor="wallet_limit_iqd" className="text-base font-bold">
                  الحد الأقصى للمحفظة بالدينار (IQD)
                </Label>
                <Input
                  id="wallet_limit_iqd"
                  type="number"
                  value={formData.wallet_limit_iqd}
                  onChange={(e) => setFormData({ ...formData, wallet_limit_iqd: e.target.value })}
                  className="text-base h-12"
                  placeholder="مثال: 20000000"
                  min="0"
                />
                <p className="text-xs text-gray-600">
                  الحد الأقصى الذي يمكن للصيرفة طلبه من المحفظة بالدينار
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="wallet_limit_usd" className="text-base font-bold">
                  الحد الأقصى للمحفظة بالدولار (USD)
                </Label>
                <Input
                  id="wallet_limit_usd"
                  type="number"
                  value={formData.wallet_limit_usd}
                  onChange={(e) => setFormData({ ...formData, wallet_limit_usd: e.target.value })}
                  className="text-base h-12"
                  placeholder="مثال: 50000"
                  min="0"
                />
                <p className="text-xs text-gray-600">
                  الحد الأقصى الذي يمكن للصيرفة طلبه من المحفظة بالدولار
                </p>
              </div>

              <div className="bg-blue-50 border-2 border-blue-300 p-4 rounded-lg">
                <p className="text-sm text-blue-800">
                  ℹ️ <strong>ملاحظة:</strong> سيتم إنشاء حساب صراف جديد بالمعلومات المدخلة. 
                  تأكد من حفظ اسم المستخدم وكلمة المرور لإعطائها للصراف.
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  onClick={() => navigate('/agents')}
                  variant="outline"
                  className="flex-1 h-12 text-lg font-bold border-2"
                  data-testid="cancel-btn"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-secondary hover:bg-secondary/90 text-primary h-12 text-lg font-bold"
                  data-testid="submit-agent-btn"
                >
                  {loading ? 'جاري الإضافة...' : '✅ إضافة الصراف'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AddAgentPage;
