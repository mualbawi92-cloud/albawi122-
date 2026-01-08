#!/usr/bin/env python3
"""
سكربت استيراد البيانات إلى MongoDB
شغّل هذا السكربت بعد تثبيت MongoDB
"""
import json
import os
from pymongo import MongoClient

# الاتصال بـ MongoDB
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/money_transfer_db')
client = MongoClient(MONGO_URL)
db = client['money_transfer_db']

# مسار ملفات البيانات
DATA_DIR = os.path.join(os.path.dirname(__file__), 'database')

def import_collection(name):
    """استيراد collection واحد"""
    file_path = os.path.join(DATA_DIR, f'{name}.json')
    
    if not os.path.exists(file_path):
        print(f'⚠️  ملف {name}.json غير موجود')
        return 0
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if not data:
        print(f'📭 {name}: فارغ')
        return 0
    
    # حذف البيانات القديمة
    db[name].delete_many({})
    
    # إدخال البيانات الجديدة
    db[name].insert_many(data)
    print(f'✅ {name}: {len(data)} سجل')
    return len(data)

def main():
    print('=' * 50)
    print('🚀 بدء استيراد البيانات إلى MongoDB')
    print('=' * 50)
    
    # قائمة الـ collections
    collections = [
        'users', 'transfers', 'chart_of_accounts', 'journal_entries',
        'wallet_transactions', 'admin_commissions', 'commission_rates',
        'notifications', 'visual_templates', 'templates', 'receipts',
        'exchange_rates', 'account_categories', 'audit_logs',
        'pin_attempts', 'transit_account', 'transit_transactions',
        'counters', 'accounts', 'currency_revaluations'
    ]
    
    total = 0
    for col in collections:
        total += import_collection(col)
    
    print('=' * 50)
    print(f'🎉 تم استيراد {total} سجل بنجاح!')
    print('=' * 50)

if __name__ == '__main__':
    main()
