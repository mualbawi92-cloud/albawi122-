import React, { useState, useEffect } from 'react';
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
  const [commissionData, setCommissionData] = useState({
    percentage: 0,
    amount: 0,
    loading: false
  });

  // Calculate commission when amount, currency, or governorate changes
  useEffect(() => {
    const calculateCommission = async () => {
      // Only calculate if we have all required fields
      if (!formData.amount || parseFloat(formData.amount) <= 0 || !formData.currency || !formData.to_governorate) {
        setCommissionData({ percentage: 0, amount: 0, loading: false });
        return;
      }

      setCommissionData(prev => ({ ...prev, loading: true }));

      try {
        const response = await axios.get(`${API}/commission/calculate-preview`, {
          params: {
            amount: parseFloat(formData.amount),
            currency: formData.currency,
            to_governorate: formData.to_governorate
          }
        });

        setCommissionData({
          percentage: response.data.commission_percentage || 0,
          amount: response.data.commission_amount || 0,
          loading: false
        });
      } catch (error) {
        console.error('Error calculating commission:', error);
        setCommissionData({ percentage: 0, amount: 0, loading: false });
      }
    };

    // Debounce the calculation to avoid too many API calls
    const timeoutId = setTimeout(calculateCommission, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.amount, formData.currency, formData.to_governorate]);

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

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>طباعة الحوالة - ${result.transfer_number}</title>
        <style>
          @media print {
            @page { margin: 1cm; }
          }
          body {
            font-family: 'Cairo', 'Arial', sans-serif;
            direction: rtl;
            text-align: right;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #1e3a5f;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .title {
            font-size: 32px;
            font-weight: bold;
            color: #1e3a5f;
            margin-bottom: 10px;
          }
          .transfer-number {
            font-size: 28px;
            font-weight: bold;
            color: #d4af37;
            background: #f8f9fa;
            padding: 10px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .section {
            margin: 25px 0;
            padding: 20px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
          }
          .label {
            font-size: 14px;
            color: #666;
            margin-bottom: 5px;
          }
          .value {
            font-size: 18px;
            font-weight: bold;
            color: #333;
            margin-bottom: 15px;
          }
          .pin-section {
            background: #fff5f5;
            border: 3px solid #e53e3e;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
          }
          .pin {
            font-size: 48px;
            font-weight: bold;
            color: #e53e3e;
            letter-spacing: 8px;
            margin: 20px 0;
          }
          .warning {
            color: #e53e3e;
            font-weight: bold;
            font-size: 16px;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #e0e0e0;
            text-align: center;
            color: #666;
            font-size: 14px;
          }
          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
          }
          @media print {
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">🏦 نظام الحوالات المالية</div>
          <div class="transfer-number">رقم الحوالة: ${result.transfer_number || 'غير متوفر'}</div>
        </div>

        <div class="section">
          <div class="grid">
            <div>
              <div class="label">اسم المرسل</div>
              <div class="value">${result.sender_name}</div>
            </div>
            ${result.sender_phone ? `
            <div>
              <div class="label">رقم تلفون المرسل</div>
              <div class="value">${result.sender_phone}</div>
            </div>
            ` : ''}
            <div>
              <div class="label">اسم المستلم</div>
              <div class="value">${result.receiver_name}</div>
            </div>
            <div>
              <div class="label">المبلغ</div>
              <div class="value">${result.amount.toLocaleString()} ${result.currency}</div>
            </div>
            <div>
              <div class="label">رمز الحوالة</div>
              <div class="value">${result.transfer_code}</div>
            </div>
            <div>
              <div class="label">إلى محافظة</div>
              <div class="value">${result.to_governorate}</div>
            </div>
            ${result.from_agent_name ? `
            <div>
              <div class="label">الصراف المرسل</div>
              <div class="value">${result.from_agent_name}</div>
            </div>
            ` : ''}
            ${result.to_agent_name ? `
            <div>
              <div class="label">الصراف المستلم</div>
              <div class="value">${result.to_agent_name}</div>
            </div>
            ` : ''}
          </div>
        </div>

        <div class="pin-section">
          <div class="label">الرقم السري (PIN)</div>
          <div class="pin">${result.pin}</div>
          <div class="warning">⚠️ أعطِ هذا الرقم للمستلِم فقط! احتفظ بهذه الورقة بأمان.</div>
        </div>

        <div class="footer">
          <p>تاريخ الإنشاء: ${new Date().toLocaleDateString('ar-IQ')} - ${new Date().toLocaleTimeString('ar-IQ')}</p>
          <p>نظام الحوالات المالية - جميع الحقوق محفوظة</p>
        </div>

        <div style="text-align: center; margin-top: 30px;">
          <button onclick="window.print()" style="padding: 15px 40px; font-size: 18px; background: #1e3a5f; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
            🖨️ طباعة
          </button>
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
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

              <div className="space-y-3 pt-4">
                <Button
                  onClick={handlePrint}
                  className="w-full bg-green-600 hover:bg-green-700 text-white text-lg font-bold py-6"
                >
                  🖨️ طباعة الحوالة
                </Button>
                
                <div className="flex gap-4">
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
                        sender_phone: '',
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

              {/* Commission Display */}
              {formData.amount && parseFloat(formData.amount) > 0 && formData.to_governorate && (
                <div className="bg-blue-50 border-2 border-blue-300 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-bold text-blue-900">نسبة العمولة على الحوالة</Label>
                    {commissionData.loading && (
                      <span className="text-xs text-blue-600">جاري الحساب...</span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-3 rounded border border-blue-200">
                      <Label className="text-xs text-muted-foreground">نسبة العمولة</Label>
                      <p className="text-2xl font-bold text-blue-700" data-testid="commission-percentage">
                        {commissionData.percentage.toFixed(2)}%
                      </p>
                    </div>
                    <div className="bg-white p-3 rounded border border-blue-200">
                      <Label className="text-xs text-muted-foreground">مبلغ العمولة</Label>
                      <p className="text-2xl font-bold text-blue-700" data-testid="commission-amount">
                        {commissionData.amount.toLocaleString()} {formData.currency}
                      </p>
                    </div>
                  </div>
                  
                  {commissionData.percentage === 0 && !commissionData.loading && (
                    <p className="text-xs text-blue-700">
                      ℹ️ لم يتم تحديد نسبة عمولة لهذه الحوالة من قبل المدير
                    </p>
                  )}
                </div>
              )}

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

              {/* Commission Info in Modal */}
              {formData.to_governorate && commissionData.percentage >= 0 && (
                <div className="bg-blue-50 p-3 rounded border border-blue-200">
                  <Label className="text-xs text-muted-foreground mb-2 block">معلومات العمولة</Label>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">نسبة العمولة:</span>
                      <span className="font-bold text-blue-700 mr-2">{commissionData.percentage.toFixed(2)}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">مبلغ العمولة:</span>
                      <span className="font-bold text-blue-700 mr-2">
                        {commissionData.amount.toLocaleString()} {formData.currency}
                      </span>
                    </div>
                  </div>
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