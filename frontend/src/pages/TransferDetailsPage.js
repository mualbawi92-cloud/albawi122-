import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import Webcam from 'react-webcam';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import { formatAmountInWords } from '../utils/arabicNumbers';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TransferDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [transfer, setTransfer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReceive, setShowReceive] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [pinData, setPinData] = useState(null);
  const [loadingPin, setLoadingPin] = useState(false);
  
  // Edit and Cancel states
  const [showEdit, setShowEdit] = useState(false);
  const [editData, setEditData] = useState({
    sender_name: '',
    receiver_name: '',
    amount: '',
    note: ''
  });
  const [loadingCancel, setLoadingCancel] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  
  // Receive form states
  const [pin, setPin] = useState('');
  const [receiverFullname, setReceiverFullname] = useState('');
  const [useCamera, setUseCamera] = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // 'user' for front, 'environment' for back
  const [capturedImage, setCapturedImage] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const webcamRef = useRef(null);

  useEffect(() => {
    fetchTransfer();
  }, [id]);

  const fetchTransfer = async () => {
    try {
      const response = await axios.get(`${API}/transfers/${id}`);
      setTransfer(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching transfer:', error);
      toast.error('خطأ في تحميل تفاصيل الحوالة');
      navigate('/transfers');
    }
  };

  const fetchPin = async () => {
    setLoadingPin(true);
    try {
      const response = await axios.get(`${API}/transfers/${id}/pin`);
      setPinData(response.data);
      setShowPin(true);
      toast.success('تم عرض الرقم السري');
    } catch (error) {
      console.error('Error fetching PIN:', error);
      toast.error(error.response?.data?.detail || 'خطأ في عرض الرقم السري');
    } finally {
      setLoadingPin(false);
    }
  };

  const handleCancelTransfer = async () => {
    if (!window.confirm('هل أنت متأكد من إلغاء هذه الحوالة؟')) {
      return;
    }

    setLoadingCancel(true);
    try {
      await axios.patch(`${API}/transfers/${id}/cancel`);
      toast.success('تم إلغاء الحوالة بنجاح. المبلغ تم إرجاعه للمحفظة.');
      fetchTransfer(); // Refresh transfer data
    } catch (error) {
      console.error('Error cancelling transfer:', error);
      toast.error(error.response?.data?.detail || 'خطأ في إلغاء الحوالة');
    } finally {
      setLoadingCancel(false);
    }
  };

  const handleEditTransfer = async (e) => {
    e.preventDefault();
    setLoadingEdit(true);

    try {
      const updateData = {};
      if (editData.sender_name) updateData.sender_name = editData.sender_name;
      if (editData.receiver_name) updateData.receiver_name = editData.receiver_name;
      if (editData.amount) updateData.amount = parseFloat(editData.amount);
      if (editData.note) updateData.note = editData.note;

      await axios.patch(`${API}/transfers/${id}/update`, updateData);
      toast.success('تم تعديل الحوالة بنجاح');
      setShowEdit(false);
      fetchTransfer(); // Refresh transfer data
    } catch (error) {
      console.error('Error updating transfer:', error);
      toast.error(error.response?.data?.detail || 'خطأ في تعديل الحوالة');
    } finally {
      setLoadingEdit(false);
    }
  };

  const captureImage = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setCapturedImage(imageSrc);
        setUseCamera(false);
      } else {
        toast.error('فشل التقاط الصورة. يرجى المحاولة مرة أخرى.');
      }
    }
  };

  const switchCamera = () => {
    setFacingMode(prevMode => prevMode === 'user' ? 'environment' : 'user');
  };

  const handleCameraError = (error) => {
    console.error('Camera error:', error);
    toast.error('خطأ في الوصول إلى الكاميرا. يرجى التحقق من الأذونات.', {
      description: 'تأكد من أن المتصفح لديه إذن الوصول إلى الكاميرا'
    });
    setUseCamera(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('حجم الصورة يجب أن يكون أقل من 5MB');
        return;
      }
      setUploadedFile(file);
      setCapturedImage(null);
    }
  };

  const handleReceiveSubmit = async (e) => {
    e.preventDefault();
    
    if (!pin || !receiverFullname || (!capturedImage && !uploadedFile)) {
      toast.error('يرجى ملء جميع الحقول ورفع صورة الهوية');
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('pin', pin);
      formData.append('receiver_fullname', receiverFullname);

      if (capturedImage) {
        // Convert base64 to blob
        const blob = await fetch(capturedImage).then(r => r.blob());
        formData.append('id_image', blob, 'id_image.jpg');
      } else if (uploadedFile) {
        formData.append('id_image', uploadedFile);
      }

      await axios.post(`${API}/transfers/${id}/receive`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success('تم استلام الحوالة بنجاح!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error receiving transfer:', error);
      toast.error('خطأ', {
        description: error.response?.data?.detail || 'فشل استلام الحوالة'
      });
    }

    setSubmitting(false);
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

  if (loading || !transfer) {
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
    <div className="min-h-screen bg-background" data-testid="transfer-details-page">
      <Navbar />
      <div className="container mx-auto p-6 max-w-4xl">
        <Card className="shadow-2xl">
          <CardHeader className="bg-gradient-to-l from-primary/10 to-primary/5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-3xl text-primary mb-2" data-testid="transfer-code">{transfer.transfer_code}</CardTitle>
                <CardDescription className="text-base">تفاصيل الحوالة</CardDescription>
              </div>
              {getStatusBadge(transfer.status)}
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Transfer Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-muted-foreground">اسم المرسل</Label>
                <p className="text-xl font-bold" data-testid="sender-name">{transfer.sender_name}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">اسم المستلم</Label>
                <p className="text-xl font-bold text-primary" data-testid="receiver-name">
                  {transfer.receiver_name || 'غير محدد'}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">المبلغ</Label>
                <p className="text-3xl font-bold text-secondary" data-testid="amount">
                  {transfer.amount.toLocaleString()} {transfer.currency || 'IQD'}
                </p>
                <p className="text-sm text-gray-600 italic bg-gray-50 p-2 rounded border border-gray-200">
                  💬 {formatAmountInWords(transfer.amount, transfer.currency || 'IQD')}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">من صراف</Label>
                <p className="text-lg font-bold">{transfer.from_agent_name || 'غير محدد'}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">إلى محافظة</Label>
                <p className="text-lg font-bold">{transfer.to_governorate}</p>
              </div>
              {transfer.to_agent_name && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">الصراف المستلم</Label>
                  <p className="text-lg font-bold">{transfer.to_agent_name}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-muted-foreground">تاريخ الإنشاء</Label>
                <p className="text-sm">
                  {new Date(transfer.created_at).toLocaleDateString('ar-IQ', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              {transfer.note && (
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-muted-foreground">ملاحظات</Label>
                  <p>{transfer.note}</p>
                </div>
              )}
            </div>

            {/* Show PIN Button for Sender */}
            {user && transfer.from_agent_id === user.id && !showPin && (
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-yellow-800">
                      🔐 الرقم السري للحوالة
                    </p>
                    <p className="text-xs text-yellow-700">
                      اضغط لعرض الرقم السري الخاص بهذه الحوالة
                    </p>
                  </div>
                  <Button
                    onClick={fetchPin}
                    disabled={loadingPin}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white"
                  >
                    {loadingPin ? 'جاري التحميل...' : '👁️ عرض الرقم السري'}
                  </Button>
                </div>
              </div>
            )}

            {/* PIN Display */}
            {showPin && pinData && (
              <Card className="border-4 border-secondary bg-gradient-to-r from-secondary/10 to-secondary/5">
                <CardHeader>
                  <CardTitle className="text-2xl text-secondary">🔐 معلومات الحوالة</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">رقم الحوالة</Label>
                      <p className="text-2xl font-bold text-primary">{pinData.transfer_code}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">الرقم السري</Label>
                      <p className="text-4xl font-bold text-secondary">{pinData.pin}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">اسم المستلم</Label>
                      <p className="text-lg font-bold">{pinData.receiver_name}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">المبلغ</Label>
                      <p className="text-lg font-bold">{pinData.amount.toLocaleString()} {pinData.currency}</p>
                      <p className="text-xs text-gray-600 italic bg-gray-50 p-2 rounded">
                        💬 {formatAmountInWords(pinData.amount, pinData.currency)}
                      </p>
                    </div>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-300 rounded p-3 text-sm text-yellow-800">
                    ⚠️ <strong>تنبيه:</strong> يمكنك مشاركة رقم الحوالة والرقم السري مع المستلم لإتمام عملية الاستلام
                  </div>
                  <Button
                    onClick={() => setShowPin(false)}
                    variant="outline"
                    className="w-full"
                  >
                    إخفاء الرقم السري
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            {transfer.status === 'pending' && !showReceive && user && transfer.from_agent_id === user.id && (
              <div className="space-y-4">
                {/* Edit and Cancel Buttons for Sender */}
                <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
                  <p className="text-sm font-semibold text-yellow-800 mb-3">
                    ⚠️ أنت مُرسل هذه الحوالة - يمكنك التعديل أو الإلغاء
                  </p>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => {
                        setEditData({
                          sender_name: transfer.sender_name,
                          receiver_name: transfer.receiver_name,
                          amount: transfer.amount,
                          note: transfer.note || ''
                        });
                        setShowEdit(true);
                      }}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      ✏️ تعديل الحوالة
                    </Button>
                    <Button
                      onClick={handleCancelTransfer}
                      disabled={loadingCancel}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    >
                      {loadingCancel ? 'جاري الإلغاء...' : '❌ إلغاء الحوالة'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {transfer.status === 'pending' && !showReceive && user && transfer.from_agent_id !== user.id && (
              <div className="flex gap-4 pt-4">
                <Button
                  onClick={() => setShowReceive(true)}
                  className="flex-1 bg-secondary hover:bg-secondary/90 text-primary text-lg font-bold py-6"
                  data-testid="receive-transfer-btn"
                >
                  ✅ استلام الحوالة
                </Button>
                <Button
                  onClick={() => navigate('/transfers')}
                  variant="outline"
                  className="border-2 text-lg font-bold py-6"
                  data-testid="back-to-list-btn"
                >
                  عودة
                </Button>
              </div>
            )}

            {transfer.status !== 'pending' && (
              <Button
                onClick={() => navigate('/transfers')}
                variant="outline"
                className="w-full border-2 text-lg font-bold py-6"
                data-testid="back-to-list-btn"
              >
                عودة للقائمة
              </Button>
            )}

            {/* Edit Form */}
            {showEdit && transfer.status === 'pending' && (
              <Card className="border-2 border-blue-500">
                <CardHeader className="bg-blue-50">
                  <CardTitle className="text-xl text-blue-900">✏️ تعديل الحوالة</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <form onSubmit={handleEditTransfer} className="space-y-4">
                    <div className="space-y-2">
                      <Label>اسم المرسل</Label>
                      <Input
                        value={editData.sender_name}
                        onChange={(e) => setEditData({...editData, sender_name: e.target.value})}
                        placeholder="اسم المرسل الثلاثي"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>اسم المستلم</Label>
                      <Input
                        value={editData.receiver_name}
                        onChange={(e) => setEditData({...editData, receiver_name: e.target.value})}
                        placeholder="اسم المستلم الثلاثي"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>المبلغ</Label>
                      <Input
                        type="number"
                        value={editData.amount}
                        onChange={(e) => setEditData({...editData, amount: e.target.value})}
                        placeholder="المبلغ"
                      />
                      <p className="text-xs text-yellow-700">
                        ⚠️ تعديل المبلغ سيؤثر على رصيد محفظتك
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>ملاحظة</Label>
                      <Input
                        value={editData.note}
                        onChange={(e) => setEditData({...editData, note: e.target.value})}
                        placeholder="ملاحظة"
                      />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <Button
                        type="submit"
                        disabled={loadingEdit}
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                      >
                        {loadingEdit ? 'جاري التعديل...' : '💾 حفظ التعديلات'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowEdit(false)}
                        className="flex-1"
                      >
                        إلغاء
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Receive Form */}
            {showReceive && transfer.status === 'pending' && (
              <Card className="border-2 border-secondary" data-testid="receive-form">
                <CardHeader className="bg-secondary/10">
                  <CardTitle className="text-2xl text-primary">استلام الحوالة</CardTitle>
                  <CardDescription>يرجى إدخال PIN وبيانات المستلم</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <form onSubmit={handleReceiveSubmit} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="pin" className="text-base font-bold">PIN (4 أرقام) *</Label>
                      <Input
                        id="pin"
                        data-testid="pin-input"
                        type="password"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        maxLength={6}
                        className="text-2xl tracking-widest h-14 text-center font-bold"
                        placeholder="أدخل PIN"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="fullname" className="text-base font-bold">الاسم الثلاثي للمستلم *</Label>
                      <Input
                        id="fullname"
                        data-testid="fullname-input"
                        value={receiverFullname}
                        onChange={(e) => setReceiverFullname(e.target.value)}
                        className="text-base h-12"
                        placeholder="أدخل الاسم الثلاثي"
                        required
                      />
                    </div>

                    <div className="space-y-4">
                      <Label className="text-base font-bold">صورة الهوية *</Label>
                      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-3">
                        <p className="text-sm font-bold text-blue-900 mb-2">📋 الهويات المقبولة:</p>
                        <ul className="text-xs text-blue-800 space-y-1 mr-4">
                          <li>✅ البطاقة المدنية الموحدة العراقية (خلفية وردية)</li>
                          <li>✅ البطاقة الوطنية العراقية (خلفية زرقاء/خضراء)</li>
                          <li>✅ إجازة السوق العراقية</li>
                          <li>✅ جواز السفر العراقي</li>
                        </ul>
                        <p className="text-xs text-blue-700 mt-3 font-bold">⚠️ تعليمات مهمة:</p>
                        <ul className="text-xs text-blue-700 space-y-1 mr-4 mt-1">
                          <li>• التقط صورة واضحة للهوية الأصلية</li>
                          <li>• تأكد من ظهور الصورة الشخصية والأرقام بوضوح</li>
                          <li>• إضاءة جيدة بدون ظلال</li>
                          <li>• الصورة مستقيمة وليست مائلة</li>
                        </ul>
                        <p className="text-xs text-green-700 mt-3">
                          🔒 جميع الصور محمية ومشفرة
                        </p>
                      </div>
                      
                      <div className="flex gap-4">
                        <Button
                          type="button"
                          onClick={() => {
                            setCapturedImage(null);
                            setUseCamera(true);
                          }}
                          variant="outline"
                          className="flex-1 h-12"
                          data-testid="camera-btn"
                        >
                          📷 فتح الكاميرا
                        </Button>
                        <Button
                          type="button"
                          onClick={() => document.getElementById('file-upload').click()}
                          variant="outline"
                          className="flex-1 h-12"
                          data-testid="upload-btn"
                        >
                          📄 رفع ملف
                        </Button>
                        <input
                          id="file-upload"
                          type="file"
                          accept="image/jpeg,image/png,image/jpg"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </div>

                      {/* Camera Full Screen Modal */}
                      {useCamera && (
                        <div className="fixed inset-0 z-[9999] bg-black">
                          {/* Header */}
                          <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black via-black/80 to-transparent p-4 safe-area-top">
                            <div className="flex items-center justify-between text-white">
                              <h3 className="text-lg font-bold">📷 التقاط صورة الهوية</h3>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setUseCamera(false)}
                                className="text-white hover:bg-white/20 text-2xl px-4"
                              >
                                ✕
                              </Button>
                            </div>
                          </div>

                          {/* Camera View */}
                          <div className="w-full h-full flex items-center justify-center">
                            <Webcam
                              ref={webcamRef}
                              audio={false}
                              screenshotFormat="image/jpeg"
                              screenshotQuality={0.95}
                              videoConstraints={{
                                facingMode: facingMode,
                                width: { min: 640, ideal: 1280, max: 1920 },
                                height: { min: 480, ideal: 720, max: 1080 },
                              }}
                              onUserMediaError={handleCameraError}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                              }}
                            />
                          </div>

                          {/* Controls */}
                          <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black via-black/80 to-transparent p-6 pb-8 safe-area-bottom">
                            <div className="flex items-center justify-center gap-6 mb-4">
                              {/* Switch Camera Button */}
                              <Button
                                type="button"
                                onClick={switchCamera}
                                size="lg"
                                className="h-16 w-16 rounded-full bg-white/30 text-white border-2 border-white hover:bg-white/40 backdrop-blur-sm flex items-center justify-center"
                              >
                                <span className="text-2xl">🔄</span>
                              </Button>

                              {/* Capture Button */}
                              <Button
                                type="button"
                                onClick={captureImage}
                                size="lg"
                                className="h-20 w-20 rounded-full bg-white hover:bg-gray-200 border-4 border-secondary shadow-2xl flex items-center justify-center"
                                data-testid="capture-btn"
                              >
                                <span className="text-3xl">📸</span>
                              </Button>

                              {/* Gallery Button */}
                              <Button
                                type="button"
                                onClick={() => {
                                  setUseCamera(false);
                                  document.getElementById('file-upload').click();
                                }}
                                size="lg"
                                className="h-16 w-16 rounded-full bg-white/30 text-white border-2 border-white hover:bg-white/40 backdrop-blur-sm flex items-center justify-center"
                              >
                                <span className="text-2xl">🖼️</span>
                              </Button>
                            </div>
                            
                            <p className="text-center text-white text-base font-bold drop-shadow-lg">
                              {facingMode === 'user' ? '📱 الكاميرا الأمامية' : '📷 الكاميرا الخلفية'}
                            </p>
                            <p className="text-center text-white/70 text-sm mt-2">
                              اضغط على زر 🔄 للتبديل بين الكاميرات
                            </p>
                          </div>
                        </div>
                      )}

                      {capturedImage && (
                        <div className="space-y-2">
                          <p className="text-sm text-green-600 font-bold">✔ تم التقاط الصورة</p>
                          <img src={capturedImage} alt="Captured" className="w-full rounded-lg border-2 border-green-500" />
                          <Button
                            type="button"
                            onClick={() => setCapturedImage(null)}
                            variant="outline"
                            size="sm"
                            className="w-full"
                          >
                            🗑️ حذف الصورة وإعادة الالتقاط
                          </Button>
                        </div>
                      )}

                      {uploadedFile && (
                        <p className="text-sm text-green-600 font-bold">✔ تم رفع الملف: {uploadedFile.name}</p>
                      )}
                    </div>

                    <div className="flex gap-4 pt-4">
                      <Button
                        type="button"
                        onClick={() => setShowReceive(false)}
                        variant="outline"
                        className="flex-1 border-2"
                        data-testid="cancel-receive-btn"
                      >
                        إلغاء
                      </Button>
                      <Button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 bg-secondary hover:bg-secondary/90 text-primary font-bold text-lg"
                        data-testid="submit-receive-btn"
                      >
                        {submitting ? 'جاري المعالجة...' : 'تأكيد الاستلام'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TransferDetailsPage;