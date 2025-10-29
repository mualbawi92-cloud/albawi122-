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
import Navbar from '../components/Navbar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ReportsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Report settings
  const [reportType, setReportType] = useState('daily'); // daily, monthly, yearly
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Report data
  const [commissionsReport, setCommissionsReport] = useState(null);
  const [agentsReport, setAgentsReport] = useState(null);
  
  // Tab state
  const [activeTab, setActiveTab] = useState('summary'); // summary, agents

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('صلاحية الوصول مرفوضة');
      navigate('/dashboard');
      return;
    }
  }, [user, navigate]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      // Get date parameter based on report type
      let dateParam = selectedDate;
      if (reportType === 'monthly') {
        dateParam = selectedDate.substring(0, 7); // YYYY-MM
      } else if (reportType === 'yearly') {
        dateParam = selectedDate.substring(0, 4); // YYYY
      }
      
      // Fetch commissions report
      const commissionsRes = await axios.get(`${API}/reports/commissions`, {
        params: { report_type: reportType, date: dateParam }
      });
      setCommissionsReport(commissionsRes.data);
      
      // Fetch agents profit report
      const agentsRes = await axios.get(`${API}/reports/agents-profit`, {
        params: { report_type: reportType, date: dateParam }
      });
      setAgentsReport(agentsRes.data);
      
      toast.success('تم تحميل التقرير بنجاح');
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('خطأ في تحميل التقارير');
    }
    setLoading(false);
  };

  const getDateInputType = () => {
    if (reportType === 'daily') return 'date';
    if (reportType === 'monthly') return 'month';
    return 'text'; // For yearly, we'll use a number input
  };

  const formatCurrency = (amount, currency = 'IQD') => {
    return `${amount.toLocaleString()} ${currency}`;
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <Navbar />
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-l from-green-50 to-green-100">
            <CardTitle className="text-2xl sm:text-3xl">📊 التقارير المالية</CardTitle>
            <CardDescription className="text-base">
              تقارير العمولات وأرباح الصيرفات
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Report Settings */}
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
                    value={selectedDate.substring(0, 4)}
                    onChange={(e) => setSelectedDate(`${e.target.value}-01-01`)}
                    placeholder="2024"
                    min="2020"
                    max="2030"
                  />
                ) : (
                  <Input
                    type={getDateInputType()}
                    value={reportType === 'monthly' ? selectedDate.substring(0, 7) : selectedDate}
                    onChange={(e) => {
                      if (reportType === 'monthly') {
                        setSelectedDate(`${e.target.value}-01`);
                      } else {
                        setSelectedDate(e.target.value);
                      }
                    }}
                  />
                )}
              </div>

              <div className="space-y-2 flex items-end">
                <Button 
                  onClick={fetchReports} 
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'جاري التحميل...' : '📊 عرض التقرير'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        {commissionsReport && (
          <>
            <div className="flex gap-2 border-b-2">
              <button
                onClick={() => setActiveTab('summary')}
                className={`px-6 py-3 font-bold text-lg transition-all ${
                  activeTab === 'summary'
                    ? 'border-b-4 border-primary text-primary bg-primary/5'
                    : 'text-muted-foreground hover:text-primary'
                }`}
              >
                📈 الملخص العام
              </button>
              <button
                onClick={() => setActiveTab('agents')}
                className={`px-6 py-3 font-bold text-lg transition-all ${
                  activeTab === 'agents'
                    ? 'border-b-4 border-primary text-primary bg-primary/5'
                    : 'text-muted-foreground hover:text-primary'
                }`}
              >
                👥 أرباح الصيرفات
              </button>
            </div>

            {/* Summary Tab */}
            {activeTab === 'summary' && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* IQD Summary */}
                  <Card className="border-2 border-green-200 bg-green-50">
                    <CardHeader>
                      <CardTitle className="text-xl text-green-900">
                        💵 الدينار العراقي (IQD)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="bg-white p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground">عمولات محققة (إيرادات)</p>
                        <p className="text-3xl font-bold text-green-700">
                          {formatCurrency(commissionsReport.summary.total_earned_iqd, 'IQD')}
                        </p>
                      </div>
                      <div className="bg-white p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground">عمولات مدفوعة (مصاريف)</p>
                        <p className="text-3xl font-bold text-red-700">
                          {formatCurrency(commissionsReport.summary.total_paid_iqd, 'IQD')}
                        </p>
                      </div>
                      <div className="bg-gradient-to-br from-green-600 to-green-800 p-4 rounded-lg">
                        <p className="text-sm text-white opacity-90">صافي الربح</p>
                        <p className="text-3xl font-bold text-white">
                          {formatCurrency(commissionsReport.summary.net_profit_iqd, 'IQD')}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* USD Summary */}
                  <Card className="border-2 border-blue-200 bg-blue-50">
                    <CardHeader>
                      <CardTitle className="text-xl text-blue-900">
                        💵 الدولار الأمريكي (USD)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="bg-white p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground">عمولات محققة (إيرادات)</p>
                        <p className="text-3xl font-bold text-green-700">
                          {formatCurrency(commissionsReport.summary.total_earned_usd, 'USD')}
                        </p>
                      </div>
                      <div className="bg-white p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground">عمولات مدفوعة (مصاريف)</p>
                        <p className="text-3xl font-bold text-red-700">
                          {formatCurrency(commissionsReport.summary.total_paid_usd, 'USD')}
                        </p>
                      </div>
                      <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-4 rounded-lg">
                        <p className="text-sm text-white opacity-90">صافي الربح</p>
                        <p className="text-3xl font-bold text-white">
                          {formatCurrency(commissionsReport.summary.net_profit_usd, 'USD')}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Transactions Details */}
                <Card>
                  <CardHeader>
                    <CardTitle>تفاصيل العمولات المحققة</CardTitle>
                    <CardDescription>
                      {commissionsReport.earned_commissions?.length || 0} عملية
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {commissionsReport.earned_commissions?.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="p-2 text-right">التاريخ</th>
                              <th className="p-2 text-right">الصراف</th>
                              <th className="p-2 text-right">رقم الحوالة</th>
                              <th className="p-2 text-right">المبلغ</th>
                              <th className="p-2 text-right">النسبة</th>
                            </tr>
                          </thead>
                          <tbody>
                            {commissionsReport.earned_commissions.map((comm, idx) => (
                              <tr key={idx} className="border-t">
                                <td className="p-2">{new Date(comm.created_at).toLocaleDateString('ar-IQ')}</td>
                                <td className="p-2">{comm.agent_name}</td>
                                <td className="p-2">{comm.transfer_code}</td>
                                <td className="p-2 font-bold text-green-700">
                                  {formatCurrency(comm.amount, comm.currency)}
                                </td>
                                <td className="p-2">{comm.commission_percentage}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-center py-4 text-muted-foreground">لا توجد عمليات</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>تفاصيل العمولات المدفوعة</CardTitle>
                    <CardDescription>
                      {commissionsReport.paid_commissions?.length || 0} عملية
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {commissionsReport.paid_commissions?.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="p-2 text-right">التاريخ</th>
                              <th className="p-2 text-right">الصراف</th>
                              <th className="p-2 text-right">رقم الحوالة</th>
                              <th className="p-2 text-right">المبلغ</th>
                              <th className="p-2 text-right">النسبة</th>
                            </tr>
                          </thead>
                          <tbody>
                            {commissionsReport.paid_commissions.map((comm, idx) => (
                              <tr key={idx} className="border-t">
                                <td className="p-2">{new Date(comm.created_at).toLocaleDateString('ar-IQ')}</td>
                                <td className="p-2">{comm.agent_name}</td>
                                <td className="p-2">{comm.transfer_code}</td>
                                <td className="p-2 font-bold text-red-700">
                                  {formatCurrency(comm.amount, comm.currency)}
                                </td>
                                <td className="p-2">{comm.commission_percentage}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-center py-4 text-muted-foreground">لا توجد عمليات</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Agents Tab */}
            {activeTab === 'agents' && agentsReport && (
              <div className="space-y-4">
                {agentsReport.agents?.length > 0 ? (
                  agentsReport.agents.map((agent) => (
                    <Card key={agent.agent_id} className="border-2">
                      <CardHeader className="bg-gradient-to-l from-gray-50 to-white">
                        <CardTitle className="text-xl">{agent.agent_name}</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          {/* IQD */}
                          <div className="space-y-2">
                            <p className="font-bold text-green-900">دينار عراقي (IQD)</p>
                            <div className="grid grid-cols-3 gap-2 text-sm">
                              <div className="bg-green-50 p-2 rounded">
                                <p className="text-xs text-muted-foreground">محققة</p>
                                <p className="font-bold text-green-700">
                                  {agent.IQD.earned.toLocaleString()}
                                </p>
                              </div>
                              <div className="bg-red-50 p-2 rounded">
                                <p className="text-xs text-muted-foreground">مدفوعة</p>
                                <p className="font-bold text-red-700">
                                  {agent.IQD.paid.toLocaleString()}
                                </p>
                              </div>
                              <div className="bg-purple-50 p-2 rounded">
                                <p className="text-xs text-muted-foreground">صافي</p>
                                <p className="font-bold text-purple-700">
                                  {agent.IQD.net.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* USD */}
                          <div className="space-y-2">
                            <p className="font-bold text-blue-900">دولار أمريكي (USD)</p>
                            <div className="grid grid-cols-3 gap-2 text-sm">
                              <div className="bg-green-50 p-2 rounded">
                                <p className="text-xs text-muted-foreground">محققة</p>
                                <p className="font-bold text-green-700">
                                  {agent.USD.earned.toLocaleString()}
                                </p>
                              </div>
                              <div className="bg-red-50 p-2 rounded">
                                <p className="text-xs text-muted-foreground">مدفوعة</p>
                                <p className="font-bold text-red-700">
                                  {agent.USD.paid.toLocaleString()}
                                </p>
                              </div>
                              <div className="bg-purple-50 p-2 rounded">
                                <p className="text-xs text-muted-foreground">صافي</p>
                                <p className="font-bold text-purple-700">
                                  {agent.USD.net.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                      لا توجد بيانات للصيرفات في هذه الفترة
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
