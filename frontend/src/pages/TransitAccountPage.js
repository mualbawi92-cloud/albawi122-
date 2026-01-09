import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import api from '../services/api';


const TransitAccountPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [transitData, setTransitData] = useState(null);
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'pending', 'transactions'

  useEffect(() => {
    fetchTransitData();
  }, []);

  const fetchTransitData = async () => {
    setLoading(true);
    try {
      // Fetch balance
      const balanceResponse = await api.get('/transit-account/balance');
      setTransitData(balanceResponse.data);

      // Fetch pending transfers
      const pendingResponse = await api.get('/transit-account/pending-transfers');
      setPendingTransfers(pendingResponse.data.pending_transfers || []);

      // Fetch transactions
      const transactionsResponse = await api.get('/transit-account/transactions?limit=50');
      setTransactions(transactionsResponse.data || []);
    } catch (error) {
      console.error('Error fetching transit data:', error);
      toast.error('خطأ في جلب بيانات حساب الترانزيت');
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        
        <div className="container mx-auto p-6 flex justify-center items-center">
          <div className="text-lg">جاري التحميل...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-primary mb-2">حساب الحوالات الواردة لم تُسلَّم</h1>
          <p className="text-muted-foreground">
            حساب الترانزيت يحتفظ بالمبالغ مؤقتاً من لحظة الإرسال حتى لحظة الاستلام الفعلي
          </p>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-blue-900">الرصيد بالدينار العراقي</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-700">
                {transitData?.balance_iqd?.toLocaleString() || 0} IQD
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200 bg-green-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-green-900">الرصيد بالدولار</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-700">
                {transitData?.balance_usd?.toLocaleString() || 0} USD
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-200 bg-orange-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-orange-900">الحوالات المعلقة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-700">
                {transitData?.pending_transfers_count || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-2 border-b">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 font-bold ${
              activeTab === 'overview'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground'
            }`}
          >
            نظرة عامة
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 font-bold ${
              activeTab === 'pending'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground'
            }`}
          >
            الحوالات المعلقة ({pendingTransfers.length})
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-4 py-2 font-bold ${
              activeTab === 'transactions'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground'
            }`}
          >
            سجل الحركات
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <Card>
            <CardHeader>
              <CardTitle>معلومات الحساب</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-bold text-blue-900 mb-2">📝 ملاحظة مهمة</h3>
                <p className="text-sm text-blue-800">
                  حساب "الحوالات الواردة لم تُسلَّم" هو حساب وسيط يحتفظ بمبالغ الحوالات المرسلة 
                  من النقاط المختلفة إلى حين تسليمها الفعلي للمستلمين. يضمن هذا الحساب عدم ضياع 
                  أي مبلغ وإمكانية تتبع جميع الحوالات المعلقة.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">آخر تحديث</Label>
                  <p className="font-bold">
                    {transitData?.updated_at
                      ? new Date(transitData.updated_at).toLocaleString('ar-IQ')
                      : 'غير متوفر'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">إجمالي الحوالات المعلقة</Label>
                  <p className="font-bold">{transitData?.pending_transfers_count || 0} حوالة</p>
                </div>
              </div>

              <Button
                onClick={fetchTransitData}
                className="w-full"
              >
                🔄 تحديث البيانات
              </Button>
            </CardContent>
          </Card>
        )}

        {activeTab === 'pending' && (
          <Card>
            <CardHeader>
              <CardTitle>الحوالات المعلقة في الترانزيت</CardTitle>
              <CardDescription>
                جميع الحوالات التي تم إرسالها ولم يتم استلامها بعد
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingTransfers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  لا توجد حوالات معلقة حالياً
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingTransfers.map((transfer) => (
                    <div
                      key={transfer.id}
                      className="p-4 border rounded-lg hover:bg-accent cursor-pointer"
                      onClick={() => navigate('/transfers/${transfer.id}')}
                    >
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">رقم الحوالة</Label>
                          <p className="font-bold">{transfer.transfer_number || transfer.transfer_code}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">المبلغ</Label>
                          <p className="font-bold text-secondary">
                            {transfer.amount?.toLocaleString()} {transfer.currency}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">من</Label>
                          <p className="font-bold">{transfer.from_agent_name}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">تاريخ الإنشاء</Label>
                          <p className="text-sm">
                            {new Date(transfer.created_at).toLocaleDateString('ar-IQ')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'transactions' && (
          <Card>
            <CardHeader>
              <CardTitle>سجل حركات حساب الترانزيت</CardTitle>
              <CardDescription>آخر 50 حركة على الحساب</CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  لا توجد حركات مسجلة
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className={`p-3 border rounded-lg ${
                        transaction.operation === 'add'
                          ? 'bg-green-50 border-green-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <p className="font-bold">
                            {transaction.operation === 'add' ? '➕' : '➖'}{' '}
                            {transaction.amount?.toLocaleString()} {transaction.currency}
                          </p>
                          <p className="text-sm text-muted-foreground">{transaction.note}</p>
                        </div>
                        <div className="text-left">
                          <p className="text-xs text-muted-foreground">
                            {new Date(transaction.created_at).toLocaleString('ar-IQ')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TransitAccountPage;
