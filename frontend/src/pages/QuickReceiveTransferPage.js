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
  const [idImage, setIdImage] = useState(null);
  const [idImagePreview, setIdImagePreview] = useState(null);
  const [nameVerification, setNameVerification] = useState(null);

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

      const response = await axios.post(`${API}/transfers/verify-id-name`, formData, {
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

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('pin', pin);
      formData.append('id_image', idImage);
      formData.append('name_verification', JSON.stringify(nameVerification));

      await axios.post(`${API}/transfers/${transfer.id}/receive-with-id`, formData, {
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
              <div className="space-y-6">
                <div className="bg-green-50 rounded-xl p-6 border-2 border-green-300">
                  <h3 className="text-2xl font-bold text-green-800 mb-6 text-center">✅ تفاصيل الحوالة</h3>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded-lg border">
                        <span className="text-sm text-gray-600">رقم الحوالة</span>
                        <p className="font-bold text-lg">{transfer.tracking_number || transfer.transfer_number}</p>
                      </div>
                      <div className="bg-white p-4 rounded-lg border">
                        <span className="text-sm text-gray-600">رمز الحوالة</span>
                        <p className="font-bold text-lg">{transfer.transfer_code}</p>
                      </div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-lg border">
                      <span className="text-sm text-gray-600">المرسل</span>
                      <p className="font-bold text-lg">{transfer.sender_name}</p>
                    </div>
                    
                    <div className="bg-white p-4 rounded-lg border">
                      <span className="text-sm text-gray-600">المستفيد</span>
                      <p className="font-bold text-lg">{transfer.receiver_name}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded-lg border">
                        <span className="text-sm text-gray-600">المبلغ</span>
                        <p className="font-bold text-2xl text-green-700">{transfer.amount.toLocaleString()} {transfer.currency}</p>
                      </div>
                      <div className="bg-white p-4 rounded-lg border">
                        <span className="text-sm text-gray-600">العمولة</span>
                        <p className="font-bold text-lg">{transfer.incoming_commission?.toLocaleString() || 0} {transfer.currency}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      setStep(1);
                      setPin('');
                      setTransfer(null);
                      setTransferNumber('');
                    }}
                    variant="outline"
                    className="flex-1 h-14 text-lg"
                  >
                    ❌ إلغاء
                  </Button>
                  <Button
                    onClick={handleReceiveTransfer}
                    disabled={submitting}
                    className="flex-1 h-14 bg-green-600 hover:bg-green-700 text-white text-lg font-bold"
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
