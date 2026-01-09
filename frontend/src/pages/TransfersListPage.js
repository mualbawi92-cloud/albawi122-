import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from 'sonner';
import api from '../services/api';


const TransfersListPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Active tab: 'outgoing', 'incoming', or 'inquiry'
  const [activeTab, setActiveTab] = useState('outgoing');
  
  // Date filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedQuickFilter, setSelectedQuickFilter] = useState('all');
  
  // Common filters
  const [searchCode, setSearchCode] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('all');
  
  // New inquiry filters
  const [searchTrackingNumber, setSearchTrackingNumber] = useState('');
  const [searchSenderName, setSearchSenderName] = useState('');
  const [searchReceiverName, setSearchReceiverName] = useState('');
  const [searchAmount, setSearchAmount] = useState('');
  
  // Inquiry-specific filters (multiple status selection)
  const [statusFilters, setStatusFilters] = useState({
    pending: false,
    completed: true,
    cancelled: false
  });

  useEffect(() => {
    // Only fetch on tab change or initial load
    fetchTransfers();
  }, [activeTab]);
  
  // Function to handle manual search
  const handleSearch = () => {
    fetchTransfers();
  };

  const fetchTransfers = async () => {
    try {
      const params = new URLSearchParams();
      
      // Add date filters
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      
      // Add currency filter
      if (selectedCurrency !== 'all') params.append('currency', selectedCurrency);
      
      // Tab-specific filters
      if (activeTab === 'outgoing') {
        params.append('direction', 'outgoing');
      } else if (activeTab === 'incoming') {
        params.append('direction', 'incoming');
        params.append('status', 'pending');
      }

      const response = await api.get('/transfers?${params}');
      let fetchedTransfers = response.data;
      
      // For inquiry tab, apply status filters
      if (activeTab === 'inquiry') {
        fetchedTransfers = fetchedTransfers.filter(t => {
          if (t.status === 'pending') return statusFilters.pending;
          if (t.status === 'completed') return statusFilters.completed;
          if (t.status === 'cancelled') return statusFilters.cancelled;
          return false;
        });
      }
      
      // Search by code
      if (searchCode) {
        fetchedTransfers = fetchedTransfers.filter(t => 
          t.transfer_code?.toLowerCase().includes(searchCode.toLowerCase()) ||
          t.id?.toLowerCase().includes(searchCode.toLowerCase())
        );
      }
      
      // New search filters for inquiry tab
      if (activeTab === 'inquiry') {
        if (searchTrackingNumber) {
          fetchedTransfers = fetchedTransfers.filter(t => 
            t.tracking_number?.includes(searchTrackingNumber)
          );
        }
        
        if (searchSenderName) {
          fetchedTransfers = fetchedTransfers.filter(t => 
            t.sender_name?.toLowerCase().includes(searchSenderName.toLowerCase())
          );
        }
        
        if (searchReceiverName) {
          fetchedTransfers = fetchedTransfers.filter(t => 
            t.receiver_name?.toLowerCase().includes(searchReceiverName.toLowerCase())
          );
        }
        
        if (searchAmount) {
          const amount = parseFloat(searchAmount);
          if (!isNaN(amount)) {
            fetchedTransfers = fetchedTransfers.filter(t => 
              t.amount === amount
            );
          }
        }
      }
      
      setTransfers(fetchedTransfers);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching transfers:', error);
      toast.error('خطأ في تحميل الحوالات');
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { label: 'قيد الانتظار', className: 'bg-yellow-100 text-yellow-800' },
      completed: { label: 'مكتمل', className: 'bg-green-100 text-green-800' },
      cancelled: { label: 'ملغى', className: 'bg-red-100 text-red-800' }
    };
    const config = statusMap[status] || { label: status, className: '' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const handleCopyTransferInfo = (transfer) => {
    const info = `
رقم الحوالة: ${transfer.tracking_number || transfer.transfer_code}
كود الحوالة: ${transfer.transfer_code}
المرسل: ${transfer.sender_name || '-'}
هاتف المرسل: ${transfer.sender_phone || '-'}
المستلم: ${transfer.receiver_name || '-'}
هاتف المستلم: ${transfer.receiver_phone || '-'}
المبلغ: ${transfer.amount?.toLocaleString()} ${transfer.currency}
مدينة الإرسال: ${transfer.sending_city || '-'}
مدينة الاستلام: ${transfer.receiving_city || '-'}
الحالة: ${transfer.status === 'pending' ? 'قيد الانتظار' : transfer.status === 'completed' ? 'مكتملة' : 'ملغاة'}
تاريخ الإنشاء: ${new Date(transfer.created_at).toLocaleString('ar-IQ')}
    `.trim();
    
    navigator.clipboard.writeText(info).then(() => {
      toast.success('تم نسخ معلومات الحوالة ✅');
    }).catch(() => {
      // Fallback method
      const textArea = document.createElement('textarea');
      textArea.value = info;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast.success('تم نسخ معلومات الحوالة ✅');
    });
  };

  const handlePrintTransfer = (transfer) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('يرجى السماح بفتح النوافذ المنبثقة للطباعة');
      return;
    }
    
    const createdDate = new Date(transfer.created_at);
    const dateStr = createdDate.toLocaleDateString('ar-IQ');
    const timeStr = createdDate.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
    
    // Single voucher template matching CreateTransferPage design
    const singleVoucher = `
      <div class="voucher">
        <!-- Header -->
        <div class="header">
          <div class="logo">🏦</div>
          <div class="title">ارسال حوالة</div>
          <div class="barcode-area"></div>
        </div>

        <!-- Basic Info -->
        <div class="info-row">
          <div style="display: flex; flex-direction: column; gap: 3px;">
            <div class="info-box">
              <span class="info-label">رقم الحوالة:</span>
              <span>${transfer.tracking_number || transfer.transfer_code}</span>
            </div>
            <div class="info-box">
              <span class="info-label">كود الحوالة:</span>
              <span>${transfer.transfer_code}</span>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 3px;">
            <div class="info-box">
              <span class="info-label">التاريخ:</span>
              <span>${dateStr}</span>
            </div>
            <div class="info-box">
              <span class="info-label">الوقت:</span>
              <span>${timeStr}</span>
            </div>
          </div>
        </div>

        <!-- Main Information - Split -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; margin: 3mm 0;">
          <!-- معلومات المرسل - اليمين -->
          <table class="main-table">
            <tr>
              <td colspan="2" style="background: #333; color: white; text-align: center; font-weight: bold; padding: 2mm;">معلومات المرسل</td>
            </tr>
            <tr>
              <td class="label-col">الاسم</td>
              <td class="value-col">${transfer.sender_name || ''}</td>
            </tr>
            <tr>
              <td class="label-col">رقم الهاتف</td>
              <td class="value-col">${transfer.sender_phone || ''}</td>
            </tr>
          </table>

          <!-- معلومات المستفيد - اليسار -->
          <table class="main-table">
            <tr>
              <td colspan="2" style="background: #333; color: white; text-align: center; font-weight: bold; padding: 2mm;">معلومات المستفيد</td>
            </tr>
            <tr>
              <td class="label-col">الاسم</td>
              <td class="value-col">${transfer.receiver_name || ''}</td>
            </tr>
            <tr>
              <td class="label-col">رقم الهاتف</td>
              <td class="value-col">${transfer.receiver_phone || ''}</td>
            </tr>
          </table>
        </div>

        <!-- معلومات إضافية -->
        <table class="main-table">
          <tr>
            <td class="label-col">مدينة الإرسال</td>
            <td class="value-col">${transfer.sending_city || ''}</td>
          </tr>
          <tr>
            <td class="label-col">مدينة الاستلام</td>
            <td class="value-col">${transfer.receiving_city || ''}</td>
          </tr>
        </table>

        <!-- Amounts Table -->
        <table class="amounts-table">
          <thead>
            <tr>
              <th>المبلغ (${transfer.currency})</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${transfer.amount?.toLocaleString()}</td>
              <td>${transfer.status === 'pending' ? 'قيد الانتظار' : transfer.status === 'completed' ? 'مكتملة' : 'ملغاة'}</td>
            </tr>
          </tbody>
        </table>

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
      </div>
    `;
    
    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>طباعة الحوالة - ${transfer.tracking_number || transfer.transfer_code}</title>
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
            page-break-after: always;
          }
          .voucher:last-child {
            page-break-after: auto;
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
        ${singleVoucher}
        ${singleVoucher}
      </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
  };

  return (
    <div className="min-h-screen bg-background">
      
      <div className="container mx-auto p-3 sm:p-6">
        <Card className="shadow-xl">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-2xl sm:text-3xl text-primary">الحوالات</CardTitle>
          </CardHeader>
          
          {/* Tabs */}
          <div className="border-b-2 px-4 sm:px-6">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('outgoing')}
                className={`px-4 sm:px-6 py-3 font-bold text-base sm:text-lg transition-all ${
                  activeTab === 'outgoing'
                    ? 'border-b-4 border-primary text-primary bg-primary/5'
                    : 'text-muted-foreground hover:text-primary'
                }`}
              >
                📤 إرسال حوالة
              </button>
              <button
                onClick={() => setActiveTab('incoming')}
                className={`px-4 sm:px-6 py-3 font-bold text-base sm:text-lg transition-all ${
                  activeTab === 'incoming'
                    ? 'border-b-4 border-primary text-primary bg-primary/5'
                    : 'text-muted-foreground hover:text-primary'
                }`}
              >
                📥 تسليم حوالة
              </button>
              <button
                onClick={() => setActiveTab('inquiry')}
                className={`px-4 sm:px-6 py-3 font-bold text-base sm:text-lg transition-all ${
                  activeTab === 'inquiry'
                    ? 'border-b-4 border-primary text-primary bg-primary/5'
                    : 'text-muted-foreground hover:text-primary'
                }`}
              >
                🔍 استعلام حوالات
              </button>
            </div>
          </div>
          
          <CardContent className="p-4 sm:p-6">
            {/* Custom Filters Section */}
            <div className="bg-gray-50 p-4 rounded-lg space-y-4">
              {/* Quick Date Filters */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">فلترة سريعة حسب التاريخ:</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={selectedQuickFilter === 'today' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0];
                      setStartDate(today);
                      setEndDate(today);
                      setSelectedQuickFilter('today');
                      setTimeout(() => handleSearch(), 100);
                    }}
                    className="text-sm"
                  >
                    📅 اليوم
                  </Button>
                  <Button
                    variant={selectedQuickFilter === 'last7' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      const today = new Date();
                      const last7 = new Date();
                      last7.setDate(today.getDate() - 7);
                      setStartDate(last7.toISOString().split('T')[0]);
                      setEndDate(today.toISOString().split('T')[0]);
                      setSelectedQuickFilter('last7');
                      setTimeout(() => handleSearch(), 100);
                    }}
                    className="text-sm"
                  >
                    📅 آخر 7 أيام
                  </Button>
                  <Button
                    variant={selectedQuickFilter === 'last30' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      const today = new Date();
                      const last30 = new Date();
                      last30.setDate(today.getDate() - 30);
                      setStartDate(last30.toISOString().split('T')[0]);
                      setEndDate(today.toISOString().split('T')[0]);
                      setSelectedQuickFilter('last30');
                      setTimeout(() => handleSearch(), 100);
                    }}
                    className="text-sm"
                  >
                    📅 آخر 30 يوم
                  </Button>
                  <Button
                    variant={selectedQuickFilter === 'thisMonth' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      const today = new Date();
                      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                      setStartDate(firstDay.toISOString().split('T')[0]);
                      setEndDate(today.toISOString().split('T')[0]);
                      setSelectedQuickFilter('thisMonth');
                      setTimeout(() => handleSearch(), 100);
                    }}
                    className="text-sm"
                  >
                    📅 هذا الشهر
                  </Button>
                  <Button
                    variant={selectedQuickFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                      setSelectedQuickFilter('all');
                      setTimeout(() => handleSearch(), 100);
                    }}
                    className="text-sm"
                  >
                    📋 كل السجلات
                  </Button>
                </div>
              </div>
              
              {/* Manual Date Selection - New Layout */}
              <div className="border-t pt-3">
                <Label className="text-sm font-semibold mb-2 block">أو اختر تاريخ محدد:</Label>
                <div className="flex gap-4">
                  {/* Left side - Date inputs stacked vertically */}
                  <div className="flex flex-col gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">من تاريخ</Label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          setSelectedQuickFilter('custom');
                        }}
                        className="h-9 w-48"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">إلى تاريخ</Label>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                          setEndDate(e.target.value);
                          setSelectedQuickFilter('custom');
                        }}
                        className="h-9 w-48"
                      />
                    </div>
                  </div>
                  
                  {/* Right side - Search button only */}
                  <div className="flex items-end">
                    <Button 
                      onClick={handleSearch} 
                      className="h-9 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8"
                    >
                      🔍 بحث
                    </Button>
                  </div>
                </div>
              </div>
            </div>
              
            {/* Inquiry-specific filters */}
            {activeTab === 'inquiry' && (
              <div className="bg-gray-50 p-4 rounded-lg mt-3 space-y-3">
                {/* Status Filters - Top */}
                <div className="flex items-center gap-4 pb-3 border-b border-gray-300">
                  <Label className="text-sm font-semibold text-gray-700">نوع الحوالة:</Label>
                  <div className="flex gap-6">
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <Checkbox
                        id="pending"
                        checked={statusFilters.pending}
                        onCheckedChange={(checked) => 
                          setStatusFilters({ ...statusFilters, pending: checked })
                        }
                      />
                      <label htmlFor="pending" className="text-sm font-medium cursor-pointer">
                        قيد الانتظار
                      </label>
                    </div>
                    
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <Checkbox
                        id="completed"
                        checked={statusFilters.completed}
                        onCheckedChange={(checked) => 
                          setStatusFilters({ ...statusFilters, completed: checked })
                        }
                      />
                      <label htmlFor="completed" className="text-sm font-medium cursor-pointer">
                        مسلّمة
                      </label>
                    </div>
                    
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <Checkbox
                        id="cancelled"
                        checked={statusFilters.cancelled}
                        onCheckedChange={(checked) => 
                          setStatusFilters({ ...statusFilters, cancelled: checked })
                        }
                      />
                      <label htmlFor="cancelled" className="text-sm font-medium cursor-pointer">
                        ملغاة
                      </label>
                    </div>
                  </div>
                </div>
                
                {/* All Search Filters in One Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">رقم الحوالة</Label>
                    <Input
                      placeholder="10 أرقام..."
                      value={searchTrackingNumber}
                      onChange={(e) => setSearchTrackingNumber(e.target.value)}
                      className="h-9 text-sm"
                      dir="ltr"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">اسم المرسل</Label>
                    <Input
                      placeholder="اسم المرسل..."
                      value={searchSenderName}
                      onChange={(e) => setSearchSenderName(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">اسم المستفيد</Label>
                    <Input
                      placeholder="اسم المستفيد..."
                      value={searchReceiverName}
                      onChange={(e) => setSearchReceiverName(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">المبلغ</Label>
                    <Input
                      type="number"
                      placeholder="المبلغ..."
                      value={searchAmount}
                      onChange={(e) => setSearchAmount(e.target.value)}
                      className="h-9 text-sm"
                      dir="ltr"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">العملة</Label>
                    <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">كل العملات</SelectItem>
                        <SelectItem value="IQD">IQD</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
            
            {/* Action Buttons */}
            {activeTab === 'outgoing' && (
              <Button
                onClick={() => navigate('/transfers/create')}
                className="bg-secondary hover:bg-secondary/90 text-primary font-bold mb-4"
              >
                ➕ حوالة جديدة
              </Button>
            )}
            
            {activeTab === 'incoming' && (
              <Button
                onClick={() => navigate('/quick-receive')}
                className="bg-green-600 hover:bg-green-700 text-white font-bold mb-4"
              >
                ➕ تسليم حوالة جديدة
              </Button>
            )}

            {/* Transfers List */}
            {loading ? (
              <div className="text-center py-12 text-xl">جاري التحميل...</div>
            ) : transfers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-xl text-muted-foreground">لا توجد حوالات</p>
              </div>
            ) : (
              <>
                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-3 text-right">رقم الحوالة</th>
                        <th className="p-3 text-right">المرسل</th>
                        <th className="p-3 text-right">المستلم</th>
                        <th className="p-3 text-right">مدينة الاستلام</th>
                        <th className="p-3 text-right">المبلغ</th>
                        <th className="p-3 text-right">العملة</th>
                        <th className="p-3 text-right">الحالة</th>
                        <th className="p-3 text-right">التاريخ</th>
                        <th className="p-3 text-center">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transfers.map((transfer) => (
                        <tr key={transfer.id} className="border-t hover:bg-gray-50">
                          <td className="p-3 font-mono font-bold text-blue-600">
                            {transfer.tracking_number || transfer.transfer_code}
                          </td>
                          <td className="p-3">{transfer.sender_name}</td>
                          <td className="p-3">{transfer.receiver_name}</td>
                          <td className="p-3 text-sm">{transfer.receiving_city || '-'}</td>
                          <td className="p-3 font-bold">{transfer.amount?.toLocaleString()}</td>
                          <td className="p-3">{transfer.currency}</td>
                          <td className="p-3">{getStatusBadge(transfer.status)}</td>
                          <td className="p-3 text-sm">
                            {new Date(transfer.created_at).toLocaleDateString('ar-IQ')}
                          </td>
                          <td className="p-3">
                            <div className="flex gap-2 justify-center flex-wrap">
                              <Button
                                size="sm"
                                onClick={() => navigate('/transfers/${transfer.id}')}
                                className="bg-blue-600 hover:bg-blue-700 text-xs"
                              >
                                عرض
                              </Button>
                              {activeTab === 'inquiry' && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handlePrintTransfer(transfer)}
                                    className="bg-green-600 hover:bg-green-700 text-xs"
                                  >
                                    طباعة
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleCopyTransferInfo(transfer)}
                                    className="bg-purple-600 hover:bg-purple-700 text-xs"
                                  >
                                    نسخ
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View */}
                <div className="md:hidden space-y-4">
                  {transfers.map((transfer) => (
                    <Card key={transfer.id} className="border-2">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs text-gray-500">رقم الحوالة</p>
                              <p className="font-mono font-bold text-blue-600">
                                {transfer.tracking_number || transfer.transfer_code}
                              </p>
                            </div>
                            {getStatusBadge(transfer.status)}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-gray-500">المرسل</p>
                              <p className="text-sm font-semibold">{transfer.sender_name}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">المستلم</p>
                              <p className="text-sm font-semibold">{transfer.receiver_name}</p>
                            </div>
                          </div>
                          
                          <div>
                            <p className="text-xs text-gray-500">مدينة الاستلام</p>
                            <p className="text-sm font-semibold">{transfer.receiving_city || '-'}</p>
                          </div>
                          
                          <div className="bg-blue-50 rounded p-3">
                            <p className="text-xs text-gray-500">المبلغ</p>
                            <p className="text-xl font-bold text-blue-600">
                              {transfer.amount?.toLocaleString()} {transfer.currency}
                            </p>
                          </div>
                          
                          <div>
                            <p className="text-xs text-gray-500">التاريخ</p>
                            <p className="text-sm">{new Date(transfer.created_at).toLocaleDateString('ar-IQ')}</p>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              onClick={() => navigate('/transfers/${transfer.id}')}
                              className="flex-1 bg-blue-600 hover:bg-blue-700"
                            >
                              عرض
                            </Button>
                            {activeTab === 'inquiry' && (
                              <>
                                <Button
                                  onClick={() => handlePrintTransfer(transfer)}
                                  className="flex-1 bg-green-600 hover:bg-green-700"
                                >
                                  طباعة
                                </Button>
                                <Button
                                  onClick={() => handleCopyTransferInfo(transfer)}
                                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                                >
                                  نسخ
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TransfersListPage;
