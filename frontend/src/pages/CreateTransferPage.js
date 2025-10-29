import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import { formatAmountInWords } from '../utils/arabicNumbers';

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

const CreateTransferPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    sender_name: '',
    sender_phone: '',
    receiver_name: '',
    amount: '',
    currency: 'IQD',
    to_governorate: '',
    to_agent_id: '',
    note: ''
  });
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleGovernorateChange = async (value) => {
    setFormData({ ...formData, to_governorate: value, to_agent_id: '' });
    
    // Fetch agents for selected governorate
    try {
      const response = await axios.get(`${API}/agents?governorate=${value}`);
      setAgents(response.data);
    } catch (error) {
      console.error('Error fetching agents:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Show confirmation modal instead of submitting directly
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = async () => {
    setShowConfirmModal(false);
    setLoading(true);

    try {
      const submitData = {
        sender_name: formData.sender_name,
        sender_phone: formData.sender_phone || null,
        receiver_name: formData.receiver_name,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        to_governorate: formData.to_governorate,
        to_agent_id: formData.to_agent_id || null,
        note: formData.note || null
      };

      const response = await axios.post(`${API}/transfers`, submitData);
      setResult(response.data);
      
      toast.success('تم إنشاء الحوالة بنجاح!');
    } catch (error) {
      console.error('Error creating transfer:', error);
      toast.error('خطأ في إنشاء الحوالة', {
        description: error.response?.data?.detail || 'حدث خطأ غير متوقع'
      });
    }

    setLoading(false);
  };

  if (result) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto p-6 max-w-2xl">
          <Card className="shadow-2xl border-2 border-secondary" data-testid="transfer-success-card">
            <CardHeader className="bg-gradient-to-l from-secondary/20 to-secondary/10">
              <div className="text-center space-y-4">
                <div className="mx-auto w-24 h-24 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <CardTitle className="text-3xl text-primary">تم إنشاء الحوالة بنجاح!</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="bg-primary/5 p-6 rounded-xl space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">رقم الحوالة</Label>
                    <p className="text-2xl font-bold text-secondary">{result.transfer_number || 'غير متوفر'}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">رمز الحوالة</Label>
                    <p className="text-lg font-bold text-primary" data-testid="transfer-code-display">{result.transfer_code}</p>
                  </div>
                </div>
                <div className="bg-red-50 border-2 border-red-500 p-6 rounded-xl">
                  <Label className="text-sm text-red-700 font-bold">رقم PIN (لمرة واحدة فقط)</Label>
                  <p className="text-5xl font-black text-red-600 text-center my-4 tracking-widest" data-testid="pin-display">{result.pin}</p>
                  <p className="text-sm text-red-700 font-bold">⚠️ أعطِ هذا الرقم للمستلِم فقط! لن يظهر مرة أخرى.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-base">
                <div>
                  <Label className="text-muted-foreground">اسم المرسل</Label>
                  <p className="font-bold">{result.sender_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">المبلغ</Label>
                  <p className="font-bold text-secondary text-2xl">{result.amount.toLocaleString()} {result.currency}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">إلى محافظة</Label>
                  <p className="font-bold">{result.to_governorate}</p>
                </div>
                {result.to_agent_name && (
                  <div>
                    <Label className="text-muted-foreground">الصراف المستلم</Label>
                    <p className="font-bold">{result.to_agent_name}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  onClick={() => navigate('/dashboard')}
                  className="flex-1 bg-primary hover:bg-primary/90 text-lg font-bold py-6"
                  data-testid="back-to-dashboard-btn"
                >
                  العودة للرئيسية
                </Button>
                <Button
                  onClick={() => {
                    setResult(null);
                    setFormData({
                      sender_name: '',
                      receiver_name: '',
                      amount: '',
                      currency: 'IQD',
                      to_governorate: '',
                      to_agent_id: '',
                      note: ''
                    });
                  }}
                  variant="outline"
                  className="flex-1 border-2 border-secondary text-lg font-bold py-6"
                  data-testid="create-another-btn"
                >
                  إنشاء حوالة أخرى
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-3 sm:p-6 max-w-2xl">
        <Card className="shadow-xl" data-testid="create-transfer-form">
          <CardHeader className="bg-gradient-to-l from-primary/10 to-primary/5 p-4 sm:p-6">
            <CardTitle className="text-2xl sm:text-3xl text-primary">إنشاء حوالة جديدة</CardTitle>
            <CardDescription className="text-sm sm:text-base">املأ بيانات الحوالة بعناية</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="sender_name" className="text-base font-bold">اسم المرسل الثلاثي *</Label>
                <Input
                  id="sender_name"
                  data-testid="sender-name-input"
                  value={formData.sender_name}
                  onChange={(e) => setFormData({ ...formData, sender_name: e.target.value })}
                  required
                  maxLength={100}
                  className="text-base h-12"
                  placeholder="أدخل اسم المرسل الثلاثي"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sender_phone" className="text-base font-bold">رقم تلفون المرسل</Label>
                <Input
                  id="sender_phone"
                  type="tel"
                  value={formData.sender_phone}
                  onChange={(e) => setFormData({ ...formData, sender_phone: e.target.value })}
                  className="text-base h-12"
                  placeholder="+9647801234567"
                  dir="ltr"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="receiver_name" className="text-base font-bold">اسم المستلم الثلاثي *</Label>
                <Input
                  id="receiver_name"
                  data-testid="receiver-name-input"
                  value={formData.receiver_name}
                  onChange={(e) => setFormData({ ...formData, receiver_name: e.target.value })}
                  required
                  maxLength={100}
                  className="text-base h-12"
                  placeholder="أدخل اسم المستلم الثلاثي"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-base font-bold">المبلغ *</Label>
                  <Input
                    id="amount"
                    data-testid="amount-input"
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                    min="0"
                    step="0.01"
                    className="text-base h-12"
                    placeholder="0.00"
                  />
                  {formData.amount && parseFloat(formData.amount) > 0 && (
                    <p className="text-xs text-gray-600 italic bg-gray-50 p-2 rounded border border-gray-200">
                      💬 {formatAmountInWords(parseFloat(formData.amount), formData.currency)}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency" className="text-base font-bold">العملة *</Label>
                  <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                    <SelectTrigger data-testid="currency-select" className="h-12 text-base">
                      <SelectValue placeholder="اختر العملة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IQD">دينار عراقي (IQD)</SelectItem>
                      <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="to_governorate" className="text-base font-bold">إلى محافظة *</Label>
                <Select value={formData.to_governorate} onValueChange={handleGovernorateChange}>
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

              {agents.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="to_agent_id" className="text-base font-bold">اختر صراف محدد (اختياري)</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    {agents.length} صراف متوفر في {IRAQI_GOVERNORATES.find(g => g.code === formData.to_governorate)?.name}
                  </p>
                  <Select value={formData.to_agent_id || "all"} onValueChange={(value) => setFormData({ ...formData, to_agent_id: value === "all" ? "" : value })}>
                    <SelectTrigger data-testid="agent-select" className="h-12 text-base">
                      <SelectValue placeholder="إرسال لكل الصرافين" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="all">🌐 إرسال لكل صرافي المحافظة</SelectItem>
                      {agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.display_name} - {agent.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.to_governorate && agents.length === 0 && (
                <div className="bg-yellow-50 border-2 border-yellow-300 p-4 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ لا يوجد صرافين نشطين في {IRAQI_GOVERNORATES.find(g => g.code === formData.to_governorate)?.name}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="note" className="text-base font-bold">ملاحظات (اختياري)</Label>
                <Input
                  id="note"
                  data-testid="note-input"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="text-base h-12"
                  placeholder="ملاحظات إضافية"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  onClick={() => navigate('/dashboard')}
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
                  data-testid="submit-transfer-btn"
                >
                  {loading ? 'جاري الإنشاء...' : 'إنشاء الحوالة'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Confirmation Modal */}
        <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl text-primary">تأكيد إنشاء الحوالة</DialogTitle>
              <DialogDescription className="text-base">
                يرجى مراجعة بيانات الحوالة قبل التأكيد
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">المرسل</Label>
                  <p className="font-bold">{formData.sender_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">المستلم</Label>
                  <p className="font-bold">{formData.receiver_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">المبلغ</Label>
                  <p className="font-bold text-secondary text-lg">
                    {parseFloat(formData.amount || 0).toLocaleString()} {formData.currency}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">إلى محافظة</Label>
                  <p className="font-bold">
                    {IRAQI_GOVERNORATES.find(g => g.code === formData.to_governorate)?.name}
                  </p>
                </div>
              </div>
              
              {formData.amount && parseFloat(formData.amount) > 0 && (
                <div className="bg-gray-50 p-3 rounded border">
                  <Label className="text-xs text-muted-foreground">المبلغ بالكلمات</Label>
                  <p className="text-sm font-medium">
                    {formatAmountInWords(parseFloat(formData.amount), formData.currency)}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1"
              >
                تراجع
              </Button>
              <Button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={loading}
                className="flex-1 bg-secondary hover:bg-secondary/90 text-primary"
              >
                {loading ? 'جاري الإنشاء...' : 'تأكيد الإنشاء'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default CreateTransferPage;