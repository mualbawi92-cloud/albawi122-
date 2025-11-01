import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread

  useEffect(() => {
    fetchNotifications();
  }, [filter]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/notifications`, {
        params: { unread_only: filter === 'unread' }
      });
      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('خطأ في جلب الإشعارات');
    }
    setLoading(false);
  };

  const markAsRead = async (notificationId) => {
    try {
      await axios.patch(`${API}/notifications/${notificationId}/mark-read`);
      fetchNotifications();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500 bg-red-50';
      case 'high':
        return 'border-orange-500 bg-orange-50';
      case 'medium':
        return 'border-yellow-500 bg-yellow-50';
      default:
        return 'border-blue-500 bg-blue-50';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return '🚨';
      case 'high':
        return '⚠️';
      case 'medium':
        return '⚡';
      default:
        return 'ℹ️';
    }
  };
  
  const getNotificationTypeIcon = (type) => {
    const typeIcons = {
      'wallet_deposit': '💰',
      'new_transfer': '📥',
      'transfer_received': '✅',
      'duplicate_transfer': '🔄',
      'name_mismatch': '❌',
      'id_verification_failed': '🆔',
      'suspicious_activity': '🔍',
      'ai_warning': '🤖',
      'system': '⚙️'
    };
    return typeIcons[type] || '🔔';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto p-6 flex justify-center items-center">
          <div className="text-lg">جاري التحميل...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <Navbar />
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-l from-primary/10 to-primary/5">
            <CardTitle className="text-2xl sm:text-3xl">🔔 الإشعارات</CardTitle>
            <CardDescription className="text-base">
              إشعارات الذكاء الاصطناعي والمراقبة
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                onClick={() => setFilter('all')}
              >
                جميع الإشعارات
              </Button>
              <Button
                variant={filter === 'unread' ? 'default' : 'outline'}
                onClick={() => setFilter('unread')}
              >
                غير المقروءة
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notifications List */}
        {notifications.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              {filter === 'unread' ? 'لا توجد إشعارات غير مقروءة' : 'لا توجد إشعارات'}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <Card
                key={notification.id}
                className={`border-2 ${getSeverityColor(notification.severity)} ${
                  !notification.is_read ? 'shadow-lg' : ''
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{getSeverityIcon(notification.severity)}</span>
                        <CardTitle className="text-lg">{notification.title}</CardTitle>
                        {!notification.is_read && (
                          <span className="px-2 py-1 bg-primary text-white text-xs rounded-full">
                            جديد
                          </span>
                        )}
                      </div>
                      <CardDescription className="text-base whitespace-pre-line">
                        {notification.message}
                      </CardDescription>
                    </div>
                    {!notification.is_read && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markAsRead(notification.id)}
                      >
                        ✓ تعليم كمقروء
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <span>
                      📅 {new Date(notification.created_at).toLocaleString('ar-IQ')}
                    </span>
                    {notification.related_transfer_id && (
                      <Button
                        size="sm"
                        variant="link"
                        className="h-auto p-0"
                        onClick={() => navigate(`/transfers/${notification.related_transfer_id}`)}
                      >
                        🔗 عرض الحوالة
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
