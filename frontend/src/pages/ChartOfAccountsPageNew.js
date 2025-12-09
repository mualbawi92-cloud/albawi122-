import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ChartOfAccountsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Add Account Dialog
  const [showAddAccountDialog, setShowAddAccountDialog] = useState(false);
  const [newAccount, setNewAccount] = useState({
    name: '',
    category: '',
    notes: '',
    currencies: ['IQD'] // Default currency
  });

  // Add Category Dialog
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false);
  const [newCategory, setNewCategory] = useState({
    name_ar: '',
    name_en: '',
    description: ''
  });

  // Edit Account Dialog
  const [showEditAccountDialog, setShowEditAccountDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);

  // Delete Confirmation Dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteType, setDeleteType] = useState(''); // 'account' or 'category'

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('صلاحية الوصول مرفوضة');
      navigate('/dashboard');
      return;
    }
    fetchCategories();
    fetchAccounts();
  }, [user, navigate]);

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API}/accounting/categories`);
      const cats = response.data.categories || [];
      setCategories(cats);
      // Expand all categories by default
      setExpandedCategories(new Set(cats.map(c => c.code)));
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('خطأ في تحميل الأقسام');
    }
  };

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/accounting/accounts`);
      setAccounts(response.data.accounts || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast.error('خطأ في تحميل الحسابات');
    }
    setLoading(false);
  };

  const toggleCategory = (categoryCode) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryCode)) {
      newExpanded.delete(categoryCode);
    } else {
      newExpanded.add(categoryCode);
    }
    setExpandedCategories(newExpanded);
  };

  const handleAddAccount = async () => {
    if (!newAccount.name || !newAccount.category) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    
    if (!newAccount.currencies || newAccount.currencies.length === 0) {
      toast.error('يرجى اختيار عملة واحدة على الأقل');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Find category to get code prefix
      const category = categories.find(c => c.name_ar === newAccount.category);
      const codePrefix = category?.code || '9';
      
      // Get existing accounts in this category
      const existingInCategory = accounts.filter(acc => 
        acc.code && acc.code.startsWith(codePrefix)
      );
      
      // Find highest sequential number
      let maxSeq = 0;
      existingInCategory.forEach(acc => {
        const numPart = acc.code.replace(codePrefix, '');
        const num = parseInt(numPart);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      });
      
      // Generate new code
      const nextSeq = maxSeq > 0 ? maxSeq + 1 : 1;
      const newCode = (parseInt(codePrefix) * 1000) + nextSeq;
      
      // Create account
      await axios.post(`${API}/accounting/accounts`, {
        code: String(newCode),
        name: newAccount.name,
        name_ar: newAccount.name,
        name_en: newAccount.name,
        type: newAccount.category,
        category: newAccount.category,
        notes: newAccount.notes,
        currencies: newAccount.currencies || ['IQD'], // Send currencies array
        balance_iqd: 0,
        balance_usd: 0,
        is_active: true
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(`✅ تمت إضافة الحساب بنجاح برقم ${newCode}`);
      
      setNewAccount({ name: '', category: '', notes: '', currencies: ['IQD'] });
      setShowAddAccountDialog(false);
      
      fetchCategories();
      fetchAccounts();
    } catch (error) {
      console.error('Error adding account:', error);
      const errorDetail = error.response?.data?.detail;
      const errorMsg = typeof errorDetail === 'string' 
        ? errorDetail 
        : errorDetail?.msg || 'حدث خطأ أثناء إضافة الحساب';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.name_ar || !newCategory.name_en) {
      toast.error('يرجى ملء اسم القسم بالعربي والإنجليزي');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      const response = await axios.post(`${API}/accounting/categories`, {
        name_ar: newCategory.name_ar,
        name_en: newCategory.name_en,
        description: newCategory.description,
        is_system: false
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(`✅ تمت إضافة القسم بنجاح`);
      
      setNewCategory({ name_ar: '', name_en: '', description: '' });
      setShowAddCategoryDialog(false);
      
      fetchCategories();
    } catch (error) {
      console.error('Error adding category:', error);
      const errorMsg = error.response?.data?.detail || 'حدث خطأ أثناء إضافة القسم';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleEditAccount = async () => {
    if (!editingAccount || !editingAccount.name) {
      toast.error('يرجى إدخال اسم الحساب');
      return;
    }
    
    // التحقق من اختيار عملة واحدة على الأقل
    if (!editingAccount.currencies || editingAccount.currencies.length === 0) {
      toast.error('يرجى اختيار عملة واحدة على الأقل');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // التحقق من إمكانية حذف العملات
      const removedCurrencies = editingAccount.originalCurrencies.filter(
        curr => !editingAccount.currencies.includes(curr)
      );
      
      if (removedCurrencies.length > 0) {
        // التحقق من وجود قيود بهذه العملات
        const ledgerResponse = await axios.get(
          `${API}/accounting/ledger/${editingAccount.code}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        const entries = ledgerResponse.data.entries || [];
        const currenciesInUse = [...new Set(entries.map(e => e.currency))];
        
        const blockedCurrencies = removedCurrencies.filter(curr => 
          currenciesInUse.includes(curr)
        );
        
        if (blockedCurrencies.length > 0) {
          toast.error(
            `⚠️ لا يمكن إلغاء العملات التالية لأنها مرتبطة بقيود نشطة: ${blockedCurrencies.join(', ')}`
          );
          setLoading(false);
          return;
        }
      }
      
      await axios.patch(`${API}/accounting/accounts/${editingAccount.code}`, {
        name: editingAccount.name,
        name_ar: editingAccount.name,
        name_en: editingAccount.name,
        notes: editingAccount.notes,
        currencies: editingAccount.currencies // إضافة العملات للتحديث
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('✅ تم تحديث الحساب بنجاح');
      
      setEditingAccount(null);
      setShowEditAccountDialog(false);
      
      fetchAccounts();
    } catch (error) {
      console.error('Error updating account:', error);
      toast.error(error.response?.data?.detail || 'حدث خطأ أثناء تحديث الحساب');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      if (deleteType === 'account') {
        await axios.delete(`${API}/accounting/accounts/${itemToDelete.code}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('تم حذف الحساب بنجاح');
        fetchAccounts();
        fetchCategories();
      } else if (deleteType === 'category') {
        await axios.delete(`${API}/accounting/categories/${itemToDelete.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('تم حذف القسم بنجاح');
        fetchCategories();
      }
      
      setShowDeleteDialog(false);
      setItemToDelete(null);
      setDeleteType('');
    } catch (error) {
      console.error('Error deleting:', error);
      const errorMsg = error.response?.data?.detail || 'حدث خطأ أثناء الحذف';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const openDeleteAccountDialog = (account) => {
    setItemToDelete(account);
    setDeleteType('account');
    setShowDeleteDialog(true);
  };

  const openDeleteCategoryDialog = (category) => {
    setItemToDelete(category);
    setDeleteType('category');
    setShowDeleteDialog(true);
  };

  const openEditAccountDialog = (account) => {
    setEditingAccount({
      code: account.code,
      name: account.name || account.name_ar,
      notes: account.notes || '',
      currencies: account.currencies || ['IQD'], // إضافة العملات الحالية
      originalCurrencies: account.currencies || ['IQD'] // للتحقق من التغييرات
    });
    setShowEditAccountDialog(true);
  };

  // Filter accounts based on search
  const getFilteredAccounts = (categoryName) => {
    return accounts.filter(acc => {
      const matchesCategory = acc.category === categoryName || acc.type === categoryName;
      const matchesSearch = searchTerm === '' || 
        (acc.name && acc.name.includes(searchTerm)) ||
        (acc.name_ar && acc.name_ar.includes(searchTerm)) ||
        (acc.code && acc.code.includes(searchTerm));
      return matchesCategory && matchesSearch;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      
      
      <div className="container mx-auto px-4 py-6">
        <Card>
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
            <CardTitle className="text-2xl flex items-center gap-2">
              <span>📚</span>
              <span>الدليل المحاسبي والتقارير</span>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-6">
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 mb-6">
              <Button
                onClick={() => setShowAddAccountDialog(true)}
                className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
              >
                <span>➕</span>
                <span>إضافة حساب جديد</span>
              </Button>
              
              <Button
                onClick={() => setShowAddCategoryDialog(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
              >
                <span>📁</span>
                <span>إضافة قسم جديد</span>
              </Button>

              <div className="mr-auto">
                <Input
                  type="text"
                  placeholder="🔍 بحث (اسم الحساب أو الرمز)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                />
              </div>
            </div>

            {/* Tree View */}
            {loading ? (
              <div className="text-center py-8">
                <p className="text-gray-500">جاري التحميل...</p>
              </div>
            ) : (
              <div className="space-y-2">
                {categories.map(category => {
                  const categoryAccounts = getFilteredAccounts(category.name_ar);
                  const isExpanded = expandedCategories.has(category.code);
                  
                  return (
                    <div key={category.code} className="border rounded-lg overflow-hidden">
                      {/* Category Header */}
                      <div 
                        className="bg-blue-50 border-b border-blue-200 p-4 cursor-pointer hover:bg-blue-100 transition-colors flex items-center justify-between"
                        onClick={() => toggleCategory(category.code)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">
                            {isExpanded ? '📂' : '📁'}
                          </span>
                          <div>
                            <div className="font-bold text-blue-900 text-lg">
                              {category.name_ar}
                            </div>
                            <div className="text-sm text-blue-600">
                              {category.name_en} • {categoryAccounts.length} حساب
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {!category.is_system && categoryAccounts.length === 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-300 hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeleteCategoryDialog(category);
                              }}
                            >
                              🗑️ حذف القسم
                            </Button>
                          )}
                          <span className="text-blue-400">
                            {isExpanded ? '▼' : '◀'}
                          </span>
                        </div>
                      </div>

                      {/* Accounts List */}
                      {isExpanded && (
                        <div className="bg-white">
                          {categoryAccounts.length === 0 ? (
                            <div className="p-4 text-center text-gray-400">
                              لا توجد حسابات في هذا القسم
                            </div>
                          ) : (
                            <div className="divide-y">
                              {categoryAccounts.map(account => (
                                <div 
                                  key={account.code}
                                  className="p-3 hover:bg-gray-50 flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-4">
                                    <span className="text-blue-600 font-mono font-bold w-16">
                                      {account.code}
                                    </span>
                                    <div>
                                      <div className="font-medium">
                                        {account.name || account.name_ar || 'بدون اسم'}
                                      </div>
                                      {account.notes && (
                                        <div className="text-sm text-gray-500">
                                          {account.notes}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openEditAccountDialog(account)}
                                    >
                                      ✏️ تعديل
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-red-600 border-red-300 hover:bg-red-50"
                                      onClick={() => openDeleteAccountDialog(account)}
                                    >
                                      🗑️
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Account Dialog */}
      <Dialog open={showAddAccountDialog} onOpenChange={setShowAddAccountDialog}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>➕ إضافة حساب جديد</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>اسم الحساب *</Label>
              <Input
                value={newAccount.name}
                onChange={(e) => setNewAccount({...newAccount, name: e.target.value})}
                placeholder="مثال: صيرفة كربلاء"
              />
            </div>

            <div>
              <Label>القسم *</Label>
              <select
                className="w-full border rounded-md p-2"
                value={newAccount.category}
                onChange={(e) => setNewAccount({...newAccount, category: e.target.value})}
              >
                <option value="">اختر القسم</option>
                {categories.map(cat => (
                  <option key={cat.code} value={cat.name_ar}>
                    {cat.name_ar}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>العملات المسموح بها *</Label>
              <div className="border rounded-md p-3 space-y-2">
                {['IQD', 'USD', 'EUR', 'GBP'].map(currency => (
                  <div key={currency} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`currency-${currency}`}
                      checked={newAccount.currencies.includes(currency)}
                      onChange={(e) => {
                        const currencies = e.target.checked
                          ? [...newAccount.currencies, currency]
                          : newAccount.currencies.filter(c => c !== currency);
                        setNewAccount({...newAccount, currencies});
                      }}
                      className="w-4 h-4"
                    />
                    <label htmlFor={`currency-${currency}`} className="cursor-pointer">
                      {currency === 'IQD' ? 'دينار عراقي (IQD)' :
                       currency === 'USD' ? 'دولار أمريكي (USD)' :
                       currency === 'EUR' ? 'يورو (EUR)' :
                       'جنيه إسترليني (GBP)'}
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                اختر العملات التي سيتم استخدامها في هذا الحساب
              </p>
            </div>

            <div>
              <Label>ملاحظات (اختياري)</Label>
              <textarea
                className="w-full border rounded-md p-2"
                rows="3"
                value={newAccount.notes}
                onChange={(e) => setNewAccount({...newAccount, notes: e.target.value})}
                placeholder="أي ملاحظات إضافية..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAccountDialog(false)}>
              إلغاء
            </Button>
            <Button onClick={handleAddAccount} disabled={loading}>
              {loading ? 'جاري الحفظ...' : '✓ حفظ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={showAddCategoryDialog} onOpenChange={setShowAddCategoryDialog}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>📁 إضافة قسم جديد</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>اسم القسم (عربي) *</Label>
              <Input
                value={newCategory.name_ar}
                onChange={(e) => setNewCategory({...newCategory, name_ar: e.target.value})}
                placeholder="مثال: الموردين"
              />
            </div>

            <div>
              <Label>اسم القسم (إنجليزي) *</Label>
              <Input
                value={newCategory.name_en}
                onChange={(e) => setNewCategory({...newCategory, name_en: e.target.value})}
                placeholder="e.g., Suppliers"
              />
            </div>

            <div>
              <Label>الوصف (اختياري)</Label>
              <textarea
                className="w-full border rounded-md p-2"
                rows="2"
                value={newCategory.description}
                onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
                placeholder="وصف القسم..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCategoryDialog(false)}>
              إلغاء
            </Button>
            <Button onClick={handleAddCategory} disabled={loading}>
              {loading ? 'جاري الحفظ...' : '✓ حفظ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Account Dialog */}
      <Dialog open={showEditAccountDialog} onOpenChange={setShowEditAccountDialog}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>✏️ تعديل الحساب</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>رمز الحساب</Label>
              <Input
                value={editingAccount?.code || ''}
                disabled
                className="bg-gray-100"
              />
            </div>

            <div>
              <Label>اسم الحساب *</Label>
              <Input
                value={editingAccount?.name || ''}
                onChange={(e) => setEditingAccount({...editingAccount, name: e.target.value})}
                placeholder="اسم الحساب الجديد"
              />
            </div>

            <div>
              <Label>العملات المسموح بها *</Label>
              <div className="border rounded-md p-3 space-y-2">
                {['IQD', 'USD', 'EUR', 'GBP'].map(currency => (
                  <div key={currency} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`edit-currency-${currency}`}
                      checked={editingAccount?.currencies?.includes(currency) || false}
                      onChange={(e) => {
                        const currencies = e.target.checked
                          ? [...(editingAccount?.currencies || []), currency]
                          : (editingAccount?.currencies || []).filter(c => c !== currency);
                        setEditingAccount({...editingAccount, currencies});
                      }}
                      className="w-4 h-4"
                    />
                    <label htmlFor={`edit-currency-${currency}`} className="cursor-pointer">
                      {currency === 'IQD' ? 'دينار عراقي (IQD)' :
                       currency === 'USD' ? 'دولار أمريكي (USD)' :
                       currency === 'EUR' ? 'يورو (EUR)' :
                       'جنيه إسترليني (GBP)'}
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                اختر العملات التي سيتم استخدامها في هذا الحساب
              </p>
              {editingAccount?.originalCurrencies && 
               editingAccount.originalCurrencies.some(curr => 
                 !editingAccount?.currencies?.includes(curr)
               ) && (
                <p className="text-xs text-amber-600 mt-1">
                  ⚠️ سيتم التحقق من عدم وجود قيود للعملات التي تم إلغاؤها
                </p>
              )}
            </div>

            <div>
              <Label>ملاحظات</Label>
              <textarea
                className="w-full border rounded-md p-2"
                rows="2"
                value={editingAccount?.notes || ''}
                onChange={(e) => setEditingAccount({...editingAccount, notes: e.target.value})}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditAccountDialog(false)}>
              إلغاء
            </Button>
            <Button onClick={handleEditAccount} disabled={loading}>
              {loading ? 'جاري التحديث...' : '✓ حفظ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-red-600">⚠️ تأكيد الحذف</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <p>
              هل أنت متأكد من حذف {deleteType === 'account' ? 'الحساب' : 'القسم'}:
            </p>
            <p className="font-bold mt-2">
              {deleteType === 'account' 
                ? `${itemToDelete?.code} - ${itemToDelete?.name || itemToDelete?.name_ar}`
                : itemToDelete?.name_ar
              }
            </p>
            <p className="text-sm text-gray-500 mt-2">
              لا يمكن التراجع عن هذا الإجراء
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              إلغاء
            </Button>
            <Button 
              onClick={handleDeleteItem} 
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {loading ? 'جاري الحذف...' : '🗑️ حذف'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChartOfAccountsPage;
