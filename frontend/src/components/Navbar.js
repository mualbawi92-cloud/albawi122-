import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { useWebSocket } from '../contexts/WebSocketContext';

const Navbar = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { connected } = useWebSocket();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-primary shadow-lg" data-testid="navbar">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-white">
              <h1 className="text-xl font-bold">نظام الحوالات</h1>
              <p className="text-sm opacity-80">{user?.display_name}</p>
            </div>
            {connected && (
              <div className="flex items-center gap-2 bg-green-500/20 px-3 py-1 rounded-full" data-testid="connection-status">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-200">متصل</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate('/dashboard')}
              variant="ghost"
              className="text-white hover:bg-white/10 font-bold"
              data-testid="nav-dashboard"
            >
              🏠 الرئيسية
            </Button>
            <Button
              onClick={() => navigate('/transfers')}
              variant="ghost"
              className="text-white hover:bg-white/10 font-bold"
              data-testid="nav-transfers"
            >
              📋 الحوالات
            </Button>
            <Button
              onClick={() => navigate('/agents')}
              variant="ghost"
              className="text-white hover:bg-white/10 font-bold"
              data-testid="nav-agents"
            >
              👥 الصرافين
            </Button>
            <Button
              onClick={handleLogout}
              className="bg-secondary hover:bg-secondary/90 text-primary font-bold"
              data-testid="logout-btn"
            >
              تسجيل الخروج
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;