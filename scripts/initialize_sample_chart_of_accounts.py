"""
Script to initialize chart of accounts with sample accounts for testing
إنشاء دليل محاسبي تجريبي للاختبار
"""
import os
import sys
from datetime import datetime, timezone
from pymongo import MongoClient

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = MongoClient(mongo_url)
db = client['exchange_system']

def initialize_chart_of_accounts():
    """
    إنشاء حسابات تجريبية في الدليل المحاسبي
    """
    
    # Sample accounts
    sample_accounts = [
        {
            'code': '1001',
            'name': 'الخزينة - دينار',
            'type': 'assets',
            'category': 'current_assets',
            'balance_iqd': 10000000,
            'balance_usd': 0,
            'is_active': True
        },
        {
            'code': '1002',
            'name': 'الخزينة - دولار',
            'type': 'assets',
            'category': 'current_assets',
            'balance_iqd': 0,
            'balance_usd': 5000,
            'is_active': True
        },
        {
            'code': '2001',
            'name': 'صيرفة كربلاء',
            'type': 'assets',
            'category': 'accounts_receivable',
            'balance_iqd': 5000000,
            'balance_usd': 2000,
            'is_active': True
        },
        {
            'code': '2002',
            'name': 'صيرفة بغداد',
            'type': 'assets',
            'category': 'accounts_receivable',
            'balance_iqd': 3000000,
            'balance_usd': 1500,
            'is_active': True
        },
        {
            'code': '2003',
            'name': 'صيرفة البصرة',
            'type': 'assets',
            'category': 'accounts_receivable',
            'balance_iqd': 2000000,
            'balance_usd': 1000,
            'is_active': True
        },
        {
            'code': '3001',
            'name': 'حسابات العملاء',
            'type': 'assets',
            'category': 'accounts_receivable',
            'balance_iqd': 1000000,
            'balance_usd': 500,
            'is_active': True
        },
        {
            'code': '4001',
            'name': 'إيرادات الصيرفة',
            'type': 'revenue',
            'category': 'operating_revenue',
            'balance_iqd': 0,
            'balance_usd': 0,
            'is_active': True
        },
        {
            'code': '5001',
            'name': 'مصروفات عامة',
            'type': 'expense',
            'category': 'operating_expense',
            'balance_iqd': 0,
            'balance_usd': 0,
            'is_active': True
        }
    ]
    
    print("🔄 إنشاء الدليل المحاسبي...")
    print("=" * 60)
    
    # Clear existing
    db.chart_of_accounts.delete_many({})
    
    # Insert sample accounts
    for acc in sample_accounts:
        acc['created_at'] = datetime.now(timezone.utc).isoformat()
        db.chart_of_accounts.insert_one(acc)
        print(f"✅ تم إضافة: {acc['code']} - {acc['name']}")
    
    print("\n" + "=" * 60)
    print(f"✅ تم إنشاء {len(sample_accounts)} حساب بنجاح!")
    print("=" * 60)
    
    client.close()

if __name__ == '__main__':
    initialize_chart_of_accounts()
