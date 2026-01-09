import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { toast } from 'sonner';
import api from '../services/api';


const QuickReceiveTransferPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [transferNumber, setTransferNumber] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState(1); // 1: enter number, 2: enter PIN, 3: show details
  const [loading, setLoading] = useState(false);
  const [transfer, setTransfer] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [idImage, setIdImage] = useState(null);
  const [idImagePreview, setIdImagePreview] = useState(null);
  const [nameVerification, setNameVerification] = useState(null);
  const [receiverPhone, setReceiverPhone] = useState('');

  const handleSearchByNumber = async () => {
    if (!transferNumber || transferNumber.length !== 10) {
      toast.error('يرجى إدخال رقم الحوالة المكون من 10 أرقام');
      return;
    }

    setLoading(true);
    try {
      const response = await api.get('/transfers/search/${transferNumber}');
      
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
    if (pin.length !== 4) {
      toast.error('يرجى إدخال كود الحوالة المكون من 4 أرقام');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/transfers/${transfer.id}/verify-pin', {
        pin: pin
      });

      if (response.data.valid) {
        toast.success('✅ تم التحقق بنجاح');
        // Set receiver phone from transfer data
        setReceiverPhone(transfer.receiver_phone || '');
        setStep(3);
      } else {
        toast.error('كود الحوالة غير صحيح');
      }
    } catch (error) {
      console.error('Error verifying PIN:', error);
      toast.error(error.response?.data?.detail || 'خطأ في التحقق من كود الحوالة');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setIdImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setIdImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
      
      // Verify name from ID image
      verifyNameFromImage(file);
    }
  };

  const handleCaptureImage = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      // Wait for video to load
      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
      });

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);

      // Stop camera
      stream.getTracks().forEach(track => track.stop());

      // Convert to blob
      canvas.toBlob((blob) => {
        const file = new File([blob], 'id-photo.jpg', { type: 'image/jpeg' });
        setIdImage(file);
        setIdImagePreview(canvas.toDataURL('image/jpeg'));
        
        // Verify name from captured image
        verifyNameFromImage(file);
      }, 'image/jpeg');
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('لا يمكن الوصول إلى الكاميرا');
    }
  };

  const verifyNameFromImage = async (imageFile) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('id_image', imageFile);
      formData.append('receiver_name', transfer.receiver_name);

      const response = await api.post('/transfers/verify-id-name', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setNameVerification(response.data);
      
      if (response.data.match_status === 'exact_match') {
        toast.success('✅ الاسم مطابق بشكل كامل');
      } else if (response.data.match_status === 'partial_match') {
        toast.warning('⚠️ الاسم مطابق جزئياً - يرجى التحقق');
      } else if (response.data.match_status === 'no_match') {
        toast.error('❌ الاسم غير مطابق - لا يمكن التسليم');
      }
    } catch (error) {
      console.error('Error verifying name:', error);
      toast.error('خطأ في التحقق من الاسم');
    } finally {
      setLoading(false);
    }
  };

  const handleReceiveTransfer = async () => {
    if (!idImage) {
      toast.error('يرجى إرفاق صورة الهوية');
      return;
    }

    if (!nameVerification) {
      toast.error('يرجى انتظار التحقق من الاسم');
      return;
    }

    if (nameVerification.match_status === 'no_match') {
      toast.error('لا يمكن تسليم الحوالة - الاسم غير مطابق');
      return;
    }

    if (!receiverPhone || receiverPhone.length < 10) {
      toast.error('يرجى إدخال رقم هاتف صحيح للمستفيد');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('pin', pin);
      formData.append('id_image', idImage);
      formData.append('receiver_phone', receiverPhone);
      formData.append('name_verification', JSON.stringify(nameVerification));

      await api.post('/transfers/${transfer.id}/receive-with-id', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('تم تسليم الحوالة بنجاح ✅');
      // Reset form
      setTransferNumber('');
      setPin('');
      setTransfer(null);
      setIdImage(null);
      setIdImagePreview(null);
      setNameVerification(null);
      setReceiverPhone('');
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
      
      <div className="container mx-auto p-4 sm:p-6 max-w-4xl">
        <Card className="shadow-xl">
          <CardHeader className="bg-gradient-to-l from-green-50 to-green-100 border-b-4 border-green-500">
            <CardTitle className="text-2xl sm:text-3xl text-green-800">
              📥 تسليم حوالة واردة
            </CardTitle>
            <CardDescription className="text-base text-green-700">
              أدخل رقم الحوالة وكود التحقق لتسليم الحوالة
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {/* Step 1: Enter Transfer Number */}
            {step === 1 && (
              <div className="bg-gradient-to-l from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-200">
                <h3 className="text-xl font-bold text-blue-800 mb-4">🔢 الخطوة 1: أدخل رقم الحوالة</h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="transfer-number" className="text-base font-semibold">
                      رقم الحوالة (10 أرقام)
                    </Label>
                    <Input
                      id="transfer-number"
                      type="text"
                      value={transferNumber}
                      onChange={(e) => setTransferNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="أدخل رقم الحوالة المكون من 10 أرقام..."
                      className="h-14 text-lg text-center font-bold"
                      maxLength={10}
                      dir="ltr"
                      onKeyPress={(e) => e.key === 'Enter' && handleSearchByNumber()}
                    />
                  </div>
                  
                  <Button
                    onClick={handleSearchByNumber}
                    disabled={loading || transferNumber.length !== 10}
                    className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold"
                  >
                    {loading ? '🔄 جاري البحث...' : '➡️ التالي'}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Enter PIN */}
            {step === 2 && transfer && (
              <div className="space-y-6">
                <div className="bg-green-50 rounded-xl p-6 border-2 border-green-200">
                  <h3 className="text-xl font-bold text-green-800 mb-4">✅ تم العثور على الحوالة</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">المرسل:</span>
                      <span className="font-bold ml-2">{transfer.sender_name}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">المستفيد:</span>
                      <span className="font-bold ml-2">{transfer.receiver_name}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">المبلغ:</span>
                      <span className="font-bold ml-2">{transfer.amount.toLocaleString()} {transfer.currency}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-l from-orange-50 to-orange-100 rounded-xl p-6 border-2 border-orange-200">
                  <h3 className="text-xl font-bold text-orange-800 mb-4">🔐 الخطوة 2: أدخل كود الحوالة</h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="pin" className="text-base font-semibold">
                        كود الحوالة (4 أرقام)
                      </Label>
                      <Input
                        id="pin"
                        type="password"
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="••••"
                        className="h-14 text-2xl text-center font-bold tracking-widest"
                        maxLength={4}
                        dir="ltr"
                        onKeyPress={(e) => e.key === 'Enter' && handleVerifyPin()}
                      />
                    </div>
                    
                    <div className="flex gap-3">
                      <Button
                        onClick={() => {
                          setStep(1);
                          setPin('');
                          setTransfer(null);
                        }}
                        variant="outline"
                        className="flex-1 h-12"
                      >
                        ↩️ رجوع
                      </Button>
                      <Button
                        onClick={handleVerifyPin}
                        disabled={loading || pin.length !== 4}
                        className="flex-1 h-12 bg-orange-600 hover:bg-orange-700 text-white font-bold"
                      >
                        {loading ? '🔄 جاري التحقق...' : '✅ تحقق'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Show Details & Confirm */}
            {step === 3 && transfer && (
              <div className="space-y-4">
                {/* Header: رقم الحوالة وكود الحوالة */}
                <div className="flex justify-between items-center pb-3 border-b-2 border-gray-200">
                  <div>
                    <Label className="text-xs text-muted-foreground">رقم الحوالة</Label>
                    <p className="text-base font-bold text-blue-600">{transfer.tracking_number || transfer.transfer_number}</p>
                  </div>
                  <div className="text-left">
                    <Label className="text-xs text-muted-foreground">كود الحوالة</Label>
                    <p className="text-base font-bold text-secondary">{transfer.transfer_code}</p>
                  </div>
                </div>

                {/* السطر الأول: معلومات المرسل والمستفيد */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                  {/* معلومات المرسل - 6 أعمدة */}
                  <div className="col-span-1 md:col-span-2 space-y-1">
                    <Label className="text-xs font-bold">اسم المرسل</Label>
                    <div className="h-9 flex items-center px-2 bg-gray-50 border rounded-md">
                      <p className="text-xs font-bold">{transfer.sender_name}</p>
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-2 space-y-1">
                    <Label className="text-xs font-bold">رقم هاتف المرسل</Label>
                    <div className="h-9 flex items-center px-2 bg-gray-50 border rounded-md">
                      <p className="text-xs font-bold" dir="ltr">{transfer.sender_phone || '-'}</p>
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-2 space-y-1">
                    <Label className="text-xs font-bold">مدينة الإرسال</Label>
                    <div className="h-9 flex items-center px-2 bg-gray-50 border rounded-md">
                      <p className="text-xs font-bold">{transfer.sending_city || '-'}</p>
                    </div>
                  </div>

                  {/* معلومات المستفيد - 6 أعمدة */}
                  <div className="col-span-1 md:col-span-2 space-y-1">
                    <Label className="text-xs font-bold">اسم المستفيد</Label>
                    <div className="h-9 flex items-center px-2 bg-gray-50 border rounded-md">
                      <p className="text-xs font-bold">{transfer.receiver_name}</p>
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-2 space-y-1">
                    <Label className="text-xs font-bold">رقم هاتف المستفيد *</Label>
                    <Input
                      type="tel"
                      value={receiverPhone}
                      onChange={(e) => setReceiverPhone(e.target.value)}
                      className="h-9 text-xs font-bold"
                      dir="ltr"
                      placeholder="07XXXXXXXXX"
                    />
                  </div>

                  <div className="col-span-1 md:col-span-2 space-y-1">
                    <Label className="text-xs font-bold">مدينة الاستلام</Label>
                    <div className="h-9 flex items-center px-2 bg-gray-50 border rounded-md">
                      <p className="text-xs font-bold">{transfer.receiving_city || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* السطر الثاني: المبلغ والعملة والعمولة */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                  <div className="col-span-1 md:col-span-3 space-y-1">
                    <Label className="text-xs font-bold">المبلغ</Label>
                    <div className="h-9 flex items-center px-2 bg-green-50 border-2 border-green-300 rounded-md">
                      <p className="text-base font-bold text-green-700">{transfer.amount.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-1 space-y-1">
                    <Label className="text-xs font-bold">العملة</Label>
                    <div className="h-9 flex items-center px-2 bg-gray-50 border rounded-md">
                      <p className="text-xs font-bold">{transfer.currency}</p>
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-2 space-y-1">
                    <Label className="text-xs font-bold">العمولة</Label>
                    <div className="h-9 flex items-center px-2 bg-blue-50 border border-blue-300 rounded-md">
                      <p className="text-xs font-bold text-blue-700">{transfer.incoming_commission?.toLocaleString() || 0}</p>
                    </div>
                  </div>
                </div>

                {/* ID Image Upload Section */}
                <div className="bg-blue-50 rounded-xl p-6 border-2 border-blue-300">
                  <h3 className="text-xl font-bold text-blue-800 mb-4">📸 صورة الهوية</h3>
                  
                  <div className="space-y-4">
                    {/* Image Preview */}
                    {idImagePreview && (
                      <div className="relative">
                        <img 
                          src={idImagePreview} 
                          alt="معاينة الهوية" 
                          className="w-full h-64 object-contain border-2 border-gray-300 rounded-lg bg-white"
                        />
                        {nameVerification && (
                          <div className={`mt-3 p-3 rounded-lg ${
                            nameVerification.match_status === 'exact_match' ? 'bg-green-100 border-green-400' :
                            nameVerification.match_status === 'partial_match' ? 'bg-yellow-100 border-yellow-400' :
                            'bg-red-100 border-red-400'
                          } border-2`}>
                            <p className="font-bold text-sm mb-1">
                              {nameVerification.match_status === 'exact_match' ? '✅ الاسم مطابق بشكل كامل' :
                               nameVerification.match_status === 'partial_match' ? '⚠️ الاسم مطابق جزئياً' :
                               '❌ الاسم غير مطابق'}
                            </p>
                            <p className="text-xs">الاسم في الهوية: {nameVerification.extracted_name || 'غير متوفر'}</p>
                            <p className="text-xs">الاسم المطلوب: {transfer.receiver_name}</p>
                            {nameVerification.match_status === 'partial_match' && (
                              <p className="text-xs mt-2 font-semibold text-yellow-800">
                                ⚠️ يرجى التحقق من المستفيد قبل التسليم
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Upload Buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <input
                          type="file"
                          id="id-image-input"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          onClick={() => document.getElementById('id-image-input').click()}
                          variant="outline"
                          className="w-full h-12 border-2 border-blue-400 hover:bg-blue-50"
                          disabled={loading}
                        >
                          📁 إرفاق صورة الهوية
                        </Button>
                      </div>
                      
                      <Button
                        type="button"
                        onClick={handleCaptureImage}
                        variant="outline"
                        className="w-full h-12 border-2 border-blue-400 hover:bg-blue-50"
                        disabled={loading}
                      >
                        📷 التقاط صورة
                      </Button>
                    </div>
                    
                    {loading && (
                      <p className="text-center text-sm text-blue-600">⏳ جاري التحقق من الاسم...</p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      setStep(1);
                      setPin('');
                      setTransfer(null);
                      setTransferNumber('');
                      setIdImage(null);
                      setIdImagePreview(null);
                      setNameVerification(null);
                    }}
                    variant="outline"
                    className="flex-1 h-14 text-lg"
                  >
                    ❌ إلغاء
                  </Button>
                  <Button
                    onClick={handleReceiveTransfer}
                    disabled={submitting || !idImage || !nameVerification || nameVerification.match_status === 'no_match'}
                    className="flex-1 h-14 bg-green-600 hover:bg-green-700 text-white text-lg font-bold disabled:bg-gray-400"
                  >
                    {submitting ? '⏳ جاري التسليم...' : '✅ تأكيد التسليم'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default QuickReceiveTransferPage;
