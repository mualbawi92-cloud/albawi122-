import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PaidCommissionsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  
  // Report filters
  const [reportType, setReportType] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Check if user is admin
  if (user?.role !== 'admin') {
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

      const response = await axios.get(`${API}/reports/commissions`, {
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
    return `${amount.toLocaleString()} ${currency}`;
  };

  const getDateInputType = () => {
    if (reportType === 'daily') return 'date';
    if (reportType === 'monthly') return 'month';
    if (reportType === 'yearly') return 'number';
    return 'date';
  };

  return (
    <div className="min-h-screen bg-background" data-testid="paid-commissions-page">
      
      <div className="container mx-auto p-6">
        <Card className="shadow-xl mb-6">
          <CardHeader className="bg-gradient-to-l from-red-50 to-red-100 border-b-4 border-red-500">
            <CardTitle className="text-3xl text-red-800">
              🔻 العمولات المدفوعة (الاستقطاعات)
            </CardTitle>
            <CardDescription className="text-base text-red-700">
              عرض جميع العمولات المدفوعة للصرافين عند استلام الحوالات
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded-lg">
              <div className="space-y-2">
                <Label>نوع التقرير</Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">يومي</SelectItem>
                    <SelectItem value="monthly">شهري</SelectItem>
                    <SelectItem value="yearly">سنوي</SelectItem>
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
                  className="w-full h-12 bg-red-600 hover:bg-red-700"
                >
                  {loading ? 'جاري التحميل...' : '🔍 عرض التقرير'}
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-xl">جاري التحميل...</div>
            ) : reportData ? (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border-2 border-red-300 bg-red-50">
                    <CardHeader>
                      <CardTitle className="text-xl text-red-800">💸 إجمالي العمولات المدفوعة (IQD)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-4xl font-bold text-red-600">
                        {formatCurrency(reportData.totals.IQD.paid, 'IQD')}
                      </p>
                      <p className="text-sm text-red-700 mt-2">
                        عدد العمليات: {reportData.paid_commissions.filter(c => c.currency === 'IQD').length}
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-2 border-red-300 bg-red-50">
                    <CardHeader>
                      <CardTitle className="text-xl text-red-800">💸 إجمالي العمولات المدفوعة (USD)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-4xl font-bold text-red-600">
                        {formatCurrency(reportData.totals.USD.paid, 'USD')}
                      </p>
                      <p className="text-sm text-red-700 mt-2">
                        عدد العمليات: {reportData.paid_commissions.filter(c => c.currency === 'USD').length}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    ℹ️ <strong>ملاحظة:</strong> العمولات المدفوعة هي المبالغ التي يتم دفعها للصرافين عند استلام الحوالات الواردة.
                    يتم خصم هذه المبالغ من حساب "عمولات مدفوعة (5110)" في دفتر الأستاذ.
                  </p>
                </div>

                {/* Paid Commissions Table */}
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
                              <th className="p-3 text-right">الصراف</th>
                              <th className="p-3 text-right">المبلغ</th>
                              <th className="p-3 text-right">النسبة</th>
                              <th className="p-3 text-right">الملاحظات</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.paid_commissions.map((comm, idx) => (
                              <tr key={comm.id || idx} className="border-b hover:bg-red-50">
                                <td className="p-3">
                                  {new Date(comm.created_at).toLocaleDateString('ar-IQ', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </td>
                                <td className="p-3 font-bold text-primary">
                                  <button
                                    onClick={() => navigate(`/transfers/${comm.transfer_id}`)}
                                    className="hover:underline"
                                  >
                                    {comm.transfer_code}
                                  </button>
                                </td>
                                <td className="p-3">{comm.agent_name}</td>
                                <td className="p-3 font-bold text-red-600">
                                  - {formatCurrency(comm.amount, comm.currency)}
                                </td>
                                <td className="p-3">{comm.commission_percentage}%</td>
                                <td className="p-3 text-sm text-gray-600">{comm.note}</td>
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

                {/* Net Profit Summary */}
                <Card className="border-2 border-green-300 bg-green-50">
                  <CardHeader>
                    <CardTitle className="text-xl text-green-800">📊 صافي الربح</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-green-700">صافي الربح (IQD)</Label>
                        <p className="text-3xl font-bold text-green-600">
                          {formatCurrency(reportData.totals.IQD.net, 'IQD')}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          العمولات المحققة: {formatCurrency(reportData.totals.IQD.earned, 'IQD')}
                        </p>
                        <p className="text-xs text-gray-600">
                          العمولات المدفوعة: {formatCurrency(reportData.totals.IQD.paid, 'IQD')}
                        </p>
                      </div>
                      <div>
                        <Label className="text-green-700">صافي الربح (USD)</Label>
                        <p className="text-3xl font-bold text-green-600">
                          {formatCurrency(reportData.totals.USD.net, 'USD')}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          العمولات المحققة: {formatCurrency(reportData.totals.USD.earned, 'USD')}
                        </p>
                        <p className="text-xs text-gray-600">
                          العمولات المدفوعة: {formatCurrency(reportData.totals.USD.paid, 'USD')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                اختر التاريخ لعرض التقرير
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PaidCommissionsPage;
