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
import { printDocument, generateAccountingReportHTML } from '../utils/printUtils';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AgentLedgerPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [ledgerData, setLedgerData] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [enabledCurrencies, setEnabledCurrencies] = useState([]);
  const [agentName, setAgentName] = useState(null);

  // Only agents and users can access this page
  if (user?.role !== 'agent' && user?.role !== 'user') {
    navigate('/dashboard');
    return null;
  }

  useEffect(() => {
    // Set default from date to 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    setDateFrom(thirtyDaysAgo.toISOString().split('T')[0]);
  }, []);

  // Fetch enabled currencies and agent name on mount
  useEffect(() => {
    const fetchEnabledCurrencies = async () => {
      try {
        let accountId = null;
        
        // If user is an agent, use their own account
        if (user?.role === 'agent') {
          const response = await axios.get(`${API}/agents`);
          const agents = response.data;
          const currentAgent = agents.find(a => a.id === user?.id);
          accountId = currentAgent?.account_id;
        }
        // If user is a regular user, get their agent's account and name
        else if (user?.role === 'user' && user?.agent_id) {
          try {
            const agentResponse = await axios.get(`${API}/agents/${user.agent_id}`, {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            accountId = agentResponse.data?.account_id;
            setAgentName(agentResponse.data?.display_name); // Set agent name for display
          } catch (err) {
            console.error('Error fetching user agent:', err);
          }
        }
        
        if (accountId) {
          const accountResponse = await axios.get(`${API}/accounting/accounts/${accountId}`);
          const currencies = accountResponse.data.currencies || ['IQD', 'USD'];
          setEnabledCurrencies(currencies);
          setSelectedCurrency(currencies[0]); // Set first currency as default
        } else {
          // Fallback to default currencies
          setEnabledCurrencies(['IQD', 'USD']);
          setSelectedCurrency('IQD');
        }
      } catch (error) {
        console.error('Error fetching currencies:', error);
        // Fallback to default
        setEnabledCurrencies(['IQD', 'USD']);
        setSelectedCurrency('IQD');
      }
    };
    
    fetchEnabledCurrencies();
  }, [user]);

  useEffect(() => {
    if (dateFrom && dateTo && selectedCurrency) {
      fetchLedgerData();
    }
  }, [dateFrom, dateTo, selectedCurrency]);

  const fetchLedgerData = async () => {
    if (!selectedCurrency) return;
    
    setLoading(true);
    try {
      const params = {
        date_from: dateFrom,
        date_to: dateTo,
        currency: selectedCurrency
      };
      
      // If user is not an agent, add agent_id to request
      if (user?.role === 'user' && user?.agent_id) {
        params.agent_id = user.agent_id;
      }
      
      const response = await axios.get(`${API}/agent-ledger`, {
        params: params
      });
      setLedgerData(response.data);
      setEnabledCurrencies(response.data.enabled_currencies || enabledCurrencies);
    } catch (error) {
      console.error('Error fetching ledger:', error);
      const errorMsg = error.response?.data?.detail || 'خطأ في تحميل دفتر الأستاذ';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle currency change
  const handleCurrencyChange = (currency) => {
    setSelectedCurrency(currency);
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 bg-gray-50 p-4 rounded-lg">
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
              
              <div className="space-y-2">
                <Label>العملة *</Label>
                {enabledCurrencies.length > 0 ? (
                  <select
                    value={selectedCurrency}
                    onChange={(e) => handleCurrencyChange(e.target.value)}
                    className="w-full h-12 border rounded-md px-3 bg-white"
                  >
                    {enabledCurrencies.map(curr => (
                      <option key={curr} value={curr}>
                        {curr === 'IQD' ? 'دينار عراقي (IQD)' :
                         curr === 'USD' ? 'دولار أمريكي (USD)' :
                         curr === 'EUR' ? 'يورو (EUR)' :
                         curr === 'GBP' ? 'جنيه إسترليني (GBP)' :
                         curr}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="h-12 border rounded-md p-2 text-sm text-gray-500 flex items-center">
                    لا توجد عملات مفعّلة
                  </div>
                )}
              </div>
              
              <div className="flex items-end gap-2">
                <Button
                  onClick={fetchLedgerData}
                  disabled={loading}
                  className="flex-1 h-12 bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? 'جاري التحميل...' : '🔍 عرض'}
                </Button>
                
                {ledgerData && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const html = generateAccountingReportHTML(
                        '📊 دفتر الأستاذ الخاص',
                        `${user?.display_name}`,
                        `من ${dateFrom} إلى ${dateTo}`,
                        [
                          { 
                            label: `الرصيد الحالي (${ledgerData.selected_currency})`, 
                            value: `${ledgerData.current_balance?.toLocaleString() || 0} ${ledgerData.selected_currency}`,
                            color: '#dbeafe',
                            borderColor: '#3b82f6',
                            textColor: '#1e40af'
                          }
                        ],
                        ledgerData.transactions || [],
                        [
                          { header: 'التاريخ', field: 'date', render: (val) => new Date(val).toLocaleDateString('ar-IQ') },
                          { header: 'النوع', field: 'type' },
                          { header: 'الوصف', field: 'description' },
                          { header: 'الرصيد', field: 'balance', align: 'center', bold: true, render: (val, row) => `${val?.toLocaleString() || 0} ${row.currency}` },
                          { header: 'المدين', field: 'debit', align: 'center', render: (val, row) => val > 0 ? `${val.toLocaleString()} ${row.currency}` : '-' },
                          { header: 'الدائن', field: 'credit', align: 'center', render: (val, row) => val > 0 ? `${val.toLocaleString()} ${row.currency}` : '-' }
                        ],
                        user
                      );
                      printDocument(html, `دفتر أستاذ ${user?.username}`);
                    }}
                    className="h-12 px-4"
                    disabled={!ledgerData}
                  >
                    🖨️ طباعة
                  </Button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-xl">جاري التحميل...</div>
            ) : ledgerData ? (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card className="border-2 border-blue-300 bg-blue-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-blue-700">
                        الرصيد الحالي ({ledgerData.selected_currency})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-blue-600">
                        {formatCurrency(ledgerData.current_balance, ledgerData.selected_currency)}
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
                    <CardTitle className="text-xl text-green-800">
                      💰 ملخص العمولات ({ledgerData.selected_currency})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-green-700 mb-1">
                          العمولات المحققة ({ledgerData.selected_currency})
                        </p>
                        <p className="text-2xl font-bold text-green-600">
                          {formatCurrency(ledgerData.earned_commission, ledgerData.selected_currency)}
                        </p>
                      </div>
                      <div className="bg-red-50 p-4 rounded-lg">
                        <p className="text-sm text-red-700 mb-1">
                          العمولات المدفوعة ({ledgerData.selected_currency})
                        </p>
                        <p className="text-2xl font-bold text-red-600">
                          {formatCurrency(ledgerData.paid_commission, ledgerData.selected_currency)}
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
