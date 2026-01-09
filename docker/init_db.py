#!/usr/bin/env python3
"""
سكربت إنشاء قاعدة البيانات والمستخدم الافتراضي
يعمل تلقائياً عند بدء تشغيل الـ container
"""
import os
import asyncio
from datetime import datetime, timezone
from uuid import uuid4
from pymongo import MongoClient
from passlib.context import CryptContext

# إعدادات
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://mongodb:27017/money_transfer_db')
DB_NAME = os.environ.get('DB_NAME', 'money_transfer_db')

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def init_database():
    print("🚀 بدء تهيئة قاعدة البيانات...")
    
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    # 1. إنشاء المستخدم الافتراضي (admin)
    existing_admin = db.users.find_one({"username": "admin"})
    if not existing_admin:
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
        print("✅ تم إنشاء المستخدم الافتراضي: admin / admin123")
    else:
        print("ℹ️ المستخدم admin موجود مسبقاً")
    
    # 2. إنشاء تصنيفات الحسابات الافتراضية
    if db.account_categories.count_documents({}) == 0:
        categories = [
            {"id": str(uuid4()), "name": "أصول", "type": "asset", "code": "1"},
            {"id": str(uuid4()), "name": "خصوم", "type": "liability", "code": "2"},
            {"id": str(uuid4()), "name": "إيرادات", "type": "revenue", "code": "3"},
            {"id": str(uuid4()), "name": "مصروفات", "type": "expense", "code": "4"}
        ]
        db.account_categories.insert_many(categories)
        print("✅ تم إنشاء تصنيفات الحسابات")
    
    # 3. إنشاء الحسابات الأساسية
    if db.chart_of_accounts.count_documents({}) == 0:
        accounts = [
            {"id": str(uuid4()), "code": "1001", "name": "الصندوق - دينار", "type": "asset", "currency": "IQD", "balance": 0},
            {"id": str(uuid4()), "code": "1002", "name": "الصندوق - دولار", "type": "asset", "currency": "USD", "balance": 0},
            {"id": str(uuid4()), "code": "2001", "name": "ذمم الوكلاء", "type": "liability", "currency": "IQD", "balance": 0},
            {"id": str(uuid4()), "code": "3001", "name": "إيرادات العمولات", "type": "revenue", "currency": "IQD", "balance": 0},
            {"id": str(uuid4()), "code": "4001", "name": "مصروفات عمومية", "type": "expense", "currency": "IQD", "balance": 0}
        ]
        db.chart_of_accounts.insert_many(accounts)
        print("✅ تم إنشاء دليل الحسابات")
    
    # 4. إنشاء العداد
    if db.counters.count_documents({}) == 0:
        db.counters.insert_one({"_id": "transfer_code", "seq": 0})
        print("✅ تم إنشاء العدادات")
    
    # 5. إنشاء الفهارس
    db.users.create_index("username", unique=True)
    db.users.create_index("email")
    db.transfers.create_index("transfer_code")
    db.transfers.create_index("status")
    db.transfers.create_index("created_at")
    print("✅ تم إنشاء الفهارس")
    
    print("")
    print("🎉 تم تهيئة قاعدة البيانات بنجاح!")
    print("="*50)
    print("بيانات الدخول:")
    print("  المستخدم: admin")
    print("  كلمة المرور: admin123")
    print("="*50)
    
    client.close()

if __name__ == "__main__":
    init_database()
