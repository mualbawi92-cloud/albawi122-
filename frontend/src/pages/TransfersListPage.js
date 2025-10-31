import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TransfersListPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Active tab: 'outgoing', 'incoming', or 'inquiry'
  const [activeTab, setActiveTab] = useState('outgoing');
  
  // Common filters
  const [searchCode, setSearchCode] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('all');
  
  // Inquiry-specific filters (multiple status selection)
  const [statusFilters, setStatusFilters] = useState({
    pending: false,
    completed: true,
    cancelled: false
  });

  useEffect(() => {
    fetchTransfers();
  }, [activeTab, selectedCurrency, statusFilters]);

  const fetchTransfers = async () => {
    try {
      const params = new URLSearchParams();
      
      // Add currency filter
      if (selectedCurrency !== 'all') params.append('currency', selectedCurrency);
      
      // Tab-specific filters
      if (activeTab === 'outgoing') {
        params.append('direction', 'outgoing');
      } else if (activeTab === 'incoming') {
        params.append('direction', 'incoming');
        params.append('status', 'pending');
      }

      const response = await axios.get(`${API}/transfers?${params}`);
      let fetchedTransfers = response.data;
      
      // For inquiry tab, apply status filters
      if (activeTab === 'inquiry') {
        fetchedTransfers = fetchedTransfers.filter(t => {
          if (t.status === 'pending') return statusFilters.pending;
          if (t.status === 'completed') return statusFilters.completed;
          if (t.status === 'cancelled') return statusFilters.cancelled;
          return false;
        });
      }
      
      // Search by code
      if (searchCode) {
        fetchedTransfers = fetchedTransfers.filter(t => 
          t.transfer_code?.toLowerCase().includes(searchCode.toLowerCase()) ||
          t.id?.toLowerCase().includes(searchCode.toLowerCase())
        );
      }
      
      setTransfers(fetchedTransfers);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching transfers:', error);
      toast.error('خطأ في تحميل الحوالات');
      setLoading(false);
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-3 sm:p-6">
        <Card className="shadow-xl">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-2xl sm:text-3xl text-primary">الحوالات</CardTitle>
          </CardHeader>
          
          {/* Tabs */}
          <div className="border-b-2 px-4 sm:px-6">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('outgoing')}
                className={`px-4 sm:px-6 py-3 font-bold text-base sm:text-lg transition-all ${
                  activeTab === 'outgoing'
                    ? 'border-b-4 border-primary text-primary bg-primary/5'
                    : 'text-muted-foreground hover:text-primary'
                }`}
              >
                📤 إرسال حوالة
              </button>
              <button
                onClick={() => setActiveTab('incoming')}
                className={`px-4 sm:px-6 py-3 font-bold text-base sm:text-lg transition-all ${
                  activeTab === 'incoming'
                    ? 'border-b-4 border-primary text-primary bg-primary/5'
                    : 'text-muted-foreground hover:text-primary'
                }`}
              >
                📥 تسليم حوالة
              </button>
              <button
                onClick={() => setActiveTab('inquiry')}
                className={`px-4 sm:px-6 py-3 font-bold text-base sm:text-lg transition-all ${
                  activeTab === 'inquiry'
                    ? 'border-b-4 border-primary text-primary bg-primary/5'
                    : 'text-muted-foreground hover:text-primary'
                }`}
              >
                🔍 استعلام حوالات
              </button>
            </div>
          </div>
          
          <CardContent className="p-4 sm:p-6">
            {/* Filters Section */}
            <div className="bg-gray-50 p-4 rounded-lg mb-4 space-y-4">
              {/* Date Filters - Common for all tabs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">من تاريخ</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-10"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">إلى تاريخ</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-10"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">العملة</Label>
                  <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل العملات</SelectItem>
                      <SelectItem value="IQD">IQD</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Inquiry-specific filters */}
              {activeTab === 'inquiry' && (
                <>
                  <div className="border-t pt-4">
                    <Label className="text-sm font-semibold mb-3 block">نوع الحوالة:</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <Checkbox
                          id="pending"
                          checked={statusFilters.pending}
                          onCheckedChange={(checked) => 
                            setStatusFilters({ ...statusFilters, pending: checked })
                          }
                        />
                        <label htmlFor="pending" className="text-sm font-medium cursor-pointer">
                          قيد الانتظار (صادرة)
                        </label>
                      </div>
                      
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <Checkbox
                          id="completed"
                          checked={statusFilters.completed}
                          onCheckedChange={(checked) => 
                            setStatusFilters({ ...statusFilters, completed: checked })
                          }
                        />
                        <label htmlFor="completed" className="text-sm font-medium cursor-pointer">
                          مسلّمة
                        </label>
                      </div>
                      
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <Checkbox
                          id="cancelled"
                          checked={statusFilters.cancelled}
                          onCheckedChange={(checked) => 
                            setStatusFilters({ ...statusFilters, cancelled: checked })
                          }
                        />
                        <label htmlFor="cancelled" className="text-sm font-medium cursor-pointer">
                          ملغاة
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">بحث برقم الحوالة</Label>
                    <Input
                      placeholder="أدخل رقم الحوالة..."
                      value={searchCode}
                      onChange={(e) => setSearchCode(e.target.value)}
                      className="h-10"
                    />
                  </div>
                </>
              )}
            </div>
            
            {/* Action Buttons */}
            {activeTab === 'outgoing' && (
              <Button
                onClick={() => navigate('/transfers/create')}
                className="bg-secondary hover:bg-secondary/90 text-primary font-bold mb-4"
              >
                ➕ حوالة جديدة
              </Button>
            )}
            
            {activeTab === 'incoming' && (
              <Button
                onClick={() => navigate('/quick-receive')}
                className="bg-green-600 hover:bg-green-700 text-white font-bold mb-4"
              >
                ➕ تسليم حوالة جديدة
              </Button>
            )}

            {/* Transfers List */}
            {loading ? (
              <div className="text-center py-12 text-xl">جاري التحميل...</div>
            ) : transfers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-xl text-muted-foreground">لا توجد حوالات</p>
              </div>
            ) : (
              <>
                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-3 text-right">رمز الحوالة</th>
                        <th className="p-3 text-right">المرسل</th>
                        <th className="p-3 text-right">المستلم</th>
                        <th className="p-3 text-right">المبلغ</th>
                        <th className="p-3 text-right">العملة</th>
                        <th className="p-3 text-right">الحالة</th>
                        <th className="p-3 text-right">التاريخ</th>
                        <th className="p-3 text-center">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transfers.map((transfer) => (
                        <tr key={transfer.id} className="border-t hover:bg-gray-50">
                          <td className="p-3 font-mono">{transfer.transfer_code}</td>
                          <td className="p-3">{transfer.sender_name}</td>
                          <td className="p-3">{transfer.receiver_name}</td>
                          <td className="p-3 font-bold">{transfer.amount?.toLocaleString()}</td>
                          <td className="p-3">{transfer.currency}</td>
                          <td className="p-3">{getStatusBadge(transfer.status)}</td>
                          <td className="p-3 text-sm">
                            {new Date(transfer.created_at).toLocaleDateString('ar-IQ')}
                          </td>
                          <td className="p-3 text-center">
                            <Button
                              size="sm"
                              onClick={() => navigate(`/transfers/${transfer.id}`)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              عرض
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View */}
                <div className="md:hidden space-y-4">
                  {transfers.map((transfer) => (
                    <Card key={transfer.id} className="border-2">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs text-gray-500">رمز الحوالة</p>
                              <p className="font-mono font-bold">{transfer.transfer_code}</p>
                            </div>
                            {getStatusBadge(transfer.status)}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-gray-500">المرسل</p>
                              <p className="text-sm font-semibold">{transfer.sender_name}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">المستلم</p>
                              <p className="text-sm font-semibold">{transfer.receiver_name}</p>
                            </div>
                          </div>
                          
                          <div className="bg-blue-50 rounded p-3">
                            <p className="text-xs text-gray-500">المبلغ</p>
                            <p className="text-xl font-bold text-blue-600">
                              {transfer.amount?.toLocaleString()} {transfer.currency}
                            </p>
                          </div>
                          
                          <div>
                            <p className="text-xs text-gray-500">التاريخ</p>
                            <p className="text-sm">{new Date(transfer.created_at).toLocaleDateString('ar-IQ')}</p>
                          </div>
                          
                          <Button
                            onClick={() => navigate(`/transfers/${transfer.id}`)}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                          >
                            عرض التفاصيل
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TransfersListPage;
