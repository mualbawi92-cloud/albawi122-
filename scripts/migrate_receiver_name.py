#!/usr/bin/env python3
"""
Migration script to add receiver_name field to existing transfers
For old transfers without receiver_name, we'll use sender_name as fallback
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

async def migrate_receiver_name():
    """Add receiver_name field to all existing transfers"""
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("Starting migration: Adding receiver_name field to transfers...")
    
    # Update all transfers without receiver_name field
    # Use sender_name as fallback for old transfers
    result = await db.transfers.update_many(
        {'receiver_name': {'$exists': False}},
        [
            {
                '$set': {
                    'receiver_name': '$sender_name'
                }
            }
        ]
    )
    
    print(f"✅ Migration completed!")
    print(f"   - Updated {result.modified_count} transfers")
    print(f"   - Matched {result.matched_count} transfers")
    
    # Show sample of transfers
    transfers = await db.transfers.find(
        {}, 
        {'_id': 0, 'transfer_code': 1, 'sender_name': 1, 'receiver_name': 1, 'status': 1}
    ).limit(5).to_list(5)
    
    if transfers:
        print("\n📋 Sample transfers:")
        for transfer in transfers:
            print(f"   - {transfer.get('transfer_code')}: "
                  f"من: {transfer.get('sender_name')} | "
                  f"إلى: {transfer.get('receiver_name')} | "
                  f"حالة: {transfer.get('status')}")
    
    client.close()

if __name__ == '__main__':
    try:
        asyncio.run(migrate_receiver_name())
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        sys.exit(1)
