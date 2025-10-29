"""
Script to migrate existing agents to chart of accounts
Creates accounting entries for all existing exchange agents
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent / 'backend'
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'money_transfer_db')

async def migrate_agents_to_accounts():
    """Migrate all existing agents to chart of accounts"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("🔄 Starting migration of agents to chart of accounts...")
    
    # Get all agents
    agents = await db.users.find({'role': 'agent'}).to_list(length=None)
    
    if not agents:
        print("❌ No agents found to migrate")
        return
    
    print(f"✅ Found {len(agents)} agents to migrate")
    
    # Get the highest exchange company account code
    exchange_accounts = await db.accounts.find({
        'category': 'شركات الصرافة',
        'code': {'$regex': '^2\\d{3}$'}
    }).sort('code', -1).to_list(length=1)
    
    if exchange_accounts:
        last_code = int(exchange_accounts[0]['code'])
    else:
        last_code = 2000
    
    migrated_count = 0
    skipped_count = 0
    
    for agent in agents:
        agent_id = agent['id']
        agent_name = agent['display_name']
        
        # Check if account already exists
        existing = await db.accounts.find_one({'code': f'AGENT_{agent_id}'})
        if existing:
            print(f"⏭️  Skipped {agent_name} - account already exists")
            skipped_count += 1
            continue
        
        # Generate new account code
        last_code += 1
        account_code = str(last_code)
        
        # Create account
        account = {
            'id': f'acc_{agent_id}',
            'code': account_code,
            'name_ar': f'صيرفة {agent_name}',
            'name_en': f'Exchange {agent_name}',
            'category': 'شركات الصرافة',
            'parent_code': None,
            'is_active': True,
            'balance': 0,
            'currency': 'IQD',
            'agent_id': agent_id,  # Link to agent
            'created_at': datetime.now(timezone.utc).isoformat(),
            'updated_at': datetime.now(timezone.utc).isoformat()
        }
        
        await db.accounts.insert_one(account)
        print(f"✅ Created account {account_code} for {agent_name}")
        migrated_count += 1
    
    print(f"\n🎉 Migration completed!")
    print(f"✅ Migrated: {migrated_count} agents")
    print(f"⏭️  Skipped: {skipped_count} agents")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate_agents_to_accounts())
