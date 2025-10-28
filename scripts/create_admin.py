import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
import uuid
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')

async def create_admin():
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Check if admin exists
    existing = await db.users.find_one({'username': 'admin'})
    if existing:
        print('Admin user already exists')
        return
    
    # Create admin user
    password_hash = bcrypt.hashpw('admin123'.encode(), bcrypt.gensalt()).decode()
    
    admin_doc = {
        'id': str(uuid.uuid4()),
        'username': 'admin',
        'password_hash': password_hash,
        'display_name': 'المدير العام',
        'role': 'admin',
        'governorate': 'BG',
        'phone': '+9647801234567',
        'is_active': True,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(admin_doc)
    print('✅ Admin user created successfully!')
    print('Username: admin')
    print('Password: admin123')
    
    # Create sample agents
    agents_data = [
        {'username': 'agent_baghdad', 'password': 'agent123', 'name': 'صراف بغداد', 'gov': 'BG', 'phone': '+9647801111111'},
        {'username': 'agent_basra', 'password': 'agent123', 'name': 'صراف البصرة', 'gov': 'BS', 'phone': '+9647802222222'},
        {'username': 'agent_najaf', 'password': 'agent123', 'name': 'صراف النجف', 'gov': 'NJ', 'phone': '+9647803333333'},
    ]
    
    for agent_data in agents_data:
        existing_agent = await db.users.find_one({'username': agent_data['username']})
        if not existing_agent:
            agent_doc = {
                'id': str(uuid.uuid4()),
                'username': agent_data['username'],
                'password_hash': bcrypt.hashpw(agent_data['password'].encode(), bcrypt.gensalt()).decode(),
                'display_name': agent_data['name'],
                'role': 'agent',
                'governorate': agent_data['gov'],
                'phone': agent_data['phone'],
                'is_active': True,
                'created_at': datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(agent_doc)
            print(f"✅ Agent created: {agent_data['username']}")
    
    # Initialize counter
    await db.counters.update_one(
        {'_id': 'transfer_seq'},
        {'$setOnInsert': {'seq': 0}},
        upsert=True
    )
    
    client.close()
    print('\n✅ Database initialization complete!')

if __name__ == '__main__':
    asyncio.run(create_admin())
