import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import QuickDateFilter from '../components/QuickDateFilter';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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

      const response = await axios.get(`${API}/transfers?${params}`);
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
رمز الحوالة: ${transfer.transfer_code}
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
    // Generate A5 landscape voucher HTML (two copies)
    const voucherHTML = generateA5Voucher(transfer);
    
    // Open print window
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    if (!printWindow) {
      toast.error('يرجى السماح بفتح النوافذ المنبثقة للطباعة');
      return;
    }

    printWindow.document.write(voucherHTML);
    printWindow.document.close();
    
    // Wait for content to load then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  };
  
  const generateA5Voucher = (transfer) => {
    const createdDate = new Date(transfer.created_at);
    const dateStr = createdDate.toLocaleDateString('ar-IQ');
    const timeStr = createdDate.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
    
    // Single voucher template
    const singleVoucher = `
      <div class="voucher-page">
        <div class="voucher-header">
          <div class="header-right">
            <h1 class="title">ارسال حوالة</h1>
          </div>
          <div class="header-center">
            <div class="tracking-info">
              <div class="info-item">
                <span class="label">رقم الحوالة:</span>
                <span class="value">${transfer.tracking_number || transfer.transfer_code}</span>
              </div>
              <div class="info-item">
                <span class="label">رمز الحوالة:</span>
                <span class="value">${transfer.transfer_code}</span>
              </div>
            </div>
          </div>
          <div class="header-left">
            <div class="date-time">
              <div>${dateStr}</div>
              <div>${timeStr}</div>
            </div>
          </div>
        </div>

        <div class="voucher-body">
          <div class="info-section">
            <div class="column">
              <h3 class="section-title">معلومات المرسل</h3>
              <div class="info-row">
                <span class="info-label">الاسم:</span>
                <span class="info-value">${transfer.sender_name || '-'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">رقم الهاتف:</span>
                <span class="info-value">${transfer.sender_phone || '-'}</span>
              </div>
            </div>
            
            <div class="column">
              <h3 class="section-title">معلومات المستلم</h3>
              <div class="info-row">
                <span class="info-label">الاسم:</span>
                <span class="info-value">${transfer.receiver_name || '-'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">رقم الهاتف:</span>
                <span class="info-value">${transfer.receiver_phone || '-'}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="voucher-footer">
          <table class="amounts-table">
            <tr>
              <td class="label-cell">المبلغ:</td>
              <td class="value-cell">${transfer.amount?.toLocaleString()} ${transfer.currency}</td>
              <td class="label-cell">مدينة الإرسال:</td>
              <td class="value-cell">${transfer.sending_city || '-'}</td>
            </tr>
            <tr>
              <td class="label-cell">مدينة الاستلام:</td>
              <td class="value-cell">${transfer.receiving_city || '-'}</td>
              <td class="label-cell">الحالة:</td>
              <td class="value-cell">${transfer.status === 'pending' ? 'قيد الانتظار' : transfer.status === 'completed' ? 'مكتملة' : 'ملغاة'}</td>
            </tr>
          </table>
          
          <div class="signature-section">
            <div class="signature-box">
              <span>توقيع المرسل: _______________</span>
            </div>
            <div class="signature-box">
              <span>توقيع المستلم: _______________</span>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Return HTML with TWO copies
    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>وصل الحوالة - ${transfer.tracking_number || transfer.transfer_code}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Arial', 'Helvetica', sans-serif;
            direction: rtl;
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          @page {
            size: A5 landscape;
            margin: 10mm;
          }
          
          .voucher-page {
            width: 100%;
            height: 148mm;
            padding: 15px;
            page-break-after: always;
            border: 2px solid #333;
            background: white;
          }
          
          .voucher-page:last-child {
            page-break-after: auto;
          }
          
          .voucher-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 3px solid #333;
            padding-bottom: 10px;
            margin-bottom: 15px;
          }
          
          .title {
            font-size: 24px;
            font-weight: bold;
            color: #000;
          }
          
          .tracking-info {
            text-align: center;
          }
          
          .info-item {
            margin: 5px 0;
            font-size: 16px;
          }
          
          .label {
            font-weight: bold;
            margin-left: 8px;
          }
          
          .value {
            font-size: 18px;
            font-weight: bold;
            color: #000;
          }
          
          .date-time {
            text-align: left;
            font-size: 14px;
            line-height: 1.6;
          }
          
          .voucher-body {
            margin: 20px 0;
          }
          
          .info-section {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
          }
          
          .column {
            flex: 1;
            border: 2px solid #333;
            padding: 15px;
            background: #f9f9f9;
          }
          
          .section-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 2px solid #333;
          }
          
          .info-row {
            display: flex;
            margin: 8px 0;
            font-size: 14px;
          }
          
          .info-label {
            font-weight: bold;
            min-width: 80px;
          }
          
          .info-value {
            flex: 1;
          }
          
          .voucher-footer {
            border-top: 2px solid #333;
            padding-top: 15px;
          }
          
          .amounts-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            font-size: 14px;
          }
          
          .amounts-table td {
            padding: 8px;
            border: 1px solid #333;
          }
          
          .label-cell {
            font-weight: bold;
            background: #f0f0f0;
            width: 25%;
          }
          
          .value-cell {
            width: 25%;
          }
          
          .signature-section {
            display: flex;
            justify-content: space-around;
            margin-top: 20px;
            font-size: 14px;
          }
          
          .signature-box {
            text-align: center;
          }
          
          @media print {
            body {
              background: white;
            }
            
            .voucher-page {
              border: 2px solid #000;
            }
          }
        </style>
      </head>
      <body>
        ${singleVoucher}
        ${singleVoucher}
      </body>
      </html>
    `;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
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
            {/* Filters Section using QuickDateFilter Component */}
            <QuickDateFilter
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onSearch={handleSearch}
              selectedFilter={selectedQuickFilter}
              onQuickFilterChange={setSelectedQuickFilter}
              showSearchButton={true}
              additionalFilters={
                <div className="space-y-2">
                  <Label className="text-xs text-gray-600">العملة</Label>
                  <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل العملات</SelectItem>
                      <SelectItem value="IQD">IQD</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              }
            />
              
            {/* Inquiry-specific filters */}
            {activeTab === 'inquiry' && (
              <div className="bg-gray-50 p-4 rounded-lg mt-4 space-y-4">
                <div>
                  <Label className="text-sm font-semibold mb-3 block">نوع الحوالة:</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <Checkbox
                        id="pending"
                        checked={statusFilters.pending}
                        onCheckedChange={(checked) => 
                          setStatusFilters({ ...statusFilters, pending: checked })
                        }
                      />
                      <label htmlFor="pending" className="text-sm font-medium cursor-pointer">
                        قيد الانتظار (صادرة)
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
                
                {/* New Search Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">بحث حسب رقم الحوالة</Label>
                    <Input
                      placeholder="رقم الحوالة (10 أرقام)..."
                      value={searchTrackingNumber}
                      onChange={(e) => setSearchTrackingNumber(e.target.value)}
                      className="h-10"
                      dir="ltr"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">بحث حسب اسم المرسل</Label>
                    <Input
                      placeholder="اسم المرسل..."
                      value={searchSenderName}
                      onChange={(e) => setSearchSenderName(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">بحث حسب اسم المستفيد</Label>
                    <Input
                      placeholder="اسم المستفيد..."
                      value={searchReceiverName}
                      onChange={(e) => setSearchReceiverName(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">بحث حسب المبلغ</Label>
                    <Input
                      type="number"
                      placeholder="المبلغ..."
                      value={searchAmount}
                      onChange={(e) => setSearchAmount(e.target.value)}
                      className="h-10"
                      dir="ltr"
                    />
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
                                onClick={() => navigate(`/transfers/${transfer.id}`)}
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
                            <p className="text-xs text-gray-500">مدينة الإرسال</p>
                            <p className="text-sm font-semibold">{transfer.sending_city || '-'}</p>
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
                              onClick={() => navigate(`/transfers/${transfer.id}`)}
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
