#!/bin/bash

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║       نظام إدارة الحوالات المالية                      ║"
echo "║       Money Transfer Management System                 ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker غير مثبت!"
    echo ""
    echo "يرجى تثبيت Docker من:"
    echo "https://www.docker.com/products/docker-desktop"
    echo ""
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker ليس قيد التشغيل!"
    echo ""
    echo "يرجى تشغيل Docker أولاً"
    echo ""
    exit 1
fi

echo "✅ Docker جاهز"
echo ""
echo "🚀 جاري تشغيل النظام..."
echo "   قد يستغرق هذا بضع دقائق في المرة الأولى"
echo ""

# Start containers
docker-compose up -d --build

if [ $? -eq 0 ]; then
    echo ""
    echo "════════════════════════════════════════════════════════"
    echo ""
    echo "✅ تم تشغيل النظام بنجاح!"
    echo ""
    echo "🌐 الواجهة: http://localhost:3000"
    echo "📡 API: http://localhost:8001"
    echo "📚 التوثيق: http://localhost:8001/docs"
    echo ""
    echo "🔑 بيانات الدخول:"
    echo "   المستخدم: admin"
    echo "   كلمة المرور: admin123"
    echo ""
    echo "════════════════════════════════════════════════════════"
    echo ""
    echo "لإيقاف النظام: docker-compose down"
    echo ""
    
    # Open browser (Mac/Linux)
    sleep 5
    if command -v xdg-open &> /dev/null; then
        xdg-open http://localhost:3000
    elif command -v open &> /dev/null; then
        open http://localhost:3000
    fi
else
    echo ""
    echo "❌ حدث خطأ أثناء التشغيل"
    echo "يرجى التحقق من سجلات Docker"
    echo ""
fi
