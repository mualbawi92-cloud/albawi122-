/**
 * ملف API الموحد
 * جميع طلبات الـ API تمر من هنا فقط
 */
import axios from 'axios';

// إنشاء instance واحد لـ axios
const api = axios.create({
  baseURL: process.env.REACT_APP_BACKEND_URL + '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor لإضافة التوكن تلقائياً لكل طلب
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor للتعامل مع الأخطاء
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // إذا كان الخطأ 401 (غير مصرح)، إعادة التوجيه لصفحة الدخول
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // إعادة التوجيه لصفحة الدخول
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
