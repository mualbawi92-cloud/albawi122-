import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import api from '../services/api';


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

const SettingsPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    display_name: user?.display_name || '',
    phone: user?.phone || '',
    governorate: user?.governorate || '',
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate password confirmation
      if (formData.new_password && formData.new_password !== formData.confirm_password) {
        toast.error('كلمات المرور غير متطابقة');
        setLoading(false);
        return;
      }

      const updateData = {
        display_name: formData.display_name,
        phone: formData.phone,
        governorate: formData.governorate
      };

      if (formData.new_password) {
        updateData.current_password = formData.current_password;
        updateData.new_password = formData.new_password;
      }

      await api.put('/profile', updateData);
      
      toast.success('تم تحديث المعلومات بنجاح!');
      
      // Clear password fields
      setFormData({
        ...formData,
        current_password: '',
        new_password: '',
        confirm_password: ''
      });

      // If password changed, logout
      if (formData.new_password) {
        toast.info('تم تغيير كلمة المرور. يرجى تسجيل الدخول مرة أخرى');
        setTimeout(() => {
          logout();
          navigate('/login');
        }, 2000);
      } else {
        // Reload page to update user info
        window.location.reload();
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('خطأ في التحديث', {
        description: error.response?.data?.detail || 'حدث خطأ غير متوقع'
      });
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="settings-page">
      
      <div className="container mx-auto p-3 sm:p-6 max-w-2xl">
        <Card className="shadow-2xl">
          <CardHeader className="bg-gradient-to-l from-primary/10 to-primary/5 p-4 sm:p-6">
            <CardTitle className="text-2xl sm:text-3xl text-primary">⚙️ الإعدادات</CardTitle>
            <CardDescription className="text-sm sm:text-base">تعديل المعلومات الشخصية</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* User Info Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-primary border-b pb-2">المعلومات الأساسية</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-base">اسم المستخدم</Label>
                  <Input
                    id="username"
                    value={user?.username || ''}
                    disabled
                    className="bg-muted text-base h-12"
                  />
                  <p className="text-xs text-muted-foreground">لا يمكن تغيير اسم المستخدم</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role" className="text-base">الدور</Label>
                  <Input
                    id="role"
                    value={user?.role === 'admin' ? 'مدير' : 'صراف'}
                    disabled
                    className="bg-muted text-base h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="display_name" className="text-base font-bold">اسم العرض *</Label>
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
              </div>

              {/* Password Change Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-primary border-b pb-2">تغيير كلمة المرور</h3>
                <p className="text-sm text-muted-foreground">اترك الحقول فارغة إذا لم ترغب في تغيير كلمة المرور</p>

                <div className="space-y-2">
                  <Label htmlFor="current_password" className="text-base">كلمة المرور الحالية</Label>
                  <Input
                    id="current_password"
                    data-testid="current-password-input"
                    type="password"
                    value={formData.current_password}
                    onChange={(e) => setFormData({ ...formData, current_password: e.target.value })}
                    className="text-base h-12"
                    placeholder="أدخل كلمة المرور الحالية"
                  />
                </div>

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
                  onClick={() => navigate('/dashboard')}
                  variant="outline"
                  className="w-full sm:flex-1 h-12 text-base sm:text-lg font-bold border-2"
                  data-testid="cancel-btn"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:flex-1 bg-secondary hover:bg-secondary/90 text-primary h-12 text-base sm:text-lg font-bold"
                  data-testid="save-btn"
                >
                  {loading ? 'جاري الحفظ...' : '💾 حفظ التغييرات'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;
