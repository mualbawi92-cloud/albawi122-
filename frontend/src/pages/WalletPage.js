import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const WalletPage = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState({ wallet_balance_iqd: 0, wallet_balance_usd: 0 });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      const [balanceRes, transactionsRes] = await Promise.all([
        axios.get(`${API}/wallet/balance`),
        axios.get(`${API}/wallet/transactions?limit=50`)
      ]);
      
      setBalance(balanceRes.data);
      setTransactions(transactionsRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching wallet data:', error);
      toast.error('خطأ في تحميل بيانات المحفظة');
      setLoading(false);
    }
  };

  const getTransactionBadge = (type) => {
    const typeMap = {
      deposit: { label: 'إيداع', className: 'bg-blue-100 text-blue-800' },
      transfer_sent: { label: 'حوالة مرسلة', className: 'bg-red-100 text-red-800' },
      transfer_received: { label: 'حوالة مستلمة', className: 'bg-green-100 text-green-800' }
    };
    const config = typeMap[type] || { label: type, className: 'bg-gray-100 text-gray-800' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto p-6 flex items-center justify-center min-h-[50vh]">
          <div className="text-2xl text-primary">جاري التحميل...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="wallet-page">
      <Navbar />
      <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <Card className="bg-gradient-to-l from-primary to-primary/80 text-white shadow-xl">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-2xl sm:text-3xl">محفظتي</CardTitle>
            <CardDescription className="text-white/80 text-sm sm:text-base">
              الرصيد المتاح في حسابك
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <Card className="border-r-4 border-r-secondary shadow-lg">
            <CardHeader className="p-4 sm:p-6">
              <CardDescription className="text-sm sm:text-base">الرصيد بالدينار العراقي</CardDescription>
              <CardTitle className="text-3xl sm:text-5xl font-bold text-secondary">
                {balance.wallet_balance_iqd?.toLocaleString() || 0}
              </CardTitle>
              <CardDescription className="text-lg sm:text-xl font-semibold text-muted-foreground">IQD</CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-r-4 border-r-primary shadow-lg">
            <CardHeader className="p-4 sm:p-6">
              <CardDescription className="text-sm sm:text-base">الرصيد بالدولار</CardDescription>
              <CardTitle className="text-3xl sm:text-5xl font-bold text-primary">
                {balance.wallet_balance_usd?.toLocaleString() || 0}
              </CardTitle>
              <CardDescription className="text-lg sm:text-xl font-semibold text-muted-foreground">USD</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Transaction History */}
        <Card className="shadow-lg">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-xl sm:text-2xl">سجل المعاملات</CardTitle>
            <CardDescription className="text-sm sm:text-base">آخر 50 عملية</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {transactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد معاملات</p>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1 mb-2 sm:mb-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getTransactionBadge(tx.transaction_type)}
                        <span className={`font-bold text-base sm:text-lg ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()} {tx.currency}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground">{tx.note}</p>
                      {tx.added_by_admin_name && (
                        <p className="text-xs text-muted-foreground mt-1">
                          بواسطة: {tx.added_by_admin_name}
                        </p>
                      )}
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString('ar-IQ', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WalletPage;
