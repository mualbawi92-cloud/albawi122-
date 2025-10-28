import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CommissionsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);

  // Check if user is admin
  if (user?.role !== 'admin') {
    navigate('/dashboard');
    return null;
  }

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      const response = await axios.get(`${API}/commissions/report`, {
        params: { status: 'completed' }
      });
      setReport(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching commissions:', error);
      toast.error('خطأ في تحميل تقرير العمولات');
      setLoading(false);
    }
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
    <div className="min-h-screen bg-background" data-testid="commissions-page">
      <Navbar />
      <div className="container mx-auto p-3 sm:p-6">
        <Card className="shadow-xl mb-6">
          <CardHeader className="bg-gradient-to-l from-secondary/20 to-secondary/10 p-4 sm:p-6">
            <CardTitle className="text-2xl sm:text-3xl text-primary">💰 تقرير العمولات</CardTitle>
            <CardDescription className="text-sm sm:text-base">نسبة العمولة: {report?.commission_percentage}%</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6">
              <Card className="border-r-4 border-r-primary">
                <CardHeader className="p-4">
                  <CardDescription className="text-xs sm:text-sm">إجمالي الحوالات المكتملة</CardDescription>
                  <CardTitle className="text-3xl sm:text-4xl font-bold text-primary">
                    {report?.total_transfers || 0}
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card className="border-r-4 border-r-secondary">
                <CardHeader className="p-4">
                  <CardDescription className="text-xs sm:text-sm">إجمالي المبالغ</CardDescription>
                  <CardTitle className="text-2xl sm:text-3xl font-bold text-secondary">
                    {(report?.total_amount || 0).toLocaleString()}
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card className="border-r-4 border-r-green-500 bg-green-50">
                <CardHeader className="p-4">
                  <CardDescription className="text-xs sm:text-sm">إجمالي الأرباح (العمولات)</CardDescription>
                  <CardTitle className="text-2xl sm:text-3xl font-bold text-green-600">
                    {(report?.total_commission || 0).toFixed(2)}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* By Currency */}
            {report?.by_currency && Object.keys(report.by_currency).length > 0 && (
              <div className="mb-6">
                <h3 className="text-xl font-bold text-primary mb-4 border-b pb-2">تفصيل حسب العملة</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(report.by_currency).map(([currency, data]) => (
                    <Card key={currency} className="border-2 border-secondary/30">
                      <CardHeader className="p-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-xl">{currency}</CardTitle>
                          <Badge className="bg-secondary text-primary text-base px-3 py-1">
                            {data.count} حوالة
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">إجمالي المبالغ:</span>
                          <span className="font-bold text-lg">{data.total_amount.toLocaleString()} {currency}</span>
                        </div>
                        <div className="flex justify-between items-center bg-green-100 p-2 rounded">
                          <span className="text-green-800 font-bold">الأرباح:</span>
                          <span className="font-bold text-green-600 text-lg">
                            {data.total_commission.toFixed(2)} {currency}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Transfers */}
            <div>
              <h3 className="text-xl font-bold text-primary mb-4 border-b pb-2">آخر 100 حوالة مكتملة</h3>
              {report?.transfers && report.transfers.length > 0 ? (
                <div className="space-y-3">
                  {report.transfers.map((transfer) => (
                    <div
                      key={transfer.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 bg-muted/30 rounded-lg hover:shadow-md transition-all cursor-pointer gap-2"
                      onClick={() => navigate(`/transfers/${transfer.id}`)}
                    >
                      <div className="space-y-1 w-full sm:w-auto">
                        <p className="font-bold text-base sm:text-lg text-primary">{transfer.transfer_code}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {transfer.sender_name} → {transfer.to_governorate}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(transfer.created_at).toLocaleDateString('ar-IQ', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 w-full sm:w-auto">
                        <p className="text-base sm:text-lg font-bold text-secondary">
                          {transfer.amount.toLocaleString()} {transfer.currency}
                        </p>
                        <div className="bg-green-100 px-2 py-1 rounded">
                          <p className="text-xs sm:text-sm font-bold text-green-700">
                            عمولة: {transfer.commission.toFixed(2)} {transfer.currency}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">لا توجد حوالات مكتملة</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CommissionsPage;
