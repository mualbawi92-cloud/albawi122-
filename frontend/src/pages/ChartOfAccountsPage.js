import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CATEGORIES = [
  { value: 'أصول', label: 'أصول (Assets)' },
  { value: 'التزامات', label: 'التزامات (Liabilities)' },
  { value: 'حقوق الملكية', label: 'حقوق الملكية (Equity)' },
  { value: 'إيرادات', label: 'إيرادات (Revenues)' },
  { value: 'مصاريف', label: 'مصاريف (Expenses)' },
  { value: 'شركات الصرافة', label: 'شركات الصرافة (Exchange Companies)' }
];

const CURRENCIES = ['IQD', 'USD'];

const ChartOfAccountsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [filteredAccounts, setFilteredAccounts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Add account dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newAccount, setNewAccount] = useState({
    code: '',
    name_ar: '',
    name_en: '',
    category: 'أصول',
    parent_code: '',
    currency: 'IQD'
  });

  // Delete confirmation dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState(null);
  
  // Tab state for reports
  const [activeTab, setActiveTab] = useState('accounts'); // accounts, trial-balance, income-statement, balance-sheet
  
  // Reports state
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [trialBalance, setTrialBalance] = useState(null);
  const [incomeStatement, setIncomeStatement] = useState(null);
  const [balanceSheet, setBalanceSheet] = useState(null);

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('صلاحية الوصول مرفوضة');
      navigate('/dashboard');
      return;
    }
    fetchAccounts();
  }, [user, navigate]);

  useEffect(() => {
    filterAccounts();
  }, [accounts, searchTerm, selectedCategory]);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/accounting/accounts`);
      setAccounts(response.data.accounts || []);
      toast.success('تم تحميل الحسابات بنجاح');
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast.error('خطأ في تحميل الحسابات');
    }
    setLoading(false);
  };

  const fetchTrialBalance = async () => {
    setLoading(true);
    try {
      const params = {};
      if (reportStartDate) params.start_date = reportStartDate;
      if (reportEndDate) params.end_date = reportEndDate;
      
      const response = await axios.get(`${API}/accounting/reports/trial-balance`, { params });
      setTrialBalance(response.data);
      toast.success('تم تحميل ميزان المراجعة بنجاح');
    } catch (error) {
      console.error('Error fetching trial balance:', error);
      toast.error('خطأ في تحميل ميزان المراجعة');
    }
    setLoading(false);
  };

  const fetchIncomeStatement = async () => {
    setLoading(true);
    try {
      const params = {};
      if (reportStartDate) params.start_date = reportStartDate;
      if (reportEndDate) params.end_date = reportEndDate;
      
      const response = await axios.get(`${API}/accounting/reports/income-statement`, { params });
      setIncomeStatement(response.data);
      toast.success('تم تحميل قائمة الدخل بنجاح');
    } catch (error) {
      console.error('Error fetching income statement:', error);
      toast.error('خطأ في تحميل قائمة الدخل');
    }
    setLoading(false);
  };

  const fetchBalanceSheet = async () => {
    setLoading(true);
    try {
      const params = {};
      if (reportEndDate) params.end_date = reportEndDate;
      
      const response = await axios.get(`${API}/accounting/reports/balance-sheet`, { params });
      setBalanceSheet(response.data);
      toast.success('تم تحميل الميزانية العمومية بنجاح');
    } catch (error) {
      console.error('Error fetching balance sheet:', error);
      toast.error('خطأ في تحميل الميزانية العمومية');
    }
    setLoading(false);
  };

  const filterAccounts = () => {
    // Safety check
    if (!Array.isArray(accounts)) {
      console.error('filterAccounts: accounts is not an array');
      setFilteredAccounts([]);
      return;
    }
    
    try {
      let filtered = accounts.filter(acc => acc && acc.code); // Filter out invalid accounts

      // Filter by category
      if (selectedCategory !== 'all') {
        filtered = filtered.filter(acc => 
          (acc.category === selectedCategory) || (acc.type === selectedCategory)
        );
      }

      // Filter by search term
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        filtered = filtered.filter(acc => {
          const nameAr = getAccountProperty(acc, 'name_ar', '');
          const nameEn = getAccountProperty(acc, 'name_en', '');
          const name = getAccountProperty(acc, 'name', '');
          const code = getAccountProperty(acc, 'code', '');
          
          return nameAr.includes(searchTerm) ||
                 nameEn.toLowerCase().includes(searchLower) ||
                 name.includes(searchTerm) ||
                 code.includes(searchTerm);
        });
      }

      setFilteredAccounts(filtered);
    } catch (error) {
      console.error('Error in filterAccounts:', error);
      setFilteredAccounts([]);
      toast.error('خطأ في فلترة الحسابات');
    }
  };

  const handleAddAccount = async () => {
    // Validation
    if (!newAccount.code || !newAccount.name_ar || !newAccount.name_en) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      await axios.post(`${API}/accounting/accounts`, newAccount);
      toast.success('تم إضافة الحساب بنجاح');
      setShowAddDialog(false);
      setNewAccount({
        code: '',
        name_ar: '',
        name_en: '',
        category: 'أصول',
        parent_code: '',
        currency: 'IQD'
      });
      fetchAccounts();
    } catch (error) {
      console.error('Error adding account:', error);
      const errorMsg = error.response?.data?.detail || 'خطأ في إضافة الحساب';
      toast.error(errorMsg);
    }
  };

  const handleDeleteClick = (account) => {
    setAccountToDelete(account);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!accountToDelete) return;

    try {
      await axios.delete(`${API}/accounting/accounts/${accountToDelete.code}`);
      toast.success('تم حذف الحساب بنجاح');
      setShowDeleteDialog(false);
      setAccountToDelete(null);
      fetchAccounts();
    } catch (error) {
      console.error('Error deleting account:', error);
      const errorMsg = error.response?.data?.detail || 'خطأ في حذف الحساب';
      toast.error(errorMsg);
    }
  };

  const formatCurrency = (amount, currency = 'IQD') => {
    // Defensive check - ensure amount is a number
    const safeAmount = parseFloat(amount) || 0;
    return `${safeAmount.toLocaleString()} ${currency || 'IQD'}`;
  };
  
  // Safe getter for account properties
  const getAccountProperty = (account, property, defaultValue = '') => {
    try {
      return account?.[property] ?? defaultValue;
    } catch (error) {
      console.warn(`Error accessing property ${property}:`, error);
      return defaultValue;
    }
  };

  const buildHierarchy = (accounts) => {
    // Group accounts by parent
    const accountMap = {};
    const roots = [];
    
    // Safety check for accounts array
    if (!Array.isArray(accounts)) {
      console.error('buildHierarchy: accounts is not an array', accounts);
      return [];
    }

    accounts.forEach(acc => {
      if (acc && acc.code) {
        accountMap[acc.code] = { ...acc, children: [] };
      }
    });

    accounts.forEach(acc => {
      if (acc.parent_code && accountMap[acc.parent_code]) {
        accountMap[acc.parent_code].children.push(accountMap[acc.code]);
      } else {
        roots.push(accountMap[acc.code]);
      }
    });

    return roots;
  };

  const renderAccountRow = (account, level = 0) => {
    // Safety check - ensure account exists
    if (!account || !account.code) {
      console.warn('Invalid account in renderAccountRow:', account);
      return null;
    }
    
    try {
      const indent = level * 40; // 40px per level
      const hasChildren = account.children && account.children.length > 0;
      const isParent = !account.parent_code;
      
      // Safe access to account properties with defaults
      const accountCode = getAccountProperty(account, 'code', 'N/A');
      const accountNameAr = getAccountProperty(account, 'name_ar', getAccountProperty(account, 'name', 'حساب بدون اسم'));
      const accountNameEn = getAccountProperty(account, 'name_en', '');
      const accountCategory = getAccountProperty(account, 'category', getAccountProperty(account, 'type', 'غير محدد'));
      
      // Handle balance - support both old (balance) and new (balance_iqd/balance_usd) formats
      const balanceIqd = parseFloat(account.balance_iqd) || parseFloat(account.balance) || 0;
      const balanceUsd = parseFloat(account.balance_usd) || 0;
      const currency = getAccountProperty(account, 'currency', 'IQD');

      return (
        <React.Fragment key={accountCode}>
          <div 
            className={`
              border-b hover:bg-gray-50 transition-colors
              ${isParent ? 'bg-gray-100 font-bold' : ''}
            `}
          >
            <div className="grid grid-cols-12 gap-2 items-center p-3">
              {/* Code */}
              <div className="col-span-2" style={{ paddingRight: `${indent}px` }}>
                <span className={`${hasChildren ? 'font-bold text-primary' : ''}`}>
                  {accountCode}
                </span>
              </div>

              {/* Name Arabic */}
              <div className="col-span-3">
                <span className={hasChildren ? 'font-bold' : ''}>
                  {accountNameAr}
                </span>
              </div>

              {/* Name English */}
              <div className="col-span-2 text-sm text-muted-foreground">
                {accountNameEn}
              </div>

              {/* Category */}
              <div className="col-span-2 text-sm">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                  {accountCategory}
                </span>
              </div>

              {/* Balance */}
              <div className="col-span-2 text-left font-bold">
                <div className="space-y-1">
                  {balanceIqd !== 0 && (
                    <div className={balanceIqd > 0 ? 'text-green-700' : balanceIqd < 0 ? 'text-red-700' : ''}>
                      {formatCurrency(balanceIqd, 'IQD')}
                    </div>
                  )}
                  {balanceUsd !== 0 && (
                    <div className={`text-sm ${balanceUsd > 0 ? 'text-green-600' : balanceUsd < 0 ? 'text-red-600' : ''}`}>
                      {formatCurrency(balanceUsd, 'USD')}
                    </div>
                  )}
                  {balanceIqd === 0 && balanceUsd === 0 && (
                    <div className="text-gray-400">
                      {formatCurrency(0, currency)}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="col-span-1 flex justify-end">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteClick(account)}
                  disabled={hasChildren}
                  title={hasChildren ? 'احذف الحسابات الفرعية أولاً' : 'حذف الحساب'}
                >
                  🗑️
                </Button>
              </div>
            </div>
          </div>

          {/* Render children recursively */}
          {hasChildren && account.children.map(child => renderAccountRow(child, level + 1))}
        </React.Fragment>
      );
    } catch (error) {
      console.error('Error rendering account row:', error, account);
      // Return a placeholder row instead of crashing
      return (
        <div key={account.code || Math.random()} className="border-b bg-red-50 p-3">
          <span className="text-red-600">خطأ في عرض الحساب: {account.code || 'غير معروف'}</span>
        </div>
      );
    }
  };

  const hierarchy = buildHierarchy(filteredAccounts);

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <Navbar />
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-l from-purple-50 to-purple-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="text-2xl sm:text-3xl">📚 الدليل المحاسبي والتقارير</CardTitle>
                <CardDescription className="text-base">
                  دليل الحسابات والتقارير المحاسبية
                </CardDescription>
              </div>
              <div className="flex gap-2 flex-wrap">
                {activeTab === 'accounts' && (
                  <Button onClick={() => setShowAddDialog(true)} className="w-full sm:w-auto">
                    ➕ إضافة حساب جديد
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Tabs */}
        <div className="flex gap-2 border-b-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('accounts')}
            className={`px-6 py-3 font-bold text-lg transition-all whitespace-nowrap ${
              activeTab === 'accounts'
                ? 'border-b-4 border-primary text-primary bg-primary/5'
                : 'text-muted-foreground hover:text-primary'
            }`}
          >
            📋 الحسابات
          </button>
          <button
            onClick={() => setActiveTab('trial-balance')}
            className={`px-6 py-3 font-bold text-lg transition-all whitespace-nowrap ${
              activeTab === 'trial-balance'
                ? 'border-b-4 border-primary text-primary bg-primary/5'
                : 'text-muted-foreground hover:text-primary'
            }`}
          >
            ⚖️ ميزان المراجعة
          </button>
          <button
            onClick={() => setActiveTab('income-statement')}
            className={`px-6 py-3 font-bold text-lg transition-all whitespace-nowrap ${
              activeTab === 'income-statement'
                ? 'border-b-4 border-primary text-primary bg-primary/5'
                : 'text-muted-foreground hover:text-primary'
            }`}
          >
            📊 قائمة الدخل
          </button>
          <button
            onClick={() => setActiveTab('balance-sheet')}
            className={`px-6 py-3 font-bold text-lg transition-all whitespace-nowrap ${
              activeTab === 'balance-sheet'
                ? 'border-b-4 border-primary text-primary bg-primary/5'
                : 'text-muted-foreground hover:text-primary'
            }`}
          >
            📈 الميزانية العمومية
          </button>
        </div>

        {/* Accounts Tab */}
        {activeTab === 'accounts' && (
          <>
        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>بحث (الاسم أو الرمز)</Label>
                <Input
                  placeholder="ابحث في الحسابات..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>تصفية حسب الفئة</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">🔍 جميع الفئات</SelectItem>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Accounts Table */}
        <Card>
          <CardHeader>
            <CardTitle>قائمة الحسابات ({filteredAccounts.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center">جاري التحميل...</div>
            ) : filteredAccounts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                لا توجد حسابات
              </div>
            ) : (
              <div className="overflow-x-auto">
                {/* Table Header */}
                <div className="bg-gray-200 border-b-2">
                  <div className="grid grid-cols-12 gap-2 p-3 font-bold text-sm">
                    <div className="col-span-2">الرمز</div>
                    <div className="col-span-3">الاسم (عربي)</div>
                    <div className="col-span-2">الاسم (إنجليزي)</div>
                    <div className="col-span-2">الفئة</div>
                    <div className="col-span-2 text-left">الرصيد</div>
                    <div className="col-span-1 text-left">إجراءات</div>
                  </div>
                </div>

                {/* Table Body - Hierarchical */}
                <div>
                  {hierarchy.map(account => renderAccountRow(account, 0))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
          </>
        )}

        {/* Trial Balance Tab */}
        {activeTab === 'trial-balance' && (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>من تاريخ</Label>
                    <Input
                      type="date"
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>إلى تاريخ</Label>
                    <Input
                      type="date"
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 flex items-end">
                    <Button onClick={fetchTrialBalance} disabled={loading} className="w-full">
                      {loading ? 'جاري التحميل...' : '📊 عرض التقرير'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {trialBalance && (
              <Card>
                <CardHeader>
                  <CardTitle>ميزان المراجعة</CardTitle>
                  <CardDescription>
                    {trialBalance.is_balanced ? (
                      <span className="text-green-700 font-bold">✅ الميزان متوازن</span>
                    ) : (
                      <span className="text-red-700 font-bold">⚠️ الميزان غير متوازن</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-200">
                        <tr>
                          <th className="p-3 text-right">رمز الحساب</th>
                          <th className="p-3 text-right">اسم الحساب</th>
                          <th className="p-3 text-right">الفئة</th>
                          <th className="p-3 text-center">مدين</th>
                          <th className="p-3 text-center">دائن</th>
                          <th className="p-3 text-center">الرصيد</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trialBalance.accounts.map((acc) => (
                          <tr key={acc.code} className="border-t hover:bg-gray-50">
                            <td className="p-3">{acc.code}</td>
                            <td className="p-3">{acc.name_ar}</td>
                            <td className="p-3">{acc.category}</td>
                            <td className="p-3 text-center font-bold text-blue-700">
                              {acc.debit > 0 ? acc.debit.toLocaleString() : '-'}
                            </td>
                            <td className="p-3 text-center font-bold text-green-700">
                              {acc.credit > 0 ? acc.credit.toLocaleString() : '-'}
                            </td>
                            <td className={`p-3 text-center font-bold ${
                              acc.balance > 0 ? 'text-green-700' : acc.balance < 0 ? 'text-red-700' : ''
                            }`}>
                              {acc.balance.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t-2 bg-gray-100 font-bold">
                          <td className="p-3" colSpan="3">المجموع</td>
                          <td className="p-3 text-center text-blue-700">
                            {trialBalance.total_debit.toLocaleString()}
                          </td>
                          <td className="p-3 text-center text-green-700">
                            {trialBalance.total_credit.toLocaleString()}
                          </td>
                          <td className="p-3 text-center">-</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Income Statement Tab */}
        {activeTab === 'income-statement' && (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>من تاريخ</Label>
                    <Input
                      type="date"
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>إلى تاريخ</Label>
                    <Input
                      type="date"
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 flex items-end">
                    <Button onClick={fetchIncomeStatement} disabled={loading} className="w-full">
                      {loading ? 'جاري التحميل...' : '📊 عرض التقرير'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {incomeStatement && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="border-2 border-green-200 bg-green-50">
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">إجمالي الإيرادات</p>
                      <p className="text-3xl font-bold text-green-700">
                        {formatCurrency(incomeStatement.total_revenue)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-red-200 bg-red-50">
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">إجمالي المصاريف</p>
                      <p className="text-3xl font-bold text-red-700">
                        {formatCurrency(incomeStatement.total_expenses)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className={`border-2 ${incomeStatement.net_profit >= 0 ? 'border-blue-200 bg-blue-50' : 'border-orange-200 bg-orange-50'}`}>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">
                        {incomeStatement.net_profit >= 0 ? 'صافي الربح' : 'صافي الخسارة'}
                      </p>
                      <p className={`text-3xl font-bold ${incomeStatement.net_profit >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                        {formatCurrency(Math.abs(incomeStatement.net_profit))}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-green-700">الإيرادات</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {incomeStatement.revenues.length === 0 ? (
                        <p className="text-center py-4 text-muted-foreground">لا توجد إيرادات</p>
                      ) : (
                        <div className="space-y-2">
                          {incomeStatement.revenues.map((rev) => (
                            <div key={rev.code} className="flex justify-between border-b pb-2">
                              <span>{rev.name_ar}</span>
                              <span className="font-bold">{formatCurrency(rev.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-red-700">المصاريف</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {incomeStatement.expenses.length === 0 ? (
                        <p className="text-center py-4 text-muted-foreground">لا توجد مصاريف</p>
                      ) : (
                        <div className="space-y-2">
                          {incomeStatement.expenses.map((exp) => (
                            <div key={exp.code} className="flex justify-between border-b pb-2">
                              <span>{exp.name_ar}</span>
                              <span className="font-bold">{formatCurrency(exp.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </div>
        )}

        {/* Balance Sheet Tab */}
        {activeTab === 'balance-sheet' && (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>حتى تاريخ</Label>
                    <Input
                      type="date"
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 flex items-end">
                    <Button onClick={fetchBalanceSheet} disabled={loading} className="w-full">
                      {loading ? 'جاري التحميل...' : '📊 عرض التقرير'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {balanceSheet && (
              <>
                <Card className={`border-2 ${balanceSheet.is_balanced ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">إجمالي الأصول</p>
                        <p className="text-2xl font-bold text-blue-700">
                          {formatCurrency(balanceSheet.total_assets)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">الالتزامات + حقوق الملكية</p>
                        <p className="text-2xl font-bold text-purple-700">
                          {formatCurrency(balanceSheet.total_liabilities_equity)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">الحالة</p>
                        <p className={`text-xl font-bold ${balanceSheet.is_balanced ? 'text-green-700' : 'text-red-700'}`}>
                          {balanceSheet.is_balanced ? '✅ متوازنة' : '⚠️ غير متوازنة'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-blue-700">الأصول</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {balanceSheet.assets.length === 0 ? (
                        <p className="text-center py-4 text-muted-foreground">لا توجد أصول</p>
                      ) : (
                        <div className="space-y-2">
                          {balanceSheet.assets.map((asset) => (
                            <div key={asset.code} className="flex justify-between border-b pb-2">
                              <span>{asset.name_ar}</span>
                              <span className="font-bold">{formatCurrency(asset.amount)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between pt-2 font-bold text-lg">
                            <span>المجموع</span>
                            <span className="text-blue-700">{formatCurrency(balanceSheet.total_assets)}</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-red-700">الالتزامات</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {balanceSheet.liabilities.length === 0 ? (
                          <p className="text-center py-4 text-muted-foreground">لا توجد التزامات</p>
                        ) : (
                          <div className="space-y-2">
                            {balanceSheet.liabilities.map((liab) => (
                              <div key={liab.code} className="flex justify-between border-b pb-2">
                                <span>{liab.name_ar}</span>
                                <span className="font-bold">{formatCurrency(liab.amount)}</span>
                              </div>
                            ))}
                            <div className="flex justify-between pt-2 font-bold">
                              <span>المجموع</span>
                              <span className="text-red-700">{formatCurrency(balanceSheet.total_liabilities)}</span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-purple-700">حقوق الملكية</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {balanceSheet.equity.length === 0 ? (
                          <p className="text-center py-4 text-muted-foreground">لا توجد حقوق ملكية</p>
                        ) : (
                          <div className="space-y-2">
                            {balanceSheet.equity.map((eq) => (
                              <div key={eq.code} className="flex justify-between border-b pb-2">
                                <span>{eq.name_ar}</span>
                                <span className="font-bold">{formatCurrency(eq.amount)}</span>
                              </div>
                            ))}
                            <div className="flex justify-between pt-2 font-bold">
                              <span>المجموع</span>
                              <span className="text-purple-700">{formatCurrency(balanceSheet.total_equity)}</span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Add Account Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>➕ إضافة حساب جديد</DialogTitle>
              <DialogDescription>
                أضف حساباً جديداً إلى الدليل المحاسبي
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>رمز الحساب *</Label>
                  <Input
                    placeholder="1010"
                    value={newAccount.code}
                    onChange={(e) => setNewAccount({ ...newAccount, code: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>العملة</Label>
                  <Select 
                    value={newAccount.currency} 
                    onValueChange={(val) => setNewAccount({ ...newAccount, currency: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map(curr => (
                        <SelectItem key={curr} value={curr}>{curr}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>الاسم بالعربي *</Label>
                <Input
                  placeholder="صندوق نقد"
                  value={newAccount.name_ar}
                  onChange={(e) => setNewAccount({ ...newAccount, name_ar: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>الاسم بالإنجليزي *</Label>
                <Input
                  placeholder="Cash"
                  value={newAccount.name_en}
                  onChange={(e) => setNewAccount({ ...newAccount, name_en: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>الفئة *</Label>
                <Select 
                  value={newAccount.category} 
                  onValueChange={(val) => setNewAccount({ ...newAccount, category: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>الحساب الرئيسي (اختياري)</Label>
                <Select 
                  value={newAccount.parent_code} 
                  onValueChange={(val) => setNewAccount({ ...newAccount, parent_code: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="بدون حساب رئيسي" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">بدون حساب رئيسي</SelectItem>
                    {accounts
                      .filter(acc => !acc.parent_code) // Only root accounts can be parents
                      .map(acc => (
                        <SelectItem key={acc.code} value={acc.code}>
                          {acc.code} - {acc.name_ar}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                إلغاء
              </Button>
              <Button onClick={handleAddAccount}>
                ✅ إضافة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>⚠️ تأكيد الحذف</DialogTitle>
              <DialogDescription>
                هل أنت متأكد من حذف هذا الحساب؟
              </DialogDescription>
            </DialogHeader>

            {accountToDelete && (
              <div className="py-4 space-y-2">
                <p><strong>الرمز:</strong> {accountToDelete.code}</p>
                <p><strong>الاسم:</strong> {accountToDelete.name_ar}</p>
                <p><strong>الرصيد:</strong> {accountToDelete.balance} {accountToDelete.currency}</p>
                <p className="text-red-600 text-sm">
                  ⚠️ لا يمكن التراجع عن هذا الإجراء
                </p>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                إلغاء
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm}>
                🗑️ حذف
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ChartOfAccountsPage;
