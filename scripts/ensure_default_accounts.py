"""
Script to ensure default accounts (203, 413, 421) exist in chart_of_accounts
"""

import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def ensure_default_accounts():
    """Ensure default system accounts exist"""
    
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'hawalat_db')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print(f"Connected to database: {db_name}")
    print("=" * 60)
    
    # Default accounts that must exist
    default_accounts = [
        {
            'code': '203',
            'name': 'حوالات واردة لم تُسلَّم',
            'name_ar': 'حوالات واردة لم تُسلَّم',
            'name_en': 'Pending Incoming Transfers',
            'category': 'حسابات مؤقتة',
            'type': 'حسابات مؤقتة',
            'parent_code': '2000',
            'currencies': ['IQD', 'USD', 'EUR', 'GBP'],
            'is_active': True,
            'balance': 0,
            'balance_iqd': 0,
            'balance_usd': 0
        },
        {
            'code': '413',
            'name': 'عمولات محققة',
            'name_ar': 'عمولات محققة',
            'name_en': 'Earned Commissions',
            'category': 'الإيرادات',
            'type': 'الإيرادات',
            'parent_code': '4000',
            'currencies': ['IQD', 'USD', 'EUR', 'GBP'],
            'is_active': True,
            'balance': 0,
            'balance_iqd': 0,
            'balance_usd': 0
        },
        {
            'code': '421',
            'name': 'عمولات حوالات مدفوعة',
            'name_ar': 'عمولات حوالات مدفوعة',
            'name_en': 'Transfer Commission Paid',
            'category': 'المصروفات',
            'type': 'المصروفات',
            'parent_code': '5000',
            'currencies': ['IQD', 'USD', 'EUR', 'GBP'],
            'is_active': True,
            'balance': 0,
            'balance_iqd': 0,
            'balance_usd': 0
        }
    ]
    
    created_count = 0
    existing_count = 0
    
    for account in default_accounts:
        existing = await db.chart_of_accounts.find_one({'code': account['code']})
        
        if existing:
            print(f"✓ Account {account['code']} ({account['name_ar']}) already exists")
            existing_count += 1
        else:
            # Add timestamps and ID
            account['id'] = f"default_account_{account['code']}"
            account['created_at'] = datetime.now(timezone.utc).isoformat()
            account['updated_at'] = datetime.now(timezone.utc).isoformat()
            
            await db.chart_of_accounts.insert_one(account)
            print(f"✅ Created account {account['code']} - {account['name_ar']}")
            created_count += 1
    
    print("=" * 60)
    print(f"📊 Summary:")
    print(f"   - Existing accounts: {existing_count}")
    print(f"   - Created accounts: {created_count}")
    print(f"✅ All default accounts are now in chart_of_accounts!")
    
    client.close()

if __name__ == "__main__":
    print("🚀 Ensuring default system accounts exist...")
    print("")
    asyncio.run(ensure_default_accounts())
