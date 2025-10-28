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

  useEffect(() => {
    fetchDashboardData();
  }, []);

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
      <div className="container mx-auto p-6 space-y-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-l from-primary to-primary/80 rounded-2xl p-8 text-white shadow-xl">
          <h1 className="text-4xl font-bold mb-2">مرحباً {user?.display_name}</h1>
          <p className="text-xl opacity-90">{user?.governorate} - {user?.role === 'admin' ? 'مدير' : 'صراف'}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-r-4 border-r-secondary hover:shadow-lg transition-all" data-testid="stat-pending-incoming">
            <CardHeader>
              <CardDescription>واردة قيد الانتظار</CardDescription>
              <CardTitle className="text-5xl font-bold text-secondary">{stats?.pending_incoming || 0}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-r-4 border-r-primary hover:shadow-lg transition-all" data-testid="stat-pending-outgoing">
            <CardHeader>
              <CardDescription>صادرة قيد الانتظار</CardDescription>
              <CardTitle className="text-5xl font-bold text-primary">{stats?.pending_outgoing || 0}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-r-4 border-r-green-500 hover:shadow-lg transition-all" data-testid="stat-completed-today">
            <CardHeader>
              <CardDescription>مكتملة اليوم</CardDescription>
              <CardTitle className="text-5xl font-bold text-green-600">{stats?.completed_today || 0}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-r-4 border-r-secondary hover:shadow-lg transition-all" data-testid="stat-total-amount">
            <CardHeader>
              <CardDescription>إجمالي المبالغ اليوم</CardDescription>
              <CardTitle className="text-3xl font-bold text-secondary">{stats?.total_amount_today?.toLocaleString() || 0} IQD</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">عمليات سريعة</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <Button 
              onClick={() => navigate('/transfers/create')} 
              className="bg-secondary hover:bg-secondary/90 text-primary font-bold text-lg px-8 py-6"
              data-testid="create-transfer-btn"
            >
              ➕ إنشاء حوالة جديدة
            </Button>
            <Button 
              onClick={() => navigate('/transfers')} 
              variant="outline"
              className="font-bold text-lg px-8 py-6 border-2 border-primary hover:bg-primary hover:text-white"
              data-testid="view-transfers-btn"
            >
              📋 عرض جميع الحوالات
            </Button>
            <Button 
              onClick={() => navigate('/agents')} 
              variant="outline"
              className="font-bold text-lg px-8 py-6 border-2 border-secondary hover:bg-secondary hover:text-primary"
              data-testid="view-agents-btn"
            >
              👥 قائمة الصرافين
            </Button>
          </CardContent>
        </Card>

        {/* Recent Transfers */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">آخر الحوالات</CardTitle>
            <CardDescription>آخر 10 حوالات</CardDescription>
          </CardHeader>
          <CardContent>
            {transfers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد حوالات</p>
            ) : (
              <div className="space-y-4">
                {transfers.map((transfer) => (
                  <div
                    key={transfer.id}
                    data-testid={`transfer-${transfer.transfer_code}`}
                    className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:shadow-md transition-all cursor-pointer"
                    onClick={() => navigate(`/transfers/${transfer.id}`)}
                  >
                    <div className="space-y-1">
                      <p className="font-bold text-lg text-primary">{transfer.transfer_code}</p>
                      <p className="text-sm text-muted-foreground">
                        {transfer.sender_name} → {transfer.to_governorate}
                      </p>
                    </div>
                    <div className="text-left space-y-2">
                      <p className="text-xl font-bold text-secondary">{transfer.amount.toLocaleString()} {transfer.currency || 'IQD'}</p>
                      {getStatusBadge(transfer.status)}
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