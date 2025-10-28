#!/usr/bin/env python3
"""
Migration script to add wallet_balance fields to existing users
"""
import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent.parent / 'backend'
load_dotenv(ROOT_DIR / '.env')

async def migrate_wallet_fields():
    """Add wallet_balance fields to all existing users"""
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("Starting migration: Adding wallet_balance fields to users...")
    
    # Update all users without wallet_balance fields
    result = await db.users.update_many(
        {
            '$or': [
                {'wallet_balance_iqd': {'$exists': False}},
                {'wallet_balance_usd': {'$exists': False}}
            ]
        },
        {
            '$set': {
                'wallet_balance_iqd': 0.0,
                'wallet_balance_usd': 0.0
            }
        }
    )
    
    print(f"✅ Migration completed!")
    print(f"   - Updated {result.modified_count} users")
    print(f"   - Matched {result.matched_count} users")
    
    # Show sample of users
    users = await db.users.find({}, {'_id': 0, 'username': 1, 'display_name': 1, 'wallet_balance_iqd': 1, 'wallet_balance_usd': 1}).limit(5).to_list(5)
    
    if users:
        print("\n📋 Sample users:")
        for user in users:
            print(f"   - {user.get('display_name')} ({user.get('username')}): IQD={user.get('wallet_balance_iqd', 0)}, USD={user.get('wallet_balance_usd', 0)}")
    
    client.close()

if __name__ == '__main__':
    try:
        asyncio.run(migrate_wallet_fields())
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        sys.exit(1)
