import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { useWebSocket } from '../contexts/WebSocketContext';

const Navbar = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { connected } = useWebSocket();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-secondary rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-white">
              <h1 className="text-base sm:text-xl font-bold">نظام الحوالات</h1>
              <p className="text-xs opacity-80 hidden sm:block">{user?.display_name}</p>
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