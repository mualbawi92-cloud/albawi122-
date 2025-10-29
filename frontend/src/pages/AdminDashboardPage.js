import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import { formatWalletRequired } from '../utils/arabicNumbers';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminDashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [agents, setAgents] = useState([]);
  const [statements, setStatements] = useState({});
  const [allTransfers, setAllTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [transitData, setTransitData] = useState(null);

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('صلاحية الوصول مرفوضة');
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    try {
      // Get all agents
      const agentsRes = await axios.get(`${API}/agents`);
      const agentsData = agentsRes.data;
      setAgents(agentsData);

      // Get all transfers
      const transfersRes = await axios.get(`${API}/transfers`);
      setAllTransfers(transfersRes.data);

      // Get statement for each agent
      const statementsData = {};
      for (const agent of agentsData) {
        try {
          const statementRes = await axios.get(`${API}/agents/${agent.id}/statement`);
          statementsData[agent.id] = statementRes.data;
        } catch (error) {
          console.error(`Error fetching statement for ${agent.id}:`, error);
          statementsData[agent.id] = {
            total_sent: 0,
            total_received: 0,
            transfers: []
          };
        }
      }
      setStatements(statementsData);
      
      // Get transit account data
      try {
        const transitRes = await axios.get(`${API}/transit-account/balance`);
        setTransitData(transitRes.data);
      } catch (error) {
        console.error('Error fetching transit data:', error);
        setTransitData(null);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('خطأ في تحميل البيانات');
      setLoading(false);
    }
  };

  // Calculate totals across all agents
  const calculateTotals = () => {
    let totalCredit = 0;
    let totalDebit = 0;

    Object.values(statements).forEach(statement => {
      totalCredit += statement.total_received || 0;
      totalDebit += statement.total_sent || 0;
    });

    return {
      totalCredit,
      totalDebit,
      netBalance: totalCredit - totalDebit
    };
  };

  // Calculate transfer statistics
  const calculateTransferStats = () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const completedToday = allTransfers.filter(t => 
      t.status === 'completed' && new Date(t.completed_at) >= todayStart
    ).length;
    
    const cancelled = allTransfers.filter(t => 
      t.status === 'cancelled'
    ).length;
    
    const pending = allTransfers.filter(t => 
      t.status === 'pending'
    ).length;
    
    const totalCompleted = allTransfers.filter(t => 
      t.status === 'completed'
    ).length;
    
    return {
      completedToday,
      cancelled,
      pending,
      totalCompleted,
      total: allTransfers.length
    };
  };

  const getLastActivity = (agentId) => {
    const statement = statements[agentId];
    if (!statement || !statement.transfers || statement.transfers.length === 0) {
      return 'لا توجد حركات';
    }

    const sortedTransfers = [...statement.transfers].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
    
    const lastTransfer = sortedTransfers[0];
    const now = new Date();
    const lastDate = new Date(lastTransfer.created_at);
    const diffMinutes = Math.floor((now - lastDate) / 60000);

    if (diffMinutes < 60) {
      return `قبل ${diffMinutes} دقيقة`;
    } else if (diffMinutes < 1440) {
      const hours = Math.floor(diffMinutes / 60);
      return `قبل ${hours} ساعة`;
    } else {
      const days = Math.floor(diffMinutes / 1440);
      return `قبل ${days} يوم`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA]">
        <Navbar />
        <div className="container mx-auto p-6 flex items-center justify-center min-h-[50vh]">
          <div className="text-2xl text-primary">جاري التحميل...</div>
        </div>
      </div>
    );
  }

  const totals = calculateTotals();
  const transferStats = calculateTransferStats();

  return (
    <div className="min-h-screen bg-[#F5F7FA]" data-testid="admin-dashboard-page">
      <Navbar />
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Header */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
                🏦 لوحة التحكم – الصيارف المسجلة
              </h1>
              <p className="text-gray-600 mt-2">إدارة ومراقبة جميع الصيارف والحوالات</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">المدير</p>
              <p className="text-lg font-bold text-gray-900">{user?.display_name}</p>
            </div>
          </div>
        </div>

        {/* Transfer Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Completed Today */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-blue-700">
                    📅 الحوالات المكتملة اليوم
                  </p>
                  <p className="text-4xl font-bold text-blue-600">
                    {transferStats.completedToday}
                  </p>
                </div>
                <div className="text-5xl text-blue-500/30">✅</div>
              </div>
            </CardContent>
          </Card>

          {/* Cancelled */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-red-50 to-red-100 rounded-xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-red-700">
                    🚫 الحوالات الملغية
                  </p>
                  <p className="text-4xl font-bold text-red-600">
                    {transferStats.cancelled}
                  </p>
                </div>
                <div className="text-5xl text-red-500/30">❌</div>
              </div>
            </CardContent>
          </Card>

          {/* Pending */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-yellow-700">
                    ⏳ الحوالات قيد الانتظار
                  </p>
                  <p className="text-4xl font-bold text-yellow-600">
                    {transferStats.pending}
                  </p>
                </div>
                <div className="text-5xl text-yellow-500/30">⌛</div>
              </div>
            </CardContent>
          </Card>

          {/* Total Completed */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100 rounded-xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-green-700">
                    💯 إجمالي المكتملة
                  </p>
                  <p className="text-4xl font-bold text-green-600">
                    {transferStats.totalCompleted}
                  </p>
                </div>
                <div className="text-5xl text-green-500/30">📊</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Credit */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100 rounded-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-green-700">
                    💵 إجمالي الحركات الدائنة لجميع الصيارف
                  </p>
                  <p className="text-4xl font-bold text-green-600">
                    {totals.totalCredit.toLocaleString()}
                  </p>
                  <p className="text-xs text-green-600">د.ع</p>
                </div>
                <div className="text-6xl text-green-500/30">⬇️</div>
              </div>
            </CardContent>
          </Card>

          {/* Total Debit */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-red-50 to-red-100 rounded-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-red-700">
                    💸 إجمالي الحركات المدينة لجميع الصيارف
                  </p>
                  <p className="text-4xl font-bold text-red-600">
                    {totals.totalDebit.toLocaleString()}
                  </p>
                  <p className="text-xs text-red-600">د.ع</p>
                </div>
                <div className="text-6xl text-red-500/30">⬆️</div>
              </div>
            </CardContent>
          </Card>

          {/* Net Balance */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-blue-700">
                    ⚖️ إجمالي الرصيد الصافي
                  </p>
                  <p className="text-4xl font-bold text-blue-600">
                    {totals.netBalance.toLocaleString()}
                  </p>
                  <p className="text-xs text-blue-600">د.ع</p>
                </div>
                <div className="text-6xl text-blue-500/30">💰</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Agents Table */}
        <Card className="border-0 shadow-lg rounded-xl">
          <CardHeader className="bg-white border-b rounded-t-xl">
            <CardTitle className="text-2xl font-bold text-gray-900">
              📋 قائمة الصيارف المسجلة
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              إجمالي: {agents.length} صيرفة
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b-2">
                  <tr>
                    <th className="text-right p-4 text-sm font-bold text-gray-700">اسم الصيرفة</th>
                    <th className="text-right p-4 text-sm font-bold text-gray-700">اسم المالك</th>
                    <th className="text-right p-4 text-sm font-bold text-gray-700">الرصيد الحالي</th>
                    <th className="text-right p-4 text-sm font-bold text-gray-700">المطلوب من المحفظة</th>
                    <th className="text-right p-4 text-sm font-bold text-gray-700">عدد العمليات</th>
                    <th className="text-right p-4 text-sm font-bold text-gray-700">آخر حركة</th>
                    <th className="text-center p-4 text-sm font-bold text-gray-700">كشف الحساب</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => {
                    const statement = statements[agent.id] || {};
                    const netBalance = (statement.total_received || 0) - (statement.total_sent || 0);
                    const operationsCount = (statement.total_received_count || 0) + (statement.total_sent_count || 0);
                    
                    // Calculate wallet required
                    const walletBalanceIqd = agent.wallet_balance_iqd || 0;
                    const walletBalanceUsd = agent.wallet_balance_usd || 0;
                    const walletLimitIqd = agent.wallet_limit_iqd || 0;
                    const walletLimitUsd = agent.wallet_limit_usd || 0;
                    
                    return (
                      <tr
                        key={agent.id}
                        className="border-b hover:bg-gray-50 transition-colors"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${agent.is_active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <div>
                              <p className="font-bold text-gray-900">{agent.display_name}</p>
                              <p className="text-xs text-gray-500">{agent.governorate}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="text-gray-700">{agent.username}</p>
                        </td>
                        <td className="p-4">
                          <div>
                            <p className={`text-lg font-bold ${netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {netBalance.toLocaleString()} د.ع
                            </p>
                            <div className="text-xs text-gray-600 mt-1">
                              <p>💰 IQD: {walletBalanceIqd.toLocaleString()}</p>
                              <p>💵 USD: {walletBalanceUsd.toLocaleString()}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="space-y-2">
                            {/* IQD */}
                            <div className="bg-yellow-50 border border-yellow-300 rounded-lg px-3 py-2">
                              {(() => {
                                const result = formatWalletRequired(walletBalanceIqd, walletLimitIqd, 'IQD');
                                if (result.status) {
                                  return (
                                    <p className="text-sm font-semibold text-yellow-800 text-center">
                                      💰 {result.status}
                                    </p>
                                  );
                                }
                                return (
                                  <div className="text-center">
                                    <p className="text-xl font-bold text-yellow-900">
                                      💰 {result.number}
                                    </p>
                                    <p className="text-xs text-yellow-700 mt-1">
                                      ({result.text})
                                    </p>
                                  </div>
                                );
                              })()}
                            </div>
                            
                            {/* USD */}
                            <div className="bg-green-50 border border-green-300 rounded-lg px-3 py-2">
                              {(() => {
                                const result = formatWalletRequired(walletBalanceUsd, walletLimitUsd, 'USD');
                                if (result.status) {
                                  return (
                                    <p className="text-sm font-semibold text-green-800 text-center">
                                      💵 {result.status}
                                    </p>
                                  );
                                }
                                return (
                                  <div className="text-center">
                                    <p className="text-xl font-bold text-green-900">
                                      💵 {result.number}
                                    </p>
                                    <p className="text-xs text-green-700 mt-1">
                                      ({result.text})
                                    </p>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-gray-900">{operationsCount}</span>
                            <div className="text-xs text-gray-500">
                              <div>📤 {statement.total_sent_count || 0}</div>
                              <div>📥 {statement.total_received_count || 0}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="text-sm text-gray-600">{getLastActivity(agent.id)}</p>
                        </td>
                        <td className="p-4 text-center">
                          <Button
                            onClick={() => navigate(`/statement/${agent.id}`)}
                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6"
                            style={{ borderRadius: '12px' }}
                          >
                            🔍 عرض
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {agents.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                لا توجد صيارف مسجلة
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button
            onClick={() => navigate('/agents/add')}
            className="bg-green-600 hover:bg-green-700 text-white h-16 text-lg rounded-xl"
            style={{ borderRadius: '12px' }}
          >
            ➕ إضافة صيرفة جديدة
          </Button>
          <Button
            onClick={() => navigate('/wallet/manage')}
            className="bg-purple-600 hover:bg-purple-700 text-white h-16 text-lg rounded-xl"
            style={{ borderRadius: '12px' }}
          >
            💳 إدارة المحافظ
          </Button>
          <Button
            onClick={() => navigate('/admin/all-transfers')}
            className="bg-orange-600 hover:bg-orange-700 text-white h-16 text-lg rounded-xl"
            style={{ borderRadius: '12px' }}
          >
            📊 جميع الحوالات
          </Button>
          <Button
            onClick={() => navigate('/admin/cancelled-transfers')}
            className="bg-red-600 hover:bg-red-700 text-white h-16 text-lg rounded-xl"
            style={{ borderRadius: '12px' }}
          >
            🚫 الحوالات الملغية
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
