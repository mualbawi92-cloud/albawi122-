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

  const fetchLedger = async () => {
    if (!selectedAccount) {
      toast.error('يرجى اختيار حساب');
      return;
    }

    setLoading(true);
    try {
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const response = await axios.get(`${API}/accounting/ledger/${selectedAccount}`, { params });
      setAccountDetails(response.data.account);
      setLedgerEntries(response.data.entries || []);
      toast.success('تم تحميل دفتر الأستاذ بنجاح');
    } catch (error) {
      console.error('Error fetching ledger:', error);
      toast.error('خطأ في تحميل دفتر الأستاذ');
    }
    setLoading(false);
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>الحساب *</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
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
              <Button onClick={fetchLedger} disabled={loading || !selectedAccount} className="w-full md:w-auto">
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
                  <p className="text-sm text-muted-foreground">الرصيد الحالي</p>
                  <p className="text-2xl font-bold text-teal-700">
                    {formatCurrency(accountDetails.balance, accountDetails.currency)}
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
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-200">
                      <tr>
                        <th className="p-3 text-right">التاريخ</th>
                        <th className="p-3 text-right">رقم القيد</th>
                        <th className="p-3 text-right">البيان</th>
                        <th className="p-3 text-center">الرصيد</th>
                        <th className="p-3 text-center">الدائن (دخول)</th>
                        <th className="p-3 text-center">المدين (خروج)</th>
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
                          <td className={`p-3 text-center font-bold ${
                            entry.balance > 0 ? 'text-teal-700' : entry.balance < 0 ? 'text-red-700' : ''
                          }`}>
                            {entry.balance.toLocaleString()}
                          </td>
                          <td className="p-3 text-center font-bold text-green-700">
                            {entry.credit > 0 ? entry.credit.toLocaleString() : '-'}
                          </td>
                          <td className="p-3 text-center font-bold text-blue-700">
                            {entry.debit > 0 ? entry.debit.toLocaleString() : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default LedgerPage;
