"""
Script to sync agents to chart of accounts
يضيف حسابات الصرافين إلى الدليل المحاسبي تلقائياً
"""
import os
import sys
from datetime import datetime, timezone
from pymongo import MongoClient

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = MongoClient(mongo_url)
db = client['exchange_system']

def sync_agents_to_chart():
    """
    يقوم بمزامنة الصرافين مع الدليل المحاسبي
    كل صراف سيكون له حساب في الدليل المحاسبي
    """
    
    # Get all active agents
    agents = list(db.users.find({'role': 'agent', 'is_active': True}))
    
    print(f"🔄 مزامنة {len(agents)} صراف مع الدليل المحاسبي...")
    
    synced_count = 0
    updated_count = 0
    
    for agent in agents:
        agent_id = agent['id']
        
        # Check if account already exists for this agent
        existing = db.chart_of_accounts.find_one({'code': agent_id})
        
        if existing:
            # Update existing account
            db.chart_of_accounts.update_one(
                {'code': agent_id},
                {'$set': {
                    'name': f"{agent['display_name']} - {agent.get('governorate', 'صيرفة')}",
                    'balance_iqd': agent.get('wallet_balance_iqd', 0),
                    'balance_usd': agent.get('wallet_balance_usd', 0),
                    'updated_at': datetime.now(timezone.utc).isoformat()
                }}
            )
            updated_count += 1
            print(f"   ✅ تحديث حساب: {agent['display_name']}")
        else:
            # Create new account
            account_doc = {
                'code': agent_id,
                'name': f"{agent['display_name']} - {agent.get('governorate', 'صيرفة')}",
                'type': 'حسابات الصرافة',
                'category': 'assets',
                'balance_iqd': agent.get('wallet_balance_iqd', 0),
                'balance_usd': agent.get('wallet_balance_usd', 0),
                'is_active': True,
                'agent_id': agent_id,
                'created_at': datetime.now(timezone.utc).isoformat()
            }
            
            db.chart_of_accounts.insert_one(account_doc)
            synced_count += 1
            print(f"   ✅ إضافة حساب جديد: {agent['display_name']}")
    
    print("\n" + "=" * 60)
    print(f"✅ تمت المزامنة بنجاح!")
    print(f"   📝 حسابات جديدة: {synced_count}")
    print(f"   🔄 حسابات محدثة: {updated_count}")
    print(f"   📊 إجمالي: {synced_count + updated_count}")
    print("=" * 60)
    
    client.close()

if __name__ == '__main__':
    sync_agents_to_chart()
