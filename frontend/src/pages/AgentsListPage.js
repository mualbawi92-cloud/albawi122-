import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const IRAQI_GOVERNORATES = [
  { code: 'BG', name: 'بغداد' },
  { code: 'BS', name: 'البصرة' },
  { code: 'NJ', name: 'النجف' },
  { code: 'KR', name: 'كربلاء' },
  { code: 'BB', name: 'بابل' },
  { code: 'AN', name: 'الأنبار' },
  { code: 'DY', name: 'ديالى' },
  { code: 'WS', name: 'واسط' },
  { code: 'SA', name: 'صلاح الدين' },
  { code: 'NI', name: 'نينوى' },
  { code: 'DQ', name: 'ذي قار' },
  { code: 'QA', name: 'القادسية' },
  { code: 'MY', name: 'المثنى' },
  { code: 'MI', name: 'ميسان' },
  { code: 'KI', name: 'كركوك' },
  { code: 'ER', name: 'أربيل' },
  { code: 'SU', name: 'السليمانية' },
  { code: 'DH', name: 'دهوك' }
];

const AgentsListPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [governorateFilter, setGovernorateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  useEffect(() => {
    fetchAgents();
  }, [governorateFilter]);

  const fetchAgents = async () => {
    try {
      const params = new URLSearchParams();
      if (governorateFilter) params.append('governorate', governorateFilter);

      const response = await axios.get(`${API}/agents?${params}`);
      setAgents(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast.error('خطأ في تحميل قائمة الصرافين');
      setLoading(false);
    }
  };

  const filteredAgents = agents.filter(agent => {
    if (statusFilter === 'active' && !agent.is_active) return false;
    if (statusFilter === 'inactive' && agent.is_active) return false;
    
    if (searchQuery && 
        !agent.display_name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !agent.username.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    return true;
  });

  const handleToggleStatus = async (agentId, currentStatus) => {
    try {
      await axios.patch(`${API}/users/${agentId}/status`, null, {
        params: { is_active: !currentStatus }
      });
      
      toast.success(currentStatus ? 'تم تعطيل الصراف' : 'تم تفعيل الصراف');
      fetchAgents();
    } catch (error) {
      console.error('Error toggling agent status:', error);
      toast.error('خطأ في تغيير حالة الصراف');
    }
  };

  return (
    <div className="min-h-screen bg-background" data-testid="agents-list-page">
      <Navbar />
      <div className="container mx-auto p-6">
        <Card className="shadow-xl">
          <CardHeader className="bg-gradient-to-l from-primary/10 to-primary/5">
            <CardTitle className="text-3xl text-primary">قائمة الصرافين</CardTitle>
            <CardDescription className="text-base">البحث عن صراف بحسب المحافظة</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 mb-6">
              <Input
                placeholder="بحث بالاسم أو اسم المستخدم..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-md h-12"
                data-testid="search-agent-input"
              />

              <Select value={governorateFilter || "all"} onValueChange={(v) => setGovernorateFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-48 h-12" data-testid="governorate-filter">
                  <SelectValue placeholder="كل المحافظات" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value="all">كل المحافظات</SelectItem>
                  {IRAQI_GOVERNORATES.map((gov) => (
                    <SelectItem key={gov.code} value={gov.code}>{gov.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48 h-12" data-testid="status-filter">
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="active">نشط</SelectItem>
                  <SelectItem value="inactive">غير نشط</SelectItem>
                </SelectContent>
              </Select>

              {user?.role === 'admin' && (
                <Button
                  onClick={() => navigate('/agents/add')}
                  className="bg-secondary hover:bg-secondary/90 text-primary font-bold mr-auto h-12"
                  data-testid="add-agent-btn"
                >
                  ➕ إضافة صراف جديد
                </Button>
              )}
            </div>

            {loading ? (
              <div className="text-center py-12 text-xl">جاري التحميل...</div>
            ) : filteredAgents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">لا توجد نتائج</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredAgents.map((agent) => (
                  <Card
                    key={agent.id}
                    data-testid={`agent-card-${agent.username}`}
                    className="hover:shadow-lg transition-all border-r-4 border-r-secondary"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-xl text-primary">{agent.display_name}</CardTitle>
                          <CardDescription>@{agent.username}</CardDescription>
                        </div>
                        <Badge className="bg-secondary text-primary">
                          {IRAQI_GOVERNORATES.find(g => g.code === agent.governorate)?.name || agent.governorate}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">📞</span>
                          <span className="font-medium" dir="ltr">{agent.phone || 'غير متوفر'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">📋</span>
                          <span>{agent.role === 'admin' ? 'مدير' : 'صراف'}</span>
                        </div>
                        
                        {/* Wallet Balance - Admin Only */}
                        {user?.role === 'admin' && (
                          <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 p-3 rounded-lg border border-yellow-200">
                            <p className="text-xs font-semibold text-yellow-800 mb-2">💰 رصيد المحفظة:</p>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-xs text-gray-600">دينار عراقي</p>
                                <p className="text-lg font-bold text-yellow-700">
                                  {(agent.wallet_balance_iqd || 0).toLocaleString()}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-600">دولار</p>
                                <p className="text-lg font-bold text-yellow-700">
                                  {(agent.wallet_balance_usd || 0).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between pt-2">
                          {agent.is_active ? (
                            <Badge className="bg-green-100 text-green-800">✅ نشط</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800">❌ معلق</Badge>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2 pt-3">
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/statement/${agent.id}`);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white w-full"
                            data-testid={`statement-${agent.username}`}
                          >
                            📊 كشف الحساب
                          </Button>
                          
                          {user?.role === 'admin' && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/agents/edit/${agent.id}`);
                                }}
                                className="text-xs flex-1"
                                data-testid={`edit-${agent.username}`}
                              >
                                ✏️ تعديل
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleStatus(agent.id, agent.is_active);
                                }}
                                className="text-xs flex-1"
                                data-testid={`toggle-status-${agent.username}`}
                              >
                                {agent.is_active ? '🔴 تعطيل' : '✅ تفعيل'}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AgentsListPage;
