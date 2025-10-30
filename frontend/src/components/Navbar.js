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
  const [accountingMenuOpen, setAccountingMenuOpen] = useState(false);
  const [mobileAccountingOpen, setMobileAccountingOpen] = useState(false);
  const [agentCommissionsMenuOpen, setAgentCommissionsMenuOpen] = useState(false);
  const [mobileAgentCommissionsOpen, setMobileAgentCommissionsOpen] = useState(false);

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
              onClick={() => navigate('/quick-receive')}
              variant="ghost"
              className="text-white hover:bg-white/10 font-bold text-sm"
              data-testid="nav-quick-receive"
            >
              ⚡ تسليم حوالة
            </Button>
            {user?.role === 'agent' && (
              <Button
                onClick={() => navigate('/agent-ledger')}
                variant="ghost"
                className="text-white hover:bg-white/10 font-bold text-sm"
                data-testid="nav-agent-ledger"
              >
                📊 دفتر الأستاذ الخاص
              </Button>
            )}
            
            {/* Agent Commissions Dropdown Menu */}
            {user?.role === 'agent' && (
              <div className="relative">
                <Button
                  onClick={() => setAgentCommissionsMenuOpen(!agentCommissionsMenuOpen)}
                  onBlur={() => setTimeout(() => setAgentCommissionsMenuOpen(false), 200)}
                  variant="ghost"
                  className="text-white hover:bg-white/10 font-bold text-sm"
                  data-testid="nav-agent-commissions-menu"
                >
                  💰 العمولات ▾
                </Button>
                
                {agentCommissionsMenuOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border-2 border-primary/20 min-w-[200px] z-50">
                    <div className="py-2">
                      <button
                        onClick={() => {
                          navigate('/agent-commissions?tab=summary');
                          setAgentCommissionsMenuOpen(false);
                        }}
                        className="w-full text-right px-4 py-2 hover:bg-primary/10 text-primary font-semibold text-sm transition-colors"
                      >
                        📊 نسبة الأرباح والخسائر
                      </button>
                      <button
                        onClick={() => {
                          navigate('/agent-commissions?tab=earned');
                          setAgentCommissionsMenuOpen(false);
                        }}
                        className="w-full text-right px-4 py-2 hover:bg-primary/10 text-primary font-semibold text-sm transition-colors"
                      >
                        💰 العمولات المحققة
                      </button>
                      <button
                        onClick={() => {
                          navigate('/agent-commissions?tab=paid');
                          setAgentCommissionsMenuOpen(false);
                        }}
                        className="w-full text-right px-4 py-2 hover:bg-primary/10 text-primary font-semibold text-sm transition-colors"
                      >
                        🔻 العمولات المدفوعة
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
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
                onClick={() => navigate('/paid-commissions')}
                variant="ghost"
                className="text-white hover:bg-white/10 font-bold text-sm"
                data-testid="nav-paid-commissions"
              >
                🔻 العمولات المدفوعة
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
            
            {/* Accounting Dropdown Menu */}
            {user?.role === 'admin' && (
              <div className="relative">
                <Button
                  onClick={() => setAccountingMenuOpen(!accountingMenuOpen)}
                  onBlur={() => setTimeout(() => setAccountingMenuOpen(false), 200)}
                  variant="ghost"
                  className="text-white hover:bg-white/10 font-bold text-sm"
                  data-testid="nav-accounting-menu"
                >
                  📊 المحاسبة ▾
                </Button>
                
                {accountingMenuOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border-2 border-primary/20 min-w-[200px] z-50">
                    <div className="py-2">
                      <button
                        onClick={() => {
                          navigate('/chart-of-accounts');
                          setAccountingMenuOpen(false);
                        }}
                        className="w-full text-right px-4 py-2 hover:bg-primary/10 text-primary font-semibold text-sm transition-colors"
                      >
                        📚 الدليل المحاسبي
                      </button>
                      <button
                        onClick={() => {
                          navigate('/ledger');
                          setAccountingMenuOpen(false);
                        }}
                        className="w-full text-right px-4 py-2 hover:bg-primary/10 text-primary font-semibold text-sm transition-colors"
                      >
                        📊 دفتر الأستاذ
                      </button>
                      <button
                        onClick={() => {
                          navigate('/journal');
                          setAccountingMenuOpen(false);
                        }}
                        className="w-full text-right px-4 py-2 hover:bg-primary/10 text-primary font-semibold text-sm transition-colors"
                      >
                        📖 دفتر اليومية
                      </button>
                      <div className="border-t border-gray-200 my-1"></div>
                      <button
                        onClick={() => {
                          navigate('/chart-of-accounts?tab=trial-balance');
                          setAccountingMenuOpen(false);
                        }}
                        className="w-full text-right px-4 py-2 hover:bg-primary/10 text-primary font-semibold text-sm transition-colors"
                      >
                        ⚖️ ميزان المراجعة
                      </button>
                      <button
                        onClick={() => {
                          navigate('/manual-journal-entry');
                          setAccountingMenuOpen(false);
                        }}
                        className="w-full text-right px-4 py-2 hover:bg-primary/10 text-primary font-semibold text-sm transition-colors"
                      >
                        📝 قيد التسوية
                      </button>
                      <button
                        onClick={() => {
                          navigate('/journal-transfer');
                          setAccountingMenuOpen(false);
                        }}
                        className="w-full text-right px-4 py-2 hover:bg-primary/10 text-primary font-semibold text-sm transition-colors"
                      >
                        🔄 القيد المزدوج
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
            {user?.role === 'agent' && (
              <Button
                onClick={() => {
                  navigate('/agent-ledger');
                  setMobileMenuOpen(false);
                }}
                variant="ghost"
                className="w-full text-white hover:bg-white/10 font-bold justify-start"
                data-testid="mobile-nav-agent-ledger"
              >
                📊 دفتر الأستاذ الخاص
              </Button>
            )}
            
            {/* Agent Commissions Dropdown for Mobile */}
            {user?.role === 'agent' && (
              <div className="w-full">
                <Button
                  onClick={() => setMobileAgentCommissionsOpen(!mobileAgentCommissionsOpen)}
                  variant="ghost"
                  className="w-full text-white hover:bg-white/10 font-bold justify-start"
                  data-testid="mobile-nav-agent-commissions-menu"
                >
                  💰 العمولات {mobileAgentCommissionsOpen ? '▴' : '▾'}
                </Button>
                
                {mobileAgentCommissionsOpen && (
                  <div className="bg-white/10 rounded-lg mt-1 mb-2">
                    <Button
                      onClick={() => {
                        navigate('/agent-commissions?tab=summary');
                        setMobileMenuOpen(false);
                        setMobileAgentCommissionsOpen(false);
                      }}
                      variant="ghost"
                      className="w-full text-white hover:bg-white/20 font-semibold justify-start text-sm py-2"
                    >
                      📊 نسبة الأرباح والخسائر
                    </Button>
                    <Button
                      onClick={() => {
                        navigate('/agent-commissions?tab=earned');
                        setMobileMenuOpen(false);
                        setMobileAgentCommissionsOpen(false);
                      }}
                      variant="ghost"
                      className="w-full text-white hover:bg-white/20 font-semibold justify-start text-sm py-2"
                    >
                      💰 العمولات المحققة
                    </Button>
                    <Button
                      onClick={() => {
                        navigate('/agent-commissions?tab=paid');
                        setMobileMenuOpen(false);
                        setMobileAgentCommissionsOpen(false);
                      }}
                      variant="ghost"
                      className="w-full text-white hover:bg-white/20 font-semibold justify-start text-sm py-2"
                    >
                      🔻 العمولات المدفوعة
                    </Button>
                  </div>
                )}
              </div>
            )}
            
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
                  navigate('/paid-commissions');
                  setMobileMenuOpen(false);
                }}
                variant="ghost"
                className="w-full text-white hover:bg-white/10 font-bold justify-start"
                data-testid="mobile-nav-paid-commissions"
              >
                🔻 العمولات المدفوعة
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
            
            {/* Accounting Dropdown for Mobile */}
            {user?.role === 'admin' && (
              <div className="w-full">
                <Button
                  onClick={() => setMobileAccountingOpen(!mobileAccountingOpen)}
                  variant="ghost"
                  className="w-full text-white hover:bg-white/10 font-bold justify-start"
                  data-testid="mobile-nav-accounting-menu"
                >
                  📊 المحاسبة {mobileAccountingOpen ? '▴' : '▾'}
                </Button>
                
                {mobileAccountingOpen && (
                  <div className="bg-white/10 rounded-lg mt-1 mb-2">
                    <Button
                      onClick={() => {
                        navigate('/chart-of-accounts');
                        setMobileMenuOpen(false);
                        setMobileAccountingOpen(false);
                      }}
                      variant="ghost"
                      className="w-full text-white hover:bg-white/20 font-semibold justify-start text-sm py-2"
                    >
                      📚 الدليل المحاسبي
                    </Button>
                    <Button
                      onClick={() => {
                        navigate('/ledger');
                        setMobileMenuOpen(false);
                        setMobileAccountingOpen(false);
                      }}
                      variant="ghost"
                      className="w-full text-white hover:bg-white/20 font-semibold justify-start text-sm py-2"
                    >
                      📊 دفتر الأستاذ
                    </Button>
                    <Button
                      onClick={() => {
                        navigate('/journal');
                        setMobileMenuOpen(false);
                        setMobileAccountingOpen(false);
                      }}
                      variant="ghost"
                      className="w-full text-white hover:bg-white/20 font-semibold justify-start text-sm py-2"
                    >
                      📖 دفتر اليومية
                    </Button>
                    <div className="border-t border-white/20 my-1"></div>
                    <Button
                      onClick={() => {
                        navigate('/chart-of-accounts?tab=trial-balance');
                        setMobileMenuOpen(false);
                        setMobileAccountingOpen(false);
                      }}
                      variant="ghost"
                      className="w-full text-white hover:bg-white/20 font-semibold justify-start text-sm py-2"
                    >
                      ⚖️ ميزان المراجعة
                    </Button>
                    <Button
                      onClick={() => {
                        navigate('/manual-journal-entry');
                        setMobileMenuOpen(false);
                        setMobileAccountingOpen(false);
                      }}
                      variant="ghost"
                      className="w-full text-white hover:bg-white/20 font-semibold justify-start text-sm py-2"
                    >
                      📝 قيد التسوية
                    </Button>
                    <Button
                      onClick={() => {
                        navigate('/journal-transfer');
                        setMobileMenuOpen(false);
                        setMobileAccountingOpen(false);
                      }}
                      variant="ghost"
                      className="w-full text-white hover:bg-white/20 font-semibold justify-start text-sm py-2"
                    >
                      🔄 القيد المزدوج
                    </Button>
                  </div>
                )}
              </div>
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