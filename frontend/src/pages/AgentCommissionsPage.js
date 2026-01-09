import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import api from '../services/api';


const AgentCommissionsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  
  // Report filters
  const [reportType, setReportType] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState('summary'); // summary, earned, paid

  // Only agents can access
  if (user?.role !== 'agent') {
    navigate('/dashboard');
    return null;
  }

  useEffect(() => {
    fetchReport();
  }, [reportType, selectedDate]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      let dateParam = selectedDate;
      if (reportType === 'monthly') {
        dateParam = selectedDate.substring(0, 7); // YYYY-MM
      } else if (reportType === 'yearly') {
        dateParam = selectedDate.substring(0, 4); // YYYY
      }

      const response = await api.get('/agent-commissions-report', {
        params: {
          report_type: reportType,
          date: dateParam
        }
      });
      
      setReportData(response.data);
    } catch (error) {
      console.error('Error fetching report:', error);
      toast.error('خطأ في تحميل التقرير');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount, currency = 'IQD') => {
    return `${amount?.toLocaleString() || 0} ${currency}`;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('ar-IQ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDateInputType = () => {
    if (reportType === 'daily') return 'date';
    if (reportType === 'monthly') return 'month';
    if (reportType === 'yearly') return 'number';
    return 'date';
  };

  const calculateNetProfit = (earned, paid) => {
    return earned - paid;
  };

  const calculateProfitPercentage = (earned, paid) => {
    if (earned === 0) return 0;
    return ((earned - paid) / earned * 100).toFixed(2);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="agent-commissions-page">
      
      <div className="container mx-auto p-6">
        <Card className="shadow-xl mb-6">
          <CardHeader className="bg-gradient-to-l from-green-50 to-green-100 border-b-4 border-green-500">
            <CardTitle className="text-3xl text-green-800">
              💰 العمولات الخاصة - {user?.display_name}
            </CardTitle>
            <CardDescription className="text-base text-green-700">
              عرض جميع عمولاتك المحققة والمدفوعة ونسب الربح والخسارة
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded-lg">
              <div className="space-y-2">
                <Label>نوع الكشف</Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">كشف يومي</SelectItem>
                    <SelectItem value="monthly">كشف شهري</SelectItem>
                    <SelectItem value="yearly">كشف سنوي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>التاريخ</Label>
                <Input
                  type={getDateInputType()}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="h-12"
                />
              </div>
              
              <div className="flex items-end">
                <Button
                  onClick={fetchReport}
                  disabled={loading}
                  className="w-full h-12 bg-green-600 hover:bg-green-700"
                >
                  {loading ? 'جاري التحميل...' : '🔍 عرض الكشف'}
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b-2 border-gray-200">
              <button
                onClick={() => setActiveTab('summary')}
                className={`px-6 py-3 font-bold text-sm transition-all ${
                  activeTab === 'summary'
                    ? 'border-b-4 border-green-500 text-green-700 bg-green-50'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                📊 نسبة الأرباح والخسائر
              </button>
              <button
                onClick={() => setActiveTab('earned')}
                className={`px-6 py-3 font-bold text-sm transition-all ${
                  activeTab === 'earned'
                    ? 'border-b-4 border-green-500 text-green-700 bg-green-50'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                💰 العمولات المحققة
              </button>
              <button
                onClick={() => setActiveTab('paid')}
                className={`px-6 py-3 font-bold text-sm transition-all ${
                  activeTab === 'paid'
                    ? 'border-b-4 border-red-500 text-red-700 bg-red-50'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                🔻 العمولات المدفوعة
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12 text-xl">جاري التحميل...</div>
            ) : reportData ? (
              <div className="space-y-6">
                {/* Summary Tab */}
                {activeTab === 'summary' && (
                  <div className="space-y-6">
                    {/* Totals Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* IQD Summary */}
                      <Card className="border-2 border-blue-300">
                        <CardHeader>
                          <CardTitle className="text-xl text-blue-800">ملخص العمولات (IQD)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="bg-green-50 p-4 rounded-lg">
                            <p className="text-sm text-green-700 mb-1">العمولات المحققة</p>
                            <p className="text-3xl font-bold text-green-600">
                              {formatCurrency(reportData.totals.IQD.earned, 'IQD')}
                            </p>
                          </div>
                          <div className="bg-red-50 p-4 rounded-lg">
                            <p className="text-sm text-red-700 mb-1">العمولات المدفوعة</p>
                            <p className="text-3xl font-bold text-red-600">
                              {formatCurrency(reportData.totals.IQD.paid, 'IQD')}
                            </p>
                          </div>
                          <div className={`p-4 rounded-lg border-2 ${
                            reportData.totals.IQD.net >= 0 
                              ? 'bg-green-50 border-green-300' 
                              : 'bg-red-50 border-red-300'
                          }`}>
                            <p className="text-sm text-gray-700 mb-1">صافي الربح/الخسارة</p>
                            <p className={`text-3xl font-bold ${
                              reportData.totals.IQD.net >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {formatCurrency(reportData.totals.IQD.net, 'IQD')}
                            </p>
                            <p className="text-xs text-gray-600 mt-2">
                              نسبة الربح: {calculateProfitPercentage(
                                reportData.totals.IQD.earned,
                                reportData.totals.IQD.paid
                              )}%
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      {/* USD Summary */}
                      <Card className="border-2 border-blue-300">
                        <CardHeader>
                          <CardTitle className="text-xl text-blue-800">ملخص العمولات (USD)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="bg-green-50 p-4 rounded-lg">
                            <p className="text-sm text-green-700 mb-1">العمولات المحققة</p>
                            <p className="text-3xl font-bold text-green-600">
                              {formatCurrency(reportData.totals.USD.earned, 'USD')}
                            </p>
                          </div>
                          <div className="bg-red-50 p-4 rounded-lg">
                            <p className="text-sm text-red-700 mb-1">العمولات المدفوعة</p>
                            <p className="text-3xl font-bold text-red-600">
                              {formatCurrency(reportData.totals.USD.paid, 'USD')}
                            </p>
                          </div>
                          <div className={`p-4 rounded-lg border-2 ${
                            reportData.totals.USD.net >= 0 
                              ? 'bg-green-50 border-green-300' 
                              : 'bg-red-50 border-red-300'
                          }`}>
                            <p className="text-sm text-gray-700 mb-1">صافي الربح/الخسارة</p>
                            <p className={`text-3xl font-bold ${
                              reportData.totals.USD.net >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {formatCurrency(reportData.totals.USD.net, 'USD')}
                            </p>
                            <p className="text-xs text-gray-600 mt-2">
                              نسبة الربح: {calculateProfitPercentage(
                                reportData.totals.USD.earned,
                                reportData.totals.USD.paid
                              )}%
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                      <p className="text-sm text-blue-900">
                        ℹ️ <strong>ملاحظة:</strong> العمولات المحققة هي من الحوالات الصادرة، 
                        والعمولات المدفوعة هي من الحوالات الواردة. 
                        صافي الربح = العمولات المحققة - العمولات المدفوعة
                      </p>
                    </div>
                  </div>
                )}

                {/* Earned Commissions Tab */}
                {activeTab === 'earned' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className="border-2 border-green-300 bg-green-50">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-green-700">إجمالي العمولات المحققة (IQD)</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-3xl font-bold text-green-600">
                            {formatCurrency(reportData.totals.IQD.earned, 'IQD')}
                          </p>
                          <p className="text-xs text-green-700 mt-1">
                            من {reportData.earned_commissions.filter(c => c.currency === 'IQD').length} حوالة صادرة
                          </p>
                        </CardContent>
                      </Card>
                      
                      <Card className="border-2 border-green-300 bg-green-50">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-green-700">إجمالي العمولات المحققة (USD)</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-3xl font-bold text-green-600">
                            {formatCurrency(reportData.totals.USD.earned, 'USD')}
                          </p>
                          <p className="text-xs text-green-700 mt-1">
                            من {reportData.earned_commissions.filter(c => c.currency === 'USD').length} حوالة صادرة
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    {reportData.earned_commissions.length > 0 ? (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-xl">📋 تفاصيل العمولات المحققة</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                              <thead>
                                <tr className="bg-green-100 border-b-2 border-green-300">
                                  <th className="p-3 text-right">التاريخ</th>
                                  <th className="p-3 text-right">رمز الحوالة</th>
                                  <th className="p-3 text-right">المبلغ الأساسي</th>
                                  <th className="p-3 text-right">النسبة</th>
                                  <th className="p-3 text-right">العمولة</th>
                                </tr>
                              </thead>
                              <tbody>
                                {reportData.earned_commissions.map((comm, idx) => (
                                  <tr key={idx} className="border-b hover:bg-green-50">
                                    <td className="p-3 text-sm">{formatDate(comm.created_at)}</td>
                                    <td className="p-3 font-bold text-primary">
                                      <button
                                        onClick={() => navigate('/transfers/${comm.transfer_id}')}
                                        className="hover:underline"
                                      >
                                        {comm.transfer_code}
                                      </button>
                                    </td>
                                    <td className="p-3">{formatCurrency(comm.transfer_amount, comm.currency)}</td>
                                    <td className="p-3">{comm.commission_percentage}%</td>
                                    <td className="p-3 font-bold text-green-600">
                                      +{formatCurrency(comm.amount, comm.currency)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        لا توجد عمولات محققة في هذه الفترة
                      </div>
                    )}
                  </div>
                )}

                {/* Paid Commissions Tab */}
                {activeTab === 'paid' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className="border-2 border-red-300 bg-red-50">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-red-700">إجمالي العمولات المدفوعة (IQD)</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-3xl font-bold text-red-600">
                            {formatCurrency(reportData.totals.IQD.paid, 'IQD')}
                          </p>
                          <p className="text-xs text-red-700 mt-1">
                            من {reportData.paid_commissions.filter(c => c.currency === 'IQD').length} حوالة واردة
                          </p>
                        </CardContent>
                      </Card>
                      
                      <Card className="border-2 border-red-300 bg-red-50">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-red-700">إجمالي العمولات المدفوعة (USD)</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-3xl font-bold text-red-600">
                            {formatCurrency(reportData.totals.USD.paid, 'USD')}
                          </p>
                          <p className="text-xs text-red-700 mt-1">
                            من {reportData.paid_commissions.filter(c => c.currency === 'USD').length} حوالة واردة
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    {reportData.paid_commissions.length > 0 ? (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-xl">📋 تفاصيل العمولات المدفوعة</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                              <thead>
                                <tr className="bg-red-100 border-b-2 border-red-300">
                                  <th className="p-3 text-right">التاريخ</th>
                                  <th className="p-3 text-right">رمز الحوالة</th>
                                  <th className="p-3 text-right">المبلغ الأساسي</th>
                                  <th className="p-3 text-right">النسبة</th>
                                  <th className="p-3 text-right">العمولة</th>
                                </tr>
                              </thead>
                              <tbody>
                                {reportData.paid_commissions.map((comm, idx) => (
                                  <tr key={idx} className="border-b hover:bg-red-50">
                                    <td className="p-3 text-sm">{formatDate(comm.created_at)}</td>
                                    <td className="p-3 font-bold text-primary">
                                      <button
                                        onClick={() => navigate('/transfers/${comm.transfer_id}')}
                                        className="hover:underline"
                                      >
                                        {comm.transfer_code}
                                      </button>
                                    </td>
                                    <td className="p-3">{formatCurrency(comm.transfer_amount, comm.currency)}</td>
                                    <td className="p-3">{comm.commission_percentage}%</td>
                                    <td className="p-3 font-bold text-red-600">
                                      +{formatCurrency(comm.amount, comm.currency)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        لا توجد عمولات مدفوعة في هذه الفترة
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                اختر نوع الكشف والتاريخ لعرض التقرير
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AgentCommissionsPage;
