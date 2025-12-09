import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Home, 
  FileText, 
  Palette, 
  Users, 
  Wallet, 
  Bell, 
  Calculator,
  BookOpen,
  FileSpreadsheet,
  BarChart3,
  Scale,
  Edit,
  ArrowLeftRight,
  ChevronRight,
  ChevronLeft,
  Menu,
  X,
  DollarSign,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [accountingOpen, setAccountingOpen] = useState(false);
  const [commissionsOpen, setCommissionsOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
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

  const isActive = (path) => location.pathname === path;

  const MenuItem = ({ icon: Icon, label, onClick, active, badge, submenu, subOpen, onSubToggle, items }) => (
    <div>
      <button
        onClick={submenu ? onSubToggle : onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 transition-all duration-200 ${
          active 
            ? 'bg-primary/10 border-r-4 border-primary text-primary' 
            : 'hover:bg-gray-100 text-gray-700'
        }`}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 text-right font-semibold text-sm">{label}</span>
            {badge > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
            {submenu && (
              <ChevronLeft className={`w-4 h-4 transition-transform ${subOpen ? 'rotate-90' : ''}`} />
            )}
          </>
        )}
      </button>
      {submenu && subOpen && !collapsed && items && (
        <div className="bg-gray-50">
          {items.map((item, idx) => (
            <button
              key={idx}
              onClick={item.onClick}
              className={`w-full flex items-center gap-3 px-8 py-2 text-sm transition-all duration-200 ${
                isActive(item.path)
                  ? 'bg-primary/5 text-primary font-semibold'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <span className="flex-1 text-right">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const menuItems = [
    {
      icon: Home,
      label: 'الرئيسية',
      path: '/dashboard',
      show: true
    },
    {
      icon: FileText,
      label: 'الحوالات',
      path: '/transfers',
      show: true
    },
    {
      icon: Palette,
      label: 'مصمم القوالب',
      path: '/visual-designer',
      show: user?.role === 'admin'
    },
    {
      icon: BarChart3,
      label: 'دفتر الأستاذ الخاص',
      path: '/agent-ledger',
      show: user?.role === 'agent'
    },
    {
      icon: BarChart3,
      label: 'دفتر الأستاذ',
      path: '/agent-ledger',
      show: user?.role === 'user'
    },
    {
      icon: DollarSign,
      label: 'العمولات',
      show: user?.role === 'agent',
      submenu: true,
      subOpen: commissionsOpen,
      onSubToggle: () => setCommissionsOpen(!commissionsOpen),
      items: [
        {
          label: 'نسبة الأرباح والخسائر',
          path: '/agent-commissions?tab=summary',
          onClick: () => {
            navigate('/agent-commissions?tab=summary');
            setMobileOpen(false);
          }
        },
        {
          label: 'العمولات المحققة',
          path: '/agent-commissions?tab=earned',
          onClick: () => {
            navigate('/agent-commissions?tab=earned');
            setMobileOpen(false);
          }
        },
        {
          label: 'العمولات المدفوعة',
          path: '/agent-commissions?tab=paid',
          onClick: () => {
            navigate('/agent-commissions?tab=paid');
            setMobileOpen(false);
          }
        }
      ]
    },
    {
      icon: Home,
      label: 'لوحة المدير',
      path: '/admin/dashboard',
      show: user?.role === 'admin'
    },
    {
      icon: Users,
      label: 'عناوين الوكلاء',
      path: '/agents',
      show: true
    },
    {
      icon: Wallet,
      label: 'إدارة المحافظ',
      path: '/wallet/manage',
      show: user?.role === 'admin'
    },
    {
      icon: Bell,
      label: 'الإشعارات',
      path: '/notifications',
      show: true,
      badge: unreadCount
    },
    {
      icon: Calculator,
      label: 'المحاسبة',
      show: user?.role === 'admin',
      submenu: true,
      subOpen: accountingOpen,
      onSubToggle: () => setAccountingOpen(!accountingOpen),
      items: [
        {
          label: 'الدليل المحاسبي',
          path: '/chart-of-accounts',
          onClick: () => {
            navigate('/chart-of-accounts');
            setMobileOpen(false);
          }
        },
        {
          label: 'دفتر الأستاذ',
          path: '/ledger',
          onClick: () => {
            navigate('/ledger');
            setMobileOpen(false);
          }
        },
        {
          label: 'دفتر اليومية',
          path: '/journal',
          onClick: () => {
            navigate('/journal');
            setMobileOpen(false);
          }
        },
        {
          label: 'ميزان المراجعة',
          path: '/chart-of-accounts?tab=trial-balance',
          onClick: () => {
            navigate('/chart-of-accounts?tab=trial-balance');
            setMobileOpen(false);
          }
        },
        {
          label: 'قيد التسوية',
          path: '/manual-journal-entry',
          onClick: () => {
            navigate('/manual-journal-entry');
            setMobileOpen(false);
          }
        },
        {
          label: 'القيد المزدوج',
          path: '/journal-transfer',
          onClick: () => {
            navigate('/journal-transfer');
            setMobileOpen(false);
          }
        },
        {
          label: 'التقارير المالية',
          path: '/reports',
          onClick: () => {
            navigate('/reports');
            setMobileOpen(false);
          }
        },
        {
          label: 'قيود يومية حسب الفترة',
          path: '/journal-by-period',
          onClick: () => {
            navigate('/journal-by-period');
            setMobileOpen(false);
          }
        }
      ]
    }
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`p-4 border-b border-gray-200 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800">نظام الحوالات</h1>
              <p className="text-xs text-gray-500">{user?.display_name}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Menu Items */}
      <div className="flex-1 overflow-y-auto py-4">
        {menuItems.map((item, idx) => {
          if (!item.show) return null;
          
          return (
            <MenuItem
              key={idx}
              icon={item.icon}
              label={item.label}
              onClick={() => {
                if (!item.submenu) {
                  navigate(item.path);
                  setMobileOpen(false);
                }
              }}
              active={!item.submenu && isActive(item.path)}
              badge={item.badge}
              submenu={item.submenu}
              subOpen={item.subOpen}
              onSubToggle={item.onSubToggle}
              items={item.items}
            />
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="md:hidden fixed top-4 right-4 z-50 p-2 bg-primary text-white rounded-lg shadow-lg"
      >
        {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:block fixed right-0 top-0 h-screen bg-white border-l border-gray-200 shadow-lg transition-all duration-300 z-30 ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar */}
      <aside
        className={`md:hidden fixed right-0 top-0 h-screen w-64 bg-white border-l border-gray-200 shadow-2xl z-50 transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
};

export default Sidebar;
