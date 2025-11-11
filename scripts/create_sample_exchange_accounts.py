"""
Script to create sample exchange company accounts for testing
"""

import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def create_sample_accounts():
    """Create sample exchange company accounts"""
    
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'hawalat_db')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print(f"Connected to database: {db_name}")
    print("=" * 60)
    
    # Sample exchange company accounts
    sample_accounts = [
        {
            'code': '2101',
            'name': 'صيرفة الباوي',
            'name_ar': 'صيرفة الباوي',
            'name_en': 'Al-Bawi Exchange',
            'category': 'شركات الصرافة',
            'type': 'شركات الصرافة',
            'parent_code': '2000'
        },
        {
            'code': '2102',
            'name': 'صيرفة الحلة',
            'name_ar': 'صيرفة الحلة',
            'name_en': 'Al-Hilla Exchange',
            'category': 'شركات الصرافة',
            'type': 'شركات الصرافة',
            'parent_code': '2000'
        },
        {
            'code': '2103',
            'name': 'صيرفة النور',
            'name_ar': 'صيرفة النور',
            'name_en': 'Al-Noor Exchange',
            'category': 'شركات الصرافة',
            'type': 'شركات الصرافة',
            'parent_code': '2000'
        },
        {
            'code': '2104',
            'name': 'صيرفة كربلاء',
            'name_ar': 'صيرفة كربلاء',
            'name_en': 'Karbala Exchange',
            'category': 'شركات الصرافة',
            'type': 'شركات الصرافة',
            'parent_code': '2000'
        }
    ]
    
    created_count = 0
    existing_count = 0
    
    for account in sample_accounts:
        existing = await db.chart_of_accounts.find_one({'code': account['code']})
        
        if existing:
            print(f"✓ Account {account['code']} ({account['name_ar']}) already exists")
            existing_count += 1
        else:
            # Add required fields
            account['id'] = f"exchange_account_{account['code']}"
            account['currencies'] = ['IQD', 'USD']
            account['is_active'] = True
            account['balance'] = 0
            account['balance_iqd'] = 0
            account['balance_usd'] = 0
            account['created_at'] = datetime.now(timezone.utc).isoformat()
            account['updated_at'] = datetime.now(timezone.utc).isoformat()
            
            await db.chart_of_accounts.insert_one(account)
            print(f"✅ Created account {account['code']} - {account['name_ar']}")
            created_count += 1
    
    print("=" * 60)
    print(f"📊 Summary:")
    print(f"   - Existing accounts: {existing_count}")
    print(f"   - Created accounts: {created_count}")
    print(f"✅ Sample exchange company accounts are ready!")
    
    client.close()

if __name__ == "__main__":
    print("🚀 Creating sample exchange company accounts...")
    print("")
    asyncio.run(create_sample_accounts())
