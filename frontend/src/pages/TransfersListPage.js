import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TransfersListPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Active tab: 'outgoing' or 'incoming'
  const [activeTab, setActiveTab] = useState('outgoing');
  
  // Initialize filters from URL query params
  const [filter, setFilter] = useState({ 
    status: searchParams.get('status') || '', 
    direction: searchParams.get('direction') || '' 
  });
  const [searchCode, setSearchCode] = useState('');

  useEffect(() => {
    // Update filters if URL params change
    const statusParam = searchParams.get('status') || '';
    const directionParam = searchParams.get('direction') || '';
    setFilter({ status: statusParam, direction: directionParam });
  }, [searchParams]);

  useEffect(() => {
    fetchTransfers();
  }, [filter]);

  const fetchTransfers = async () => {
    try {
      const params = new URLSearchParams();
      if (filter.status && filter.status.trim()) params.append('status', filter.status.trim());
      if (filter.direction && filter.direction.trim()) params.append('direction', filter.direction.trim());

      const response = await axios.get(`${API}/transfers?${params}`);
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
      cancelled: { label: 'ملغى', className: 'bg-red-100 text-red-800' }
    };
    const config = statusMap[status] || { label: status, className: '' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const filteredTransfers = transfers.filter(t => 
    !searchCode || t.transfer_code.toLowerCase().includes(searchCode.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background" data-testid="transfers-list-page">
      <Navbar />
      <div className="container mx-auto p-3 sm:p-6">
        <Card className="shadow-xl mb-4 sm:mb-6">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-2xl sm:text-3xl text-primary">جميع الحوالات</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 mb-4 sm:mb-6">
              <Input
                placeholder="بحث برمز الحوالة..."
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                className="w-full sm:max-w-xs h-10 sm:h-12 text-sm sm:text-base"
                data-testid="search-transfer-input"
              />
              
              <Select value={filter.status || ""} onValueChange={(value) => setFilter({ ...filter, status: value || "" })}>
                <SelectTrigger className="w-48 h-12" data-testid="status-filter">
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=" ">كل الحالات</SelectItem>
                  <SelectItem value="pending">قيد الانتظار</SelectItem>
                  <SelectItem value="completed">مكتمل</SelectItem>
                  <SelectItem value="cancelled">ملغى</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filter.direction || ""} onValueChange={(value) => setFilter({ ...filter, direction: value || "" })}>
                <SelectTrigger className="w-48 h-12" data-testid="direction-filter">
                  <SelectValue placeholder="الاتجاه" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=" ">كل الحوالات</SelectItem>
                  <SelectItem value="incoming">واردة</SelectItem>
                  <SelectItem value="outgoing">صادرة</SelectItem>
                </SelectContent>
              </Select>

              <Button
                onClick={() => navigate('/transfers/create')}
                className="bg-secondary hover:bg-secondary/90 text-primary font-bold mr-auto"
                data-testid="create-new-transfer-btn"
              >
                ➕ حوالة جديدة
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-12 text-xl">جاري التحميل...</div>
            ) : filteredTransfers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">لا توجد حوالات</div>
            ) : (
              <div className="space-y-3">
                {filteredTransfers.map((transfer) => (
                  <div
                    key={transfer.id}
                    data-testid={`transfer-item-${transfer.transfer_code}`}
                    className="flex items-center justify-between p-5 bg-muted/30 rounded-xl hover:shadow-lg transition-all cursor-pointer border-r-4 border-r-secondary"
                    onClick={() => navigate(`/transfers/${transfer.id}`)}
                  >
                    <div className="space-y-2">
                      <p className="text-xl font-bold text-primary">{transfer.transfer_code}</p>
                      <p className="text-sm text-muted-foreground">
                        من: {transfer.sender_name}
                      </p>
                      {transfer.receiver_name && (
                        <p className="text-sm text-muted-foreground">
                          إلى: {transfer.receiver_name} ({transfer.to_governorate})
                        </p>
                      )}
                      {!transfer.receiver_name && (
                        <p className="text-sm text-muted-foreground">
                          إلى: {transfer.to_governorate}
                        </p>
                      )}
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
                    <div className="text-left space-y-2">
                      <p className="text-2xl font-bold text-secondary">{transfer.amount.toLocaleString()} {transfer.currency || 'IQD'}</p>
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TransfersListPage;