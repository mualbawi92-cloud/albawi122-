import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import Navbar from '../components/Navbar';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const QuickReceiveTransferPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [transferNumber, setTransferNumber] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState(1); // 1: enter number, 2: enter PIN, 3: show details
  const [loading, setLoading] = useState(false);
  const [transfer, setTransfer] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSearchByNumber = async () => {
    if (!transferNumber || transferNumber.length !== 10) {
      toast.error('يرجى إدخال رقم الحوالة المكون من 10 أرقام');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`${API}/transfers/search/${transferNumber}`);
      
      if (response.data && response.data.status === 'pending') {
        setTransfer(response.data);
        setStep(2); // الانتقال لإدخال PIN
        toast.success('تم العثور على الحوالة - يرجى إدخال كود الحوالة');
      } else if (response.data && response.data.status !== 'pending') {
        toast.error('هذه الحوالة تم تسليمها مسبقاً أو ملغاة');
      } else {
        toast.error('لم يتم العثور على الحوالة');
      }
    } catch (error) {
      console.error('Error searching transfer:', error);
      toast.error('لم يتم العثور على الحوالة بهذا الرقم');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPin = async () => {
    if (!pin || pin.length !== 4) {
      toast.error('يرجى إدخال كود الحوالة المكون من 4 أرقام');
      return;
    }

    setLoading(true);
    try {
      // Verify PIN
      const response = await axios.post(`${API}/transfers/${transfer.id}/verify-pin`, {
        pin: pin
      });

      if (response.data.valid) {
        setStep(3); // عرض التفاصيل
        toast.success('تم التحقق بنجاح - يمكنك الآن استلام الحوالة');
      } else {
        toast.error('كود الحوالة غير صحيح');
        setPin('');
      }
    } catch (error) {
      console.error('Error verifying PIN:', error);
      toast.error('كود الحوالة غير صحيح');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleReceiveTransfer = async () => {
    setSubmitting(true);
    try {
      await axios.post(`${API}/transfers/${transfer.id}/receive`, {
        pin: pin
      });

      toast.success('تم تسليم الحوالة بنجاح ✅');
      // Reset form
      setTransferNumber('');
      setPin('');
      setTransfer(null);
      setStep(1);
    } catch (error) {
      console.error('Error receiving transfer:', error);
      toast.error(error.response?.data?.detail || 'خطأ في تسليم الحوالة');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount, currency = 'IQD') => {
    return `${amount?.toLocaleString() || 0} ${currency}`;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('ar-IQ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-background" data-testid="quick-receive-page">
      <Navbar />
      <div className="container mx-auto p-4 sm:p-6">
        <Card className="shadow-xl">
          <CardHeader className="bg-gradient-to-l from-green-50 to-green-100 border-b-4 border-green-500">
            <CardTitle className="text-2xl sm:text-3xl text-green-800">
              ⚡ تسليم حوالة سريع
            </CardTitle>
            <CardDescription className="text-base text-green-700">
              ابحث عن الحوالة وسلمها بشكل مباشر وسريع
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {/* Search Section */}
            <div className="bg-gradient-to-l from-blue-50 to-blue-100 rounded-xl p-6 mb-6 border-2 border-blue-200">
              <h3 className="text-xl font-bold text-blue-800 mb-4">🔍 البحث عن الحوالة</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="receiver-name" className="text-base font-semibold">
                    🙋 البحث باسم المستلم
                  </Label>
                  <Input
                    id="receiver-name"
                    type="text"
                    value={searchReceiverName}
                    onChange={(e) => setSearchReceiverName(e.target.value)}
                    placeholder="أدخل اسم المستلم..."
                    className="h-12 text-base"
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="transfer-id" className="text-base font-semibold">
                    🔢 البحث برقم الحوالة
                  </Label>
                  <Input
                    id="transfer-id"
                    type="text"
                    value={searchTransferId}
                    onChange={(e) => setSearchTransferId(e.target.value)}
                    placeholder="أدخل رقم الحوالة..."
                    className="h-12 text-base"
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
              </div>
              
              <Button
                onClick={handleSearch}
                disabled={loading}
                className="w-full md:w-auto h-12 bg-blue-600 hover:bg-blue-700 text-white text-base font-bold px-8"
              >
                {loading ? '🔄 جاري البحث...' : '🔍 بحث'}
              </Button>
            </div>

            {/* Results Section */}
            {transfers.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-gray-800 mb-4">
                  📋 نتائج البحث ({transfers.length} حوالة)
                </h3>
                
                {/* Desktop View - Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-green-100 border-b-2 border-green-300">
                        <th className="p-3 text-right">رقم الحوالة</th>
                        <th className="p-3 text-right">المرسل</th>
                        <th className="p-3 text-right">المستلم</th>
                        <th className="p-3 text-right">المبلغ</th>
                        <th className="p-3 text-right">تاريخ الإرسال</th>
                        <th className="p-3 text-center">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transfers.map((transfer) => (
                        <tr key={transfer.transfer_id} className="border-b hover:bg-green-50">
                          <td className="p-3 font-bold text-blue-600">
                            {transfer.transfer_id}
                          </td>
                          <td className="p-3">{transfer.sender_name}</td>
                          <td className="p-3 font-semibold text-green-700">
                            {transfer.receiver_name}
                          </td>
                          <td className="p-3 font-bold">
                            {formatCurrency(transfer.receiving_amount, transfer.receiving_currency)}
                          </td>
                          <td className="p-3 text-sm">{formatDate(transfer.created_at)}</td>
                          <td className="p-3 text-center">
                            <Button
                              onClick={() => handleOpenModal(transfer)}
                              className="bg-green-600 hover:bg-green-700 text-white font-bold"
                            >
                              📥 تسليم
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View - Cards */}
                <div className="md:hidden space-y-4">
                  {transfers.map((transfer) => (
                    <Card key={transfer.transfer_id} className="border-2 border-green-200">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs text-gray-500">رقم الحوالة</p>
                              <p className="text-base font-bold text-blue-600">
                                {transfer.transfer_id}
                              </p>
                            </div>
                            <Button
                              onClick={() => handleOpenModal(transfer)}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white font-bold"
                            >
                              📥 تسليم
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-gray-500">المرسل</p>
                              <p className="text-sm font-semibold">{transfer.sender_name}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">المستلم</p>
                              <p className="text-sm font-semibold text-green-700">
                                {transfer.receiver_name}
                              </p>
                            </div>
                          </div>
                          
                          <div className="bg-green-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">المبلغ</p>
                            <p className="text-xl font-bold text-green-700">
                              {formatCurrency(transfer.receiving_amount, transfer.receiving_currency)}
                            </p>
                          </div>
                          
                          <div>
                            <p className="text-xs text-gray-500">تاريخ الإرسال</p>
                            <p className="text-sm">{formatDate(transfer.created_at)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {!loading && transfers.length === 0 && (searchReceiverName || searchTransferId) && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🔍</div>
                <p className="text-xl text-muted-foreground">
                  لم يتم العثور على حوالات جاهزة للتسليم
                </p>
              </div>
            )}

            {!searchReceiverName && !searchTransferId && transfers.length === 0 && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">⚡</div>
                <p className="text-xl text-muted-foreground">
                  أدخل اسم المستلم أو رقم الحوالة للبحث
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Receive Transfer Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl text-green-700">📥 تسليم الحوالة</DialogTitle>
            <DialogDescription>
              تأكيد تسليم الحوالة للمستلم
            </DialogDescription>
          </DialogHeader>
          
          {selectedTransfer && (
            <div className="space-y-4 py-4">
              {/* Transfer Details */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">رقم الحوالة</p>
                    <p className="font-bold text-blue-600">{selectedTransfer.transfer_id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">المرسل</p>
                    <p className="font-semibold">{selectedTransfer.sender_name}</p>
                  </div>
                </div>
                
                <div>
                  <p className="text-xs text-gray-500">المستلم</p>
                  <p className="font-bold text-green-700 text-lg">
                    {selectedTransfer.receiver_name}
                  </p>
                </div>
              </div>

              {/* Receiving Amount */}
              <div className="space-y-2">
                <Label htmlFor="receiving-amount" className="text-base font-semibold">
                  💵 مبلغ الاستلام ({selectedTransfer.receiving_currency})
                </Label>
                <Input
                  id="receiving-amount"
                  type="number"
                  value={receivingAmount}
                  onChange={(e) => setReceivingAmount(e.target.value)}
                  className="h-12 text-lg font-bold"
                  placeholder="أدخل المبلغ..."
                />
              </div>

              {/* Commission Info */}
              {selectedTransfer.incoming_commission > 0 && (
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-sm text-green-700 font-semibold">
                    💰 العمولة: {formatCurrency(selectedTransfer.incoming_commission, selectedTransfer.receiving_currency)}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleReceiveTransfer}
                  disabled={submitting}
                  className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white font-bold text-base"
                >
                  {submitting ? '⏳ جاري التسليم...' : '✅ تأكيد التسليم'}
                </Button>
                <Button
                  onClick={() => setModalOpen(false)}
                  disabled={submitting}
                  variant="outline"
                  className="flex-1 h-12 font-bold text-base"
                >
                  ❌ إلغاء
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuickReceiveTransferPage;
