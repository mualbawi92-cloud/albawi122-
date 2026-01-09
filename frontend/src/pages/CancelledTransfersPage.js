import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import api from '../services/api';


const CancelledTransfersPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [transfers, setTransfers] = useState([]);
  const [auditLogs, setAuditLogs] = useState({});
  const [loading, setLoading] = useState(true);

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
      // Get all cancelled transfers
      const response = await api.get('/transfers?status=cancelled');
      setTransfers(response.data);

      // Get audit logs for cancelled/updated transfers
      const logsResponse = await api.get('/audit-logs?action=transfer_cancelled,transfer_updated&limit=1000');
      
      // Group logs by transfer_id
      const logsMap = {};
      logsResponse.data.forEach(log => {
        if (!logsMap[log.transfer_id]) {
          logsMap[log.transfer_id] = [];
        }
        logsMap[log.transfer_id].push(log);
      });
      
      setAuditLogs(logsMap);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('خطأ في تحميل البيانات');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA]">
        
        <div className="container mx-auto p-6 flex items-center justify-center min-h-[50vh]">
          <div className="text-2xl text-primary">جاري التحميل...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA]" data-testid="cancelled-transfers-page">
      
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Header */}
        <Card className="shadow-lg border-0">
          <CardHeader className="p-6 bg-white">
            <CardTitle className="text-3xl sm:text-4xl font-bold text-gray-900">
              🚫 الحوالات الملغية والمعدلة
            </CardTitle>
            <CardDescription className="text-base mt-2">
              عرض جميع الحوالات التي تم إلغاؤها أو تعديلها من قبل الصيارف
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-red-50 to-red-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-red-700">الحوالات الملغية</p>
                  <p className="text-4xl font-bold text-red-600">{transfers.length}</p>
                </div>
                <div className="text-5xl text-red-500/30">❌</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-700">الحوالات المعدلة</p>
                  <p className="text-4xl font-bold text-blue-600">
                    {Object.values(auditLogs).filter(logs => 
                      logs.some(log => log.action === 'transfer_updated')
                    ).length}
                  </p>
                </div>
                <div className="text-5xl text-blue-500/30">✏️</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transfers List */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-white border-b">
            <CardTitle className="text-2xl font-bold text-gray-900">
              📋 قائمة الحوالات
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {transfers.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                لا توجد حوالات ملغية
              </div>
            ) : (
              <div className="divide-y">
                {transfers.map((transfer) => {
                  const logs = auditLogs[transfer.id] || [];
                  const wasEdited = logs.some(log => log.action === 'transfer_updated');
                  
                  return (
                    <div key={transfer.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex flex-col md:flex-row md:items-start gap-4">
                        {/* Transfer Info */}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <p className="text-2xl font-bold text-primary">
                              {transfer.transfer_code}
                            </p>
                            <Badge className="bg-red-100 text-red-800">❌ ملغاة</Badge>
                            {wasEdited && (
                              <Badge className="bg-blue-100 text-blue-800">✏️ تم التعديل</Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-gray-600">من:</span>
                              <span className="font-bold mr-2">{transfer.sender_name}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">إلى:</span>
                              <span className="font-bold mr-2">{transfer.receiver_name}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">المبلغ:</span>
                              <span className="font-bold text-red-600 mr-2">
                                {transfer.amount.toLocaleString()} {transfer.currency}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600">الصيرفة:</span>
                              <span className="font-bold mr-2">{transfer.from_agent_name}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">تاريخ الإنشاء:</span>
                              <span className="mr-2">
                                {new Date(transfer.created_at).toLocaleDateString('ar-IQ', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            {transfer.cancelled_at && (
                              <div>
                                <span className="text-gray-600">تاريخ الإلغاء:</span>
                                <span className="text-red-600 font-bold mr-2">
                                  {new Date(transfer.cancelled_at).toLocaleDateString('ar-IQ', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            )}
                            {transfer.cancelled_by_name && (
                              <div>
                                <span className="text-gray-600">ألغيت بواسطة:</span>
                                <span className="font-bold text-red-600 mr-2">
                                  {transfer.cancelled_by_name}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Audit Logs */}
                          {logs.length > 0 && (
                            <div className="mt-4 bg-gray-50 rounded-lg p-4">
                              <p className="font-bold text-sm text-gray-700 mb-2">📝 سجل الإجراءات:</p>
                              <div className="space-y-2">
                                {logs.map((log, index) => (
                                  <div key={index} className="text-xs bg-white p-2 rounded border">
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold">
                                        {log.action === 'transfer_cancelled' ? '❌ إلغاء' : '✏️ تعديل'}
                                      </span>
                                      <span className="text-gray-600">
                                        {new Date(log.created_at).toLocaleString('ar-IQ')}
                                      </span>
                                    </div>
                                    {log.action === 'transfer_updated' && log.details?.old_values && (
                                      <div className="mt-2 text-xs space-y-1">
                                        <p className="font-bold text-blue-700">التعديلات:</p>
                                        {log.details.new_values.sender_name && (
                                          <p>اسم المرسل: {log.details.old_values.sender_name} → {log.details.new_values.sender_name}</p>
                                        )}
                                        {log.details.new_values.receiver_name && (
                                          <p>اسم المستلم: {log.details.old_values.receiver_name} → {log.details.new_values.receiver_name}</p>
                                        )}
                                        {log.details.new_values.amount && (
                                          <p>المبلغ: {log.details.old_values.amount} → {log.details.new_values.amount}</p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div>
                          <Button
                            onClick={() => navigate('/transfers/${transfer.id}')}
                            variant="outline"
                            size="sm"
                            className="w-full md:w-auto"
                          >
                            🔍 التفاصيل
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Back Button */}
        <div className="flex justify-center">
          <Button
            onClick={() => navigate('/admin/dashboard')}
            variant="outline"
            className="border-2"
          >
            العودة للوحة المدير
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CancelledTransfersPage;
