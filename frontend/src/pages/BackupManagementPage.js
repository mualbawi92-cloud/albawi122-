import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const AUTO_BACKUP_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

const BackupManagementPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState(null);
  const [nextBackupTime, setNextBackupTime] = useState(null);
  const [backupStats, setBackupStats] = useState(null);
  const autoBackupInterval = useRef(null);
  const countdownInterval = useRef(null);

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('صلاحية الوصول مرفوضة - هذه الصفحة للمدير فقط');
      navigate('/dashboard');
      return;
    }

    // Request download permission
    requestDownloadPermission();

    // Load settings from localStorage
    const savedAutoBackup = localStorage.getItem('autoBackupEnabled');
    if (savedAutoBackup === 'true') {
      setAutoBackupEnabled(true);
      startAutoBackup();
    }

    const savedLastBackup = localStorage.getItem('lastBackupTime');
    if (savedLastBackup) {
      setLastBackupTime(new Date(savedLastBackup));
    }

    return () => {
      // Cleanup intervals on unmount
      if (autoBackupInterval.current) {
        clearInterval(autoBackupInterval.current);
      }
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
    };
  }, [user, navigate]);

  // Request permission for automatic downloads
  const requestDownloadPermission = () => {
    toast.info('💾 سيقوم النظام بحفظ النسخ الاحتياطية تلقائياً في مجلد التنزيلات', {
      duration: 5000
    });
  };

  // Perform backup
  const performBackup = async (isManual = false) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/admin/backup/export-all`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const backupData = response.data;
      
      // Store stats
      setBackupStats(backupData.metadata);

      // Create filename with date and time
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `backup_${timestamp}.json`;

      // Create blob and download
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Update last backup time
      const backupTime = new Date();
      setLastBackupTime(backupTime);
      localStorage.setItem('lastBackupTime', backupTime.toISOString());

      // Show success notification
      const message = isManual 
        ? `✅ تم حفظ النسخة الاحتياطية بنجاح!\nالملف: ${filename}`
        : `✅ حفظ تلقائي ناجح - ${now.toLocaleTimeString('ar-IQ')}`;
      
      toast.success(message, {
        duration: 5000
      });

      // Update next backup time if auto-backup is enabled
      if (autoBackupEnabled) {
        const nextTime = new Date(backupTime.getTime() + AUTO_BACKUP_INTERVAL);
        setNextBackupTime(nextTime);
      }

    } catch (error) {
      console.error('Backup error:', error);
      toast.error('❌ فشل في إنشاء النسخة الاحتياطية: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Start auto backup
  const startAutoBackup = () => {
    // Clear existing interval
    if (autoBackupInterval.current) {
      clearInterval(autoBackupInterval.current);
    }
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
    }

    // Set next backup time
    const nextTime = new Date(Date.now() + AUTO_BACKUP_INTERVAL);
    setNextBackupTime(nextTime);

    // Perform immediate backup
    performBackup(false);

    // Set interval for periodic backups
    autoBackupInterval.current = setInterval(() => {
      performBackup(false);
    }, AUTO_BACKUP_INTERVAL);

    // Update countdown every second
    countdownInterval.current = setInterval(() => {
      setNextBackupTime(prev => {
        if (!prev) return null;
        const now = new Date();
        if (prev <= now) {
          return new Date(now.getTime() + AUTO_BACKUP_INTERVAL);
        }
        return prev;
      });
    }, 1000);

    toast.success('🔄 تم تفعيل الحفظ التلقائي - كل 5 دقائق', { duration: 3000 });
  };

  // Stop auto backup
  const stopAutoBackup = () => {
    if (autoBackupInterval.current) {
      clearInterval(autoBackupInterval.current);
      autoBackupInterval.current = null;
    }
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }
    setNextBackupTime(null);
    toast.info('⏸️ تم إيقاف الحفظ التلقائي');
  };

  // Toggle auto backup
  const toggleAutoBackup = () => {
    const newState = !autoBackupEnabled;
    setAutoBackupEnabled(newState);
    localStorage.setItem('autoBackupEnabled', newState.toString());

    if (newState) {
      startAutoBackup();
    } else {
      stopAutoBackup();
    }
  };

  // Calculate time remaining for next backup
  const getTimeRemaining = () => {
    if (!nextBackupTime) return null;
    
    const now = new Date();
    const diff = nextBackupTime - now;
    
    if (diff <= 0) return 'جاري الحفظ...';
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle page unload (save before closing)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (autoBackupEnabled) {
        // Perform final backup before closing
        performBackup(false);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [autoBackupEnabled]);

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <Navbar />
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-l from-purple-50 to-purple-100">
            <CardTitle className="text-2xl sm:text-3xl">💾 إدارة النسخ الاحتياطية</CardTitle>
            <CardDescription className="text-base">
              حفظ تلقائي لجميع بيانات النظام كل 5 دقائق
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Auto Backup Control */}
        <Card>
          <CardHeader>
            <CardTitle>⚙️ إعدادات الحفظ التلقائي</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
              <div>
                <h3 className="font-bold text-lg">الحفظ التلقائي</h3>
                <p className="text-sm text-gray-600">
                  {autoBackupEnabled 
                    ? '🟢 مفعّل - يتم الحفظ كل 5 دقائق' 
                    : '⚪ معطّل - لا يوجد حفظ تلقائي'}
                </p>
              </div>
              <Button
                onClick={toggleAutoBackup}
                variant={autoBackupEnabled ? "destructive" : "default"}
                className="px-6"
              >
                {autoBackupEnabled ? '⏸️ إيقاف' : '▶️ تفعيل'}
              </Button>
            </div>

            {autoBackupEnabled && nextBackupTime && (
              <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">النسخة الاحتياطية التالية بعد:</p>
                    <p className="text-3xl font-bold text-blue-600">{getTimeRemaining()}</p>
                  </div>
                  <div className="text-5xl">⏰</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual Backup */}
        <Card>
          <CardHeader>
            <CardTitle>📥 حفظ يدوي سريع</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              احفظ نسخة احتياطية فورية من جميع البيانات في أي وقت
            </p>
            <Button
              onClick={() => performBackup(true)}
              disabled={loading}
              className="w-full py-6 text-lg"
              size="lg"
            >
              {loading ? '⏳ جاري الحفظ...' : '💾 حفظ نسخة احتياطية الآن'}
            </Button>
          </CardContent>
        </Card>

        {/* Backup Info */}
        <Card>
          <CardHeader>
            <CardTitle>📊 معلومات النسخ الاحتياطية</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600">آخر نسخة احتياطية</p>
                <p className="text-xl font-bold text-green-700">
                  {lastBackupTime 
                    ? lastBackupTime.toLocaleString('ar-IQ')
                    : 'لا توجد نسخ محفوظة'}
                </p>
              </div>

              {backupStats && (
                <>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600">عدد السجلات</p>
                    <p className="text-xl font-bold text-blue-700">
                      {backupStats.total_documents.toLocaleString()} سجل
                    </p>
                  </div>

                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-gray-600">عدد المجموعات</p>
                    <p className="text-xl font-bold text-purple-700">
                      {backupStats.total_collections} مجموعة
                    </p>
                  </div>

                  <div className="p-4 bg-orange-50 rounded-lg">
                    <p className="text-sm text-gray-600">آخر مستخدم</p>
                    <p className="text-xl font-bold text-orange-700">
                      {backupStats.exported_by}
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 bg-yellow-50 rounded-lg border-2 border-yellow-200">
              <h4 className="font-bold text-lg mb-2">📁 موقع الحفظ</h4>
              <p className="text-sm text-gray-700">
                يتم حفظ النسخ الاحتياطية في مجلد <strong>التنزيلات</strong> الخاص بك
              </p>
              <p className="text-sm text-gray-700 mt-2">
                اسم الملف: <code className="bg-white px-2 py-1 rounded">backup_YYYY-MM-DD_HH-MM-SS.json</code>
              </p>
            </div>

            <div className="p-4 bg-red-50 rounded-lg border-2 border-red-200">
              <h4 className="font-bold text-lg mb-2">⚠️ ملاحظات مهمة</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                <li>يتم حفظ نسخة احتياطية كاملة كل 5 دقائق عند التفعيل</li>
                <li>الحفظ يتم تلقائياً دون الحاجة لتدخل يدوي</li>
                <li>يتم حفظ نسخة نهائية عند إغلاق الصفحة</li>
                <li>احتفظ بالنسخ في مكان آمن خارج الحاسوب للحماية</li>
                <li>يُنصح بنقل النسخ إلى USB أو Cloud Storage بشكل دوري</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BackupManagementPage;
