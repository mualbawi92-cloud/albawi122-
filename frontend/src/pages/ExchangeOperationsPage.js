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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ExchangeOperationsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('operations'); // operations, history, report
  
  // Exchange rates
  const [rates, setRates] = useState(null);
  const [editingRates, setEditingRates] = useState(false);
  const [newBuyRate, setNewBuyRate] = useState('');
  const [newSellRate, setNewSellRate] = useState('');
  
  // Operation form
  const [operationType, setOperationType] = useState('buy');
  const [amountUsd, setAmountUsd] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [notes, setNotes] = useState('');
  
  // History
  const [operations, setOperations] = useState([]);
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  
  // Report
  const [reportType, setReportType] = useState('daily');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('صلاحية الوصول مرفوضة');
      navigate('/dashboard');
      return;
    }
    fetchRates();
    fetchOperations();
  }, [user, navigate]);

  const fetchRates = async () => {
    try {
      const response = await axios.get(`${API}/exchange-rates`);
      setRates(response.data);
      setExchangeRate(response.data.buy_rate.toString());
    } catch (error) {
      console.error('Error fetching rates:', error);
    }
  };

  const handleUpdateRates = async () => {
    const buy = parseFloat(newBuyRate);
    const sell = parseFloat(newSellRate);
    
    if (!buy || !sell) {
      toast.error('يرجى إدخال أسعار صحيحة');
      return;
    }
    
    if (buy <= sell) {
      toast.error('سعر الشراء يجب أن يكون أكبر من سعر البيع');
      return;
    }
    
    try {
      await axios.post(`${API}/exchange-rates`, {
        buy_rate: buy,
        sell_rate: sell
      });
      toast.success('تم تحديث أسعار الصرف بنجاح');
      setEditingRates(false);
      fetchRates();
    } catch (error) {
      console.error('Error updating rates:', error);
      toast.error(error.response?.data?.detail || 'خطأ في تحديث الأسعار');
    }
  };

  const handleOperation = async () => {
    const amount = parseFloat(amountUsd);
    const rate = parseFloat(exchangeRate);
    
    if (!amount || amount <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح');
      return;
    }
    
    if (!rate || rate <= 0) {
      toast.error('يرجى إدخال سعر صرف صحيح');
      return;
    }
    
    setLoading(true);
    try {
      const endpoint = operationType === 'buy' ? '/exchange/buy' : '/exchange/sell';
      await axios.post(`${API}${endpoint}`, {
        operation_type: operationType,
        amount_usd: amount,
        exchange_rate: rate,
        notes: notes || null
      });
      
      toast.success(`تم ${operationType === 'buy' ? 'شراء' : 'بيع'} العملة بنجاح`);
      
      // Reset form
      setAmountUsd('');
      setNotes('');
      fetchRates();
      fetchOperations();
      setActiveTab('history');
    } catch (error) {
      console.error('Error processing operation:', error);
      toast.error(error.response?.data?.detail || 'خطأ في العملية');
    }
    setLoading(false);
  };

  const fetchOperations = async () => {
    try {
      const params = {};
      if (historyStartDate) params.start_date = historyStartDate;
      if (historyEndDate) params.end_date = historyEndDate;
      
      const response = await axios.get(`${API}/exchange/operations`, { params });
      setOperations(response.data.operations || []);
    } catch (error) {
      console.error('Error fetching operations:', error);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      let dateParam = reportDate;
      if (reportType === 'monthly') {
        dateParam = reportDate.substring(0, 7);
      } else if (reportType === 'yearly') {
        dateParam = reportDate.substring(0, 4);
      }
      
      const response = await axios.get(`${API}/exchange/profit-report`, {
        params: { report_type: reportType, date: dateParam }
      });
      setReportData(response.data);
      toast.success('تم تحميل التقرير بنجاح');
    } catch (error) {
      console.error('Error fetching report:', error);
      toast.error('خطأ في تحميل التقرير');
    }
    setLoading(false);
  };

  const calculateAmountIqd = () => {
    const amount = parseFloat(amountUsd);
    const rate = parseFloat(exchangeRate);
    if (amount && rate) {
      return (amount * rate).toLocaleString();
    }
    return '0';
  };

  const calculateProfit = () => {
    if (!rates) return '0';
    const amount = parseFloat(amountUsd);
    const rate = parseFloat(exchangeRate);
    if (!amount || !rate) return '0';
    
    let profit = 0;
    if (operationType === 'buy') {
      profit = (rates.buy_rate - rate) * amount;
    } else {
      profit = (rate - rates.sell_rate) * amount;
    }
    return profit.toLocaleString();
  };

  const formatCurrency = (amount, currency = 'IQD') => {
    return `${amount.toLocaleString()} ${currency}`;
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-l from-amber-50 to-amber-100">
            <CardTitle className="text-2xl sm:text-3xl">💱 عمليات الصرافة</CardTitle>
            <CardDescription className="text-base">
              شراء وبيع العملات وإدارة أسعار الصرف
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Exchange Rates Card */}
        {rates && (
          <Card className="border-2 border-amber-200 bg-amber-50">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>أسعار الصرف الحالية</CardTitle>
                <Button
                  size="sm"
                  onClick={() => {
                    if (editingRates) {
                      setEditingRates(false);
                    } else {
                      setNewBuyRate(rates.buy_rate.toString());
                      setNewSellRate(rates.sell_rate.toString());
                      setEditingRates(true);
                    }
                  }}
                >
                  {editingRates ? 'إلغاء' : '✏️ تعديل'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {editingRates ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>سعر الشراء (IQD لكل 1 USD)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newBuyRate}
                        onChange={(e) => setNewBuyRate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>سعر البيع (IQD لكل 1 USD)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newSellRate}
                        onChange={(e) => setNewSellRate(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button onClick={handleUpdateRates} className="w-full">
                    💾 حفظ الأسعار الجديدة
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">سعر الشراء</p>
                    <p className="text-2xl font-bold text-green-700">
                      {rates.buy_rate.toLocaleString()} IQD
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">سعر البيع</p>
                    <p className="text-2xl font-bold text-blue-700">
                      {rates.sell_rate.toLocaleString()} IQD
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">فرق السعر (الربح)</p>
                    <p className="text-2xl font-bold text-amber-700">
                      {(rates.buy_rate - rates.sell_rate).toLocaleString()} IQD
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b-2">
          <button
            onClick={() => setActiveTab('operations')}
            className={`px-6 py-3 font-bold text-lg transition-all ${
              activeTab === 'operations'
                ? 'border-b-4 border-primary text-primary bg-primary/5'
                : 'text-muted-foreground hover:text-primary'
            }`}
          >
            💰 عمليات الصرف
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 font-bold text-lg transition-all ${
              activeTab === 'history'
                ? 'border-b-4 border-primary text-primary bg-primary/5'
                : 'text-muted-foreground hover:text-primary'
            }`}
          >
            📋 السجل
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`px-6 py-3 font-bold text-lg transition-all ${
              activeTab === 'report'
                ? 'border-b-4 border-primary text-primary bg-primary/5'
                : 'text-muted-foreground hover:text-primary'
            }`}
          >
            📊 التقارير
          </button>
        </div>

        {/* Operations Tab */}
        {activeTab === 'operations' && (
          <Card>
            <CardHeader>
              <CardTitle>عملية صرف جديدة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>نوع العملية</Label>
                  <Select value={operationType} onValueChange={(val) => {
                    setOperationType(val);
                    if (rates) {
                      setExchangeRate(val === 'buy' ? rates.buy_rate.toString() : rates.sell_rate.toString());
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buy">🟢 شراء دولار (دفع دينار)</SelectItem>
                      <SelectItem value="sell">🔴 بيع دولار (استلام دينار)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>المبلغ بالدولار (USD) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={amountUsd}
                    onChange={(e) => setAmountUsd(e.target.value)}
                    placeholder="100.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>سعر الصرف (IQD لكل 1 USD) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>ملاحظات (اختياري)</Label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="ملاحظات على العملية..."
                  />
                </div>
              </div>

              {/* Calculation Preview */}
              <Card className="bg-gray-50 border-2">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">المبلغ بالدينار</p>
                      <p className="text-xl font-bold text-blue-700">
                        {calculateAmountIqd()} IQD
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">الربح المتوقع</p>
                      <p className="text-xl font-bold text-green-700">
                        {calculateProfit()} IQD
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">نوع العملية</p>
                      <p className="text-xl font-bold">
                        {operationType === 'buy' ? '🟢 شراء' : '🔴 بيع'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button
                onClick={handleOperation}
                disabled={loading || !amountUsd || !exchangeRate}
                className="w-full"
                size="lg"
              >
                {loading ? 'جاري المعالجة...' : '✅ تنفيذ العملية'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>من تاريخ</Label>
                    <Input
                      type="date"
                      value={historyStartDate}
                      onChange={(e) => setHistoryStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>إلى تاريخ</Label>
                    <Input
                      type="date"
                      value={historyEndDate}
                      onChange={(e) => setHistoryEndDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 flex items-end">
                    <Button onClick={fetchOperations} className="w-full">
                      🔍 بحث
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {operations.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  لا توجد عمليات
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>سجل العمليات ({operations.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-200">
                        <tr>
                          <th className="p-3 text-right">التاريخ</th>
                          <th className="p-3 text-right">النوع</th>
                          <th className="p-3 text-right">المبلغ (USD)</th>
                          <th className="p-3 text-right">المبلغ (IQD)</th>
                          <th className="p-3 text-right">السعر</th>
                          <th className="p-3 text-right">الربح</th>
                        </tr>
                      </thead>
                      <tbody>
                        {operations.map((op) => (
                          <tr key={op.id} className="border-t hover:bg-gray-50">
                            <td className="p-3">
                              {new Date(op.created_at).toLocaleDateString('ar-IQ')}
                            </td>
                            <td className="p-3">
                              {op.operation_type === 'buy' ? '🟢 شراء' : '🔴 بيع'}
                            </td>
                            <td className="p-3 font-bold">{formatCurrency(op.amount_usd, 'USD')}</td>
                            <td className="p-3 font-bold">{formatCurrency(op.amount_iqd, 'IQD')}</td>
                            <td className="p-3">{op.exchange_rate.toLocaleString()}</td>
                            <td className={`p-3 font-bold ${op.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              {formatCurrency(op.profit, 'IQD')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Report Tab */}
        {activeTab === 'report' && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>إعدادات التقرير</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>نوع التقرير</Label>
                    <Select value={reportType} onValueChange={setReportType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">📅 يومي</SelectItem>
                        <SelectItem value="monthly">📆 شهري</SelectItem>
                        <SelectItem value="yearly">🗓️ سنوي</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>التاريخ</Label>
                    {reportType === 'yearly' ? (
                      <Input
                        type="number"
                        value={reportDate.substring(0, 4)}
                        onChange={(e) => setReportDate(`${e.target.value}-01-01`)}
                        min="2020"
                        max="2030"
                      />
                    ) : (
                      <Input
                        type={reportType === 'monthly' ? 'month' : 'date'}
                        value={reportType === 'monthly' ? reportDate.substring(0, 7) : reportDate}
                        onChange={(e) => {
                          if (reportType === 'monthly') {
                            setReportDate(`${e.target.value}-01`);
                          } else {
                            setReportDate(e.target.value);
                          }
                        }}
                      />
                    )}
                  </div>

                  <div className="space-y-2 flex items-end">
                    <Button onClick={fetchReport} disabled={loading} className="w-full">
                      {loading ? 'جاري التحميل...' : '📊 عرض التقرير'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {reportData && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="border-2 border-green-200 bg-green-50">
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">إجمالي الشراء</p>
                      <p className="text-3xl font-bold text-green-700">
                        {formatCurrency(reportData.total_buy_usd, 'USD')}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-2 border-blue-200 bg-blue-50">
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">إجمالي البيع</p>
                      <p className="text-3xl font-bold text-blue-700">
                        {formatCurrency(reportData.total_sell_usd, 'USD')}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-2 border-amber-200 bg-amber-50">
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">إجمالي الربح</p>
                      <p className="text-3xl font-bold text-amber-700">
                        {formatCurrency(reportData.total_profit, 'IQD')}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>عدد العمليات: {reportData.operations_count}</CardTitle>
                  </CardHeader>
                </Card>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExchangeOperationsPage;
