import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import axios from 'axios';
import { Rnd } from 'react-rnd';
import { Trash2, Plus, Save, Eye, FolderOpen, Grid, Type, Square, Minus } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// أحجام الصفحات بالبكسل (1mm = 3.78px)
const PAGE_SIZES = {
  'A4_portrait': { width: 794, height: 1123, label: 'A4 عمودي' },
  'A4_landscape': { width: 1123, height: 794, label: 'A4 أفقي' },
  'A5_portrait': { width: 559, height: 794, label: 'A5 عمودي' },
  'A5_landscape': { width: 794, height: 559, label: 'A5 أفقي' },
  'thermal_80mm': { width: 302, height: 600, label: 'حراري 80 ملم' },
};

// أنواع العناصر
const ELEMENT_TYPES = {
  TEXT_FIELD: 'text_field',
  STATIC_TEXT: 'static_text',
  LINE: 'line',
  RECTANGLE: 'rectangle',
  CIRCLE: 'circle',
  IMAGE: 'image',
  VERTICAL_LINE: 'vertical_line',
};

// الحقول المتاحة
const AVAILABLE_FIELDS = [
  { name: 'رقم الحوالة', value: 'tracking_number' },
  { name: 'كود الحوالة', value: 'transfer_code' },
  { name: 'اسم المرسل', value: 'sender_name' },
  { name: 'هاتف المرسل', value: 'sender_phone' },
  { name: 'مدينة الإرسال', value: 'sending_city' },
  { name: 'اسم المستفيد', value: 'receiver_name' },
  { name: 'هاتف المستفيد', value: 'receiver_phone' },
  { name: 'مدينة الاستلام', value: 'receiving_city' },
  { name: 'المبلغ', value: 'amount' },
  { name: 'العملة', value: 'currency' },
  { name: 'العمولة الصادرة', value: 'outgoing_commission' },
  { name: 'العمولة الواردة', value: 'incoming_commission' },
  { name: 'التاريخ', value: 'created_date' },
  { name: 'الوقت', value: 'created_time' },
  { name: 'الوكيل المرسل', value: 'from_agent_name' },
  { name: 'الوكيل المستلم', value: 'to_agent_name' },
];

const VisualTemplateDesignerPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [currentTemplate, setCurrentTemplate] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [templateType, setTemplateType] = useState('send_transfer'); // نوع الوصل
  const [pageSize, setPageSize] = useState('A5_landscape');
  const [elements, setElements] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(1);

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
      const response = await axios.get(`${API}/visual-templates`);
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const addElement = (type, field = null) => {
    let width = 150;
    let height = 30;
    
    if (type === ELEMENT_TYPES.LINE) {
      width = 200;
      height = 2;
    } else if (type === ELEMENT_TYPES.VERTICAL_LINE) {
      width = 2;
      height = 100;
    } else if (type === ELEMENT_TYPES.CIRCLE) {
      width = 80;
      height = 80;
    } else if (type === ELEMENT_TYPES.IMAGE) {
      width = 100;
      height = 100;
    }
    
    const newElement = {
      id: Date.now().toString(),
      type,
      x: 50,
      y: 50,
      width,
      height,
      field: field,
      text: type === ELEMENT_TYPES.STATIC_TEXT ? 'نص جديد' : '',
      fontFamily: 'Arial',
      fontSize: 14,
      fontWeight: 'normal',
      textAlign: 'right',
      color: '#000000',
      backgroundColor: 'transparent',
      borderWidth: (type === ELEMENT_TYPES.RECTANGLE || type === ELEMENT_TYPES.CIRCLE) ? 1 : 0,
      borderColor: '#000000',
      borderStyle: 'solid',
      letterSpacing: '0',
      opacity: 1,
      rotation: 0,
      imageUrl: '',
    };
    setElements([...elements, newElement]);
    setSelectedElement(newElement.id);
  };

  const updateElement = (id, updates) => {
    setElements(elements.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const deleteElement = (id) => {
    setElements(elements.filter(el => el.id !== id));
    if (selectedElement === id) setSelectedElement(null);
  };

  const handleSave = async () => {
    if (!templateName.trim()) {
      toast.error('يرجى إدخال اسم التصميم');
      return;
    }

    try {
      const payload = {
        name: templateName,
        template_type: templateType,
        page_size: pageSize,
        elements: elements,
      };

      if (currentTemplate) {
        await axios.put(`${API}/visual-templates/${currentTemplate.id}`, payload);
        toast.success('تم تحديث التصميم بنجاح');
      } else {
        await axios.post(`${API}/visual-templates`, payload);
        toast.success('تم حفظ التصميم بنجاح');
      }

      fetchTemplates();
      handleNew();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error(error.response?.data?.detail || 'خطأ في حفظ التصميم');
    }
  };

  const handleLoad = (template) => {
    setCurrentTemplate(template);
    setTemplateName(template.name);
    setTemplateType(template.template_type || 'send_transfer');
    setPageSize(template.page_size);
    setElements(template.elements || []);
    setSelectedElement(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا التصميم؟')) return;

    try {
      await axios.delete(`${API}/visual-templates/${id}`);
      toast.success('تم حذف التصميم بنجاح');
      fetchTemplates();
      if (currentTemplate?.id === id) {
        handleNew();
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('خطأ في حذف التصميم');
    }
  };

  const handleNew = () => {
    setCurrentTemplate(null);
    setTemplateName('');
    setTemplateType('send_transfer');
    setPageSize('A5_landscape');
    setElements([]);
    setSelectedElement(null);
  };

  const handlePreview = () => {
    const previewWindow = window.open('', '_blank');
    if (!previewWindow) {
      toast.error('يرجى السماح بفتح النوافذ المنبثقة');
      return;
    }

    const pageConfig = PAGE_SIZES[pageSize];
    let html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>${templateName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Arial', sans-serif; direction: rtl; background: white; }
    @page { size: ${pageConfig.width}px ${pageConfig.height}px; margin: 0; }
    .page {
      width: ${pageConfig.width}px;
      height: ${pageConfig.height}px;
      position: relative;
      background: white;
      margin: 20px auto;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
    }
    .element {
      position: absolute;
      overflow: hidden;
    }
    @media print {
      .page { margin: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="page">
`;

    // Sample data for preview
    const sampleData = {
      tracking_number: '1234567890',
      transfer_code: '5678',
      sender_name: 'أحمد محمد علي',
      sender_phone: '07701234567',
      sending_city: 'بغداد',
      receiver_name: 'فاطمة حسن علي',
      receiver_phone: '07709876543',
      receiving_city: 'البصرة',
      amount: '500,000',
      currency: 'IQD',
      outgoing_commission: '5,000',
      incoming_commission: '3,000',
      created_date: new Date().toLocaleDateString('ar-IQ'),
      created_time: new Date().toLocaleTimeString('ar-IQ'),
      from_agent_name: 'وكيل بغداد',
      to_agent_name: 'وكيل البصرة',
    };

    elements.forEach(el => {
      let content = '';
      if (el.type === ELEMENT_TYPES.TEXT_FIELD && el.field) {
        content = sampleData[el.field] || el.field;
      } else if (el.type === ELEMENT_TYPES.STATIC_TEXT) {
        content = el.text;
      } else if (el.type === ELEMENT_TYPES.IMAGE && el.imageUrl) {
        content = `<img src="${el.imageUrl}" alt="صورة" style="width:100%;height:100%;object-fit:contain;" />`;
      }

      const borderRadius = el.type === ELEMENT_TYPES.CIRCLE ? '50%' : '0';
      const borderStyle = el.borderStyle || 'solid';
      const padding = (el.type === ELEMENT_TYPES.LINE || el.type === ELEMENT_TYPES.VERTICAL_LINE) ? '0' : '5px';

      html += `
    <div class="element" style="
      top: ${el.y}px;
      left: ${el.x}px;
      width: ${el.width}px;
      height: ${el.height}px;
      font-size: ${el.fontSize}px;
      font-weight: ${el.fontWeight};
      text-align: ${el.textAlign};
      color: ${el.color};
      background-color: ${el.backgroundColor};
      border: ${el.borderWidth}px ${borderStyle} ${el.borderColor};
      border-radius: ${borderRadius};
      display: flex;
      align-items: center;
      justify-content: ${el.textAlign === 'right' ? 'flex-end' : el.textAlign === 'center' ? 'center' : 'flex-start'};
      padding: ${padding};
      overflow: hidden;
    ">${content}</div>
`;
    });

    html += `
  </div>
</body>
</html>
`;

    previewWindow.document.write(html);
    previewWindow.document.close();
  };

  const selectedElementData = elements.find(el => el.id === selectedElement);
  const pageConfig = PAGE_SIZES[pageSize];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container-fluid mx-auto p-4">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-2xl">🎨 مصمم القوالب المرئي</CardTitle>
              <div className="flex gap-2">
                <Button onClick={handleNew} variant="outline" size="sm">
                  <Plus className="ml-2 h-4 w-4" /> جديد
                </Button>
                <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700" size="sm">
                  <Save className="ml-2 h-4 w-4" /> حفظ
                </Button>
                <Button onClick={handlePreview} className="bg-blue-600 hover:bg-blue-700" size="sm">
                  <Eye className="ml-2 h-4 w-4" /> معاينة
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-12 gap-4">
              {/* القائمة اليمنى - الحقول والأدوات */}
              <div className="col-span-3 space-y-4">
                {/* إعدادات التصميم */}
                <div className="border rounded-lg p-3">
                  <h3 className="font-bold mb-3">إعدادات التصميم</h3>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm">نوع الوصل</Label>
                      <Select value={templateType} onValueChange={setTemplateType}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="send_transfer">📤 إرسال حوالة</SelectItem>
                          <SelectItem value="receive_transfer">📥 تسليم حوالة</SelectItem>
                          <SelectItem value="commission_receipt">💰 وصل عمولة</SelectItem>
                          <SelectItem value="account_statement">📋 كشف حساب</SelectItem>
                          <SelectItem value="deposit_receipt">💵 وصل إيداع</SelectItem>
                          <SelectItem value="general_receipt">📄 وصل عام</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">اسم التصميم</Label>
                      <Input
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="مثال: وصل A5"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">حجم الصفحة</Label>
                      <Select value={pageSize} onValueChange={setPageSize}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(PAGE_SIZES).map(([key, config]) => (
                            <SelectItem key={key} value={key}>{config.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="showGrid"
                        checked={showGrid}
                        onChange={(e) => setShowGrid(e.target.checked)}
                        className="rounded"
                      />
                      <Label htmlFor="showGrid" className="text-sm cursor-pointer">
                        <Grid className="inline h-4 w-4 ml-1" /> إظهار الشبكة
                      </Label>
                    </div>
                  </div>
                </div>

                {/* الأدوات */}
                <div className="border rounded-lg p-3">
                  <h3 className="font-bold mb-3">الأدوات</h3>
                  <div className="space-y-2">
                    <Button
                      onClick={() => addElement(ELEMENT_TYPES.STATIC_TEXT)}
                      variant="outline"
                      className="w-full justify-start"
                      size="sm"
                    >
                      <Type className="ml-2 h-4 w-4" /> نص ثابت
                    </Button>
                    <Button
                      onClick={() => addElement(ELEMENT_TYPES.RECTANGLE)}
                      variant="outline"
                      className="w-full justify-start"
                      size="sm"
                    >
                      <Square className="ml-2 h-4 w-4" /> مستطيل
                    </Button>
                    <Button
                      onClick={() => addElement(ELEMENT_TYPES.CIRCLE)}
                      variant="outline"
                      className="w-full justify-start"
                      size="sm"
                    >
                      ⭕ دائرة
                    </Button>
                    <Button
                      onClick={() => addElement(ELEMENT_TYPES.LINE)}
                      variant="outline"
                      className="w-full justify-start"
                      size="sm"
                    >
                      <Minus className="ml-2 h-4 w-4" /> خط أفقي
                    </Button>
                    <Button
                      onClick={() => addElement(ELEMENT_TYPES.VERTICAL_LINE)}
                      variant="outline"
                      className="w-full justify-start"
                      size="sm"
                    >
                      │ خط عمودي
                    </Button>
                    <Button
                      onClick={() => addElement(ELEMENT_TYPES.IMAGE)}
                      variant="outline"
                      className="w-full justify-start"
                      size="sm"
                    >
                      🖼️ صورة/لوجو
                    </Button>
                  </div>
                </div>

                {/* الحقول */}
                <div className="border rounded-lg p-3 max-h-96 overflow-y-auto">
                  <h3 className="font-bold mb-3">الحقول المتاحة</h3>
                  <div className="space-y-2">
                    {AVAILABLE_FIELDS.map((field, idx) => (
                      <div
                        key={idx}
                        onClick={() => addElement(ELEMENT_TYPES.TEXT_FIELD, field.value)}
                        className="p-2 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded cursor-pointer text-sm transition-colors"
                      >
                        <p className="font-bold">{field.name}</p>
                        <p className="text-xs text-gray-600">{`{{${field.value}}}`}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* التصاميم المحفوظة */}
                <div className="border rounded-lg p-3">
                  <h3 className="font-bold mb-3">التصاميم المحفوظة</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {templates.map((template) => (
                      <div key={template.id} className="flex gap-2 items-center">
                        <Button
                          onClick={() => handleLoad(template)}
                          variant="outline"
                          className="flex-1 text-sm justify-start"
                          size="sm"
                        >
                          <FolderOpen className="ml-2 h-3 w-3" /> {template.name}
                        </Button>
                        <Button
                          onClick={() => handleDelete(template.id)}
                          variant="destructive"
                          size="sm"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* منطقة التصميم */}
              <div className="col-span-6">
                <div className="border rounded-lg p-4 bg-gray-100 overflow-auto" style={{ minHeight: '600px' }}>
                  <div className="flex justify-center">
                    <div
                      className="relative bg-white shadow-lg"
                      style={{
                        width: `${pageConfig.width}px`,
                        height: `${pageConfig.height}px`,
                        backgroundImage: showGrid ? 'linear-gradient(#e0e0e0 1px, transparent 1px), linear-gradient(90deg, #e0e0e0 1px, transparent 1px)' : 'none',
                        backgroundSize: showGrid ? '20px 20px' : 'auto',
                      }}
                    >
                      {elements.map((el) => (
                        <Rnd
                          key={el.id}
                          size={{ width: el.width, height: el.height }}
                          position={{ x: el.x, y: el.y }}
                          onDragStop={(e, d) => updateElement(el.id, { x: d.x, y: d.y })}
                          onResizeStop={(e, direction, ref, delta, position) => {
                            updateElement(el.id, {
                              width: parseInt(ref.style.width),
                              height: parseInt(ref.style.height),
                              ...position,
                            });
                          }}
                          onClick={() => setSelectedElement(el.id)}
                          bounds="parent"
                          dragGrid={showGrid ? [20, 20] : [1, 1]}
                          resizeGrid={showGrid ? [20, 20] : [1, 1]}
                          className={`${selectedElement === el.id ? 'ring-2 ring-blue-500' : ''}`}
                          style={{
                            border: selectedElement === el.id ? '2px dashed #3b82f6' : '1px dashed #ccc',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: el.textAlign === 'right' ? 'flex-end' : el.textAlign === 'center' ? 'center' : 'flex-start',
                            padding: el.type === ELEMENT_TYPES.LINE || el.type === ELEMENT_TYPES.VERTICAL_LINE ? '0' : '5px',
                            fontSize: `${el.fontSize}px`,
                            fontWeight: el.fontWeight,
                            textAlign: el.textAlign,
                            color: el.color,
                            backgroundColor: el.backgroundColor,
                            borderWidth: (el.type === ELEMENT_TYPES.RECTANGLE || el.type === ELEMENT_TYPES.CIRCLE) ? `${el.borderWidth}px` : '0',
                            borderColor: el.borderColor,
                            borderStyle: el.borderStyle || 'solid',
                            borderRadius: el.type === ELEMENT_TYPES.CIRCLE ? '50%' : '0',
                            cursor: 'move',
                            overflow: el.type === ELEMENT_TYPES.IMAGE ? 'hidden' : 'visible',
                          }}
                        >
                          {el.type === ELEMENT_TYPES.TEXT_FIELD && el.field && (
                            <span>{`{{${el.field}}}`}</span>
                          )}
                          {el.type === ELEMENT_TYPES.STATIC_TEXT && (
                            <span>{el.text || 'نص جديد'}</span>
                          )}
                          {el.type === ELEMENT_TYPES.IMAGE && (
                            el.imageUrl ? (
                              <img src={el.imageUrl} alt="لوجو" className="w-full h-full object-contain" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-500 text-xs">
                                🖼️ صورة
                              </div>
                            )
                          )}
                        </Rnd>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* القائمة اليسرى - خصائص العنصر */}
              <div className="col-span-3">
                <div className="border rounded-lg p-3 sticky top-4">
                  <h3 className="font-bold mb-3">خصائص العنصر</h3>
                  {selectedElementData ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center pb-2 border-b">
                        <span className="text-sm font-semibold">
                          {selectedElementData.type === ELEMENT_TYPES.TEXT_FIELD && '📝 حقل نصي'}
                          {selectedElementData.type === ELEMENT_TYPES.STATIC_TEXT && '🔤 نص ثابت'}
                          {selectedElementData.type === ELEMENT_TYPES.LINE && '➖ خط أفقي'}
                          {selectedElementData.type === ELEMENT_TYPES.VERTICAL_LINE && '│ خط عمودي'}
                          {selectedElementData.type === ELEMENT_TYPES.RECTANGLE && '◻️ مستطيل'}
                          {selectedElementData.type === ELEMENT_TYPES.CIRCLE && '⭕ دائرة'}
                          {selectedElementData.type === ELEMENT_TYPES.IMAGE && '🖼️ صورة'}
                        </span>
                        <Button
                          onClick={() => deleteElement(selectedElement)}
                          variant="destructive"
                          size="sm"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>

                      {selectedElementData.type === ELEMENT_TYPES.STATIC_TEXT && (
                        <div>
                          <Label className="text-sm">النص</Label>
                          <Input
                            value={selectedElementData.text}
                            onChange={(e) => updateElement(selectedElement, { text: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                      )}

                      {selectedElementData.type === ELEMENT_TYPES.TEXT_FIELD && (
                        <div>
                          <Label className="text-sm">الحقل</Label>
                          <Select
                            value={selectedElementData.field}
                            onValueChange={(value) => updateElement(selectedElement, { field: value })}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {AVAILABLE_FIELDS.map((field) => (
                                <SelectItem key={field.value} value={field.value}>
                                  {field.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {(selectedElementData.type === ELEMENT_TYPES.TEXT_FIELD || selectedElementData.type === ELEMENT_TYPES.STATIC_TEXT) && (
                        <>
                          <div>
                            <Label className="text-sm">حجم الخط</Label>
                            <Input
                              type="number"
                              value={selectedElementData.fontSize}
                              onChange={(e) => updateElement(selectedElement, { fontSize: parseInt(e.target.value) || 14 })}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-sm">وزن الخط</Label>
                            <Select
                              value={selectedElementData.fontWeight}
                              onValueChange={(value) => updateElement(selectedElement, { fontWeight: value })}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="normal">عادي</SelectItem>
                                <SelectItem value="bold">عريض</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-sm">المحاذاة</Label>
                            <Select
                              value={selectedElementData.textAlign}
                              onValueChange={(value) => updateElement(selectedElement, { textAlign: value })}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="right">يمين</SelectItem>
                                <SelectItem value="center">وسط</SelectItem>
                                <SelectItem value="left">يسار</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-sm">اللون</Label>
                            <Input
                              type="color"
                              value={selectedElementData.color}
                              onChange={(e) => updateElement(selectedElement, { color: e.target.value })}
                              className="mt-1 h-10"
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <Label className="text-sm">لون الخلفية</Label>
                        <Input
                          type="color"
                          value={selectedElementData.backgroundColor === 'transparent' ? '#ffffff' : selectedElementData.backgroundColor}
                          onChange={(e) => updateElement(selectedElement, { backgroundColor: e.target.value })}
                          className="mt-1 h-10"
                        />
                      </div>

                      {selectedElementData.type === ELEMENT_TYPES.IMAGE && (
                        <div>
                          <Label className="text-sm">رابط الصورة</Label>
                          <Input
                            value={selectedElementData.imageUrl || ''}
                            onChange={(e) => updateElement(selectedElement, { imageUrl: e.target.value })}
                            placeholder="https://example.com/logo.png"
                            className="mt-1"
                          />
                          <p className="text-xs text-gray-500 mt-1">أدخل رابط الصورة أو اللوجو</p>
                        </div>
                      )}

                      {(selectedElementData.type === ELEMENT_TYPES.RECTANGLE || selectedElementData.type === ELEMENT_TYPES.CIRCLE) && (
                        <>
                          <div>
                            <Label className="text-sm">عرض الحدود</Label>
                            <Input
                              type="number"
                              value={selectedElementData.borderWidth}
                              onChange={(e) => updateElement(selectedElement, { borderWidth: parseInt(e.target.value) || 0 })}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-sm">لون الحدود</Label>
                            <Input
                              type="color"
                              value={selectedElementData.borderColor}
                              onChange={(e) => updateElement(selectedElement, { borderColor: e.target.value })}
                              className="mt-1 h-10"
                            />
                          </div>
                          <div>
                            <Label className="text-sm">نمط الحدود</Label>
                            <Select
                              value={selectedElementData.borderStyle || 'solid'}
                              onValueChange={(value) => updateElement(selectedElement, { borderStyle: value })}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="solid">متصل</SelectItem>
                                <SelectItem value="dashed">متقطع</SelectItem>
                                <SelectItem value="dotted">منقط</SelectItem>
                                <SelectItem value="double">مزدوج</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-sm">X</Label>
                          <Input
                            type="number"
                            value={Math.round(selectedElementData.x)}
                            onChange={(e) => updateElement(selectedElement, { x: parseInt(e.target.value) || 0 })}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">Y</Label>
                          <Input
                            type="number"
                            value={Math.round(selectedElementData.y)}
                            onChange={(e) => updateElement(selectedElement, { y: parseInt(e.target.value) || 0 })}
                            className="mt-1"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-sm">العرض</Label>
                          <Input
                            type="number"
                            value={Math.round(selectedElementData.width)}
                            onChange={(e) => updateElement(selectedElement, { width: parseInt(e.target.value) || 50 })}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">الارتفاع</Label>
                          <Input
                            type="number"
                            value={Math.round(selectedElementData.height)}
                            onChange={(e) => updateElement(selectedElement, { height: parseInt(e.target.value) || 20 })}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-8">
                      اضغط على عنصر لتعديل خصائصه
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VisualTemplateDesignerPage;
