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
import QuickDateFilter from '../components/QuickDateFilter';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CommissionsUnifiedPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState([]);
  
  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedQuickFilter, setSelectedQuickFilter] = useState('all');
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [selectedCurrency, setSelectedCurrency] = useState('all');
  
  // Data
  const [paidCommissions, setPaidCommissions] = useState([]);
  const [earnedCommissions, setEarnedCommissions] = useState([]);
  const [showPaidDetails, setShowPaidDetails] = useState(false);
  const [showEarnedDetails, setShowEarnedDetails] = useState(false);

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('صلاحية الوصول مرفوضة');
      navigate('/dashboard');
      return;
    }
    
    fetchAgents();
  }, [user, navigate]);

  const handleSearch = () => {
    if (startDate && endDate) {
      fetchCommissions();
    }
  };

  const fetchAgents = async () => {
    try {
      const response = await axios.get(`${API}/agents`);
      setAgents(response.data || []);
    } catch (error) {
      console.error('Error fetching agents:', error);
    }
  };

  const fetchCommissions = async () => {
    setLoading(true);
    try {
      const params = {
        start_date: startDate,
        end_date: endDate
      };
      
      // Add agent filter if selected
      if (selectedAgent !== 'all') {
        params.agent_id = selectedAgent;
        console.log('Applying agent filter:', selectedAgent);
      }
      
      // Add currency filter if selected
      if (selectedCurrency !== 'all') {
        params.currency = selectedCurrency;
        console.log('Applying currency filter:', selectedCurrency);
      }
      
      console.log('Fetching commissions with params:', params);
      
      // Fetch paid commissions
      const paidResponse = await axios.get(`${API}/admin-commissions`, {
        params: { ...params, type: 'paid' }
      });
      
      console.log('Paid commissions received:', paidResponse.data.commissions?.length || 0);
      
      // Fetch earned commissions
      const earnedResponse = await axios.get(`${API}/admin-commissions`, {
        params: { ...params, type: 'earned' }
      });
      
      console.log('Earned commissions received:', earnedResponse.data.commissions?.length || 0);
      
      setPaidCommissions(paidResponse.data.commissions || []);
      setEarnedCommissions(earnedResponse.data.commissions || []);
      
    } catch (error) {
      console.error('Error fetching commissions:', error);
      toast.error('خطأ في تحميل العمولات');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = (commissions, currency = null) => {
    return commissions
      .filter(c => !currency || c.currency === currency)
      .reduce((sum, c) => sum + (c.amount || 0), 0);
  };

  const totalPaidIQD = calculateTotal(paidCommissions, 'IQD');
  const totalPaidUSD = calculateTotal(paidCommissions, 'USD');
  const totalEarnedIQD = calculateTotal(earnedCommissions, 'IQD');
  const totalEarnedUSD = calculateTotal(earnedCommissions, 'USD');
  const netIQD = totalEarnedIQD - totalPaidIQD;
  const netUSD = totalEarnedUSD - totalPaidUSD;

  const formatCurrency = (amount, currency) => {
    return `${amount.toLocaleString()} ${currency}`;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('ar-IQ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <Navbar />
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-l from-emerald-50 to-emerald-100">
            <CardTitle className="text-2xl sm:text-3xl">💰 العمولات</CardTitle>
            <CardDescription className="text-base">
              نظرة شاملة على العمولات المدفوعة والمحققة
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>الفلاتر</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>من تاريخ</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>إلى تاريخ</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>الصراف</Label>
                <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                  <SelectTrigger>
                    <SelectValue placeholder="الكل" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {agents.map(agent => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>العملة</Label>
                <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                  <SelectTrigger>
                    <SelectValue placeholder="الكل" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="IQD">IQD</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-12">جاري التحميل...</div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Paid Commissions */}
              <Card className="border-2 border-red-300 bg-red-50">
                <CardHeader>
                  <CardTitle className="text-red-800">🔻 العمولات المدفوعة</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-red-700">IQD</p>
                    <p className="text-3xl font-bold text-red-600">
                      {formatCurrency(totalPaidIQD, 'IQD')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-red-700">USD</p>
                    <p className="text-3xl font-bold text-red-600">
                      {formatCurrency(totalPaidUSD, 'USD')}
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowPaidDetails(!showPaidDetails)}
                    className="w-full bg-red-600 hover:bg-red-700"
                  >
                    {showPaidDetails ? '▴ إخفاء التفاصيل' : '▾ عرض التفاصيل'}
                  </Button>
                </CardContent>
              </Card>

              {/* Earned Commissions */}
              <Card className="border-2 border-green-300 bg-green-50">
                <CardHeader>
                  <CardTitle className="text-green-800">💰 العمولات المحققة</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-green-700">IQD</p>
                    <p className="text-3xl font-bold text-green-600">
                      {formatCurrency(totalEarnedIQD, 'IQD')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-green-700">USD</p>
                    <p className="text-3xl font-bold text-green-600">
                      {formatCurrency(totalEarnedUSD, 'USD')}
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowEarnedDetails(!showEarnedDetails)}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {showEarnedDetails ? '▴ إخفاء التفاصيل' : '▾ عرض التفاصيل'}
                  </Button>
                </CardContent>
              </Card>

              {/* Net Commissions */}
              <Card className={`border-2 ${netIQD >= 0 || netUSD >= 0 ? 'border-blue-300 bg-blue-50' : 'border-orange-300 bg-orange-50'}`}>
                <CardHeader>
                  <CardTitle className={netIQD >= 0 || netUSD >= 0 ? 'text-blue-800' : 'text-orange-800'}>
                    📊 صافي العمولات
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className={`text-sm ${netIQD >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>IQD</p>
                    <p className={`text-3xl font-bold ${netIQD >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                      {formatCurrency(netIQD, 'IQD')}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {netIQD >= 0 ? '✅ ربح' : '⚠️ خسارة'}
                    </p>
                  </div>
                  <div>
                    <p className={`text-sm ${netUSD >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>USD</p>
                    <p className={`text-3xl font-bold ${netUSD >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                      {formatCurrency(netUSD, 'USD')}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {netUSD >= 0 ? '✅ ربح' : '⚠️ خسارة'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Paid Commissions Details */}
            {showPaidDetails && paidCommissions.length > 0 && (
              <Card className="border-2 border-red-200">
                <CardHeader className="bg-red-50">
                  <CardTitle className="text-red-800">تفاصيل العمولات المدفوعة</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-200">
                        <tr>
                          <th className="p-3 text-right">التاريخ</th>
                          <th className="p-3 text-right">الصراف</th>
                          <th className="p-3 text-right">رقم الحوالة</th>
                          <th className="p-3 text-right">المبلغ</th>
                          <th className="p-3 text-right">العملة</th>
                          <th className="p-3 text-right">الملاحظة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paidCommissions.map((comm, idx) => (
                          <tr key={idx} className="border-t hover:bg-gray-50">
                            <td className="p-3">{formatDate(comm.created_at)}</td>
                            <td className="p-3">{comm.agent_name}</td>
                            <td className="p-3">{comm.transfer_code}</td>
                            <td className="p-3 font-bold text-red-600">
                              {comm.amount.toLocaleString()}
                            </td>
                            <td className="p-3">{comm.currency}</td>
                            <td className="p-3 text-xs">{comm.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Earned Commissions Details */}
            {showEarnedDetails && earnedCommissions.length > 0 && (
              <Card className="border-2 border-green-200">
                <CardHeader className="bg-green-50">
                  <CardTitle className="text-green-800">تفاصيل العمولات المحققة</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-200">
                        <tr>
                          <th className="p-3 text-right">التاريخ</th>
                          <th className="p-3 text-right">الصراف</th>
                          <th className="p-3 text-right">رقم الحوالة</th>
                          <th className="p-3 text-right">المبلغ</th>
                          <th className="p-3 text-right">العملة</th>
                          <th className="p-3 text-right">النسبة</th>
                          <th className="p-3 text-right">الملاحظة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {earnedCommissions.map((comm, idx) => (
                          <tr key={idx} className="border-t hover:bg-gray-50">
                            <td className="p-3">{formatDate(comm.created_at)}</td>
                            <td className="p-3">{comm.agent_name}</td>
                            <td className="p-3">{comm.transfer_code}</td>
                            <td className="p-3 font-bold text-green-600">
                              {comm.amount.toLocaleString()}
                            </td>
                            <td className="p-3">{comm.currency}</td>
                            <td className="p-3">
                              {comm.commission_percentage ? `${comm.commission_percentage}%` : '-'}
                            </td>
                            <td className="p-3 text-xs">{comm.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {!showPaidDetails && paidCommissions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                لا توجد عمولات مدفوعة في الفترة المحددة
              </div>
            )}

            {!showEarnedDetails && earnedCommissions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                لا توجد عمولات محققة في الفترة المحددة
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CommissionsUnifiedPage;
