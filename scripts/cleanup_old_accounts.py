"""
Script to cleanup old accounts and users that are not in chart_of_accounts
This script will:
1. Remove old accounts table entries
2. Remove users linked to non-existent accounts
3. Update users to use correct account_id from chart_of_accounts
"""

import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def cleanup_old_data():
    """Cleanup old accounts and fix user links"""
    
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'hawalat_db')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print(f"Connected to database: {db_name}")
    print("=" * 60)
    
    # Step 1: Get all valid accounts from chart_of_accounts
    print("\n📊 Step 1: Getting valid accounts from chart_of_accounts...")
    valid_accounts = await db.chart_of_accounts.find({'is_active': True}).to_list(1000)
    valid_account_codes = [acc['code'] for acc in valid_accounts]
    
    print(f"✅ Found {len(valid_accounts)} valid accounts in chart_of_accounts:")
    for acc in valid_accounts:
        print(f"   - {acc['code']}: {acc.get('name_ar', acc.get('name'))}")
    
    # Step 2: Check old accounts table
    print("\n🗑️  Step 2: Checking old 'accounts' table...")
    old_accounts = await db.accounts.find({}).to_list(1000)
    
    if len(old_accounts) > 0:
        print(f"⚠️  Found {len(old_accounts)} entries in old 'accounts' table")
        
        # Ask for confirmation to delete
        print("\n⚠️  WARNING: This will DELETE the old 'accounts' table!")
        print("The system now uses 'chart_of_accounts' table exclusively.")
        print("\nDeleting old accounts table in 3 seconds...")
        await asyncio.sleep(3)
        
        # Delete old accounts table
        result = await db.accounts.delete_many({})
        print(f"✅ Deleted {result.deleted_count} entries from old 'accounts' table")
    else:
        print("✅ Old 'accounts' table is already clean (0 entries)")
    
    # Step 3: Fix user links
    print("\n👥 Step 3: Checking and fixing user account links...")
    all_users = await db.users.find({'role': 'agent'}).to_list(1000)
    
    print(f"📋 Found {len(all_users)} agent users")
    
    fixed_count = 0
    unlinked_count = 0
    invalid_link_count = 0
    
    for user in all_users:
        user_id = user['id']
        username = user.get('display_name', user.get('username'))
        current_account_id = user.get('account_id')
        
        # Check if user has account_id linking to valid account
        if current_account_id:
            if current_account_id in valid_account_codes:
                print(f"   ✓ {username}: linked to valid account {current_account_id}")
            else:
                print(f"   ⚠️  {username}: linked to INVALID account {current_account_id}")
                
                # Try to find account in chart_of_accounts by agent_id
                agent_account = await db.chart_of_accounts.find_one({'agent_id': user_id})
                
                if agent_account:
                    # Fix the link
                    await db.users.update_one(
                        {'id': user_id},
                        {'$set': {'account_id': agent_account['code']}}
                    )
                    print(f"      ✅ Fixed link to {agent_account['code']}")
                    fixed_count += 1
                else:
                    # Remove invalid link
                    await db.users.update_one(
                        {'id': user_id},
                        {'$unset': {'account_id': ''}}
                    )
                    print(f"      ❌ Removed invalid link (no matching account found)")
                    invalid_link_count += 1
        else:
            # User not linked to any account
            print(f"   ⚠️  {username}: NOT LINKED to any account")
            
            # Try to find account by agent_id
            agent_account = await db.chart_of_accounts.find_one({'agent_id': user_id})
            
            if agent_account:
                # Create the link
                await db.users.update_one(
                    {'id': user_id},
                    {'$set': {'account_id': agent_account['code']}}
                )
                print(f"      ✅ Linked to {agent_account['code']}")
                fixed_count += 1
            else:
                print(f"      ⚠️  No matching account in chart_of_accounts")
                unlinked_count += 1
    
    # Step 4: Summary
    print("\n" + "=" * 60)
    print("📊 Cleanup Summary:")
    print(f"   - Valid accounts in chart_of_accounts: {len(valid_accounts)}")
    print(f"   - Old accounts table entries deleted: {len(old_accounts)}")
    print(f"   - User links fixed: {fixed_count}")
    print(f"   - Invalid links removed: {invalid_link_count}")
    print(f"   - Users without accounts: {unlinked_count}")
    
    if unlinked_count > 0:
        print(f"\n⚠️  WARNING: {unlinked_count} user(s) are not linked to any account!")
        print("   These users will NOT be able to perform transfers until linked.")
        print("   Create accounts for them in chart_of_accounts or link existing ones.")
    
    print("\n✅ Cleanup completed successfully!")
    
    # Step 5: Display final state
    print("\n" + "=" * 60)
    print("📋 Current System State:")
    print("\n🏦 Chart of Accounts (شركات الصرافة only):")
    exchange_accounts = [acc for acc in valid_accounts if 
                        'شركات' in str(acc.get('category', '')) or 
                        'صرافة' in str(acc.get('category', '')) or
                        str(acc.get('code', '')).startswith('21')]
    
    for acc in exchange_accounts:
        linked_user = await db.users.find_one({'account_id': acc['code']})
        if linked_user:
            print(f"   ✅ {acc['code']}: {acc.get('name_ar')} → مرتبط بـ {linked_user.get('display_name')}")
        else:
            print(f"   ⚪ {acc['code']}: {acc.get('name_ar')} → غير مرتبط بأي مستخدم")
    
    print("\n👥 Agent Users:")
    agents = await db.users.find({'role': 'agent'}).to_list(1000)
    for agent in agents:
        acc_id = agent.get('account_id', 'NO ACCOUNT')
        status = '✅' if acc_id in valid_account_codes else '❌'
        print(f"   {status} {agent.get('display_name')}: account_id = {acc_id}")
    
    client.close()

if __name__ == "__main__":
    print("🧹 Starting database cleanup...")
    print("This script will:")
    print("  1. Remove old 'accounts' table entries")
    print("  2. Fix user account links")
    print("  3. Remove invalid links")
    print("")
    asyncio.run(cleanup_old_data())
