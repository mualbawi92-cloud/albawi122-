import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import api from '../services/api';


const TemplateDesignerPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [templateType, setTemplateType] = useState('transfer_receipt'); // transfer_receipt, invoice, report
  const [htmlContent, setHtmlContent] = useState('');
  const [cssContent, setCssContent] = useState('');

  // Available fields for transfers
  const transferFields = [
    { name: 'رقم الحوالة', value: '{{tracking_number}}', description: 'رقم الحوالة المكون من 10 أرقام' },
    { name: 'كود الحوالة', value: '{{transfer_code}}', description: 'كود التحقق المكون من 4 أرقام' },
    { name: 'اسم المرسل', value: '{{sender_name}}', description: 'اسم المرسل الكامل' },
    { name: 'رقم هاتف المرسل', value: '{{sender_phone}}', description: 'رقم هاتف المرسل' },
    { name: 'مدينة الإرسال', value: '{{sending_city}}', description: 'مدينة إرسال الحوالة' },
    { name: 'اسم المستفيد', value: '{{receiver_name}}', description: 'اسم المستفيد الكامل' },
    { name: 'رقم هاتف المستفيد', value: '{{receiver_phone}}', description: 'رقم هاتف المستفيد' },
    { name: 'مدينة الاستلام', value: '{{receiving_city}}', description: 'مدينة استلام الحوالة' },
    { name: 'المبلغ', value: '{{amount}}', description: 'مبلغ الحوالة' },
    { name: 'العملة', value: '{{currency}}', description: 'عملة الحوالة (IQD, USD)' },
    { name: 'العمولة الصادرة', value: '{{outgoing_commission}}', description: 'عمولة المرسل' },
    { name: 'العمولة الواردة', value: '{{incoming_commission}}', description: 'عمولة المستقبل' },
    { name: 'الحالة', value: '{{status}}', description: 'حالة الحوالة (معلقة، مكتملة، ملغاة)' },
    { name: 'تاريخ الإنشاء', value: '{{created_date}}', description: 'تاريخ إنشاء الحوالة' },
    { name: 'وقت الإنشاء', value: '{{created_time}}', description: 'وقت إنشاء الحوالة' },
    { name: 'اسم الوكيل المرسل', value: '{{from_agent_name}}', description: 'اسم الوكيل الذي أرسل الحوالة' },
    { name: 'اسم الوكيل المستلم', value: '{{to_agent_name}}', description: 'اسم الوكيل الذي استلم الحوالة' },
    { name: 'تاريخ الاستلام', value: '{{received_date}}', description: 'تاريخ استلام الحوالة' },
    { name: 'ملاحظات', value: '{{note}}', description: 'ملاحظات إضافية' },
  ];

  const defaultTemplate = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>وصل حوالة</title>
  <style>
    ${cssContent || `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Arial', sans-serif;
      direction: rtl;
      background: white;
    }
    @page {
      size: A5 landscape;
      margin: 10mm;
    }
    .voucher {
      border: 2px solid #000;
      padding: 20px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      border-bottom: 2px solid #000;
      padding-bottom: 10px;
      margin-bottom: 15px;
    }
    .title {
      font-size: 24px;
      font-weight: bold;
    }
    .info-box {
      margin: 10px 0;
      font-size: 14px;
    }
    .info-label {
      font-weight: bold;
      margin-left: 10px;
    }
    `}
  </style>
</head>
<body>
  <div class="voucher">
    <div class="header">
      <div class="title">وصل حوالة</div>
      <div>
        <div class="info-box">
          <span class="info-label">رقم الحوالة:</span>
          <span>{{tracking_number}}</span>
        </div>
        <div class="info-box">
          <span class="info-label">كود الحوالة:</span>
          <span>{{transfer_code}}</span>
        </div>
      </div>
    </div>
    
    <div class="info-box">
      <span class="info-label">المرسل:</span>
      <span>{{sender_name}}</span>
    </div>
    
    <div class="info-box">
      <span class="info-label">المستفيد:</span>
      <span>{{receiver_name}}</span>
    </div>
    
    <div class="info-box">
      <span class="info-label">المبلغ:</span>
      <span>{{amount}} {{currency}}</span>
    </div>
    
    <div class="info-box">
      <span class="info-label">التاريخ:</span>
      <span>{{created_date}}</span>
    </div>
  </div>
</body>
</html>
  `;

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('لا تملك صلاحية الوصول لهذه الصفحة');
      navigate('/dashboard');
      return;
    }
    fetchTemplates();
  }, [user, navigate]);

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/templates');
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error('يرجى إدخال اسم التصميم');
      return;
    }

    try {
      const payload = {
        name: templateName,
        type: templateType,
        html_content: htmlContent || defaultTemplate,
        css_content: cssContent
      };

      if (selectedTemplate) {
        await api.put('/templates/${selectedTemplate.id}', payload);
        toast.success('تم تحديث التصميم بنجاح');
      } else {
        await api.post('/templates', payload);
        toast.success('تم حفظ التصميم بنجاح');
      }

      fetchTemplates();
      resetForm();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error(error.response?.data?.detail || 'خطأ في حفظ التصميم');
    }
  };

  const handleLoadTemplate = (template) => {
    setSelectedTemplate(template);
    setTemplateName(template.name);
    setTemplateType(template.type);
    setHtmlContent(template.html_content);
    setCssContent(template.css_content || '');
  };

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا التصميم?')) return;

    try {
      await api.delete('/templates/${id}');
      toast.success('تم حذف التصميم بنجاح');
      fetchTemplates();
      if (selectedTemplate?.id === id) {
        resetForm();
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('خطأ في حذف التصميم');
    }
  };

  const resetForm = () => {
    setSelectedTemplate(null);
    setTemplateName('');
    setTemplateType('transfer_receipt');
    setHtmlContent('');
    setCssContent('');
  };

  const insertField = (fieldValue) => {
    const textarea = document.getElementById('html-editor');
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = htmlContent || defaultTemplate;
      const before = text.substring(0, start);
      const after = text.substring(end);
      setHtmlContent(before + fieldValue + after);
      
      // Set cursor position after inserted text
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + fieldValue.length, start + fieldValue.length);
      }, 0);
    }
  };

  const handlePreview = () => {
    const previewWindow = window.open('', '_blank');
    if (!previewWindow) {
      toast.error('يرجى السماح بفتح النوافذ المنبثقة');
      return;
    }

    // Replace placeholders with sample data
    let previewHTML = (htmlContent || defaultTemplate)
      .replace(/{{tracking_number}}/g, '1234567890')
      .replace(/{{transfer_code}}/g, '5678')
      .replace(/{{sender_name}}/g, 'أحمد محمد علي')
      .replace(/{{sender_phone}}/g, '07701234567')
      .replace(/{{sending_city}}/g, 'بغداد')
      .replace(/{{receiver_name}}/g, 'فاطمة حسن علي')
      .replace(/{{receiver_phone}}/g, '07709876543')
      .replace(/{{receiving_city}}/g, 'البصرة')
      .replace(/{{amount}}/g, '500,000')
      .replace(/{{currency}}/g, 'IQD')
      .replace(/{{outgoing_commission}}/g, '5,000')
      .replace(/{{incoming_commission}}/g, '3,000')
      .replace(/{{status}}/g, 'مكتملة')
      .replace(/{{created_date}}/g, new Date().toLocaleDateString('ar-IQ'))
      .replace(/{{created_time}}/g, new Date().toLocaleTimeString('ar-IQ'))
      .replace(/{{from_agent_name}}/g, 'وكيل بغداد')
      .replace(/{{to_agent_name}}/g, 'وكيل البصرة')
      .replace(/{{received_date}}/g, new Date().toLocaleDateString('ar-IQ'))
      .replace(/{{note}}/g, '');

    previewWindow.document.write(previewHTML);
    previewWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-background">
      
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">🎨 مصمم الوصولات والكشوفات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Panel - Available Fields */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold">الحقول المتاحة</h3>
                <p className="text-sm text-muted-foreground">اضغط على الحقل لإضافته للتصميم</p>
                
                <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-3">
                  {transferFields.map((field, index) => (
                    <div
                      key={index}
                      onClick={() => insertField(field.value)}
                      className="p-3 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded cursor-pointer transition-colors"
                    >
                      <p className="font-bold text-sm">{field.name}</p>
                      <p className="text-xs text-muted-foreground">{field.value}</p>
                      <p className="text-xs text-gray-600 mt-1">{field.description}</p>
                    </div>
                  ))}
                </div>

                {/* Saved Templates */}
                <div className="border-t pt-4">
                  <h3 className="text-xl font-bold mb-3">التصاميم المحفوظة</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {templates.map((template) => (
                      <div key={template.id} className="flex gap-2 items-center p-2 border rounded">
                        <Button
                          onClick={() => handleLoadTemplate(template)}
                          variant="outline"
                          className="flex-1 text-sm"
                        >
                          {template.name}
                        </Button>
                        <Button
                          onClick={() => handleDeleteTemplate(template.id)}
                          variant="destructive"
                          size="sm"
                        >
                          🗑️
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Center Panel - Editor */}
              <div className="lg:col-span-2 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>اسم التصميم</Label>
                    <Input
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="مثال: وصل A5 أفقي"
                    />
                  </div>
                  
                  <div>
                    <Label>نوع التصميم</Label>
                    <Select value={templateType} onValueChange={setTemplateType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transfer_receipt">وصل حوالة</SelectItem>
                        <SelectItem value="invoice">فاتورة</SelectItem>
                        <SelectItem value="report">تقرير</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>محرر HTML</Label>
                  <textarea
                    id="html-editor"
                    value={htmlContent || defaultTemplate}
                    onChange={(e) => setHtmlContent(e.target.value)}
                    className="w-full h-96 p-3 border rounded-lg font-mono text-sm"
                    dir="ltr"
                  />
                </div>

                <div>
                  <Label>محرر CSS (اختياري)</Label>
                  <textarea
                    value={cssContent}
                    onChange={(e) => setCssContent(e.target.value)}
                    className="w-full h-32 p-3 border rounded-lg font-mono text-sm"
                    dir="ltr"
                    placeholder="أضف CSS مخصص هنا..."
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleSaveTemplate}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    💾 {selectedTemplate ? 'تحديث التصميم' : 'حفظ التصميم'}
                  </Button>
                  <Button
                    onClick={handlePreview}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    👁️ معاينة
                  </Button>
                  <Button
                    onClick={resetForm}
                    variant="outline"
                    className="flex-1"
                  >
                    🔄 مسح
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TemplateDesignerPage;
