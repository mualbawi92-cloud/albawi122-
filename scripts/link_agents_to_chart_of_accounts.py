"""
Script to link all existing agents to chart_of_accounts
This ensures all agents have proper accounting accounts for journal entries
"""

import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import uuid

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def link_agents():
    """Link all existing agents to chart_of_accounts"""
    
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'hawalat_db')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print(f"Connected to database: {db_name}")
    print("=" * 60)
    
    # Get all agents
    agents = await db.users.find({'role': 'agent'}).to_list(length=None)
    print(f"📊 Total agents found: {len(agents)}")
    
    if len(agents) == 0:
        print("⚠️ No agents found in the system")
        client.close()
        return
    
    # Get or create "شركات الصرافة" category
    category = await db.categories.find_one({'name_ar': 'شركات الصرافة'})
    if not category:
        print("Creating 'شركات الصرافة' category...")
        category_doc = {
            'id': str(uuid.uuid4()),
            'name': 'شركات الصرافة',
            'name_ar': 'شركات الصرافة',
            'name_en': 'Exchange Companies',
            'code': '2000',
            'description': 'حسابات شركات الصرافة والوكلاء',
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        await db.categories.insert_one(category_doc)
        print("✅ Category created")
    
    # Get next account number for exchange companies (2xxx)
    existing_accounts = await db.chart_of_accounts.find({
        'code': {'$regex': '^2\\d{3}$'}
    }).to_list(length=None)
    
    # Find max number
    max_number = 2000
    for acc in existing_accounts:
        try:
            num = int(acc['code'])
            if num > max_number:
                max_number = num
        except:
            pass
    
    next_number = max_number + 1
    
    linked_count = 0
    updated_count = 0
    
    for agent in agents:
        agent_id = agent['id']
        agent_name = agent.get('display_name', agent.get('username'))
        
        # Check if agent already has an account in chart_of_accounts
        existing = await db.chart_of_accounts.find_one({'agent_id': agent_id})
        
        if existing:
            print(f"✓ Agent {agent_name} already linked to account {existing['code']}")
            
            # Update account_id in users table
            if not agent.get('account_id') or agent.get('account_id') != existing['code']:
                await db.users.update_one(
                    {'id': agent_id},
                    {'$set': {'account_id': existing['code']}}
                )
                print(f"  Updated user account_id to {existing['code']}")
                updated_count += 1
            continue
        
        # Check if agent has account_id pointing to chart_of_accounts
        if agent.get('account_id'):
            account = await db.chart_of_accounts.find_one({'code': agent['account_id']})
            if account:
                # Link the account to agent
                await db.chart_of_accounts.update_one(
                    {'code': agent['account_id']},
                    {'$set': {'agent_id': agent_id}}
                )
                print(f"✅ Linked existing account {agent['account_id']} to agent {agent_name}")
                linked_count += 1
                continue
        
        # Create new account for agent
        account_code = str(next_number)
        account_doc = {
            'id': str(uuid.uuid4()),
            'code': account_code,
            'name': agent_name,
            'name_ar': agent_name,
            'name_en': agent_name,
            'category': 'شركات الصرافة',
            'type': 'أصول',
            'parent_code': '2000',
            'agent_id': agent_id,
            'currencies': ['IQD', 'USD'],  # Default currencies
            'is_active': True,
            'balance': 0,
            'balance_iqd': 0,
            'balance_usd': 0,
            'notes': f'حساب تلقائي لـ {agent_name}',
            'created_at': datetime.now(timezone.utc).isoformat(),
            'updated_at': datetime.now(timezone.utc).isoformat()
        }
        
        await db.chart_of_accounts.insert_one(account_doc)
        
        # Update agent with account_id
        await db.users.update_one(
            {'id': agent_id},
            {'$set': {'account_id': account_code}}
        )
        
        print(f"✅ Created new account {account_code} for agent {agent_name}")
        linked_count += 1
        next_number += 1
    
    print("=" * 60)
    print(f"📈 Linking Summary:")
    print(f"   - Total agents: {len(agents)}")
    print(f"   - New accounts created: {linked_count}")
    print(f"   - Existing accounts updated: {updated_count}")
    print(f"✅ All agents are now linked to chart_of_accounts!")
    
    client.close()

if __name__ == "__main__":
    print("🚀 Starting agent linking to chart_of_accounts...")
    print("")
    asyncio.run(link_agents())
