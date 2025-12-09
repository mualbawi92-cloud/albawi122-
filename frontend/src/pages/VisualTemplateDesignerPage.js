import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
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
  const [multiSelect, setMultiSelect] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('لا تملك صلاحية الوصول لهذه الصفحة');
      navigate('/dashboard');
      return;
    }
    fetchTemplates();
  }, [user, navigate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedElement) return;
      
      const el = elements.find(el => el.id === selectedElement);
      if (!el) return;
      
      const currentPageConfig = PAGE_SIZES[pageSize] || PAGE_SIZES['A5_landscape'];
      const step = e.shiftKey ? 1 : 10; // Shift للتحريك الدقيق
      
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        updateElement(selectedElement, { y: Math.max(0, el.y - step) });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        updateElement(selectedElement, { y: Math.min(currentPageConfig.height - el.height, el.y + step) });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        updateElement(selectedElement, { x: Math.max(0, el.x - step) });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        updateElement(selectedElement, { x: Math.min(currentPageConfig.width - el.width, el.x + step) });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteElement(selectedElement);
      } else if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        // نسخ
        const newEl = { ...el, id: Date.now().toString(), x: el.x + 20, y: el.y + 20 };
        setElements([...elements, newEl]);
        setSelectedElement(newEl.id);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElement, elements, pageSize]);

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

  const handleSave = async (applyAsDefault = false) => {
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
        is_active: applyAsDefault,
      };

      if (currentTemplate) {
        await axios.put(`${API}/visual-templates/${currentTemplate.id}`, payload);
        toast.success('تم تحديث التصميم بنجاح');
      } else {
        await axios.post(`${API}/visual-templates`, payload);
        toast.success('تم حفظ التصميم بنجاح');
      }

      if (applyAsDefault) {
        toast.success(`✅ تم تطبيق التصميم على: ${templateType === 'send_transfer' ? 'وصولات الإرسال' : 'وصولات التسليم'}`);
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

  // تحميل التصميم النشط عند تغيير نوع الوصل
  const loadActiveTemplate = async (type) => {
    try {
      const response = await axios.get(`${API}/visual-templates/active/${type}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.data) {
        handleLoad(response.data);
        toast.success(`✅ تم تحميل التصميم النشط: ${response.data.name}`);
      }
    } catch (error) {
      // لا يوجد تصميم نشط - استخدم القالب الافتراضي
      console.log('No active template, using default');
    }
  };

  // عند تغيير نوع الوصل، جلب التصميم النشط
  useEffect(() => {
    if (templateType) {
      loadActiveTemplate(templateType);
    }
  }, [templateType]);

  // دالة رفع ملف Excel واستيراد التصميم
  const handleExcelUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAiLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('page_size', pageSize);

      const response = await axios.post(
        `${API}/import-from-excel`,
        formData,
        { 
          headers: { 
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'multipart/form-data'
          } 
        }
      );

      if (response.data.elements) {
        setElements(response.data.elements);
        setTemplateName(response.data.suggested_name || 'تصميم من Excel');
        setPageSize(response.data.page_size || pageSize);
        toast.success(`🎉 تم استيراد ${response.data.elements.length} عنصر من Excel!`);
      }
    } catch (error) {
      console.error('Excel Import Error:', error);
      toast.error(error.response?.data?.detail || 'خطأ في استيراد ملف Excel');
    } finally {
      setAiLoading(false);
      e.target.value = ''; // Reset input
    }
  };

  const loadDefaultTemplate = (type) => {
    handleNew();
    
    if (type === 'send_transfer') {
      setTemplateName('وصل إرسال حوالة - افتراضي');
      setTemplateType('send_transfer');
      setPageSize('A5_landscape');
      
      // عناصر وصل الإرسال
      const defaultElements = [
        // العنوان
        { id: '1', type: ELEMENT_TYPES.STATIC_TEXT, x: 300, y: 20, width: 200, height: 40, text: 'وصل إرسال حوالة', fontFamily: 'Arial', fontSize: 24, fontWeight: 'bold', textAlign: 'center', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // إطار خارجي
        { id: '2', type: ELEMENT_TYPES.RECTANGLE, x: 20, y: 10, width: 754, height: 520, text: '', fontFamily: 'Arial', fontSize: 14, fontWeight: 'normal', textAlign: 'right', color: '#000000', backgroundColor: 'transparent', borderWidth: 2, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // خط فاصل بعد العنوان
        { id: '3', type: ELEMENT_TYPES.LINE, x: 30, y: 70, width: 734, height: 2, text: '', fontFamily: 'Arial', fontSize: 14, fontWeight: 'normal', textAlign: 'right', color: '#000000', backgroundColor: '#000000', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // رقم الحوالة
        { id: '4', type: ELEMENT_TYPES.STATIC_TEXT, x: 650, y: 85, width: 100, height: 25, text: 'رقم الحوالة:', fontFamily: 'Arial', fontSize: 12, fontWeight: 'bold', textAlign: 'right', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        { id: '5', type: ELEMENT_TYPES.TEXT_FIELD, field: 'tracking_number', x: 520, y: 85, width: 120, height: 25, text: '', fontFamily: 'Arial', fontSize: 12, fontWeight: 'normal', textAlign: 'right', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // كود الحوالة
        { id: '6', type: ELEMENT_TYPES.STATIC_TEXT, x: 400, y: 85, width: 100, height: 25, text: 'كود الحوالة:', fontFamily: 'Arial', fontSize: 12, fontWeight: 'bold', textAlign: 'right', color: '#e53e3e', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        { id: '7', type: ELEMENT_TYPES.TEXT_FIELD, field: 'transfer_code', x: 300, y: 85, width: 90, height: 25, text: '', fontFamily: 'Arial', fontSize: 16, fontWeight: 'bold', textAlign: 'center', color: '#e53e3e', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '3', opacity: 1, rotation: 0 },
        
        // التاريخ
        { id: '8', type: ELEMENT_TYPES.STATIC_TEXT, x: 180, y: 85, width: 70, height: 25, text: 'التاريخ:', fontFamily: 'Arial', fontSize: 12, fontWeight: 'bold', textAlign: 'right', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        { id: '9', type: ELEMENT_TYPES.TEXT_FIELD, field: 'created_date', x: 50, y: 85, width: 120, height: 25, text: '', fontFamily: 'Arial', fontSize: 12, fontWeight: 'normal', textAlign: 'right', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // بيانات المرسل - عنوان
        { id: '10', type: ELEMENT_TYPES.STATIC_TEXT, x: 600, y: 130, width: 150, height: 30, text: 'بيانات المرسل', fontFamily: 'Arial', fontSize: 14, fontWeight: 'bold', textAlign: 'center', color: '#ffffff', backgroundColor: '#333333', borderWidth: 1, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // اسم المرسل
        { id: '11', type: ELEMENT_TYPES.STATIC_TEXT, x: 690, y: 170, width: 60, height: 25, text: 'الاسم:', fontFamily: 'Arial', fontSize: 11, fontWeight: 'bold', textAlign: 'right', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        { id: '12', type: ELEMENT_TYPES.TEXT_FIELD, field: 'sender_name', x: 520, y: 170, width: 160, height: 25, text: '', fontFamily: 'Arial', fontSize: 11, fontWeight: 'normal', textAlign: 'right', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // هاتف المرسل
        { id: '13', type: ELEMENT_TYPES.STATIC_TEXT, x: 690, y: 200, width: 60, height: 25, text: 'الهاتف:', fontFamily: 'Arial', fontSize: 11, fontWeight: 'bold', textAlign: 'right', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        { id: '14', type: ELEMENT_TYPES.TEXT_FIELD, field: 'sender_phone', x: 520, y: 200, width: 160, height: 25, text: '', fontFamily: 'Arial', fontSize: 11, fontWeight: 'normal', textAlign: 'right', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // مدينة الإرسال
        { id: '15', type: ELEMENT_TYPES.STATIC_TEXT, x: 690, y: 230, width: 60, height: 25, text: 'المدينة:', fontFamily: 'Arial', fontSize: 11, fontWeight: 'bold', textAlign: 'right', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        { id: '16', type: ELEMENT_TYPES.TEXT_FIELD, field: 'sending_city', x: 520, y: 230, width: 160, height: 25, text: '', fontFamily: 'Arial', fontSize: 11, fontWeight: 'normal', textAlign: 'right', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // بيانات المستفيد - عنوان
        { id: '17', type: ELEMENT_TYPES.STATIC_TEXT, x: 50, y: 130, width: 150, height: 30, text: 'بيانات المستفيد', fontFamily: 'Arial', fontSize: 14, fontWeight: 'bold', textAlign: 'center', color: '#ffffff', backgroundColor: '#333333', borderWidth: 1, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // اسم المستفيد
        { id: '18', type: ELEMENT_TYPES.STATIC_TEXT, x: 360, y: 170, width: 60, height: 25, text: 'الاسم:', fontFamily: 'Arial', fontSize: 11, fontWeight: 'bold', textAlign: 'right', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        { id: '19', type: ELEMENT_TYPES.TEXT_FIELD, field: 'receiver_name', x: 190, y: 170, width: 160, height: 25, text: '', fontFamily: 'Arial', fontSize: 11, fontWeight: 'normal', textAlign: 'right', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // هاتف المستفيد
        { id: '20', type: ELEMENT_TYPES.STATIC_TEXT, x: 360, y: 200, width: 60, height: 25, text: 'الهاتف:', fontFamily: 'Arial', fontSize: 11, fontWeight: 'bold', textAlign: 'right', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        { id: '21', type: ELEMENT_TYPES.TEXT_FIELD, field: 'receiver_phone', x: 190, y: 200, width: 160, height: 25, text: '', fontFamily: 'Arial', fontSize: 11, fontWeight: 'normal', textAlign: 'right', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // مدينة الاستلام
        { id: '22', type: ELEMENT_TYPES.STATIC_TEXT, x: 360, y: 230, width: 60, height: 25, text: 'المدينة:', fontFamily: 'Arial', fontSize: 11, fontWeight: 'bold', textAlign: 'right', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        { id: '23', type: ELEMENT_TYPES.TEXT_FIELD, field: 'receiving_city', x: 190, y: 230, width: 160, height: 25, text: '', fontFamily: 'Arial', fontSize: 11, fontWeight: 'normal', textAlign: 'right', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // خط فاصل
        { id: '24', type: ELEMENT_TYPES.LINE, x: 30, y: 280, width: 734, height: 2, text: '', fontFamily: 'Arial', fontSize: 14, fontWeight: 'normal', textAlign: 'right', color: '#000000', backgroundColor: '#000000', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // معلومات المبلغ - عنوان
        { id: '25', type: ELEMENT_TYPES.STATIC_TEXT, x: 320, y: 300, width: 150, height: 30, text: 'معلومات المبلغ', fontFamily: 'Arial', fontSize: 14, fontWeight: 'bold', textAlign: 'center', color: '#ffffff', backgroundColor: '#333333', borderWidth: 1, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // المبلغ
        { id: '26', type: ELEMENT_TYPES.STATIC_TEXT, x: 690, y: 345, width: 60, height: 25, text: 'المبلغ:', fontFamily: 'Arial', fontSize: 11, fontWeight: 'bold', textAlign: 'right', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        { id: '27', type: ELEMENT_TYPES.TEXT_FIELD, field: 'amount', x: 600, y: 345, width: 80, height: 25, text: '', fontFamily: 'Arial', fontSize: 14, fontWeight: 'bold', textAlign: 'center', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // العملة
        { id: '28', type: ELEMENT_TYPES.STATIC_TEXT, x: 550, y: 345, width: 40, height: 25, text: 'IQD', fontFamily: 'Arial', fontSize: 11, fontWeight: 'normal', textAlign: 'center', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // العمولة
        { id: '29', type: ELEMENT_TYPES.STATIC_TEXT, x: 400, y: 345, width: 60, height: 25, text: 'العمولة:', fontFamily: 'Arial', fontSize: 11, fontWeight: 'bold', textAlign: 'right', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        { id: '30', type: ELEMENT_TYPES.TEXT_FIELD, field: 'outgoing_commission', x: 310, y: 345, width: 80, height: 25, text: '', fontFamily: 'Arial', fontSize: 11, fontWeight: 'normal', textAlign: 'center', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // إطار كود الحوالة
        { id: '31', type: ELEMENT_TYPES.RECTANGLE, x: 250, y: 390, width: 290, height: 80, text: '', fontFamily: 'Arial', fontSize: 14, fontWeight: 'normal', textAlign: 'center', color: '#000000', backgroundColor: '#fff5f5', borderWidth: 2, borderColor: '#e53e3e', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // نص كود الحوالة
        { id: '32', type: ELEMENT_TYPES.STATIC_TEXT, x: 260, y: 400, width: 270, height: 20, text: '⚠️ كود الحوالة السري (احفظه جيداً)', fontFamily: 'Arial', fontSize: 11, fontWeight: 'bold', textAlign: 'center', color: '#e53e3e', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // كود الحوالة كبير
        { id: '33', type: ELEMENT_TYPES.TEXT_FIELD, field: 'transfer_code', x: 260, y: 425, width: 270, height: 35, text: '', fontFamily: 'Arial', fontSize: 24, fontWeight: 'bold', textAlign: 'center', color: '#e53e3e', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '8', opacity: 1, rotation: 0 },
        
        // ملاحظة
        { id: '34', type: ELEMENT_TYPES.STATIC_TEXT, x: 50, y: 490, width: 700, height: 20, text: 'يرجى الاحتفاظ بهذا الوصل لحين استلام الحوالة - لا يمكن التسليم بدون كود الحوالة', fontFamily: 'Arial', fontSize: 9, fontWeight: 'normal', textAlign: 'center', color: '#666666', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
      ];
      
      setElements(defaultElements);
      toast.success('تم تحميل القالب الافتراضي: وصل إرسال حوالة');
      
    } else if (type === 'receive_transfer') {
      setTemplateName('وصل تسليم حوالة - افتراضي');
      setTemplateType('receive_transfer');
      setPageSize('A5_landscape');
      
      // عناصر وصل التسليم (مشابه مع تعديلات)
      const defaultElements = [
        // العنوان
        { id: '1', type: ELEMENT_TYPES.STATIC_TEXT, x: 300, y: 20, width: 200, height: 40, text: 'وصل تسليم حوالة', fontFamily: 'Arial', fontSize: 24, fontWeight: 'bold', textAlign: 'center', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // إطار خارجي
        { id: '2', type: ELEMENT_TYPES.RECTANGLE, x: 20, y: 10, width: 754, height: 520, text: '', fontFamily: 'Arial', fontSize: 14, fontWeight: 'normal', textAlign: 'right', color: '#000000', backgroundColor: 'transparent', borderWidth: 2, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // خط فاصل
        { id: '3', type: ELEMENT_TYPES.LINE, x: 30, y: 70, width: 734, height: 2, text: '', fontFamily: 'Arial', fontSize: 14, fontWeight: 'normal', textAlign: 'right', color: '#000000', backgroundColor: '#000000', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // رقم الحوالة
        { id: '4', type: ELEMENT_TYPES.STATIC_TEXT, x: 650, y: 85, width: 100, height: 25, text: 'رقم الحوالة:', fontFamily: 'Arial', fontSize: 12, fontWeight: 'bold', textAlign: 'right', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        { id: '5', type: ELEMENT_TYPES.TEXT_FIELD, field: 'tracking_number', x: 520, y: 85, width: 120, height: 25, text: '', fontFamily: 'Arial', fontSize: 12, fontWeight: 'normal', textAlign: 'right', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // الحالة
        { id: '6', type: ELEMENT_TYPES.STATIC_TEXT, x: 400, y: 85, width: 80, height: 25, text: 'الحالة:', fontFamily: 'Arial', fontSize: 12, fontWeight: 'bold', textAlign: 'right', color: '#059669', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        { id: '7', type: ELEMENT_TYPES.STATIC_TEXT, x: 300, y: 85, width: 90, height: 25, text: '✓ مكتملة', fontFamily: 'Arial', fontSize: 12, fontWeight: 'bold', textAlign: 'center', color: '#059669', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // تاريخ التسليم
        { id: '8', type: ELEMENT_TYPES.STATIC_TEXT, x: 180, y: 85, width: 100, height: 25, text: 'تاريخ التسليم:', fontFamily: 'Arial', fontSize: 12, fontWeight: 'bold', textAlign: 'right', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        { id: '9', type: ELEMENT_TYPES.TEXT_FIELD, field: 'created_date', x: 50, y: 85, width: 120, height: 25, text: '', fontFamily: 'Arial', fontSize: 12, fontWeight: 'normal', textAlign: 'right', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // بيانات المرسل
        { id: '10', type: ELEMENT_TYPES.STATIC_TEXT, x: 600, y: 130, width: 150, height: 30, text: 'بيانات المرسل', fontFamily: 'Arial', fontSize: 14, fontWeight: 'bold', textAlign: 'center', color: '#ffffff', backgroundColor: '#333333', borderWidth: 1, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        { id: '11', type: ELEMENT_TYPES.STATIC_TEXT, x: 690, y: 170, width: 60, height: 25, text: 'الاسم:', fontFamily: 'Arial', fontSize: 11, fontWeight: 'bold', textAlign: 'right', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        { id: '12', type: ELEMENT_TYPES.TEXT_FIELD, field: 'sender_name', x: 520, y: 170, width: 160, height: 25, text: '', fontFamily: 'Arial', fontSize: 11, fontWeight: 'normal', textAlign: 'right', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // بيانات المستلم
        { id: '17', type: ELEMENT_TYPES.STATIC_TEXT, x: 50, y: 130, width: 150, height: 30, text: 'بيانات المستلم', fontFamily: 'Arial', fontSize: 14, fontWeight: 'bold', textAlign: 'center', color: '#ffffff', backgroundColor: '#333333', borderWidth: 1, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        { id: '18', type: ELEMENT_TYPES.STATIC_TEXT, x: 360, y: 170, width: 60, height: 25, text: 'الاسم:', fontFamily: 'Arial', fontSize: 11, fontWeight: 'bold', textAlign: 'right', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        { id: '19', type: ELEMENT_TYPES.TEXT_FIELD, field: 'receiver_name', x: 190, y: 170, width: 160, height: 25, text: '', fontFamily: 'Arial', fontSize: 11, fontWeight: 'normal', textAlign: 'right', color: '#000000', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // المبلغ المستلم
        { id: '20', type: ELEMENT_TYPES.RECTANGLE, x: 250, y: 240, width: 290, height: 100, text: '', fontFamily: 'Arial', fontSize: 14, fontWeight: 'normal', textAlign: 'center', color: '#000000', backgroundColor: '#f0fdf4', borderWidth: 2, borderColor: '#059669', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        { id: '21', type: ELEMENT_TYPES.STATIC_TEXT, x: 260, y: 250, width: 270, height: 25, text: 'المبلغ المستلم', fontFamily: 'Arial', fontSize: 14, fontWeight: 'bold', textAlign: 'center', color: '#059669', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        { id: '22', type: ELEMENT_TYPES.TEXT_FIELD, field: 'amount', x: 260, y: 285, width: 270, height: 40, text: '', fontFamily: 'Arial', fontSize: 28, fontWeight: 'bold', textAlign: 'center', color: '#059669', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '2', opacity: 1, rotation: 0 },
        
        // توقيع المستلم
        { id: '23', type: ELEMENT_TYPES.RECTANGLE, x: 50, y: 370, width: 300, height: 80, text: '', fontFamily: 'Arial', fontSize: 14, fontWeight: 'normal', textAlign: 'center', color: '#000000', backgroundColor: 'transparent', borderWidth: 1, borderColor: '#000000', borderStyle: 'dashed', letterSpacing: '0', opacity: 1, rotation: 0 },
        { id: '24', type: ELEMENT_TYPES.STATIC_TEXT, x: 60, y: 380, width: 280, height: 25, text: 'توقيع المستلم', fontFamily: 'Arial', fontSize: 12, fontWeight: 'bold', textAlign: 'center', color: '#666666', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // ختم الوكيل
        { id: '25', type: ELEMENT_TYPES.RECTANGLE, x: 450, y: 370, width: 300, height: 80, text: '', fontFamily: 'Arial', fontSize: 14, fontWeight: 'normal', textAlign: 'center', color: '#000000', backgroundColor: 'transparent', borderWidth: 1, borderColor: '#000000', borderStyle: 'dashed', letterSpacing: '0', opacity: 1, rotation: 0 },
        { id: '26', type: ELEMENT_TYPES.STATIC_TEXT, x: 460, y: 380, width: 280, height: 25, text: 'ختم الوكيل', fontFamily: 'Arial', fontSize: 12, fontWeight: 'bold', textAlign: 'center', color: '#666666', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
        
        // ملاحظة
        { id: '27', type: ELEMENT_TYPES.STATIC_TEXT, x: 50, y: 490, width: 700, height: 20, text: 'تم استلام المبلغ كاملاً - شكراً لتعاملكم معنا', fontFamily: 'Arial', fontSize: 9, fontWeight: 'normal', textAlign: 'center', color: '#666666', backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'solid', letterSpacing: '0', opacity: 1, rotation: 0 },
      ];
      
      setElements(defaultElements);
      toast.success('تم تحميل القالب الافتراضي: وصل تسليم حوالة');
    }
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
      font-family: ${el.fontFamily || 'Arial'};
      font-size: ${el.fontSize}px;
      font-weight: ${el.fontWeight};
      text-align: ${el.textAlign};
      letter-spacing: ${el.letterSpacing || 0}px;
      color: ${el.color};
      background-color: ${el.backgroundColor};
      border: ${el.borderWidth}px ${borderStyle} ${el.borderColor};
      border-radius: ${borderRadius};
      opacity: ${el.opacity || 1};
      transform: rotate(${el.rotation || 0}deg);
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
      
      <div className="container-fluid mx-auto p-4">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-2xl">🎨 مصمم القوالب المرئي</CardTitle>
              <div className="flex gap-2">
                <Button onClick={handleNew} variant="outline" size="sm">
                  <Plus className="ml-2 h-4 w-4" /> جديد
                </Button>
                <Button onClick={() => handleSave(false)} className="bg-green-600 hover:bg-green-700" size="sm">
                  <Save className="ml-2 h-4 w-4" /> حفظ
                </Button>
                <Button onClick={() => handleSave(true)} className="bg-purple-600 hover:bg-purple-700" size="sm">
                  ⭐ حفظ وتطبيق
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
              <div className="col-span-2 space-y-4">
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

                {/* القوالب الافتراضية */}
                <div className="border rounded-lg p-3 bg-blue-50">
                  <h3 className="font-bold mb-3">⭐ القوالب الافتراضية</h3>
                  <div className="space-y-2">
                    <Button
                      onClick={() => loadDefaultTemplate('send_transfer')}
                      variant="outline"
                      className="w-full text-sm justify-start bg-white"
                      size="sm"
                    >
                      📤 وصل إرسال حوالة
                    </Button>
                    <Button
                      onClick={() => loadDefaultTemplate('receive_transfer')}
                      variant="outline"
                      className="w-full text-sm justify-start bg-white"
                      size="sm"
                    >
                      📥 وصل تسليم حوالة
                    </Button>
                  </div>
                </div>

                {/* استيراد من Excel */}
                <div className="border rounded-lg p-3 bg-gradient-to-r from-green-50 to-blue-50">
                  <h3 className="font-bold mb-3">📊 استيراد من Excel</h3>
                  <p className="text-xs text-gray-600 mb-2">صمم الوصل في Excel وارفعه، نحوله تلقائياً!</p>
                  <input
                    type="file"
                    id="excelUpload"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleExcelUpload}
                  />
                  <Button
                    onClick={() => document.getElementById('excelUpload').click()}
                    variant="outline"
                    className="w-full text-sm justify-start bg-white border-2 border-green-400 hover:bg-green-50"
                    size="sm"
                    disabled={aiLoading}
                  >
                    {aiLoading ? (
                      <>⏳ جاري الاستيراد...</>
                    ) : (
                      <>📊 ارفع ملف Excel</>
                    )}
                  </Button>
                  <p className="text-xs text-gray-500 mt-2">✓ يدعم .xlsx و .xls</p>
                </div>

                {/* التصاميم المحفوظة */}
                <div className="border rounded-lg p-3">
                  <h3 className="font-bold mb-3">التصاميم المحفوظة</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {templates.map((template) => (
                      <div key={template.id} className="flex gap-1 items-center">
                        <Button
                          onClick={() => handleLoad(template)}
                          variant="outline"
                          className="flex-1 text-sm justify-start"
                          size="sm"
                        >
                          {template.is_active && <span className="text-green-600">✓ </span>}
                          <FolderOpen className="ml-2 h-3 w-3" /> {template.name}
                        </Button>
                        {!template.is_active && (
                          <Button
                            onClick={async () => {
                              try {
                                await axios.put(`${API}/visual-templates/${template.id}`, 
                                  { is_active: true },
                                  { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
                                );
                                toast.success('✅ تم تطبيق التصميم');
                                fetchTemplates();
                              } catch (error) {
                                toast.error('خطأ في التطبيق');
                              }
                            }}
                            variant="outline"
                            className="text-xs px-2"
                            size="sm"
                            title="تطبيق"
                          >
                            ⭐
                          </Button>
                        )}
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
              <div className="col-span-8">
                {/* شريط الأدوات السريع */}
                {selectedElementData && (
                  <div className="border rounded-lg p-3 mb-3 bg-white">
                    <div className="flex gap-3 items-center flex-wrap">
                      <span className="font-bold text-sm">أدوات سريعة:</span>
                      
                      {/* المحاذاة */}
                      {(selectedElementData.type === ELEMENT_TYPES.TEXT_FIELD || selectedElementData.type === ELEMENT_TYPES.STATIC_TEXT) && (
                        <>
                          <div className="flex gap-1 border-r pr-3">
                            <Button
                              onClick={() => updateElement(selectedElement, { textAlign: 'right' })}
                              variant={selectedElementData.textAlign === 'right' ? 'default' : 'outline'}
                              size="sm"
                              className="px-3"
                            >
                              ⬅️ يمين
                            </Button>
                            <Button
                              onClick={() => updateElement(selectedElement, { textAlign: 'center' })}
                              variant={selectedElementData.textAlign === 'center' ? 'default' : 'outline'}
                              size="sm"
                              className="px-3"
                            >
                              ↔️ وسط
                            </Button>
                            <Button
                              onClick={() => updateElement(selectedElement, { textAlign: 'left' })}
                              variant={selectedElementData.textAlign === 'left' ? 'default' : 'outline'}
                              size="sm"
                              className="px-3"
                            >
                              ➡️ يسار
                            </Button>
                          </div>
                          
                          {/* لون الخط */}
                          <div className="flex gap-2 items-center border-r pr-3">
                            <span className="text-sm">لون الخط:</span>
                            <Input
                              type="color"
                              value={selectedElementData.color}
                              onChange={(e) => updateElement(selectedElement, { color: e.target.value })}
                              className="w-16 h-8"
                            />
                          </div>
                          
                          {/* حجم الخط */}
                          <div className="flex gap-2 items-center border-r pr-3">
                            <Button
                              onClick={() => updateElement(selectedElement, { fontSize: Math.max(8, selectedElementData.fontSize - 2) })}
                              variant="outline"
                              size="sm"
                              className="px-2"
                            >
                              A-
                            </Button>
                            <span className="text-sm w-8 text-center">{selectedElementData.fontSize}</span>
                            <Button
                              onClick={() => updateElement(selectedElement, { fontSize: selectedElementData.fontSize + 2 })}
                              variant="outline"
                              size="sm"
                              className="px-2"
                            >
                              A+
                            </Button>
                          </div>
                          
                          {/* عريض */}
                          <Button
                            onClick={() => updateElement(selectedElement, { fontWeight: selectedElementData.fontWeight === 'bold' ? 'normal' : 'bold' })}
                            variant={selectedElementData.fontWeight === 'bold' ? 'default' : 'outline'}
                            size="sm"
                            className="px-3 font-bold"
                          >
                            B
                          </Button>
                        </>
                      )}
                      
                      {/* لون الخلفية */}
                      <div className="flex gap-2 items-center border-r pr-3">
                        <span className="text-sm">خلفية:</span>
                        <Input
                          type="color"
                          value={selectedElementData.backgroundColor === 'transparent' ? '#ffffff' : selectedElementData.backgroundColor}
                          onChange={(e) => updateElement(selectedElement, { backgroundColor: e.target.value })}
                          className="w-16 h-8"
                        />
                        <Button
                          onClick={() => updateElement(selectedElement, { backgroundColor: 'transparent' })}
                          variant="outline"
                          size="sm"
                          className="px-2 text-xs"
                        >
                          شفاف
                        </Button>
                      </div>
                      
                      {/* أدوات الترتيب */}
                      <div className="flex gap-1 border-r pr-3">
                        <Button
                          onClick={() => {
                            const sorted = [...elements];
                            const idx = sorted.findIndex(e => e.id === selectedElement);
                            if (idx > 0) {
                              [sorted[idx], sorted[idx-1]] = [sorted[idx-1], sorted[idx]];
                              setElements(sorted);
                              toast.success('تم التقديم');
                            }
                          }}
                          variant="outline"
                          size="sm"
                          className="px-2"
                          title="تقديم للأمام"
                        >
                          ⬆️
                        </Button>
                        <Button
                          onClick={() => {
                            const sorted = [...elements];
                            const idx = sorted.findIndex(e => e.id === selectedElement);
                            if (idx < sorted.length - 1) {
                              [sorted[idx], sorted[idx+1]] = [sorted[idx+1], sorted[idx]];
                              setElements(sorted);
                              toast.success('تم التأخير');
                            }
                          }}
                          variant="outline"
                          size="sm"
                          className="px-2"
                          title="تأخير للخلف"
                        >
                          ⬇️
                        </Button>
                      </div>
                      
                      {/* نسخ ولصق */}
                      <div className="flex gap-1 border-r pr-3">
                        <Button
                          onClick={() => {
                            const el = elements.find(e => e.id === selectedElement);
                            if (el) {
                              const newEl = { ...el, id: Date.now().toString(), x: el.x + 20, y: el.y + 20 };
                              setElements([...elements, newEl]);
                              setSelectedElement(newEl.id);
                              toast.success('تم النسخ');
                            }
                          }}
                          variant="outline"
                          size="sm"
                          className="px-2"
                          title="نسخ"
                        >
                          📋
                        </Button>
                      </div>
                      
                      {/* محاذاة للصفحة */}
                      <div className="flex gap-1 border-r pr-3">
                        <Button
                          onClick={() => {
                            const el = selectedElementData;
                            updateElement(selectedElement, { x: (pageConfig.width - el.width) / 2 });
                            toast.success('تم التوسيط');
                          }}
                          variant="outline"
                          size="sm"
                          className="px-2"
                          title="توسيط أفقي"
                        >
                          ↔
                        </Button>
                        <Button
                          onClick={() => {
                            const el = selectedElementData;
                            updateElement(selectedElement, { y: (pageConfig.height - el.height) / 2 });
                            toast.success('تم التوسيط');
                          }}
                          variant="outline"
                          size="sm"
                          className="px-2"
                          title="توسيط عمودي"
                        >
                          ↕
                        </Button>
                      </div>
                      
                      {/* حذف */}
                      <Button
                        onClick={() => deleteElement(selectedElement)}
                        variant="destructive"
                        size="sm"
                        className="mr-auto"
                      >
                        <Trash2 className="h-4 w-4 ml-1" /> حذف
                      </Button>
                    </div>
                  </div>
                )}
                
                <div className="border rounded-lg p-4 bg-gray-100 overflow-auto" style={{ height: '700px', maxHeight: '700px' }}>
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
                            fontFamily: el.fontFamily || 'Arial',
                            fontSize: `${el.fontSize}px`,
                            fontWeight: el.fontWeight,
                            textAlign: el.textAlign,
                            letterSpacing: `${el.letterSpacing || 0}px`,
                            color: el.color,
                            backgroundColor: el.backgroundColor,
                            borderWidth: (el.type === ELEMENT_TYPES.RECTANGLE || el.type === ELEMENT_TYPES.CIRCLE || (el.borderWidth && el.borderWidth > 0)) ? `${el.borderWidth}px` : '0',
                            borderColor: el.borderColor,
                            borderStyle: el.borderStyle || 'solid',
                            borderRadius: el.type === ELEMENT_TYPES.CIRCLE ? '50%' : '0',
                            opacity: el.opacity || 1,
                            transform: `rotate(${el.rotation || 0}deg)`,
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
                
                {/* أدوات مساعدة */}
                <div className="border rounded-lg p-2 mt-3 bg-white">
                  <div className="flex gap-2 items-center flex-wrap text-sm">
                    <span className="font-bold">مساعدة:</span>
                    <Button
                      onClick={() => {
                        if (elements.length > 0) {
                          const minY = Math.min(...elements.map(e => e.y));
                          elements.forEach(el => {
                            updateElement(el.id, { y: minY });
                          });
                          toast.success('تم محاذاة الكل للأعلى');
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      محاذاة الكل للأعلى
                    </Button>
                    <Button
                      onClick={() => {
                        const step = 20;
                        let currentY = 50;
                        elements.forEach(el => {
                          updateElement(el.id, { y: currentY });
                          currentY += el.height + step;
                        });
                        toast.success('تم ترتيب العناصر عمودياً');
                      }}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      رص عمودي متساوي
                    </Button>
                    <Button
                      onClick={() => {
                        const step = 20;
                        let currentX = 50;
                        elements.forEach(el => {
                          updateElement(el.id, { x: currentX });
                          currentX += el.width + step;
                        });
                        toast.success('تم ترتيب العناصر أفقياً');
                      }}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      رص أفقي متساوي
                    </Button>
                    <Button
                      onClick={() => {
                        setElements([]);
                        setSelectedElement(null);
                        toast.success('تم مسح كل العناصر');
                      }}
                      variant="outline"
                      size="sm"
                      className="text-xs text-red-600"
                    >
                      مسح الكل
                    </Button>
                    <span className="text-xs text-gray-500 mr-auto">
                      عدد العناصر: {elements.length} | 
                      استخدم السهم + Shift لتحريك دقيق
                    </span>
                  </div>
                </div>
              </div>

              {/* القائمة اليسرى - خصائص العنصر */}
              <div className="col-span-2">
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
                            <Label className="text-sm">نوع الخط</Label>
                            <Select
                              value={selectedElementData.fontFamily || 'Arial'}
                              onValueChange={(value) => updateElement(selectedElement, { fontFamily: value })}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Arial">Arial</SelectItem>
                                <SelectItem value="Tahoma">Tahoma</SelectItem>
                                <SelectItem value="Verdana">Verdana</SelectItem>
                                <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                                <SelectItem value="Courier New">Courier New</SelectItem>
                                <SelectItem value="Georgia">Georgia</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
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
                            <Label className="text-sm">سُمك الخط</Label>
                            <Select
                              value={selectedElementData.fontWeight}
                              onValueChange={(value) => updateElement(selectedElement, { fontWeight: value })}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="100">100 - رفيع جداً</SelectItem>
                                <SelectItem value="200">200 - رفيع</SelectItem>
                                <SelectItem value="300">300 - خفيف</SelectItem>
                                <SelectItem value="normal">400 - عادي</SelectItem>
                                <SelectItem value="500">500 - متوسط</SelectItem>
                                <SelectItem value="600">600 - نصف عريض</SelectItem>
                                <SelectItem value="bold">700 - عريض</SelectItem>
                                <SelectItem value="800">800 - عريض جداً</SelectItem>
                                <SelectItem value="900">900 - أسود</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-sm">تباعد الأحرف</Label>
                            <Input
                              type="number"
                              value={selectedElementData.letterSpacing || 0}
                              onChange={(e) => updateElement(selectedElement, { letterSpacing: e.target.value })}
                              className="mt-1"
                              step="0.5"
                            />
                            <p className="text-xs text-gray-500 mt-1">بكسل (px)</p>
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

                      <div>
                        <Label className="text-sm">الشفافية ({Math.round((selectedElementData.opacity || 1) * 100)}%)</Label>
                        <Input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={selectedElementData.opacity || 1}
                          onChange={(e) => updateElement(selectedElement, { opacity: parseFloat(e.target.value) })}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label className="text-sm">الدوران ({selectedElementData.rotation || 0}°)</Label>
                        <Input
                          type="range"
                          min="0"
                          max="360"
                          step="5"
                          value={selectedElementData.rotation || 0}
                          onChange={(e) => updateElement(selectedElement, { rotation: parseInt(e.target.value) })}
                          className="mt-1"
                        />
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
