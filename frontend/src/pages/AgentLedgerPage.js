import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import Navbar from '../components/Navbar';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AgentLedgerPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [ledgerData, setLedgerData] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  // Only agents can access this page
  if (user?.role !== 'agent') {
    navigate('/dashboard');
    return null;
  }

  useEffect(() => {
    // Set default from date to 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    setDateFrom(thirtyDaysAgo.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (dateFrom && dateTo) {
      fetchLedgerData();
    }
  }, [dateFrom, dateTo]);

  const fetchLedgerData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/agent-ledger`, {
        params: {
          date_from: dateFrom,
          date_to: dateTo
        }
      });
      setLedgerData(response.data);
    } catch (error) {
      console.error('Error fetching ledger:', error);
      toast.error('خطأ في تحميل دفتر الأستاذ');
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

  return (
    <div className="min-h-screen bg-background" data-testid="agent-ledger-page">
      <Navbar />
      <div className="container mx-auto p-6">
        <Card className="shadow-xl">
          <CardHeader className="bg-gradient-to-l from-blue-50 to-blue-100 border-b-4 border-blue-500">
            <CardTitle className="text-3xl text-blue-800">
              📊 دفتر الأستاذ الخاص - {user?.display_name}
            </CardTitle>
            <CardDescription className="text-base text-blue-700">
              عرض جميع حركاتك المالية والحوالات
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {/* Date Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded-lg">
              <div className="space-y-2">
                <Label>من تاريخ</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-12"
                />
              </div>
              
              <div className="space-y-2">
                <Label>إلى تاريخ</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-12"
                />
              </div>
              
              <div className="flex items-end">
                <Button
                  onClick={fetchLedgerData}
                  disabled={loading}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? 'جاري التحميل...' : '🔍 عرض'}
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-xl">جاري التحميل...</div>
            ) : ledgerData ? (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="border-2 border-blue-300 bg-blue-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-blue-700">رصيد المحفظة (IQD)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-blue-600">
                        {formatCurrency(ledgerData.wallet_balance_iqd, 'IQD')}
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-2 border-green-300 bg-green-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-green-700">رصيد المحفظة (USD)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(ledgerData.wallet_balance_usd, 'USD')}
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-2 border-purple-300 bg-purple-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-purple-700">عدد الحوالات الصادرة</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-purple-600">
                        {ledgerData.outgoing_transfers_count}
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-2 border-orange-300 bg-orange-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-orange-700">عدد الحوالات الواردة</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-orange-600">
                        {ledgerData.incoming_transfers_count}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Commissions Summary */}
                <Card className="border-2 border-green-300">
                  <CardHeader>
                    <CardTitle className="text-xl text-green-800">💰 ملخص العمولات</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-green-700 mb-1">العمولات المحققة (IQD)</p>
                        <p className="text-2xl font-bold text-green-600">
                          {formatCurrency(ledgerData.earned_commission_iqd, 'IQD')}
                        </p>
                      </div>
                      <div className="bg-red-50 p-4 rounded-lg">
                        <p className="text-sm text-red-700 mb-1">العمولات المدفوعة (IQD)</p>
                        <p className="text-2xl font-bold text-red-600">
                          {formatCurrency(ledgerData.paid_commission_iqd, 'IQD')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Transactions Table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">📋 الحركات المالية</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {ledgerData.transactions && ledgerData.transactions.length > 0 ? (
                      <>
                        {/* Desktop View - Table */}
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-blue-100 border-b-2 border-blue-300">
                                <th className="p-3 text-right">التاريخ</th>
                                <th className="p-3 text-right">النوع</th>
                                <th className="p-3 text-right">الوصف</th>
                                <th className="p-3 text-right">الرصيد</th>
                                <th className="p-3 text-right">المدين (خروج)</th>
                                <th className="p-3 text-right">الدائن (دخول)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ledgerData.transactions.map((txn, idx) => (
                                <tr key={idx} className="border-b hover:bg-blue-50">
                                  <td className="p-3 text-sm">{formatDate(txn.date)}</td>
                                  <td className="p-3">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                      txn.type === 'outgoing' ? 'bg-purple-100 text-purple-800' :
                                      txn.type === 'incoming' ? 'bg-orange-100 text-orange-800' :
                                      txn.type === 'commission_earned' ? 'bg-green-100 text-green-800' :
                                      txn.type === 'commission_paid' ? 'bg-red-100 text-red-800' :
                                      txn.type === 'journal_entry' ? 'bg-indigo-100 text-indigo-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {
                                        txn.type === 'outgoing' ? '📤 حوالة صادرة' :
                                        txn.type === 'incoming' ? '📥 حوالة واردة' :
                                        txn.type === 'commission_earned' ? '💰 عمولة محققة' :
                                        txn.type === 'commission_paid' ? '🔻 عمولة مدفوعة' :
                                        txn.type === 'journal_entry' ? '📝 قيد يومي' :
                                        txn.type
                                      }
                                    </span>
                                  </td>
                                  <td className="p-3 text-sm">{txn.description}</td>
                                  <td className="p-3 font-bold text-blue-600">
                                    {formatCurrency(txn.balance, txn.currency)}
                                  </td>
                                  <td className="p-3 font-bold text-blue-600">
                                    {txn.debit > 0 ? formatCurrency(txn.debit, txn.currency) : '-'}
                                  </td>
                                  <td className="p-3 font-bold text-green-600">
                                    {txn.credit > 0 ? formatCurrency(txn.credit, txn.currency) : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile View - Cards */}
                        <div className="md:hidden space-y-4">
                          {ledgerData.transactions.map((txn, idx) => (
                            <div key={idx} className="bg-white border-2 border-blue-200 rounded-lg p-4 shadow-sm">
                              {/* التاريخ والنوع */}
                              <div className="flex justify-between items-center mb-3 pb-3 border-b">
                                <div>
                                  <p className="text-xs text-gray-500">التاريخ</p>
                                  <p className="text-sm font-semibold">{formatDate(txn.date)}</p>
                                </div>
                                <div>
                                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                    txn.type === 'outgoing' ? 'bg-purple-100 text-purple-800' :
                                    txn.type === 'incoming' ? 'bg-orange-100 text-orange-800' :
                                    txn.type === 'commission_earned' ? 'bg-green-100 text-green-800' :
                                    txn.type === 'commission_paid' ? 'bg-red-100 text-red-800' :
                                    txn.type === 'journal_entry' ? 'bg-indigo-100 text-indigo-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {
                                      txn.type === 'outgoing' ? '📤 صادرة' :
                                      txn.type === 'incoming' ? '📥 واردة' :
                                      txn.type === 'commission_earned' ? '💰 عمولة محققة' :
                                      txn.type === 'commission_paid' ? '🔻 عمولة مدفوعة' :
                                      txn.type === 'journal_entry' ? '📝 قيد يومي' :
                                      txn.type
                                    }
                                  </span>
                                </div>
                              </div>

                              {/* الوصف */}
                              <div className="mb-3">
                                <p className="text-xs text-gray-500 mb-1">الوصف</p>
                                <p className="text-sm font-medium">{txn.description}</p>
                              </div>

                              {/* الرصيد */}
                              <div className="bg-gradient-to-l from-blue-50 to-blue-100 rounded-lg p-3 mb-3">
                                <p className="text-xs text-blue-700 mb-1">💰 الرصيد</p>
                                <p className="text-2xl font-bold text-blue-600">
                                  {formatCurrency(txn.balance, txn.currency)}
                                </p>
                              </div>

                              {/* المدين والدائن */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-blue-50 rounded-lg p-3">
                                  <p className="text-xs text-blue-700 mb-1">📤 المدين (خروج)</p>
                                  <p className="text-lg font-bold text-blue-700">
                                    {txn.debit > 0 ? formatCurrency(txn.debit, txn.currency) : '-'}
                                  </p>
                                </div>
                                <div className="bg-green-50 rounded-lg p-3">
                                  <p className="text-xs text-green-700 mb-1">📥 الدائن (دخول)</p>
                                  <p className="text-lg font-bold text-green-700">
                                    {txn.credit > 0 ? formatCurrency(txn.credit, txn.currency) : '-'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        لا توجد حركات مالية في هذه الفترة
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                اختر الفترة الزمنية لعرض دفتر الأستاذ
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AgentLedgerPage;
