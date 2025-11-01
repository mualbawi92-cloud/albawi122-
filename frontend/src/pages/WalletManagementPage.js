import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import { printDocument, generateWalletDepositReceiptHTML } from '../utils/printUtils';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const WalletManagementPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [formData, setFormData] = useState({
    user_id: '',
    amount: '',
    currency: 'IQD',
    note: ''
  });

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('صلاحية الوصول مرفوضة');
      navigate('/dashboard');
      return;
    }
    fetchAgents();
  }, [user, navigate]);

  const fetchAgents = async () => {
    try {
      const response = await axios.get(`${API}/agents`);
      setAgents(response.data);
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast.error('خطأ في تحميل قائمة الصرافين');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.user_id) {
      toast.error('يرجى اختيار الصراف');
      return;
    }
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/wallet/deposit`, {
        user_id: formData.user_id,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        note: formData.note || undefined
      });
      
      toast.success('تم إضافة الرصيد بنجاح');
      
      // Reset form
      setFormData({
        user_id: '',
        amount: '',
        currency: 'IQD',
        note: ''
      });
      
    } catch (error) {
      console.error('Error adding deposit:', error);
      const message = error.response?.data?.detail || 'حدث خطأ أثناء إضافة الرصيد';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const selectedAgent = agents.find(a => a.id === formData.user_id);

  return (
    <div className="min-h-screen bg-background" data-testid="wallet-management-page">
      <Navbar />
      <div className="container mx-auto p-3 sm:p-6">
        <Card className="shadow-xl max-w-2xl mx-auto">
          <CardHeader className="p-4 sm:p-6 bg-gradient-to-l from-primary to-primary/80 text-white rounded-t-lg">
            <CardTitle className="text-2xl sm:text-3xl">إدارة المحافظ</CardTitle>
            <CardDescription className="text-white/80 text-sm sm:text-base">
              إضافة رصيد لمحفظة الصرافين
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              {/* Agent Selection */}
              <div className="space-y-2">
                <Label htmlFor="agent" className="text-sm sm:text-base font-semibold">
                  اختر الصراف <span className="text-red-500">*</span>
                </Label>
                <Select 
                  value={formData.user_id} 
                  onValueChange={(value) => setFormData({ ...formData, user_id: value })}
                >
                  <SelectTrigger id="agent" className="h-10 sm:h-12 text-sm sm:text-base">
                    <SelectValue placeholder="اختر الصراف..." />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.display_name} - {agent.governorate} ({agent.username})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedAgent && (
                  <div className="text-xs sm:text-sm text-muted-foreground bg-accent p-2 rounded">
                    <p>رصيد IQD: {selectedAgent.wallet_balance_iqd?.toLocaleString() || 0}</p>
                    <p>رصيد USD: {selectedAgent.wallet_balance_usd?.toLocaleString() || 0}</p>
                  </div>
                )}
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-sm sm:text-base font-semibold">
                  المبلغ <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="أدخل المبلغ"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="h-10 sm:h-12 text-sm sm:text-base"
                  required
                />
              </div>

              {/* Currency */}
              <div className="space-y-2">
                <Label htmlFor="currency" className="text-sm sm:text-base font-semibold">
                  العملة <span className="text-red-500">*</span>
                </Label>
                <Select 
                  value={formData.currency} 
                  onValueChange={(value) => setFormData({ ...formData, currency: value })}
                >
                  <SelectTrigger id="currency" className="h-10 sm:h-12 text-sm sm:text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IQD">دينار عراقي (IQD)</SelectItem>
                    <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Note */}
              <div className="space-y-2">
                <Label htmlFor="note" className="text-sm sm:text-base font-semibold">
                  ملاحظة (اختياري)
                </Label>
                <Input
                  id="note"
                  type="text"
                  placeholder="أدخل ملاحظة..."
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="h-10 sm:h-12 text-sm sm:text-base"
                />
              </div>

              {/* Submit Button */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-secondary hover:bg-secondary/90 text-primary font-bold h-11 sm:h-12 text-sm sm:text-base"
                >
                  {loading ? 'جاري الإضافة...' : '➕ إضافة رصيد'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                  className="flex-1 h-11 sm:h-12 text-sm sm:text-base"
                >
                  إلغاء
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WalletManagementPage;
