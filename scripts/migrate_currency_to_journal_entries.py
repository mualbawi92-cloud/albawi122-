"""
Script to update old journal entries with currency codes
This ensures all journal entries have a currency field for proper filtering
"""

import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def migrate_journal_entries():
    """Update old journal entries with currency codes based on account default"""
    
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'hawalat_db')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print(f"Connected to database: {db_name}")
    print("=" * 60)
    
    # Get all journal entries
    all_entries = await db.journal_entries.find({}).to_list(length=None)
    print(f"📊 Total journal entries found: {len(all_entries)}")
    
    updated_count = 0
    entries_without_currency = 0
    
    for entry in all_entries:
        needs_update = False
        updated_lines = []
        
        for line in entry.get('lines', []):
            account_code = line.get('account_code')
            current_currency = line.get('currency')
            
            # If line doesn't have currency, we need to update it
            if not current_currency:
                entries_without_currency += 1
                needs_update = True
                
                # Get account from chart_of_accounts
                account = await db.chart_of_accounts.find_one({'code': account_code})
                
                if account:
                    # Get account's currencies, default to first one or IQD
                    account_currencies = account.get('currencies', ['IQD'])
                    default_currency = account_currencies[0] if account_currencies else 'IQD'
                    
                    # Update line with default currency
                    line['currency'] = default_currency
                    print(f"   ✓ Updated line for account {account_code}: {default_currency}")
                else:
                    # Account not found in chart_of_accounts, default to IQD
                    line['currency'] = 'IQD'
                    print(f"   ⚠️ Account {account_code} not found, defaulting to IQD")
            
            updated_lines.append(line)
        
        # Update entry if needed
        if needs_update:
            await db.journal_entries.update_one(
                {'id': entry['id']},
                {
                    '$set': {
                        'lines': updated_lines,
                        'migrated_currency': True,
                        'migration_date': datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            updated_count += 1
            print(f"✅ Updated entry {entry.get('entry_number', entry['id'])}")
    
    print("=" * 60)
    print(f"📈 Migration Summary:")
    print(f"   - Total entries processed: {len(all_entries)}")
    print(f"   - Entries updated: {updated_count}")
    print(f"   - Lines without currency: {entries_without_currency}")
    print(f"✅ Migration completed successfully!")
    
    client.close()

if __name__ == "__main__":
    print("🚀 Starting currency migration for journal entries...")
    print("")
    asyncio.run(migrate_journal_entries())
