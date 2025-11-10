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

const LedgerPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [accountDetails, setAccountDetails] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState(''); // Will be set to first enabled currency
  const [enabledCurrencies, setEnabledCurrencies] = useState([]); // العملات المفعّلة للحساب

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('صلاحية الوصول مرفوضة');
      navigate('/dashboard');
      return;
    }
    fetchAccounts();
  }, [user, navigate]);

  const fetchAccounts = async () => {
    try {
      const response = await axios.get(`${API}/accounting/accounts`);
      setAccounts(response.data.accounts || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast.error('خطأ في تحميل الحسابات');
    }
  };

  const fetchLedger = async (currencyOverride = null) => {
    if (!selectedAccount) {
      toast.error('يرجى اختيار حساب');
      return;
    }

    // Use currency override if provided, otherwise use selected currency
    const currencyToUse = currencyOverride || selectedCurrency;
    
    if (!currencyToUse) {
      toast.error('يرجى اختيار عملة');
      return;
    }

    setLoading(true);
    try {
      const params = {
        currency: currencyToUse // العملة مطلوبة دائماً
      };
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const response = await axios.get(`${API}/accounting/ledger/${selectedAccount}`, { params });
      
      // Update account details and enabled currencies
      const accountData = {
        ...response.data.account,
        current_balance: response.data.current_balance,
        selected_currency: response.data.selected_currency
      };
      setAccountDetails(accountData);
      setEnabledCurrencies(response.data.enabled_currencies || ['IQD']);
      setLedgerEntries(response.data.entries || []);
      
      // Update selected currency if it was overridden
      if (currencyOverride) {
        setSelectedCurrency(currencyOverride);
      }
      
      toast.success('تم تحميل دفتر الأستاذ بنجاح');
    } catch (error) {
      console.error('Error fetching ledger:', error);
      const errorMsg = error.response?.data?.detail || 'خطأ في تحميل دفتر الأستاذ';
      toast.error(errorMsg);
    }
    setLoading(false);
  };

  // Handle account selection - set first enabled currency
  const handleAccountChange = async (accountCode) => {
    setSelectedAccount(accountCode);
    
    // Get account details to find enabled currencies
    try {
      const response = await axios.get(`${API}/accounting/accounts/${accountCode}`);
      const account = response.data;
      const currencies = account.currencies || ['IQD'];
      
      setEnabledCurrencies(currencies);
      
      // Set first currency as default and fetch ledger
      const firstCurrency = currencies[0];
      setSelectedCurrency(firstCurrency);
      
      // Clear previous data
      setAccountDetails(null);
      setLedgerEntries([]);
    } catch (error) {
      console.error('Error fetching account:', error);
      toast.error('خطأ في تحميل بيانات الحساب');
    }
  };

  // Handle currency change
  const handleCurrencyChange = (currency) => {
    setSelectedCurrency(currency);
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
          <CardHeader className="bg-gradient-to-l from-teal-50 to-teal-100">
            <CardTitle className="text-2xl sm:text-3xl">📊 دفتر الأستاذ</CardTitle>
            <CardDescription className="text-base">
              عرض جميع حركات حساب معين
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>اختيار الحساب والفترة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>الحساب *</Label>
                <Select value={selectedAccount} onValueChange={handleAccountChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الحساب" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(acc => (
                      <SelectItem key={acc.code} value={acc.code}>
                        {acc.code} - {acc.name_ar}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>العملة *</Label>
                {enabledCurrencies.length > 0 ? (
                  <Select value={selectedCurrency} onValueChange={handleCurrencyChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر العملة" />
                    </SelectTrigger>
                    <SelectContent>
                      {enabledCurrencies.map(curr => (
                        <SelectItem key={curr} value={curr}>
                          {curr === 'IQD' ? 'دينار عراقي (IQD)' :
                           curr === 'USD' ? 'دولار أمريكي (USD)' :
                           curr === 'EUR' ? 'يورو (EUR)' :
                           curr === 'GBP' ? 'جنيه إسترليني (GBP)' :
                           curr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="border rounded-md p-2 text-sm text-gray-500">
                    {selectedAccount ? 'هذا الحساب غير مرتبط بأي عملة' : 'اختر حساباً أولاً'}
                  </div>
                )}
              </div>

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
            </div>

            <div className="mt-4">
              <Button 
                onClick={() => fetchLedger()} 
                disabled={loading || !selectedAccount || !selectedCurrency} 
                className="w-full md:w-auto"
              >
                {loading ? 'جاري التحميل...' : '🔍 عرض دفتر الأستاذ'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Account Details */}
        {accountDetails && (
          <Card className="border-2 border-teal-200 bg-teal-50">
            <CardHeader>
              <CardTitle className="text-xl">تفاصيل الحساب</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">رمز الحساب</p>
                  <p className="text-lg font-bold">{accountDetails.code}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">اسم الحساب</p>
                  <p className="text-lg font-bold">{accountDetails.name_ar}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">الفئة</p>
                  <p className="text-lg font-bold">{accountDetails.category}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">الرصيد الحالي ({accountDetails.selected_currency})</p>
                  <p className="text-2xl font-bold text-teal-700">
                    {formatCurrency(accountDetails.current_balance, accountDetails.selected_currency)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ledger Entries */}
        {accountDetails && (
          <Card>
            <CardHeader>
              <CardTitle>حركات الحساب ({ledgerEntries.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="p-8 text-center">جاري التحميل...</div>
              ) : ledgerEntries.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  لا توجد حركات في هذه الفترة
                </div>
              ) : (
                <>
                  {/* Desktop View - Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-200">
                        <tr>
                          <th className="p-3 text-right">التاريخ</th>
                          <th className="p-3 text-right">رقم القيد</th>
                          <th className="p-3 text-right">البيان</th>
                          <th className="p-3 text-center">العملة</th>
                          <th className="p-3 text-center">الرصيد</th>
                          <th className="p-3 text-center">المدين (خروج)</th>
                          <th className="p-3 text-center">الدائن (دخول)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerEntries.map((entry, idx) => (
                          <tr key={idx} className="border-t hover:bg-gray-50">
                            <td className="p-3">
                              {new Date(entry.date).toLocaleDateString('ar-IQ')}
                            </td>
                            <td className="p-3">{entry.entry_number}</td>
                            <td className="p-3">{entry.description}</td>
                            <td className="p-3 text-center">
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                                {entry.currency || 'IQD'}
                              </span>
                            </td>
                            <td className={`p-3 text-center font-bold ${
                              entry.balance > 0 ? 'text-teal-700' : entry.balance < 0 ? 'text-red-700' : ''
                            }`}>
                              {entry.balance.toLocaleString()}
                            </td>
                            <td className="p-3 text-center font-bold text-blue-700">
                              {entry.debit > 0 ? entry.debit.toLocaleString() : '-'}
                            </td>
                            <td className="p-3 text-center font-bold text-green-700">
                              {entry.credit > 0 ? entry.credit.toLocaleString() : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile View - Cards */}
                  <div className="md:hidden space-y-4">
                    {ledgerEntries.map((entry, idx) => (
                      <div key={idx} className="bg-white border-2 border-gray-200 rounded-lg p-4 shadow-sm">
                        {/* التاريخ ورقم القيد */}
                        <div className="flex justify-between items-center mb-3 pb-3 border-b">
                          <div>
                            <p className="text-xs text-gray-500">التاريخ</p>
                            <p className="text-sm font-semibold">
                              {new Date(entry.date).toLocaleDateString('ar-IQ')}
                            </p>
                          </div>
                          <div className="text-left">
                            <p className="text-xs text-gray-500">رقم القيد</p>
                            <p className="text-sm font-semibold">{entry.entry_number}</p>
                          </div>
                        </div>

                        {/* البيان */}
                        <div className="mb-3">
                          <p className="text-xs text-gray-500 mb-1">البيان</p>
                          <p className="text-sm font-medium">{entry.description}</p>
                        </div>

                        {/* العملة */}
                        <div className="mb-3">
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                            💱 {entry.currency || 'IQD'}
                          </span>
                        </div>

                        {/* الرصيد */}
                        <div className="bg-gradient-to-l from-blue-50 to-blue-100 rounded-lg p-3 mb-3">
                          <p className="text-xs text-blue-700 mb-1">💰 الرصيد</p>
                          <p className={`text-2xl font-bold ${
                            entry.balance > 0 ? 'text-teal-700' : entry.balance < 0 ? 'text-red-700' : 'text-gray-700'
                          }`}>
                            {entry.balance.toLocaleString()}
                          </p>
                        </div>

                        {/* المدين والدائن */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-blue-50 rounded-lg p-3">
                            <p className="text-xs text-blue-700 mb-1">📤 المدين (خروج)</p>
                            <p className="text-lg font-bold text-blue-700">
                              {entry.debit > 0 ? entry.debit.toLocaleString() : '-'}
                            </p>
                          </div>
                          <div className="bg-green-50 rounded-lg p-3">
                            <p className="text-xs text-green-700 mb-1">📥 الدائن (دخول)</p>
                            <p className="text-lg font-bold text-green-700">
                              {entry.credit > 0 ? entry.credit.toLocaleString() : '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default LedgerPage;
