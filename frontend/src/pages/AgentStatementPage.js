import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AgentStatementPage = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatement();
  }, [agentId]);

  const fetchStatement = async () => {
    try {
      const id = agentId || user.id; // If no agentId in URL, use current user
      const response = await axios.get(`${API}/agents/${id}/statement`);
      setStatement(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching statement:', error);
      toast.error('خطأ في تحميل كشف الحساب');
      navigate('/dashboard');
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { label: 'قيد الانتظار', className: 'bg-yellow-100 text-yellow-800' },
      completed: { label: 'مكتمل', className: 'bg-green-100 text-green-800' },
      cancelled: { label: 'ملغى', className: 'bg-red-100 text-red-800' }
    };
    const config = statusMap[status] || { label: status, className: '' };
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
    <div className="min-h-screen bg-background" data-testid="agent-statement-page">
      <Navbar />
      <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <Card className="bg-gradient-to-l from-primary to-primary/80 text-white shadow-xl">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-2xl sm:text-3xl">كشف حساب الصيرفة</CardTitle>
            <CardDescription className="text-white/80 text-sm sm:text-base">
              {statement.agent_name} - {statement.governorate}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Total Sent */}
          <Card className="border-r-4 border-r-red-500 shadow-lg">
            <CardHeader className="p-4 sm:p-6">
              <CardDescription className="text-sm sm:text-base">إجمالي المُرسل (باع)</CardDescription>
              <CardTitle className="text-2xl sm:text-4xl font-bold text-red-600">
                {statement.total_sent.toLocaleString()}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                عدد الحوالات: {statement.total_sent_count}
              </CardDescription>
              <div className="mt-2 text-xs">
                <p>IQD: {statement.iqd_sent.toLocaleString()}</p>
                <p>USD: {statement.usd_sent.toLocaleString()}</p>
              </div>
            </CardHeader>
          </Card>

          {/* Total Received */}
          <Card className="border-r-4 border-r-green-500 shadow-lg">
            <CardHeader className="p-4 sm:p-6">
              <CardDescription className="text-sm sm:text-base">إجمالي المُستلم (حول)</CardDescription>
              <CardTitle className="text-2xl sm:text-4xl font-bold text-green-600">
                {statement.total_received.toLocaleString()}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                عدد الحوالات: {statement.total_received_count}
              </CardDescription>
              <div className="mt-2 text-xs">
                <p>IQD: {statement.iqd_received.toLocaleString()}</p>
                <p>USD: {statement.usd_received.toLocaleString()}</p>
              </div>
            </CardHeader>
          </Card>

          {/* Total Commission */}
          <Card className="border-r-4 border-r-secondary shadow-lg">
            <CardHeader className="p-4 sm:p-6">
              <CardDescription className="text-sm sm:text-base">إجمالي الأرباح (عمولة)</CardDescription>
              <CardTitle className="text-2xl sm:text-4xl font-bold text-secondary">
                {statement.total_commission.toLocaleString()}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                من الحوالات المستلمة
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Transfers List */}
        <Card className="shadow-lg">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-xl sm:text-2xl">تفاصيل جميع الحوالات</CardTitle>
            <CardDescription className="text-sm sm:text-base">
              إجمالي: {statement.transfers.length} حوالة
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {statement.transfers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد حوالات</p>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {statement.transfers.map((transfer) => {
                  const isSent = transfer.from_agent_id === statement.agent_id;
                  return (
                    <div
                      key={transfer.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-accent/50 transition-colors ${
                        isSent ? 'border-r-4 border-r-red-500' : 'border-r-4 border-r-green-500'
                      }`}
                      onClick={() => navigate(`/transfers/${transfer.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="flex-1 space-y-1 mb-2 sm:mb-0">
                        <div className="flex items-center gap-2">
                          <p className="text-base sm:text-lg font-bold text-primary">
                            {transfer.transfer_code}
                          </p>
                          {getStatusBadge(transfer.status)}
                          <Badge className={isSent ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                            {isSent ? '📤 مُرسل' : '📥 مُستلم'}
                          </Badge>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          من: {transfer.sender_name} → إلى: {transfer.receiver_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(transfer.created_at).toLocaleDateString('ar-IQ', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-xl sm:text-2xl font-bold text-secondary">
                          {transfer.amount.toLocaleString()} {transfer.currency || 'IQD'}
                        </p>
                        {!isSent && transfer.commission && (
                          <p className="text-xs text-green-600">
                            عمولة: +{transfer.commission.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Back Button */}
        <div className="flex justify-center">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="outline"
            className="w-full sm:w-auto"
          >
            العودة للرئيسية
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AgentStatementPage;
