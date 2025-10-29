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

const JournalTransferPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  
  // Transfer form
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

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

  const handleTransfer = async () => {
    // Validation
    if (!fromAccount || !toAccount) {
      toast.error('يرجى اختيار الحساب المحول منه والمحول إليه');
      return;
    }

    if (fromAccount === toAccount) {
      toast.error('لا يمكن النقل من نفس الحساب إلى نفسه');
      return;
    }

    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح');
      return;
    }

    if (!description.trim()) {
      toast.error('يرجى إدخال وصف المناقلة');
      return;
    }

    setLoading(true);
    try {
      // Create journal entry for transfer
      await axios.post(`${API}/accounting/journal-entries`, {
        description: description,
        lines: [
          { account_code: toAccount, debit: amountNum, credit: 0 },
          { account_code: fromAccount, debit: 0, credit: amountNum }
        ]
      });

      toast.success('تم تسجيل المناقلة بنجاح');

      // Reset form
      setFromAccount('');
      setToAccount('');
      setAmount('');
      setDescription('');

      // Navigate to journal
      setTimeout(() => navigate('/journal'), 1000);
    } catch (error) {
      console.error('Error creating transfer:', error);
      const errorMsg = error.response?.data?.detail || 'خطأ في تسجيل المناقلة';
      toast.error(errorMsg);
    }
    setLoading(false);
  };

  const getAccountName = (code) => {
    const account = accounts.find(acc => acc.code === code);
    return account ? `${account.code} - ${account.name_ar}` : code;
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <Navbar />
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-l from-emerald-50 to-emerald-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="text-2xl sm:text-3xl">🔄 قيد مزدوج / مناقلة</CardTitle>
                <CardDescription className="text-base">
                  نقل مبلغ من حساب إلى حساب آخر
                </CardDescription>
              </div>
              <Button variant="outline" onClick={() => navigate('/journal')}>
                📖 دفتر اليومية
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Transfer Form */}
        <Card>
          <CardHeader>
            <CardTitle>تفاصيل المناقلة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Description */}
            <div className="space-y-2">
              <Label>وصف المناقلة *</Label>
              <Input
                placeholder="مثال: مناقلة من صندوق نقد إلى صيرفة بغداد"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* From Account */}
              <div className="space-y-2">
                <Label>من حساب (المدين) *</Label>
                <Select value={fromAccount} onValueChange={setFromAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الحساب المحول منه" />
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

              {/* To Account */}
              <div className="space-y-2">
                <Label>إلى حساب (الدائن) *</Label>
                <Select value={toAccount} onValueChange={setToAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الحساب المحول إليه" />
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
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label>المبلغ *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>

            {/* Preview */}
            {fromAccount && toAccount && amount && (
              <Card className="bg-gray-50 border-2">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-gray-700">معاينة القيد:</p>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="font-bold">الحساب</div>
                      <div className="text-center font-bold text-blue-700">مدين</div>
                      <div className="text-center font-bold text-green-700">دائن</div>
                    </div>
                    <div className="border-t pt-2">
                      <div className="grid grid-cols-3 gap-4 text-sm py-2">
                        <div>{getAccountName(toAccount)}</div>
                        <div className="text-center text-blue-700 font-bold">
                          {parseFloat(amount).toLocaleString()}
                        </div>
                        <div className="text-center">-</div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm py-2">
                        <div>{getAccountName(fromAccount)}</div>
                        <div className="text-center">-</div>
                        <div className="text-center text-green-700 font-bold">
                          {parseFloat(amount).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Submit Button */}
            <div className="flex gap-2">
              <Button
                onClick={handleTransfer}
                disabled={loading || !fromAccount || !toAccount || !amount || !description}
                className="flex-1"
              >
                {loading ? 'جاري الحفظ...' : '✅ تنفيذ المناقلة'}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/journal')}
                disabled={loading}
              >
                إلغاء
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default JournalTransferPage;
