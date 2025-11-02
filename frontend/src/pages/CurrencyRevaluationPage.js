import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const CurrencyRevaluationPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [accounts, setAccounts] = useState([]);
  const [currentRate, setCurrentRate] = useState(1300);
  const [revaluations, setRevaluations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  
  const [formData, setFormData] = useState({
    account_code: '',
    amount: '',
    currency: 'IQD',
    exchange_rate: '',
    operation_type: 'debit',
    direction: 'iqd_to_usd',
    notes: ''
  });

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('صلاحية الوصول مرفوضة');
      navigate('/dashboard');
      return;
    }
    fetchAccounts();
    fetchCurrentRate();
    fetchRevaluations();
  }, [user, navigate]);

  const fetchAccounts = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch agents (صرافين) instead of chart of accounts
      const response = await axios.get(`${API}/api/users?role=agent`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Transform agents to account format
      const agentAccounts = response.data
        .filter(agent => agent.is_active !== false)
        .map(agent => ({
          code: agent.id,
          name: `${agent.display_name} - صيرفة`,
          balance_iqd: agent.wallet_balance_iqd || 0,
          balance_usd: agent.wallet_balance_usd || 0
        }));
      
      setAccounts(agentAccounts);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      setAccounts([]);
      toast.error('خطأ في جلب حسابات الصيرفة');
    }
  };

  const fetchCurrentRate = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/exchange-rates/current`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCurrentRate(response.data.rate);
      setFormData(prev => ({ ...prev, exchange_rate: response.data.rate }));
    } catch (error) {
      console.error('Error fetching rate:', error);
    }
  };

  const fetchRevaluations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/currency-revaluations?limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRevaluations(response.data);
    } catch (error) {
      console.error('Error fetching revaluations:', error);
    }
  };

  const calculateEquivalent = () => {
    const amount = parseFloat(formData.amount) || 0;
    const rate = parseFloat(formData.exchange_rate) || 1;
    
    if (formData.direction === 'iqd_to_usd') {
      return (amount / rate).toFixed(2);
    } else {
      return (amount * rate).toFixed(2);
    }
  };

  const handlePreview = () => {
    if (!formData.account_code) {
      toast.error('يرجى اختيار الحساب');
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح');
      return;
    }
    if (!formData.exchange_rate || parseFloat(formData.exchange_rate) <= 0) {
      toast.error('يرجى إدخال سعر صرف صحيح');
      return;
    }

    const account = accounts.find(a => a.code === formData.account_code);
    const equivalent = calculateEquivalent();

    setPreviewData({
      account_name: account?.name || '',
      amount: parseFloat(formData.amount),
      currency: formData.currency,
      exchange_rate: parseFloat(formData.exchange_rate),
      equivalent_amount: parseFloat(equivalent),
      equivalent_currency: formData.direction === 'iqd_to_usd' ? 'USD' : 'IQD',
      operation_type: formData.operation_type,
      direction: formData.direction,
      notes: formData.notes
    });

    setShowPreview(true);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/api/currency-revaluation`, {
        account_code: formData.account_code,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        exchange_rate: parseFloat(formData.exchange_rate),
        operation_type: formData.operation_type,
        direction: formData.direction,
        notes: formData.notes || undefined
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('تمت عملية التقويم بنجاح');
      setShowPreview(false);
      
      // Reset form
      setFormData({
        account_code: '',
        amount: '',
        currency: 'IQD',
        exchange_rate: currentRate,
        operation_type: 'debit',
        direction: 'iqd_to_usd',
        notes: ''
      });

      fetchRevaluations();
      fetchAccounts(); // Refresh to show updated balances
    } catch (error) {
      console.error('Error creating revaluation:', error);
      toast.error(error.response?.data?.detail || 'حدث خطأ أثناء تنفيذ العملية');
    } finally {
      setLoading(false);
    }
  };

  const getDirectionLabel = (direction) => {
    return direction === 'iqd_to_usd' ? 'من دينار إلى دولار' : 'من دولار إلى دينار';
  };

  const getOperationTypeLabel = (type) => {
    return type === 'debit' ? 'مدين' : 'دائن';
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-4 sm:p-6">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2">💱 تقويم قطع لحساب</h1>
          <p className="text-muted-foreground">تنفيذ عمليات التقويم بين الدينار والدولار</p>
        </div>

        {/* Form Card */}
        <Card className="mb-6">
          <CardHeader className="bg-primary/5">
            <CardTitle>عملية تقويم جديدة</CardTitle>
            <CardDescription>قم بإدخال تفاصيل عملية التقويم</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 mt-4">
            {/* Account Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">🧾 اسم الحساب (العميل)</label>
              <select
                value={formData.account_code}
                onChange={(e) => setFormData({ ...formData, account_code: e.target.value })}
                className="w-full p-3 border rounded-lg text-base"
              >
                <option value="">اختر الحساب...</option>
                {accounts.map((account) => (
                  <option key={account.code} value={account.code}>
                    {account.name} ({account.code})
                  </option>
                ))}
              </select>
              {formData.account_code && (
                <p className="text-xs text-gray-500 mt-1">
                  الحساب المختار: {accounts.find(a => a.code === formData.account_code)?.name}
                </p>
              )}
            </div>

            {/* Show Selected Account Balance */}
            {formData.account_code && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                {(() => {
                  const account = accounts.find(a => a.code === formData.account_code);
                  return account ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">الرصيد بالدينار:</p>
                        <p className="font-bold text-lg">{(account.balance_iqd || 0).toLocaleString()} IQD</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">الرصيد بالدولار:</p>
                        <p className="font-bold text-lg">{(account.balance_usd || 0).toLocaleString()} USD</p>
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            {/* Direction */}
            <div>
              <label className="block text-sm font-medium mb-2">🔁 اتجاه التقويم</label>
              <select
                value={formData.direction}
                onChange={(e) => setFormData({ ...formData, direction: e.target.value })}
                className="w-full p-3 border rounded-lg"
              >
                <option value="iqd_to_usd">من دينار إلى دولار (شراء دولار)</option>
                <option value="usd_to_iqd">من دولار إلى دينار (بيع دولار)</option>
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium mb-2">
                💰 المبلغ ({formData.direction === 'iqd_to_usd' ? 'بالدينار' : 'بالدولار'})
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full p-3 border rounded-lg"
                placeholder="أدخل المبلغ..."
              />
            </div>

            {/* Exchange Rate */}
            <div>
              <label className="block text-sm font-medium mb-2">💱 سعر الصرف</label>
              <input
                type="number"
                step="0.01"
                value={formData.exchange_rate}
                onChange={(e) => setFormData({ ...formData, exchange_rate: e.target.value })}
                className="w-full p-3 border rounded-lg"
                placeholder="سعر الصرف..."
              />
              <p className="text-xs text-gray-500 mt-1">السعر الحالي: {currentRate.toLocaleString()}</p>
            </div>

            {/* Equivalent Amount Display */}
            {formData.amount && formData.exchange_rate && (
              <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">📊 القيمة المقابلة:</p>
                <p className="font-bold text-2xl text-green-700">
                  {calculateEquivalent()} {formData.direction === 'iqd_to_usd' ? 'USD' : 'IQD'}
                </p>
              </div>
            )}

            {/* Operation Type */}
            <div>
              <label className="block text-sm font-medium mb-2">🔘 نوع العملية</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="operation_type"
                    value="debit"
                    checked={formData.operation_type === 'debit'}
                    onChange={(e) => setFormData({ ...formData, operation_type: e.target.value })}
                  />
                  <span>مدين (Debit) - خصم من الحساب</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="operation_type"
                    value="credit"
                    checked={formData.operation_type === 'credit'}
                    onChange={(e) => setFormData({ ...formData, operation_type: e.target.value })}
                  />
                  <span>دائن (Credit) - إضافة للحساب</span>
                </label>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-2">📝 ملاحظة (اختياري)</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full p-3 border rounded-lg"
                rows="2"
                placeholder="أي ملاحظات إضافية..."
              />
            </div>

            {/* Submit Button */}
            <Button
              onClick={handlePreview}
              className="w-full h-12 text-lg font-bold"
              disabled={loading}
            >
              👁️ معاينة القيد
            </Button>
          </CardContent>
        </Card>

        {/* Revaluations History */}
        <Card>
          <CardHeader className="bg-primary/5">
            <CardTitle>سجل عمليات التقويم</CardTitle>
            <CardDescription>آخر 50 عملية</CardDescription>
          </CardHeader>
          <CardContent className="mt-4">
            {revaluations.length === 0 ? (
              <p className="text-center text-gray-500 py-8">لا توجد عمليات تقويم</p>
            ) : (
              <div className="space-y-3">
                {revaluations.map((rev) => (
                  <div
                    key={rev.id}
                    className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold text-lg">{rev.account_name}</p>
                        <p className="text-sm text-gray-600">{rev.account_code}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        rev.operation_type === 'debit' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {getOperationTypeLabel(rev.operation_type)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-2">
                      <div className="bg-blue-50 p-2 rounded">
                        <p className="text-xs text-gray-600">المبلغ الأصلي</p>
                        <p className="font-bold">{rev.amount.toLocaleString()} {rev.currency}</p>
                      </div>
                      <div className="bg-purple-50 p-2 rounded">
                        <p className="text-xs text-gray-600">المبلغ المقابل</p>
                        <p className="font-bold">
                          {rev.equivalent_amount.toLocaleString()} {rev.currency === 'IQD' ? 'USD' : 'IQD'}
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-sm text-gray-600">
                      <span>🔁 {getDirectionLabel(rev.direction)}</span>
                      <span>💱 {rev.exchange_rate.toLocaleString()}</span>
                    </div>

                    {rev.notes && (
                      <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">
                        📝 {rev.notes}
                      </p>
                    )}

                    <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                      <span>بواسطة: {rev.created_by}</span>
                      <span>{new Date(rev.created_at).toLocaleString('ar-IQ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="text-2xl text-center">📋 معاينة القيد المحاسبي</DialogTitle>
              <DialogDescription className="text-center">
                تأكد من البيانات قبل الحفظ
              </DialogDescription>
            </DialogHeader>

            {previewData && (
              <div className="space-y-4">
                {/* Account Info */}
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600">الحساب:</p>
                  <p className="font-bold text-lg">{previewData.account_name}</p>
                </div>

                {/* Operation Details */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-xs text-gray-600 mb-1">نوع العملية:</p>
                    <p className="font-semibold">{getOperationTypeLabel(previewData.operation_type)}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-xs text-gray-600 mb-1">الاتجاه:</p>
                    <p className="font-semibold">{getDirectionLabel(previewData.direction)}</p>
                  </div>
                </div>

                {/* Journal Entry Preview */}
                <div className="border-2 border-green-300 rounded-lg p-4 bg-green-50">
                  <p className="font-bold text-center mb-3 text-green-800">القيد المحاسبي المزدوج</p>
                  
                  <div className="space-y-2">
                    {/* Debit Entry */}
                    <div className="bg-white border border-red-300 rounded p-3">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-red-700">من (مدين):</span>
                        <span className="font-bold text-lg">
                          {previewData.operation_type === 'debit'
                            ? `${previewData.amount.toLocaleString()} ${previewData.currency}`
                            : `${previewData.equivalent_amount.toLocaleString()} ${previewData.equivalent_currency}`
                          }
                        </span>
                      </div>
                    </div>

                    {/* Credit Entry */}
                    <div className="bg-white border border-green-300 rounded p-3">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-green-700">إلى (دائن):</span>
                        <span className="font-bold text-lg">
                          {previewData.operation_type === 'credit'
                            ? `${previewData.amount.toLocaleString()} ${previewData.currency}`
                            : `${previewData.equivalent_amount.toLocaleString()} ${previewData.equivalent_currency}`
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-center text-sm text-gray-600">
                    💱 سعر الصرف: {previewData.exchange_rate.toLocaleString()}
                  </div>
                </div>

                {/* Notes */}
                {previewData.notes && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                    <p className="text-sm text-gray-600">📝 الملاحظة:</p>
                    <p className="font-semibold">{previewData.notes}</p>
                  </div>
                )}

                {/* Warning */}
                <div className="bg-orange-50 border border-orange-300 rounded p-3 text-center">
                  <p className="text-sm text-orange-800">
                    ⚠️ بعد الحفظ سيتم تحديث أرصدة الحساب مباشرة
                  </p>
                </div>
              </div>
            )}

            <DialogFooter className="flex gap-3">
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700 h-12 text-base font-bold"
              >
                {loading ? '⏳ جاري الحفظ...' : '✅ تأكيد وحفظ'}
              </Button>
              <Button
                onClick={() => setShowPreview(false)}
                variant="outline"
                className="flex-1 h-12 text-base"
                disabled={loading}
              >
                ❌ إلغاء
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default CurrencyRevaluationPage;
