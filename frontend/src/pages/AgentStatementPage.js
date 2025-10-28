import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import { formatAmountInWords } from '../utils/arabicNumbers';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AgentStatementPage = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchStatement();
  }, [agentId]);

  const fetchStatement = async () => {
    try {
      const id = agentId || user.id;
      const response = await axios.get(`${API}/agents/${id}/statement`);
      setStatement(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching statement:', error);
      toast.error('خطأ في تحميل كشف الحساب');
      navigate('/dashboard');
    }
  };

  const calculateRunningBalance = (transfers) => {
    let balance = 0;
    // Include completed and cancelled (reversal) transfers
    const statementTransfers = transfers.filter(t => 
      t.status === 'completed' || t.is_reversal
    );
    
    return statementTransfers.map(transfer => {
      const isSent = transfer.from_agent_id === statement.agent_id;
      const amount = transfer.amount || 0;
      const isReversal = transfer.is_reversal;
      
      if (isReversal) {
        // Reversal: add back the amount (cancelled sent transfer)
        balance += amount;
      } else if (isSent) {
        balance -= amount; // مدين (خارج)
      } else {
        balance += amount; // دائن (داخل)
      }
      
      return {
        ...transfer,
        running_balance: balance
      };
    });
  };

  const filterTransfers = (transfers) => {
    let filtered = transfers;
    
    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(t => 
        t.transfer_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.sender_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.receiver_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Date filter
    if (dateFrom) {
      filtered = filtered.filter(t => new Date(t.created_at) >= new Date(dateFrom));
    }
    if (dateTo) {
      filtered = filtered.filter(t => new Date(t.created_at) <= new Date(dateTo));
    }
    
    return filtered;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FB]">
        <Navbar />
        <div className="container mx-auto p-6 flex items-center justify-center min-h-[50vh]">
          <div className="text-2xl text-primary">جاري التحميل...</div>
        </div>
      </div>
    );
  }

  const transfersWithBalance = calculateRunningBalance(statement.transfers);
  const filteredTransfers = filterTransfers(transfersWithBalance);
  
  // Calculate totals for completed transfers only
  const totalCredit = statement.total_received; // الدائن (الداخل)
  const totalDebit = statement.total_sent; // المدين (الخارج)
  const netBalance = totalCredit - totalDebit; // الرصيد الصافي

  return (
    <div className="min-h-screen bg-[#F8F9FB]" data-testid="agent-statement-page">
      <Navbar />
      <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        
        {/* Header Section */}
        <Card className="shadow-lg border-0">
          <CardHeader className="p-6 bg-white">
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
                💰 كشف حساب الزبون
              </h1>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 font-semibold">اسم الزبون:</p>
                  <p className="text-lg font-bold text-gray-900">{statement.agent_name}</p>
                </div>
                <div>
                  <p className="text-gray-600 font-semibold">المحافظة:</p>
                  <p className="text-lg font-bold text-gray-900">{statement.governorate}</p>
                </div>
                <div>
                  <p className="text-gray-600 font-semibold">رصيد البداية:</p>
                  <p className="text-lg font-bold text-gray-900">0 د.ع</p>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Summary Cards - 3 Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Credit Card - الدائن */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-green-700">💵 الدائن (المبالغ الداخلة)</p>
                  <p className="text-3xl font-bold text-green-600">
                    {totalCredit.toLocaleString()}
                  </p>
                  <p className="text-xs text-green-600">عدد: {statement.total_received_count}</p>
                  <p className="text-xs text-green-700 italic mt-1">
                    {formatAmountInWords(totalCredit, 'IQD')}
                  </p>
                </div>
                <div className="text-5xl text-green-500/30">⬇️</div>
              </div>
            </CardContent>
          </Card>

          {/* Debit Card - المدين */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-red-50 to-red-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-red-700">💸 المدين (المبالغ الخارجة)</p>
                  <p className="text-3xl font-bold text-red-600">
                    {totalDebit.toLocaleString()}
                  </p>
                  <p className="text-xs text-red-600">عدد: {statement.total_sent_count}</p>
                  <p className="text-xs text-red-700 italic mt-1">
                    {formatAmountInWords(totalDebit, 'IQD')}
                  </p>
                </div>
                <div className="text-5xl text-red-500/30">⬆️</div>
              </div>
            </CardContent>
          </Card>

          {/* Net Balance - الرصيد الصافي */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-blue-700">⚖️ الرصيد الصافي</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {netBalance.toLocaleString()}
                  </p>
                  <p className="text-xs text-blue-600">د.ع</p>
                  <p className="text-xs text-blue-700 italic mt-1">
                    {formatAmountInWords(Math.abs(netBalance), 'IQD')}
                  </p>
                </div>
                <div className="text-5xl text-blue-500/30">💰</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="🔎 بحث برقم الحوالة أو الاسم..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-10"
                  placeholder="من تاريخ"
                />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-10"
                  placeholder="إلى تاريخ"
                />
              </div>
              <Button
                onClick={fetchStatement}
                className="bg-blue-600 hover:bg-blue-700"
              >
                🔄 تحديث
              </Button>
              <Button
                variant="outline"
                className="border-2 border-gray-300"
              >
                ⬇️ تحميل PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-white border-b">
            <CardTitle className="text-xl">📅 جدول الحركات المكتملة</CardTitle>
            <CardDescription>
              إجمالي: {filteredTransfers.length} حركة مكتملة فقط
              <span className="text-xs text-yellow-600 mr-2">
                (الحوالات قيد الانتظار لا تظهر في كشف الحساب)
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {filteredTransfers.length === 0 ? (
              <p className="text-center text-gray-500 py-8">لا توجد حركات</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 border-b-2">
                    <tr>
                      <th className="text-right p-3 text-sm font-bold text-gray-700">التاريخ</th>
                      <th className="text-right p-3 text-sm font-bold text-gray-700">الوصف</th>
                      <th className="text-right p-3 text-sm font-bold text-green-700">دائن ⬇️</th>
                      <th className="text-right p-3 text-sm font-bold text-red-700">مدين ⬆️</th>
                      <th className="text-right p-3 text-sm font-bold text-blue-700">الرصيد بعد الحركة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransfers.map((transfer) => {
                      const isSent = transfer.from_agent_id === statement.agent_id;
                      const isCompleted = transfer.status === 'completed';
                      const isReversal = transfer.is_reversal;
                      const amount = transfer.amount || 0;
                      
                      // Color coding
                      let bgColor;
                      if (isReversal) {
                        bgColor = 'bg-purple-50 hover:bg-purple-100 border-l-4 border-l-purple-500';
                      } else if (isCompleted) {
                        bgColor = isSent ? 'bg-red-50 hover:bg-red-100' : 'bg-green-50 hover:bg-green-100';
                      } else {
                        bgColor = 'bg-gray-50 hover:bg-gray-100';
                      }
                      
                      return (
                        <tr 
                          key={`${transfer.id}-${isReversal ? 'reversal' : 'normal'}`}
                          className={`border-b cursor-pointer transition-colors ${bgColor}`}
                          onClick={() => navigate(`/transfers/${transfer.id}`)}
                        >
                          <td className="p-3 text-sm">
                            <div className="font-semibold text-gray-900">
                              {new Date(transfer.cancelled_at || transfer.created_at).toLocaleDateString('ar-IQ')}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(transfer.cancelled_at || transfer.created_at).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td className="p-3">
                            <div>
                              <div className="font-bold text-primary text-sm">
                                {transfer.transfer_code}
                                {isReversal && (
                                  <span className="mr-2 text-xs bg-purple-200 text-purple-800 px-2 py-1 rounded">
                                    🔄 قيد عكسي
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-600">
                                {isReversal ? (
                                  <span className="text-purple-700 font-semibold">
                                    ❌ حوالة ملغاة - إرجاع المبلغ
                                  </span>
                                ) : (
                                  isSent ? `إلى: ${transfer.receiver_name}` : `من: ${transfer.sender_name}`
                                )}
                              </div>
                              <div className="text-xs">
                                {isReversal ? (
                                  <span className="text-purple-600">🔄 قيد عكسي</span>
                                ) : transfer.status === 'completed' ? (
                                  <span className="text-green-600">✅ مكتمل</span>
                                ) : (
                                  <span className="text-yellow-600">⏳ قيد الانتظار</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            {(isReversal || (!isSent && isCompleted)) ? (
                              <span className="text-lg font-bold text-green-600">
                                +{amount.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            {(!isReversal && isSent && isCompleted) ? (
                              <span className="text-lg font-bold text-red-600">
                                -{amount.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className="text-lg font-bold text-blue-600">
                              {transfer.running_balance.toLocaleString()}
                            </span>
                            <span className="text-xs text-gray-500 mr-1">د.ع</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Footer */}
        <Card className="border-0 shadow-lg bg-gradient-to-l from-gray-50 to-white">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-sm text-gray-600 mb-1">✅ إجمالي الدائن</p>
                <p className="text-2xl font-bold text-green-600">{totalCredit.toLocaleString()} د.ع</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">🚫 إجمالي المدين</p>
                <p className="text-2xl font-bold text-red-600">{totalDebit.toLocaleString()} د.ع</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">⚖️ الرصيد النهائي</p>
                <p className="text-3xl font-bold text-blue-600">{netBalance.toLocaleString()} د.ع</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Back Button */}
        <div className="flex justify-center">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="outline"
            className="w-full sm:w-auto border-2"
          >
            العودة للرئيسية
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AgentStatementPage;
