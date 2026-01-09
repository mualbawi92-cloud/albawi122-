import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import api from '../services/api';


const ManualJournalEntryPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  
  // Journal entry state
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState([
    { account_code: '', debit: 0, credit: 0 }
  ]);

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
      const response = await api.get('/accounting/accounts');
      setAccounts(response.data.accounts || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast.error('خطأ في تحميل الحسابات');
    }
  };

  const addLine = () => {
    setLines([...lines, { account_code: '', debit: 0, credit: 0 }]);
  };

  const removeLine = (index) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const updateLine = (index, field, value) => {
    const newLines = [...lines];
    newLines[index][field] = field === 'account_code' ? value : parseFloat(value) || 0;
    setLines(newLines);
  };

  const calculateTotals = () => {
    const totalDebit = lines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (parseFloat(line.credit) || 0), 0);
    return { totalDebit, totalCredit };
  };

  const isBalanced = () => {
    const { totalDebit, totalCredit } = calculateTotals();
    return Math.abs(totalDebit - totalCredit) < 0.01;
  };

  const handleSubmit = async () => {
    // Validation
    if (!description.trim()) {
      toast.error('يرجى إدخال وصف القيد');
      return;
    }

    if (lines.some(line => !line.account_code)) {
      toast.error('يرجى اختيار حساب لكل سطر');
      return;
    }

    if (!isBalanced()) {
      toast.error('القيد غير متوازن: المدين يجب أن يساوي الدائن');
      return;
    }

    const { totalDebit } = calculateTotals();
    if (totalDebit === 0) {
      toast.error('المبالغ يجب أن تكون أكبر من صفر');
      return;
    }

    setLoading(true);
    try {
      await api.post('/accounting/journal-entries', {
        description,
        lines
      });
      
      toast.success('تم تسجيل القيد بنجاح');
      
      // Reset form
      setDescription('');
      setLines([{ account_code: '', debit: 0, credit: 0 }]);
      
      // Navigate to journal page
      setTimeout(() => navigate('/journal'), 1000);
    } catch (error) {
      console.error('Error creating journal entry:', error);
      const errorMsg = error.response?.data?.detail || 'خطأ في تسجيل القيد';
      toast.error(errorMsg);
    }
    setLoading(false);
  };

  const { totalDebit, totalCredit } = calculateTotals();
  const balanced = isBalanced();

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-l from-indigo-50 to-indigo-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="text-2xl sm:text-3xl">📝 تسجيل قيد يومي</CardTitle>
                <CardDescription className="text-base">
                  إدخال قيد محاسبي يدوي جديد
                </CardDescription>
              </div>
              <Button variant="outline" onClick={() => navigate('/journal')}>
                📖 دفتر اليومية
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Journal Entry Form */}
        <Card>
          <CardHeader>
            <CardTitle>تفاصيل القيد</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Description */}
            <div className="space-y-2">
              <Label>وصف القيد *</Label>
              <Input
                placeholder="مثال: قيد افتتاحي، دفع إيجار، استلام نقدية..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Entry Lines */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label className="text-lg font-bold">سطور القيد</Label>
                <Button onClick={addLine} size="sm">
                  ➕ إضافة سطر
                </Button>
              </div>

              {/* Table Header */}
              <div className="bg-gray-200 rounded-t-lg">
                <div className="grid grid-cols-12 gap-2 p-3 font-bold text-sm">
                  <div className="col-span-5">الحساب</div>
                  <div className="col-span-3 text-center">مدين</div>
                  <div className="col-span-3 text-center">دائن</div>
                  <div className="col-span-1"></div>
                </div>
              </div>

              {/* Table Body */}
              <div className="border rounded-b-lg">
                {lines.map((line, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 p-3 border-b last:border-b-0 items-center">
                    {/* Account Selection */}
                    <div className="col-span-5">
                      <Select 
                        value={line.account_code} 
                        onValueChange={(val) => updateLine(index, 'account_code', val)}
                      >
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

                    {/* Debit */}
                    <div className="col-span-3">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.debit}
                        onChange={(e) => updateLine(index, 'debit', e.target.value)}
                        className="text-center"
                      />
                    </div>

                    {/* Credit */}
                    <div className="col-span-3">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.credit}
                        onChange={(e) => updateLine(index, 'credit', e.target.value)}
                        className="text-center"
                      />
                    </div>

                    {/* Remove Button */}
                    <div className="col-span-1 text-center">
                      {lines.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLine(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          🗑️
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="bg-gray-100 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-sm text-muted-foreground">إجمالي المدين</p>
                    <p className="text-2xl font-bold text-blue-700">
                      {totalDebit.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">إجمالي الدائن</p>
                    <p className="text-2xl font-bold text-green-700">
                      {totalCredit.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="mt-4 text-center">
                  {balanced ? (
                    <div className="flex items-center justify-center gap-2 text-green-700">
                      <span className="text-2xl">✅</span>
                      <span className="font-bold">القيد متوازن</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-red-700">
                      <span className="text-2xl">⚠️</span>
                      <span className="font-bold">
                        القيد غير متوازن (الفرق: {Math.abs(totalDebit - totalCredit).toLocaleString()})
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                disabled={loading || !balanced}
                className="flex-1"
              >
                {loading ? 'جاري الحفظ...' : '💾 حفظ القيد'}
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

export default ManualJournalEntryPage;
