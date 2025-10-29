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
  { value: 'مصاريف', label: 'مصاريف (Expenses)' }
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
    let filtered = accounts;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(acc => acc.category === selectedCategory);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(acc => 
        acc.name_ar.includes(searchTerm) ||
        acc.name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.code.includes(searchTerm)
      );
    }

    setFilteredAccounts(filtered);
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
    return `${amount.toLocaleString()} ${currency}`;
  };

  const buildHierarchy = (accounts) => {
    // Group accounts by parent
    const accountMap = {};
    const roots = [];

    accounts.forEach(acc => {
      accountMap[acc.code] = { ...acc, children: [] };
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
    const indent = level * 40; // 40px per level
    const hasChildren = account.children && account.children.length > 0;
    const isParent = !account.parent_code;

    return (
      <React.Fragment key={account.code}>
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
                {account.code}
              </span>
            </div>

            {/* Name Arabic */}
            <div className="col-span-3">
              <span className={hasChildren ? 'font-bold' : ''}>
                {account.name_ar}
              </span>
            </div>

            {/* Name English */}
            <div className="col-span-2 text-sm text-muted-foreground">
              {account.name_en}
            </div>

            {/* Category */}
            <div className="col-span-2 text-sm">
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                {account.category}
              </span>
            </div>

            {/* Balance */}
            <div className="col-span-2 text-left font-bold">
              <span className={account.balance > 0 ? 'text-green-700' : account.balance < 0 ? 'text-red-700' : ''}>
                {account.balance.toLocaleString()} {account.currency}
              </span>
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
              {activeTab === 'accounts' && (
                <Button onClick={() => setShowAddDialog(true)} className="w-full sm:w-auto">
                  ➕ إضافة حساب جديد
                </Button>
              )}
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
