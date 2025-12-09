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
  const [copiedId, setCopiedId] = useState(null);

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

  // دالة نسخ معلومات الوكيل
  const handleCopyAgentInfo = (agent) => {
    const governorateName = IRAQI_GOVERNORATES.find(g => g.code === agent.governorate)?.name || agent.governorate;
    
    const agentInfo = `اسم الوكيل: ${agent.display_name}
المدينة: ${governorateName}
العنوان: ${agent.address || 'غير محدد'}
الهاتف: ${agent.phone || 'غير محدد'}`;

    // Try modern clipboard API first, fallback if blocked
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(agentInfo).then(() => {
        setCopiedId(agent.id);
        toast.success('تم نسخ معلومات الوكيل');
        
        // إخفاء رسالة النسخ بعد ثانيتين
        setTimeout(() => {
          setCopiedId(null);
        }, 2000);
      }).catch(() => {
        // Fallback to old method
        fallbackCopy(agentInfo, agent.id);
      });
    } else {
      fallbackCopy(agentInfo, agent.id);
    }
  };

  const fallbackCopy = (text, agentId) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
      document.execCommand('copy');
      setCopiedId(agentId);
      toast.success('تم نسخ معلومات الوكيل');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast.error('فشل نسخ المعلومات');
    }
    
    document.body.removeChild(textArea);
  };


  return (
    <div className="min-h-screen bg-background" data-testid="agents-list-page">
      
      <div className="container mx-auto p-6">
        <Card className="shadow-xl">
          <CardHeader className="bg-gradient-to-l from-primary/10 to-primary/5">
            <CardTitle className="text-3xl text-primary">عناوين الوكلاء</CardTitle>
            <CardDescription className="text-base">عرض معلومات التواصل مع الوكلاء</CardDescription>
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
                    className="hover:shadow-lg transition-all border-r-4 border-r-primary relative"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-xl text-primary">{agent.display_name}</CardTitle>
                        <Badge className="bg-secondary text-primary">
                          {IRAQI_GOVERNORATES.find(g => g.code === agent.governorate)?.name || agent.governorate}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* معلومات الاتصال */}
                        <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">👤</span>
                            <div className="flex-1">
                              <p className="text-xs text-muted-foreground mb-1">اسم الوكيل</p>
                              <p className="font-semibold text-base">{agent.display_name}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">🏙️</span>
                            <div className="flex-1">
                              <p className="text-xs text-muted-foreground mb-1">المدينة</p>
                              <p className="font-semibold text-base">
                                {IRAQI_GOVERNORATES.find(g => g.code === agent.governorate)?.name || agent.governorate}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">📍</span>
                            <div className="flex-1">
                              <p className="text-xs text-muted-foreground mb-1">العنوان</p>
                              <p className="font-semibold text-base">{agent.address || 'غير محدد'}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">📞</span>
                            <div className="flex-1">
                              <p className="text-xs text-muted-foreground mb-1">الهاتف</p>
                              <p className="font-semibold text-base" dir="ltr">{agent.phone || 'غير محدد'}</p>
                            </div>
                          </div>
                        </div>
                        
                        {/* زر النسخ */}
                        <Button
                          onClick={() => handleCopyAgentInfo(agent)}
                          className={`w-full ${copiedId === agent.id ? 'bg-green-600 hover:bg-green-700' : 'bg-primary hover:bg-primary/90'} text-white font-bold transition-all`}
                        >
                          {copiedId === agent.id ? (
                            <>
                              <span className="ml-2">✓</span>
                              تم النسخ
                            </>
                          ) : (
                            <>
                              <span className="ml-2">📋</span>
                              نسخ المعلومات
                            </>
                          )}
                        </Button>
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
