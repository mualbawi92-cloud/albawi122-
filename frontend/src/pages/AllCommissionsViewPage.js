import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AllCommissionsViewPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [allRates, setAllRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('صلاحية الوصول مرفوضة');
      navigate('/dashboard');
      return;
    }
    fetchAllCommissionRates();
  }, [user, navigate]);

  const fetchAllCommissionRates = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/commission-rates`);
      setAllRates(response.data);
    } catch (error) {
      console.error('Error fetching commission rates:', error);
      toast.error('خطأ في تحميل النشرات');
    }
    setLoading(false);
  };

  const filteredRates = allRates.filter(rate => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      rate.agent_display_name?.toLowerCase().includes(term) ||
      rate.currency?.toLowerCase().includes(term) ||
      rate.bulletin_type?.toLowerCase().includes(term)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto p-6 flex justify-center items-center">
          <div className="text-lg">جاري التحميل...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <Navbar />
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-l from-purple-50 to-purple-100">
            <CardTitle className="text-2xl sm:text-3xl">📊 جميع نشرات العمولات</CardTitle>
            <CardDescription className="text-base">
              عرض شامل لجميع النشرات المحددة للصرافين
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex gap-4 items-center">
              <Input
                placeholder="🔍 بحث بالاسم، العملة، أو النوع..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
              <Button onClick={fetchAllCommissionRates} variant="outline">
                🔄 تحديث
              </Button>
              <Button onClick={() => navigate('/commissions-management')}>
                ➕ إدارة العمولات
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">إجمالي النشرات</p>
                <p className="text-3xl font-bold text-purple-600">{allRates.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">نشرات IQD</p>
                <p className="text-3xl font-bold text-green-600">
                  {allRates.filter(r => r.currency === 'IQD').length}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">نشرات USD</p>
                <p className="text-3xl font-bold text-blue-600">
                  {allRates.filter(r => r.currency === 'USD').length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* All Rates Table */}
        <Card>
          <CardHeader>
            <CardTitle>جميع النشرات ({filteredRates.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredRates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? 'لا توجد نتائج' : 'لا توجد نشرات محفوظة'}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRates.map((rate) => (
                  <Card key={rate.id} className="border-2">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">
                            {rate.agent_display_name || 'صراف غير معروف'}
                          </CardTitle>
                          <CardDescription>
                            {rate.currency} - {rate.bulletin_type} - {new Date(rate.date).toLocaleDateString('ar-IQ')}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                            rate.currency === 'IQD' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {rate.currency}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="p-2 text-right">من</th>
                              <th className="p-2 text-right">إلى</th>
                              <th className="p-2 text-right">النسبة %</th>
                              <th className="p-2 text-right">المدينة</th>
                              <th className="p-2 text-right">النوع</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rate.tiers?.map((tier, idx) => (
                              <tr key={idx} className="border-t">
                                <td className="p-2">{tier.from_amount?.toLocaleString()}</td>
                                <td className="p-2">{tier.to_amount?.toLocaleString()}</td>
                                <td className="p-2 font-bold text-purple-700">{tier.percentage}%</td>
                                <td className="p-2">{tier.city || '(جميع المدن)'}</td>
                                <td className="p-2">
                                  {tier.type === 'outgoing' ? '📤 صادرة' : '📥 واردة'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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

export default AllCommissionsViewPage;
