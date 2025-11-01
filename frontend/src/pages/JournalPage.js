import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import PrintButton from '../components/PrintButton';
import AccountingReport from '../components/AccountingReport';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const JournalPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Delete confirmation
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('صلاحية الوصول مرفوضة');
      navigate('/dashboard');
      return;
    }
    fetchEntries();
  }, [user, navigate]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      
      const response = await axios.get(`${API}/accounting/journal-entries`, { params });
      setEntries(response.data.entries || []);
      toast.success('تم تحميل القيود بنجاح');
    } catch (error) {
      console.error('Error fetching entries:', error);
      toast.error('خطأ في تحميل القيود');
    }
    setLoading(false);
  };

  const handleDeleteClick = (entry) => {
    setEntryToDelete(entry);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!entryToDelete) return;

    try {
      await axios.delete(`${API}/accounting/journal-entries/${entryToDelete.id}`);
      toast.success('تم إلغاء القيد بنجاح');
      setShowDeleteDialog(false);
      setEntryToDelete(null);
      fetchEntries();
    } catch (error) {
      console.error('Error deleting entry:', error);
      const errorMsg = error.response?.data?.detail || 'خطأ في إلغاء القيد';
      toast.error(errorMsg);
    }
  };

  const formatCurrency = (amount) => {
    return amount.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <Navbar />
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-l from-blue-50 to-blue-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="text-2xl sm:text-3xl">📖 دفتر اليومية</CardTitle>
                <CardDescription className="text-base">
                  عرض جميع القيود المحاسبية
                </CardDescription>
              </div>
              <Button onClick={() => navigate('/manual-journal-entry')}>
                ➕ قيد جديد
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>من تاريخ</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>إلى تاريخ</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <div className="space-y-2 flex items-end gap-2">
                <Button onClick={fetchEntries} disabled={loading} className="flex-1">
                  {loading ? 'جاري البحث...' : '🔍 بحث'}
                </Button>
                
                {entries.length > 0 && (
                  <PrintButton
                    componentToPrint={
                      <AccountingReport
                        title="📖 دفتر اليومية"
                        subtitle="جميع القيود المحاسبية"
                        dateRange={startDate && endDate ? `من ${startDate} إلى ${endDate}` : 'كل الفترات'}
                        summary={[
                          { 
                            label: 'عدد القيود', 
                            value: entries.length,
                            color: '#dbeafe',
                            borderColor: '#3b82f6',
                            textColor: '#1e40af'
                          },
                          { 
                            label: 'إجمالي المدين', 
                            value: entries.reduce((sum, e) => sum + (e.total_debit || 0), 0).toLocaleString(),
                            color: '#fee2e2',
                            borderColor: '#ef4444',
                            textColor: '#991b1b'
                          },
                          { 
                            label: 'إجمالي الدائن', 
                            value: entries.reduce((sum, e) => sum + (e.total_credit || 0), 0).toLocaleString(),
                            color: '#d1fae5',
                            borderColor: '#10b981',
                            textColor: '#059669'
                          }
                        ]}
                        data={entries.flatMap(entry => 
                          entry.lines?.map((line, idx) => ({
                            entry_number: idx === 0 ? entry.entry_number : '',
                            date: idx === 0 ? entry.date : '',
                            description: idx === 0 ? entry.description : '',
                            account_code: line.account_code,
                            account_name: line.account_name || '-',
                            debit: line.debit,
                            credit: line.credit
                          })) || []
                        )}
                        columns={[
                          { header: 'رقم القيد', field: 'entry_number' },
                          { header: 'التاريخ', field: 'date', render: (val) => val ? new Date(val).toLocaleDateString('ar-IQ') : '' },
                          { header: 'البيان', field: 'description' },
                          { header: 'رمز الحساب', field: 'account_code' },
                          { header: 'اسم الحساب', field: 'account_name' },
                          { header: 'مدين', field: 'debit', align: 'center', render: (val) => val > 0 ? val.toLocaleString() : '-' },
                          { header: 'دائن', field: 'credit', align: 'center', render: (val) => val > 0 ? val.toLocaleString() : '-' }
                        ]}
                      />
                    }
                    buttonText="🖨️"
                    fileName={`journal-${new Date().toISOString().split('T')[0]}.pdf`}
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Entries List */}
        <div className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="p-8 text-center">جاري التحميل...</CardContent>
            </Card>
          ) : entries.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                لا توجد قيود محاسبية
              </CardContent>
            </Card>
          ) : (
            entries.map((entry) => (
              <Card key={entry.id} className="border-2 hover:shadow-lg transition-shadow">
                <CardHeader className="bg-gradient-to-l from-gray-50 to-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">
                        قيد رقم: {entry.entry_number}
                      </CardTitle>
                      <CardDescription>
                        {new Date(entry.date).toLocaleDateString('ar-IQ')} - {entry.description}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteClick(entry)}
                      >
                        🗑️ إلغاء
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="p-2 text-right">رمز الحساب</th>
                          <th className="p-2 text-right">اسم الحساب</th>
                          <th className="p-2 text-center">مدين</th>
                          <th className="p-2 text-center">دائن</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entry.lines?.map((line, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2">{line.account_code}</td>
                            <td className="p-2">{line.account_name || '-'}</td>
                            <td className="p-2 text-center font-bold text-blue-700">
                              {line.debit > 0 ? formatCurrency(line.debit) : '-'}
                            </td>
                            <td className="p-2 text-center font-bold text-green-700">
                              {line.credit > 0 ? formatCurrency(line.credit) : '-'}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t-2 bg-gray-50 font-bold">
                          <td className="p-2" colSpan="2">المجموع</td>
                          <td className="p-2 text-center text-blue-700">
                            {formatCurrency(entry.total_debit)}
                          </td>
                          <td className="p-2 text-center text-green-700">
                            {formatCurrency(entry.total_credit)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>⚠️ تأكيد الإلغاء</DialogTitle>
              <DialogDescription>
                هل أنت متأكد من إلغاء هذا القيد؟
              </DialogDescription>
            </DialogHeader>

            {entryToDelete && (
              <div className="py-4 space-y-2">
                <p><strong>رقم القيد:</strong> {entryToDelete.entry_number}</p>
                <p><strong>الوصف:</strong> {entryToDelete.description}</p>
                <p><strong>المبلغ:</strong> {formatCurrency(entryToDelete.total_debit)}</p>
                <p className="text-red-600 text-sm">
                  ⚠️ سيتم إعادة الأرصدة إلى ما كانت عليه قبل هذا القيد
                </p>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                إلغاء
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm}>
                🗑️ تأكيد الإلغاء
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default JournalPage;
