import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const GOVERNORATES = [
  'BG', 'BS', 'BB', 'DY', 'AN', 'AR', 'SD', 'NA', 'QA', 'WS',
  'SA', 'NJ', 'MI', 'DQ', 'KR', 'SU', 'MU', 'TH'
];

const AgentsListPage = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [governorateFilter, setGovernorateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredAgents = agents.filter(agent =>
    !searchQuery ||
    agent.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

              <Select value={governorateFilter} onValueChange={setGovernorateFilter}>
                <SelectTrigger className="w-48 h-12" data-testid="governorate-filter">
                  <SelectValue placeholder="كل المحافظات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">كل المحافظات</SelectItem>
                  {GOVERNORATES.map((gov) => (
                    <SelectItem key={gov} value={gov}>{gov}</SelectItem>
                  ))}
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
                    className="hover:shadow-lg transition-all border-r-4 border-r-secondary"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-xl text-primary">{agent.display_name}</CardTitle>
                          <CardDescription>@{agent.username}</CardDescription>
                        </div>
                        <Badge className="bg-secondary text-primary">{agent.governorate}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">📞</span>
                          <span className="font-medium">{agent.phone || 'غير متوفر'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">📋</span>
                          <span>{agent.role === 'admin' ? 'مدير' : 'صراف'}</span>
                        </div>
                        {agent.is_active ? (
                          <Badge className="bg-green-100 text-green-800">✅ نشط</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">❌ معلق</Badge>
                        )}
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