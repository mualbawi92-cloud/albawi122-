import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import api from '../services/api';


const AllTransfersAdminPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Check if user is admin
  if (user?.role !== 'admin') {
    navigate('/dashboard');
    return null;
  }

  useEffect(() => {
    fetchAllTransfers();
  }, []);

  const fetchAllTransfers = async () => {
    try {
      // Get all transfers without filters
      const response = await api.get('/transfers');
      setTransfers(response.data);
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
      cancelled: { label: 'ملغى', className: 'bg-red-100 text-red-800' },
      expired: { label: 'منتهي', className: 'bg-gray-100 text-gray-800' }
    };
    const config = statusMap[status] || { label: status, className: '' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const filteredTransfers = transfers.filter(transfer => {
    // Status filter
    if (statusFilter !== 'all' && transfer.status !== statusFilter) return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        transfer.transfer_code.toLowerCase().includes(query) ||
        transfer.sender_name.toLowerCase().includes(query) ||
        transfer.receiver_name?.toLowerCase().includes(query) ||
        transfer.from_agent_name?.toLowerCase().includes(query) ||
        transfer.to_agent_name?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        
        <div className="container mx-auto p-6 flex items-center justify-center min-h-[50vh]">
          <div className="text-2xl text-primary">جاري التحميل...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="all-transfers-admin-page">
      
      <div className="container mx-auto p-3 sm:p-6">
        <Card className="shadow-xl">
          <CardHeader className="bg-gradient-to-l from-primary/10 to-primary/5 p-4 sm:p-6">
            <CardTitle className="text-2xl sm:text-3xl text-primary">📊 جميع الحوالات في النظام</CardTitle>
            <CardDescription className="text-sm sm:text-base">عرض شامل لكل الحوالات مع التفاصيل الكاملة</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
              <Input
                placeholder="بحث برمز الحوالة أو الاسم..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:max-w-md h-10 sm:h-12"
                data-testid="search-input"
              />

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48 h-10 sm:h-12" data-testid="status-filter">
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="pending">قيد الانتظار</SelectItem>
                  <SelectItem value="completed">مكتمل</SelectItem>
                  <SelectItem value="cancelled">ملغى</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-bold text-primary">{filteredTransfers.length}</span>
                <span>حوالة</span>
              </div>
            </div>

            {/* Transfers List */}
            {filteredTransfers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">لا توجد حوالات</div>
            ) : (
              <div className="space-y-4">
                {filteredTransfers.map((transfer) => (
                  <Card
                    key={transfer.id}
                    data-testid={`transfer-${transfer.transfer_code}`}
                    className="hover:shadow-lg transition-all cursor-pointer border-r-4 border-r-secondary"
                    onClick={() => navigate('/transfers/${transfer.id}')}
                  >
                    <CardContent className="p-4 sm:p-6">
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          <div>
                            <h3 className="text-xl sm:text-2xl font-bold text-primary">{transfer.transfer_code}</h3>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                              {new Date(transfer.created_at).toLocaleDateString('ar-IQ', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                          <div className="flex flex-col items-start sm:items-end gap-2">
                            <p className="text-2xl sm:text-3xl font-bold text-secondary">
                              {transfer.amount.toLocaleString()} {transfer.currency || 'IQD'}
                            </p>
                            <p className="text-sm text-gray-600">
                              نسبة العمولة: <span className="font-bold text-primary">
                                {transfer.commission_percentage !== undefined && transfer.commission_percentage !== null 
                                  ? `${transfer.commission_percentage}%` 
                                  : '0%'}
                              </span>
                            </p>
                            {getStatusBadge(transfer.status)}
                          </div>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg">
                          {/* Sender Info */}
                          <div className="space-y-2">
                            <h4 className="font-bold text-primary border-b pb-1">📤 معلومات المرسل</h4>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">الاسم الثلاثي:</span>
                                <span className="font-bold">{transfer.sender_name}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">من صراف:</span>
                                <span className="font-bold text-primary">
                                  {transfer.from_agent_name || 'غير محدد'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Receiver Info */}
                          <div className="space-y-2">
                            <h4 className="font-bold text-primary border-b pb-1">📥 معلومات المستلم</h4>
                            <div className="space-y-1 text-sm">
                              {transfer.receiver_name && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">الاسم الثلاثي:</span>
                                  <span className="font-bold">{transfer.receiver_name}</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">إلى محافظة:</span>
                                <span className="font-bold">{transfer.to_governorate}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">إلى صراف:</span>
                                <span className="font-bold text-primary">
                                  {transfer.to_agent_name || 'أي صراف في المحافظة'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Additional Info */}
                          <div className="space-y-2 md:col-span-2">
                            <h4 className="font-bold text-primary border-b pb-1">ℹ️ معلومات إضافية</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                              <div className="flex justify-between sm:flex-col sm:justify-start">
                                <span className="text-muted-foreground">رقم التسلسل:</span>
                                <span className="font-mono font-bold">{transfer.seq_number}</span>
                              </div>
                              {transfer.commission !== undefined && (
                                <div className="flex justify-between sm:flex-col sm:justify-start">
                                  <span className="text-muted-foreground">العمولة:</span>
                                  <span className="font-bold text-green-600">
                                    {transfer.commission.toFixed(2)} {transfer.currency || 'IQD'}
                                  </span>
                                </div>
                              )}
                              {transfer.note && (
                                <div className="flex justify-between sm:flex-col sm:justify-start sm:col-span-2">
                                  <span className="text-muted-foreground">ملاحظات:</span>
                                  <span className="font-medium">{transfer.note}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate('/transfers/${transfer.id}');
                            }}
                            className="text-primary border-primary hover:bg-primary hover:text-white"
                          >
                            عرض التفاصيل الكاملة →
                          </Button>
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

export default AllTransfersAdminPage;
