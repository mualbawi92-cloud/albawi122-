#!/usr/bin/env python3
"""
إنشاء قاعدة البيانات والمستخدم الافتراضي
"""
import os
import sys
from datetime import datetime, timezone
from uuid import uuid4

try:
    from pymongo import MongoClient
    from passlib.context import CryptContext
except ImportError:
    print("Installing required packages...")
    os.system(f"{sys.executable} -m pip install pymongo passlib bcrypt -q")
    from pymongo import MongoClient
    from passlib.context import CryptContext

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/money_transfer_db')
DB_NAME = 'money_transfer_db'

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def init_database():
    try:
        client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
        client.server_info()  # Test connection
        db = client[DB_NAME]
        
        # إنشاء المستخدم الافتراضي
        if not db.users.find_one({"username": "admin"}):
            admin_user = {
                "id": str(uuid4()),
                "username": "admin",
                "full_name": "المدير العام",
                "email": "admin@system.local",
                "password_hash": pwd_context.hash("admin123"),
                "role": "admin",
                "permissions": ["all"],
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "governorate": "بغداد"
            }
            db.users.insert_one(admin_user)
            print("✅ تم إنشاء المستخدم: admin / admin123")
        
        # إنشاء العداد
        if not db.counters.find_one({"_id": "transfer_code"}):
            db.counters.insert_one({"_id": "transfer_code", "seq": 0})
        
        # إنشاء التصنيفات
        if db.account_categories.count_documents({}) == 0:
            categories = [
                {"id": str(uuid4()), "name": "أصول", "type": "asset", "code": "1"},
                {"id": str(uuid4()), "name": "خصوم", "type": "liability", "code": "2"},
                {"id": str(uuid4()), "name": "إيرادات", "type": "revenue", "code": "3"},
                {"id": str(uuid4()), "name": "مصروفات", "type": "expense", "code": "4"}
            ]
            db.account_categories.insert_many(categories)
        
        print("✅ قاعدة البيانات جاهزة")
        client.close()
        
    except Exception as e:
        print(f"⚠️ لا يمكن الاتصال بقاعدة البيانات: {e}")

if __name__ == "__main__":
    init_database()
