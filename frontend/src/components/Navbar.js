import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { useWebSocket } from '../contexts/WebSocketContext';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Navbar = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { connected } = useWebSocket();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUnreadCount();
      // Poll every 30 seconds
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchUnreadCount = async () => {
    try {
      const response = await axios.get(`${API}/notifications`, {
        params: { unread_only: true }
      });
      setUnreadCount(response.data.unread_count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-primary shadow-lg" data-testid="navbar">
      <div className="container mx-auto px-4 py-3">
        {/* Desktop & Mobile Header */}
        <div className="flex items-center justify-between">
          {/* Logo & User Info */}
          <div className="flex items-center gap-3">
            <div 
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-secondary rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-white">
                <h1 className="text-base sm:text-xl font-bold">نظام الحوالات</h1>
                <p className="text-xs opacity-80 hidden sm:block">{user?.display_name}</p>
              </div>
            </div>
            {connected && (
              <div className="hidden sm:flex items-center gap-2 bg-green-500/20 px-3 py-1 rounded-full" data-testid="connection-status">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-200">متصل</span>
              </div>
            )}
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-3">
            <Button
              onClick={() => navigate('/dashboard')}
              variant="ghost"
              className="text-white hover:bg-white/10 font-bold text-sm"
              data-testid="nav-dashboard"
            >
              🏠 الرئيسية
            </Button>
            <Button
              onClick={() => navigate('/transfers')}
              variant="ghost"
              className="text-white hover:bg-white/10 font-bold text-sm"
              data-testid="nav-transfers"
            >
              📋 الحوالات
            </Button>
            <Button
              onClick={() => navigate('/statement')}
              variant="ghost"
              className="text-white hover:bg-white/10 font-bold text-sm"
              data-testid="nav-statement"
            >
              📊 كشف الحساب
            </Button>
            {user?.role === 'admin' && (
              <Button
                onClick={() => navigate('/admin/dashboard')}
                variant="ghost"
                className="text-white hover:bg-white/10 font-bold text-sm"
                data-testid="nav-admin-dashboard"
              >
                🏦 لوحة المدير
              </Button>
            )}
            {user?.role === 'admin' && (
              <Button
                onClick={() => navigate('/admin/all-transfers')}
                variant="ghost"
                className="text-white hover:bg-white/10 font-bold text-sm"
                data-testid="nav-all-transfers"
              >
                📊 كل الحوالات
              </Button>
            )}
            <Button
              onClick={() => navigate('/agents')}
              variant="ghost"
              className="text-white hover:bg-white/10 font-bold text-sm"
              data-testid="nav-agents"
            >
              👥 الصرافين
            </Button>
            {user?.role === 'admin' && (
              <Button
                onClick={() => navigate('/commissions')}
                variant="ghost"
                className="text-white hover:bg-white/10 font-bold text-sm"
                data-testid="nav-commissions"
              >
                💰 العمولات
              </Button>
            )}
            {user?.role === 'admin' && (
              <Button
                onClick={() => navigate('/wallet/manage')}
                variant="ghost"
                className="text-white hover:bg-white/10 font-bold text-sm"
                data-testid="nav-wallet-manage"
              >
                💳 إدارة المحافظ
              </Button>
            )}
            {user?.role === 'admin' && (
              <Button
                onClick={() => navigate('/commissions-management')}
                variant="ghost"
                className="text-white hover:bg-white/10 font-bold text-sm"
                data-testid="nav-commissions-manage"
              >
                💰 إدارة العمولات
              </Button>
            )}
            {user?.role === 'admin' && (
              <Button
                onClick={() => navigate('/transit-account')}
                variant="ghost"
                className="text-white hover:bg-white/10 font-bold text-sm"
                data-testid="nav-transit-account"
              >
                🏦 حساب الترانزيت
              </Button>
            )}
            {user?.role === 'admin' && (
              <Button
                onClick={() => navigate('/notifications')}
                variant="ghost"
                className="text-white hover:bg-white/10 font-bold text-sm relative"
                data-testid="nav-notifications"
              >
                🔔 الإشعارات
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            )}
            {user?.role === 'admin' && (
              <Button
                onClick={() => navigate('/reports')}
                variant="ghost"
                className="text-white hover:bg-white/10 font-bold text-sm"
                data-testid="nav-reports"
              >
                📊 التقارير
              </Button>
            )}
            {user?.role === 'admin' && (
              <Button
                onClick={() => navigate('/chart-of-accounts')}
                variant="ghost"
                className="text-white hover:bg-white/10 font-bold text-sm"
                data-testid="nav-chart-of-accounts"
              >
                📚 الدليل المحاسبي
              </Button>
            )}
            {user?.role === 'admin' && (
              <Button
                onClick={() => navigate('/manual-journal-entry')}
                variant="ghost"
                className="text-white hover:bg-white/10 font-bold text-sm"
                data-testid="nav-manual-journal"
              >
                📝 القيود اليدوية
              </Button>
            )}
            {user?.role === 'admin' && (
              <Button
                onClick={() => navigate('/journal')}
                variant="ghost"
                className="text-white hover:bg-white/10 font-bold text-sm"
                data-testid="nav-journal"
              >
                📖 دفتر اليومية
              </Button>
            )}
            {user?.role === 'admin' && (
              <Button
                onClick={() => navigate('/journal-transfer')}
                variant="ghost"
                className="text-white hover:bg-white/10 font-bold text-sm"
                data-testid="nav-journal-transfer"
              >
                🔄 قيد مزدوج
              </Button>
            )}
            {user?.role === 'admin' && (
              <Button
                onClick(() => navigate('/ledger')}
                variant="ghost"
                className="text-white hover:bg-white/10 font-bold text-sm"
                data-testid="nav-ledger"
              >
                📊 دفتر الأستاذ
              </Button>
            )}
            {user?.role === 'admin' && (
              <Button
                onClick={() => navigate('/exchange')}
                variant="ghost"
                className="text-white hover:bg-white/10 font-bold text-sm"
                data-testid="nav-exchange"
              >
                💱 عمليات الصرف
              </Button>
            )}
            <Button
              onClick={() => navigate('/settings')}
              variant="ghost"
              className="text-white hover:bg-white/10 font-bold text-sm"
              data-testid="nav-settings"
            >
              ⚙️ الإعدادات
            </Button>
            <Button
              onClick={handleLogout}
              className="bg-secondary hover:bg-secondary/90 text-primary font-bold text-sm"
              data-testid="logout-btn"
            >
              تسجيل الخروج
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-white p-2"
            data-testid="mobile-menu-btn"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-4 pb-2 space-y-2" data-testid="mobile-menu">
            <Button
              onClick={() => {
                navigate('/dashboard');
                setMobileMenuOpen(false);
              }}
              variant="ghost"
              className="w-full text-white hover:bg-white/10 font-bold justify-start"
              data-testid="mobile-nav-dashboard"
            >
              🏠 الرئيسية
            </Button>
            <Button
              onClick={() => {
                navigate('/transfers');
                setMobileMenuOpen(false);
              }}
              variant="ghost"
              className="w-full text-white hover:bg-white/10 font-bold justify-start"
              data-testid="mobile-nav-transfers"
            >
              📋 الحوالات
            </Button>
            <Button
              onClick={() => {
                navigate('/statement');
                setMobileMenuOpen(false);
              }}
              variant="ghost"
              className="w-full text-white hover:bg-white/10 font-bold justify-start"
              data-testid="mobile-nav-statement"
            >
              📊 كشف الحساب
            </Button>
            {user?.role === 'admin' && (
              <Button
                onClick={() => {
                  navigate('/admin/dashboard');
                  setMobileMenuOpen(false);
                }}
                variant="ghost"
                className="w-full text-white hover:bg-white/10 font-bold justify-start"
                data-testid="mobile-nav-admin-dashboard"
              >
                🏦 لوحة المدير
              </Button>
            )}
            {user?.role === 'admin' && (
              <Button
                onClick={() => {
                  navigate('/admin/all-transfers');
                  setMobileMenuOpen(false);
                }}
                variant="ghost"
                className="w-full text-white hover:bg-white/10 font-bold justify-start"
                data-testid="mobile-nav-all-transfers"
              >
                📊 كل الحوالات
              </Button>
            )}
            <Button
              onClick={() => {
                navigate('/agents');
                setMobileMenuOpen(false);
              }}
              variant="ghost"
              className="w-full text-white hover:bg-white/10 font-bold justify-start"
              data-testid="mobile-nav-agents"
            >
              👥 الصرافين
            </Button>
            {user?.role === 'admin' && (
              <Button
                onClick={() => {
                  navigate('/commissions');
                  setMobileMenuOpen(false);
                }}
                variant="ghost"
                className="w-full text-white hover:bg-white/10 font-bold justify-start"
                data-testid="mobile-nav-commissions"
              >
                💰 العمولات
              </Button>
            )}
            {user?.role === 'admin' && (
              <Button
                onClick={() => {
                  navigate('/wallet/manage');
                  setMobileMenuOpen(false);
                }}
                variant="ghost"
                className="w-full text-white hover:bg-white/10 font-bold justify-start"
                data-testid="mobile-nav-wallet-manage"
              >
                💳 إدارة المحافظ
              </Button>
            )}
            {user?.role === 'admin' && (
              <Button
                onClick={() => {
                  navigate('/commissions-management');
                  setMobileMenuOpen(false);
                }}
                variant="ghost"
                className="w-full text-white hover:bg-white/10 font-bold justify-start"
                data-testid="mobile-nav-commissions-manage"
              >
                💰 إدارة العمولات
              </Button>
            )}
            {user?.role === 'admin' && (
              <Button
                onClick={() => {
                  navigate('/transit-account');
                  setMobileMenuOpen(false);
                }}
                variant="ghost"
                className="w-full text-white hover:bg-white/10 font-bold justify-start"
                data-testid="mobile-nav-transit-account"
              >
                🏦 حساب الترانزيت
              </Button>
            )}
            {user?.role === 'admin' && (
              <Button
                onClick={() => {
                  navigate('/notifications');
                  setMobileMenuOpen(false);
                }}
                variant="ghost"
                className="w-full text-white hover:bg-white/10 font-bold justify-start relative"
                data-testid="mobile-nav-notifications"
              >
                🔔 الإشعارات
                {unreadCount > 0 && (
                  <span className="mr-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                    {unreadCount}
                  </span>
                )}
              </Button>
            )}
            {user?.role === 'admin' && (
              <Button
                onClick={() => {
                  navigate('/reports');
                  setMobileMenuOpen(false);
                }}
                variant="ghost"
                className="w-full text-white hover:bg-white/10 font-bold justify-start"
                data-testid="mobile-nav-reports"
              >
                📊 التقارير
              </Button>
            )}
            {user?.role === 'admin' && (
              <Button
                onClick={() => {
                  navigate('/chart-of-accounts');
                  setMobileMenuOpen(false);
                }}
                variant="ghost"
                className="w-full text-white hover:bg-white/10 font-bold justify-start"
                data-testid="mobile-nav-chart-of-accounts"
              >
                📚 الدليل المحاسبي
              </Button>
            )}
            {user?.role === 'admin' && (
              <Button
                onClick={() => {
                  navigate('/manual-journal-entry');
                  setMobileMenuOpen(false);
                }}
                variant="ghost"
                className="w-full text-white hover:bg-white/10 font-bold justify-start"
                data-testid="mobile-nav-manual-journal"
              >
                📝 القيود اليدوية
              </Button>
            )}
            {user?.role === 'admin' && (
              <Button
                onClick={() => {
                  navigate('/journal');
                  setMobileMenuOpen(false);
                }}
                variant="ghost"
                className="w-full text-white hover:bg-white/10 font-bold justify-start"
                data-testid="mobile-nav-journal"
              >
                📖 دفتر اليومية
              </Button>
            )}
            {user?.role === 'admin' && (
              <Button
                onClick={() => {
                  navigate('/ledger');
                  setMobileMenuOpen(false);
                }}
                variant="ghost"
                className="w-full text-white hover:bg-white/10 font-bold justify-start"
                data-testid="mobile-nav-ledger"
              >
                📊 دفتر الأستاذ
              </Button>
            )}
            {user?.role === 'admin' && (
              <Button
                onClick={() => {
                  navigate('/exchange');
                  setMobileMenuOpen(false);
                }}
                variant="ghost"
                className="w-full text-white hover:bg-white/10 font-bold justify-start"
                data-testid="mobile-nav-exchange"
              >
                💱 عمليات الصرف
              </Button>
            )}
            <Button
              onClick={() => {
                navigate('/settings');
                setMobileMenuOpen(false);
              }}
              variant="ghost"
              className="w-full text-white hover:bg-white/10 font-bold justify-start"
              data-testid="mobile-nav-settings"
            >
              ⚙️ الإعدادات
            </Button>
            <div className="flex items-center justify-between px-4 py-2 text-white text-sm">
              <span>{user?.display_name}</span>
              {connected && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-200">متصل</span>
                </div>
              )}
            </div>
            <Button
              onClick={handleLogout}
              className="w-full bg-secondary hover:bg-secondary/90 text-primary font-bold"
              data-testid="mobile-logout-btn"
            >
              تسجيل الخروج
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;