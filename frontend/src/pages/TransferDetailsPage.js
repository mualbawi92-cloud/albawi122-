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
    const imageSrc = webcamRef.current.getScreenshot();
    setCapturedImage(imageSrc);
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
                <p className="text-3xl font-bold text-secondary" data-testid="amount">{transfer.amount.toLocaleString()} {transfer.currency || 'IQD'}</p>
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
            {transfer.status === 'pending' && !showReceive && (
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
                      
                      <div className="flex gap-4">
                        <Button
                          type="button"
                          onClick={() => setUseCamera(!useCamera)}
                          variant="outline"
                          className="flex-1"
                          data-testid="camera-btn"
                        >
                          📷 {useCamera ? 'إغلاق الكاميرا' : 'فتح الكاميرا'}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => document.getElementById('file-upload').click()}
                          variant="outline"
                          className="flex-1"
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

                      {useCamera && (
                        <div className="space-y-4">
                          <Webcam
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            className="w-full rounded-lg"
                          />
                          <Button
                            type="button"
                            onClick={captureImage}
                            className="w-full bg-secondary hover:bg-secondary/90 text-primary"
                            data-testid="capture-btn"
                          >
                            📸 التقاط الصورة
                          </Button>
                        </div>
                      )}

                      {capturedImage && (
                        <div className="space-y-2">
                          <p className="text-sm text-green-600 font-bold">✔ تم التقاط الصورة</p>
                          <img src={capturedImage} alt="Captured" className="w-full rounded-lg border-2 border-green-500" />
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