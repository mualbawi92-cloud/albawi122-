import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [agentName, setAgentName] = useState(null);

  useEffect(() => {
    fetchDashboardData();
    fetchAgentName();
  }, []);

  const fetchAgentName = async () => {
    // If user is a regular user (role='user'), fetch their agent's name
    if (user?.role === 'user' && user?.agent_id) {
      try {
        const response = await axios.get(`${API}/users`);
        const agent = response.data.find(u => u.id === user.agent_id);
        if (agent) {
          setAgentName(agent.display_name);
        }
      } catch (error) {
        console.error('Error fetching agent name:', error);
      }
    }
  };

  const fetchDashboardData = async () => {
    try {
      const [statsRes, transfersRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`),
        axios.get(`${API}/transfers`)
      ]);
      
      setStats(statsRes.data);
      setTransfers(transfersRes.data.slice(0, 10)); // Latest 10
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('خطأ في تحميل البيانات');
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { label: 'قيد الانتظار', variant: 'warning' },
      completed: { label: 'مكتمل', variant: 'success' },
      cancelled: { label: 'ملغى', variant: 'destructive' }
    };
    const config = statusMap[status] || { label: status, variant: 'default' };
    return (
      <Badge variant={config.variant === 'warning' ? 'default' : config.variant === 'success' ? 'outline' : config.variant}>
        {config.label}
      </Badge>
    );
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
    <div className="min-h-screen bg-background" data-testid="dashboard-page">
      <Navbar />
      <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-l from-primary to-primary/80 rounded-xl sm:rounded-2xl p-4 sm:p-8 text-white shadow-xl">
          <h1 className="text-2xl sm:text-4xl font-bold mb-1 sm:mb-2">مرحباً {user?.display_name}</h1>
          <p className="text-base sm:text-xl opacity-90">{user?.governorate} - {user?.role === 'admin' ? 'مدير' : 'صراف'}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <Card 
            className="border-r-4 border-r-secondary hover:shadow-lg transition-all cursor-pointer" 
            data-testid="stat-pending-incoming"
            onClick={() => navigate('/transfers?direction=incoming&status=pending')}
          >
            <CardHeader className="p-3 sm:p-6">
              <CardDescription className="text-xs sm:text-sm">واردة قيد الانتظار</CardDescription>
              <CardTitle className="text-3xl sm:text-5xl font-bold text-secondary">{stats?.pending_incoming || 0}</CardTitle>
            </CardHeader>
          </Card>

          <Card 
            className="border-r-4 border-r-primary hover:shadow-lg transition-all cursor-pointer" 
            data-testid="stat-pending-outgoing"
            onClick={() => navigate('/transfers?direction=outgoing&status=pending')}
          >
            <CardHeader className="p-3 sm:p-6">
              <CardDescription className="text-xs sm:text-sm">صادرة قيد الانتظار</CardDescription>
              <CardTitle className="text-3xl sm:text-5xl font-bold text-primary">{stats?.pending_outgoing || 0}</CardTitle>
            </CardHeader>
          </Card>

          <Card 
            className="border-r-4 border-r-green-500 hover:shadow-lg transition-all cursor-pointer" 
            data-testid="stat-completed-today"
            onClick={() => navigate('/transfers?status=completed')}
          >
            <CardHeader className="p-3 sm:p-6">
              <CardDescription className="text-xs sm:text-sm">مكتملة اليوم</CardDescription>
              <CardTitle className="text-3xl sm:text-5xl font-bold text-green-600">{stats?.completed_today || 0}</CardTitle>
            </CardHeader>
          </Card>

          <Card 
            className="border-r-4 border-r-secondary hover:shadow-lg transition-all cursor-pointer" 
            data-testid="stat-wallet-balance"
            onClick={() => navigate('/wallet')}
          >
            <CardHeader className="p-3 sm:p-6">
              <CardDescription className="text-xs sm:text-sm">الرصيد المتاح</CardDescription>
              <CardTitle className="text-lg sm:text-2xl font-bold text-secondary">
                {stats?.wallet_balance_iqd?.toLocaleString() || 0} IQD
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                {stats?.wallet_balance_usd?.toLocaleString() || 0} USD
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="shadow-lg">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-xl sm:text-2xl">عمليات سريعة</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 p-4 sm:p-6">
            <Button 
              onClick={() => navigate('/transfers/create')} 
              className="w-full sm:w-auto bg-secondary hover:bg-secondary/90 text-primary font-bold text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6"
              data-testid="create-transfer-btn"
            >
              ➕ إنشاء حوالة جديدة
            </Button>
            <Button 
              onClick={() => navigate('/transfers')} 
              variant="outline"
              className="w-full sm:w-auto font-bold text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 border-2 border-primary hover:bg-primary hover:text-white"
              data-testid="view-transfers-btn"
            >
              📋 عرض جميع الحوالات
            </Button>
            <Button 
              onClick={() => navigate('/agents')} 
              variant="outline"
              className="w-full sm:w-auto font-bold text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 border-2 border-secondary hover:bg-secondary hover:text-primary"
              data-testid="view-agents-btn"
            >
              👥 قائمة الصرافين
            </Button>
          </CardContent>
        </Card>

        {/* Recent Transfers */}
        <Card className="shadow-lg">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-xl sm:text-2xl">آخر الحوالات</CardTitle>
            <CardDescription className="text-sm sm:text-base">آخر 10 حوالات</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {transfers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد حوالات</p>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {transfers.map((transfer) => (
                  <div
                    key={transfer.id}
                    data-testid={`transfer-${transfer.transfer_code}`}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 bg-muted/30 rounded-lg hover:shadow-md transition-all cursor-pointer gap-2 sm:gap-0"
                    onClick={() => navigate(`/transfers/${transfer.id}`)}
                  >
                    <div className="space-y-1 w-full sm:w-auto">
                      <p className="font-bold text-base sm:text-lg text-primary">{transfer.transfer_code}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {transfer.sender_name} → {transfer.to_governorate}
                      </p>
                    </div>
                    <div className="flex items-center justify-between w-full sm:w-auto sm:text-left space-y-1 sm:space-y-2">
                      <p className="text-lg sm:text-xl font-bold text-secondary">{transfer.amount.toLocaleString()} {transfer.currency || 'IQD'}</p>
                      <div className="sm:mr-4">{getStatusBadge(transfer.status)}</div>
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

export default DashboardPage;