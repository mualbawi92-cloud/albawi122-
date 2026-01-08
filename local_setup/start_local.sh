#!/bin/bash

echo "========================================"
echo "   نظام الحوالات - التشغيل المحلي"
echo "========================================"
echo ""

# التحقق من MongoDB
echo "[1/4] التحقق من MongoDB..."
if ! pgrep -x "mongod" > /dev/null; then
    echo "⚠️  تشغيل MongoDB..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew services start mongodb-community
    else
        sudo systemctl start mongodb
    fi
fi
echo "✅ MongoDB يعمل"
echo ""

# استيراد البيانات
echo "[2/4] استيراد البيانات..."
cd "$(dirname "$0")"
python3 import_data.py
echo ""

# تشغيل Backend
echo "[3/4] تشغيل Backend..."
cd ../backend
source venv/bin/activate 2>/dev/null || python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt -q
uvicorn server:app --host 0.0.0.0 --port 8001 --reload &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"
echo ""

sleep 3

# تشغيل Frontend
echo "[4/4] تشغيل Frontend..."
cd ../frontend
yarn install --silent
yarn start &
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID)"
echo ""

echo "========================================"
echo "🎉 التطبيق يعمل!"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8001"
echo "========================================"
echo ""
echo "اضغط Ctrl+C للإيقاف"

# انتظار
wait
