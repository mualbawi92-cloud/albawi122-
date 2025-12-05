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
    receiver_phone: '',
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
  const [showAgentInfoModal, setShowAgentInfoModal] = useState(false);
  const [selectedAgentInfo, setSelectedAgentInfo] = useState(null);
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

  const handleShowAgentInfo = () => {
    if (!formData.to_agent_id || formData.to_agent_id === "all") {
      toast.error('الرجاء اختيار وكيل محدد');
      return;
    }
    const agent = agents.find(a => a.id === formData.to_agent_id);
    if (agent) {
      setSelectedAgentInfo(agent);
      setShowAgentInfoModal(true);
    }
  };

  const handleCopyAgentInfo = () => {
    if (!selectedAgentInfo) return;
    const govName = IRAQI_GOVERNORATES.find(g => g.code === selectedAgentInfo.governorate)?.name || 'غير محدد';
    const info = `اسم الوكيل: ${selectedAgentInfo.display_name}\nرقم الهاتف: ${selectedAgentInfo.phone || 'غير متوفر'}\nالمحافظة: ${govName}`;
    
    navigator.clipboard.writeText(info).then(() => {
      toast.success('تم نسخ معلومات الوكيل');
    }).catch(() => {
      toast.error('فشل النسخ');
    });
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
          @page {
            size: A5 landscape;
            margin: 0;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Arial', sans-serif;
            direction: rtl;
            background: white;
            width: 210mm;
            height: 148mm;
            margin: 0 auto;
            padding: 8mm;
          }
          .voucher {
            border: 2px solid #000;
            padding: 8mm;
            height: 100%;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #000;
            padding-bottom: 5mm;
            margin-bottom: 5mm;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #333;
          }
          .title {
            font-size: 20px;
            font-weight: bold;
            text-align: center;
            flex: 1;
          }
          .barcode-area {
            width: 60px;
            height: 60px;
            border: 1px solid #ccc;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3mm;
            font-size: 11px;
          }
          .info-box {
            display: flex;
            gap: 5px;
          }
          .info-label {
            font-weight: bold;
          }
          .main-table {
            width: 100%;
            border-collapse: collapse;
            margin: 5mm 0;
            font-size: 11px;
          }
          .main-table td {
            border: 1px solid #000;
            padding: 3mm 2mm;
          }
          .main-table .label-col {
            width: 30%;
            font-weight: bold;
            background: #f0f0f0;
          }
          .main-table .value-col {
            width: 70%;
          }
          .amounts-table {
            width: 100%;
            border-collapse: collapse;
            margin: 5mm 0;
            font-size: 11px;
          }
          .amounts-table th {
            border: 1px solid #000;
            padding: 2mm;
            background: #333;
            color: white;
            font-weight: bold;
          }
          .amounts-table td {
            border: 1px solid #000;
            padding: 2mm;
            text-align: center;
          }
          .pin-section {
            border: 2px solid #e53e3e;
            background: #fff5f5;
            padding: 3mm;
            text-align: center;
            margin: 5mm 0;
          }
          .pin-label {
            font-size: 12px;
            color: #e53e3e;
            font-weight: bold;
            margin-bottom: 2mm;
          }
          .pin-code {
            font-size: 28px;
            font-weight: bold;
            color: #e53e3e;
            letter-spacing: 8px;
            margin: 2mm 0;
          }
          .warning-text {
            font-size: 9px;
            color: #e53e3e;
            margin-top: 2mm;
          }
          .notes-box {
            border: 1px solid #000;
            padding: 3mm;
            margin: 3mm 0;
            min-height: 15mm;
            font-size: 10px;
          }
          .signatures {
            display: flex;
            justify-content: space-around;
            margin-top: 8mm;
          }
          .sig-box {
            text-align: center;
            width: 30%;
          }
          .sig-line {
            border-top: 1px solid #000;
            margin-bottom: 2mm;
          }
          .sig-label {
            font-size: 10px;
            font-weight: bold;
          }
          @media print {
            button { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="voucher">
          <!-- Header -->
          <div class="header">
            <div class="logo">🏦</div>
            <div class="title">وصل تحويل مالي</div>
            <div class="barcode-area"></div>
          </div>

          <!-- Basic Info -->
          <div class="info-row">
            <div class="info-box">
              <span class="info-label">رقم الوصل:</span>
              <span>${result.tracking_number || result.transfer_number || 'غير متوفر'}</span>
            </div>
            <div class="info-box">
              <span class="info-label">التاريخ:</span>
              <span>${new Date().toLocaleDateString('ar-IQ')}</span>
            </div>
            <div class="info-box">
              <span class="info-label">الوقت:</span>
              <span>${new Date().toLocaleTimeString('ar-IQ', {hour: '2-digit', minute: '2-digit'})}</span>
            </div>
          </div>

          <!-- Main Information Table -->
          <table class="main-table">
            <tr>
              <td class="label-col">اسم المرسل</td>
              <td class="value-col">${result.sender_name || ''}</td>
            </tr>
            ${result.sender_phone ? `
            <tr>
              <td class="label-col">رقم هاتف المرسل</td>
              <td class="value-col">${result.sender_phone}</td>
            </tr>
            ` : ''}
            <tr>
              <td class="label-col">اسم المستلم</td>
              <td class="value-col">${result.receiver_name || ''}</td>
            </tr>
            ${result.receiver_phone ? `
            <tr>
              <td class="label-col">رقم هاتف المستلم</td>
              <td class="value-col">${result.receiver_phone}</td>
            </tr>
            ` : ''}
            <tr>
              <td class="label-col">المحافظة</td>
              <td class="value-col">${result.to_governorate || ''}</td>
            </tr>
            ${result.to_agent_name ? `
            <tr>
              <td class="label-col">الوكيل المستلم</td>
              <td class="value-col">${result.to_agent_name}</td>
            </tr>
            ` : ''}
          </table>

          <!-- Amounts Table -->
          <table class="amounts-table">
            <thead>
              <tr>
                <th>المبلغ (${result.currency})</th>
                <th>العمولة</th>
                <th>المبلغ الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${result.amount.toLocaleString()}</td>
                <td>${result.commission ? result.commission.toLocaleString() : '0'}</td>
                <td>${(parseFloat(result.amount) + parseFloat(result.commission || 0)).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <!-- PIN Section -->
          <div class="pin-section">
            <div class="pin-label">الرقم السري للاستلام (PIN)</div>
            <div class="pin-code">${result.pin}</div>
            <div class="warning-text">⚠️ يُرجى الاحتفاظ بهذا الرقم بسرية تامة وإعطاؤه للمستلم فقط</div>
          </div>

          <!-- Notes -->
          ${result.note ? `
          <div class="notes-box">
            <strong>ملاحظات:</strong> ${result.note}
          </div>
          ` : ''}

          <!-- Signatures -->
          <div class="signatures">
            <div class="sig-box">
              <div class="sig-line"></div>
              <div class="sig-label">توقيع المرسل</div>
            </div>
            <div class="sig-box">
              <div class="sig-line"></div>
              <div class="sig-label">توقيع الموظف</div>
            </div>
            <div class="sig-box">
              <div class="sig-line"></div>
              <div class="sig-label">ختم الشركة</div>
            </div>
          </div>

          <!-- Print Button -->
          <div style="text-align: center; margin-top: 10mm;">
            <button onclick="window.print()" style="padding: 8px 25px; font-size: 14px; background: #333; color: white; border: none; border-radius: 4px; cursor: pointer;">
              🖨️ طباعة
            </button>
          </div>
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
                <div className="text-center">
                  <Label className="text-sm text-muted-foreground">رقم الحوالة</Label>
                  <p className="text-3xl font-bold text-secondary" data-testid="transfer-number-display">{result.transfer_number || 'غير متوفر'}</p>
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
      <div className="container mx-auto p-3 sm:p-6 max-w-7xl">
        <Card className="shadow-xl" data-testid="create-transfer-form">
          <CardHeader className="bg-gradient-to-l from-primary/10 to-primary/5 p-4 sm:p-6">
            <CardTitle className="text-2xl sm:text-3xl text-primary">إنشاء حوالة جديدة</CardTitle>
            <CardDescription className="text-sm sm:text-base">املأ بيانات الحوالة بعناية</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 p-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Header: تاريخ الإصدار ورقم الحوالة */}
              <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                <div>
                  <Label className="text-xs text-muted-foreground">تاريخ الإصدار</Label>
                  <p className="text-sm font-bold">{new Date().toLocaleDateString('ar-IQ')}</p>
                </div>
                <div className="text-left">
                  <Label className="text-xs text-muted-foreground">رقم الحوالة</Label>
                  <p className="text-sm font-bold text-secondary">سيتم توليده تلقائياً</p>
                </div>
              </div>

              {/* السطر الأول: المبلغ والعمولة والمدن والوكيل */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                {/* 1. مبلغ الحوالة */}
                <div className="col-span-1 md:col-span-3 space-y-1">
                  <Label htmlFor="amount" className="text-xs font-bold">مبلغ الحوالة *</Label>
                  <Input
                    id="amount"
                    data-testid="amount-input"
                    type="text"
                    value={formData.amount ? parseFloat(formData.amount).toLocaleString('en-US') : ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/,/g, '');
                      if (!isNaN(value) || value === '') {
                        setFormData({ ...formData, amount: value });
                      }
                    }}
                    required
                    className="text-sm h-10 md:h-9 text-right"
                    placeholder="0"
                    dir="ltr"
                  />
                </div>

                {/* 2. عملة الحوالة */}
                <div className="col-span-1 md:col-span-1 space-y-1">
                  <Label htmlFor="currency" className="text-xs font-bold">العملة</Label>
                  <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                    <SelectTrigger data-testid="currency-select" className="h-10 md:h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IQD">IQD</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 3. مبلغ العمولة */}
                <div className="col-span-1 md:col-span-2 space-y-1">
                  <Label className="text-xs font-bold">مبلغ العمولة</Label>
                  <div className="h-10 md:h-9 flex items-center px-2 bg-gray-50 border rounded-md">
                    <p className="text-xs font-bold text-blue-700">
                      {commissionData.loading ? '...' : commissionData.amount.toLocaleString('en-US')}
                    </p>
                  </div>
                </div>

                {/* 4. نسبة العمولة */}
                <div className="col-span-1 md:col-span-2 space-y-1">
                  <Label className="text-xs font-bold">نسبة العمولة</Label>
                  <div className="h-10 md:h-9 flex items-center px-2 bg-gray-50 border rounded-md">
                    <p className="text-xs font-bold text-blue-700">
                      {commissionData.loading ? '...' : `${commissionData.percentage.toFixed(2)}%`}
                    </p>
                  </div>
                </div>

                {/* 5. مدينة الاستلام */}
                <div className="col-span-1 md:col-span-2 space-y-1">
                  <Label htmlFor="to_governorate" className="text-xs font-bold">مدينة الاستلام *</Label>
                  <Select value={formData.to_governorate} onValueChange={handleGovernorateChange}>
                    <SelectTrigger data-testid="governorate-select" className="h-10 md:h-9 text-sm">
                      <SelectValue placeholder="اختر المدينة" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {IRAQI_GOVERNORATES.map((gov) => (
                        <SelectItem key={gov.code} value={gov.code}>{gov.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 6. الوكيل المسلم */}
                <div className="col-span-1 md:col-span-2 space-y-1">
                  <Label htmlFor="to_agent_id" className="text-xs font-bold">الوكيل المسلم</Label>
                  <div className="flex gap-1">
                    {agents.length > 0 ? (
                      <Select value={formData.to_agent_id || "all"} onValueChange={(value) => setFormData({ ...formData, to_agent_id: value === "all" ? "" : value })}>
                        <SelectTrigger data-testid="agent-select" className="h-10 md:h-9 text-sm flex-1">
                          <SelectValue placeholder="الكل" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          <SelectItem value="all">الكل</SelectItem>
                          {agents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.display_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="h-10 md:h-9 flex items-center px-2 bg-gray-50 border rounded-md flex-1">
                        <p className="text-xs text-muted-foreground">
                          {formData.to_governorate ? 'لا يوجد' : 'اختر المدينة'}
                        </p>
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10 md:h-9 w-10 md:w-9 p-0"
                      disabled={!formData.to_agent_id || formData.to_agent_id === "all"}
                      onClick={handleShowAgentInfo}
                    >
                      👁️
                    </Button>
                  </div>
                </div>
              </div>

              {/* بيانات المرسل والمستفيد */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 pt-2">
                {/* المرسل */}
                <div className="space-y-2 md:border-l-2 border-gray-200 md:pl-4 pb-3 md:pb-0 border-b md:border-b-0">
                  <h3 className="text-sm font-bold text-center text-primary">بيانات المرسل</h3>
                  
                  <div className="space-y-1">
                    <Label htmlFor="sender_name" className="text-xs font-bold">اسم المرسل *</Label>
                    <Input
                      id="sender_name"
                      data-testid="sender-name-input"
                      value={formData.sender_name}
                      onChange={(e) => setFormData({ ...formData, sender_name: e.target.value })}
                      required
                      maxLength={100}
                      className="text-sm h-10 md:h-9"
                      placeholder="الاسم الثلاثي"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="sender_phone" className="text-xs font-bold">رقم هاتف المرسل</Label>
                    <Input
                      id="sender_phone"
                      type="tel"
                      value={formData.sender_phone}
                      onChange={(e) => setFormData({ ...formData, sender_phone: e.target.value })}
                      className="text-sm h-10 md:h-9"
                      placeholder="+9647801234567"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* المستفيد */}
                <div className="space-y-2 md:pr-4">
                  <h3 className="text-sm font-bold text-center text-primary">بيانات المستفيد</h3>
                  
                  <div className="space-y-1">
                    <Label htmlFor="receiver_name" className="text-xs font-bold">اسم المستفيد *</Label>
                    <Input
                      id="receiver_name"
                      data-testid="receiver-name-input"
                      value={formData.receiver_name}
                      onChange={(e) => setFormData({ ...formData, receiver_name: e.target.value })}
                      required
                      maxLength={100}
                      className="text-sm h-10 md:h-9"
                      placeholder="الاسم الثلاثي"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="receiver_phone" className="text-xs font-bold">رقم هاتف المستفيد</Label>
                    <Input
                      id="receiver_phone"
                      type="tel"
                      value={formData.receiver_phone}
                      onChange={(e) => setFormData({ ...formData, receiver_phone: e.target.value })}
                      className="text-sm h-10 md:h-9"
                      placeholder="+9647801234567"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>

              {/* ملاحظات */}
              <div className="space-y-1">
                <Label htmlFor="note" className="text-xs font-bold">ملاحظات (اختياري)</Label>
                <Input
                  id="note"
                  data-testid="note-input"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="text-sm h-10 md:h-9"
                  placeholder="ملاحظات إضافية"
                />
              </div>

              {/* الأزرار */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
                <Button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  variant="outline"
                  className="flex-1 h-11 sm:h-10 text-base font-bold border-2"
                  data-testid="cancel-btn"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-secondary hover:bg-secondary/90 text-primary h-11 sm:h-10 text-base font-bold"
                  data-testid="submit-transfer-btn"
                >
                  {loading ? 'جاري الإنشاء...' : 'إرسال الحوالة'}
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

        {/* Agent Info Modal */}
        <Dialog open={showAgentInfoModal} onOpenChange={setShowAgentInfoModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg text-primary">معلومات الوكيل</DialogTitle>
              <DialogDescription className="text-sm">
                تفاصيل الوكيل المختار
              </DialogDescription>
            </DialogHeader>
            
            {selectedAgentInfo && (
              <div className="space-y-4 py-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                    <div className="text-2xl">👤</div>
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">اسم الوكيل</Label>
                      <p className="font-bold text-base">{selectedAgentInfo.display_name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                    <div className="text-2xl">📱</div>
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">رقم الهاتف</Label>
                      <p className="font-bold text-base" dir="ltr">
                        {selectedAgentInfo.phone || 'غير متوفر'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                    <div className="text-2xl">📍</div>
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">المحافظة</Label>
                      <p className="font-bold text-base">
                        {IRAQI_GOVERNORATES.find(g => g.code === selectedAgentInfo.governorate)?.name || 'غير محدد'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAgentInfoModal(false)}
                className="flex-1"
              >
                إغلاق
              </Button>
              <Button
                type="button"
                onClick={handleCopyAgentInfo}
                className="flex-1 bg-secondary hover:bg-secondary/90 text-primary"
              >
                📋 نسخ المعلومات
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default CreateTransferPage;