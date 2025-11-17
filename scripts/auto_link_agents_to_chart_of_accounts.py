"""
سكريبت ربط تلقائي للوكلاء بالدليل المحاسبي

هذا السكريبت سيقوم بـ:
1. فحص جميع الوكلاء الموجودين في النظام
2. التحقق من وجود حساب محاسبي لكل وكيل في chart_of_accounts
3. إنشاء حساب محاسبي تلقائياً للوكلاء الذين لا يملكون حساباً
4. ربط الحساب بالوكيل عن طريق account_id
"""

import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# رموز المحافظات العراقية
GOVERNORATE_CODE_TO_NAME = {
    'BG': 'بغداد',
    'BS': 'البصرة',
    'NJ': 'النجف',
    'KR': 'كربلاء',
    'BB': 'بابل',
    'AN': 'الأنبار',
    'DY': 'ديالى',
    'WS': 'واسط',
    'SA': 'صلاح الدين',
    'NI': 'نينوى',
    'DQ': 'ذي قار',
    'QA': 'القادسية',
    'MY': 'المثنى',
    'MI': 'ميسان',
    'KI': 'كركوك',
    'ER': 'أربيل',
    'SU': 'السليمانية',
    'DH': 'دهوك'
}

async def auto_link_agents_to_coa():
    """ربط تلقائي لجميع الوكلاء بالدليل المحاسبي"""
    
    # الاتصال بقاعدة البيانات
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'hawalat_db')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("=" * 80)
    print("🔗 بدء الربط التلقائي للوكلاء بالدليل المحاسبي")
    print("=" * 80)
    print(f"\n📊 قاعدة البيانات: {db_name}\n")
    
    # ============ الخطوة 1: جمع البيانات ============
    print("📋 الخطوة 1: جمع بيانات الوكلاء والحسابات")
    print("-" * 80)
    
    # الحصول على جميع الوكلاء
    all_agents = await db.users.find({'role': 'agent'}).to_list(1000)
    print(f"✅ عدد الوكلاء: {len(all_agents)}")
    
    # الحصول على جميع حسابات شركات الصرافة في الدليل المحاسبي
    exchange_accounts = await db.chart_of_accounts.find({
        'category': 'شركات الصرافة'
    }).to_list(1000)
    print(f"✅ عدد حسابات شركات الصرافة في الدليل: {len(exchange_accounts)}")
    
    # إنشاء خريطة للحسابات حسب agent_id
    accounts_by_agent_id = {}
    for account in exchange_accounts:
        if 'agent_id' in account:
            accounts_by_agent_id[account['agent_id']] = account
    
    # ============ الخطوة 2: تحديد الوكلاء الذين يحتاجون لحسابات ============
    print("\n📊 الخطوة 2: تحديد الوكلاء الذين يحتاجون لحسابات جديدة")
    print("-" * 80)
    
    agents_needing_accounts = []
    agents_already_linked = []
    
    for agent in all_agents:
        agent_id = agent['id']
        agent_name = agent.get('display_name', agent.get('username'))
        account_id = agent.get('account_id')
        
        # التحقق من وجود حساب في chart_of_accounts
        has_coa_account = agent_id in accounts_by_agent_id
        
        if has_coa_account:
            coa_account = accounts_by_agent_id[agent_id]
            
            # التحقق من أن account_id في user يطابق الحساب في COA
            if account_id == coa_account['code']:
                print(f"✅ {agent_name}: مرتبط بشكل صحيح - حساب {coa_account['code']}")
                agents_already_linked.append(agent)
            else:
                # الحساب موجود لكن الربط غير صحيح
                print(f"⚠️  {agent_name}: الحساب موجود ({coa_account['code']}) لكن الربط غير صحيح")
                # تحديث الربط
                await db.users.update_one(
                    {'id': agent_id},
                    {'$set': {'account_id': coa_account['code']}}
                )
                print(f"   ✅ تم تصحيح الربط إلى {coa_account['code']}")
                agents_already_linked.append(agent)
        else:
            print(f"❌ {agent_name}: لا يوجد حساب في الدليل المحاسبي")
            agents_needing_accounts.append(agent)
    
    print(f"\n📊 الإحصائيات:")
    print(f"   • وكلاء مرتبطون بشكل صحيح: {len(agents_already_linked)}")
    print(f"   • وكلاء يحتاجون لحسابات جديدة: {len(agents_needing_accounts)}")
    
    # ============ الخطوة 3: إنشاء الحسابات للوكلاء ============
    if len(agents_needing_accounts) > 0:
        print("\n\n🏦 الخطوة 3: إنشاء الحسابات في الدليل المحاسبي")
        print("-" * 80)
        
        # الحصول على آخر رقم حساب في فئة شركات الصرافة
        last_account = await db.chart_of_accounts.find_one(
            {'category': 'شركات الصرافة'},
            sort=[('code', -1)]
        )
        
        if last_account and last_account.get('code'):
            try:
                # استخراج الرقم من الكود (مثلاً: "2105" → 105)
                last_code = last_account['code']
                if last_code.startswith('2'):
                    last_number = int(last_code) - 2000
                else:
                    last_number = 0
            except:
                last_number = 0
        else:
            last_number = 0
        
        print(f"📌 آخر رقم حساب: {last_number}")
        print(f"📌 سيتم البدء من: {last_number + 1}\n")
        
        created_count = 0
        
        for agent in agents_needing_accounts:
            agent_id = agent['id']
            agent_name = agent.get('display_name', agent.get('username'))
            governorate_code = agent.get('governorate', 'BG')
            governorate_name = GOVERNORATE_CODE_TO_NAME.get(governorate_code, governorate_code)
            
            # توليد رقم الحساب الجديد
            last_number += 1
            new_account_code = f"2{last_number:03d}"  # مثلاً: 2001, 2002, 2003
            
            # إنشاء الحساب الجديد
            new_account = {
                'code': new_account_code,
                'name': f"صيرفة {agent_name} - {governorate_name}",
                'name_ar': f"صيرفة {agent_name} - {governorate_name}",
                'name_en': f"Exchange {agent_name} - {governorate_name}",
                'category': 'شركات الصرافة',
                'type': 'شركات الصرافة',
                'balance': 0.0,
                'balance_iqd': 0.0,
                'balance_usd': 0.0,
                'currencies': ['IQD', 'USD'],  # العملات الافتراضية
                'is_active': True,
                'agent_id': agent_id,  # ربط الحساب بالوكيل
                'created_at': datetime.now(timezone.utc).isoformat(),
                'updated_at': datetime.now(timezone.utc).isoformat()
            }
            
            # إضافة الحساب إلى الدليل المحاسبي
            try:
                await db.chart_of_accounts.insert_one(new_account)
                
                # تحديث الوكيل بربط الحساب
                await db.users.update_one(
                    {'id': agent_id},
                    {'$set': {'account_id': new_account_code}}
                )
                
                print(f"✅ {agent_name}:")
                print(f"   • رقم الحساب: {new_account_code}")
                print(f"   • اسم الحساب: {new_account['name']}")
                print(f"   • المحافظة: {governorate_name}")
                print(f"   • العملات: IQD, USD")
                print()
                
                created_count += 1
                
            except Exception as e:
                print(f"❌ خطأ في إنشاء حساب {agent_name}: {str(e)}\n")
        
        print("-" * 80)
        print(f"✅ تم إنشاء {created_count} حساباً جديداً بنجاح!")
    else:
        print("\n✅ جميع الوكلاء مرتبطون بشكل صحيح - لا توجد حسابات جديدة للإنشاء")
    
    # ============ الخطوة 4: التحقق النهائي ============
    print("\n\n📊 الخطوة 4: التحقق النهائي من جميع الوكلاء")
    print("-" * 80)
    
    # إعادة جمع البيانات
    final_agents = await db.users.find({'role': 'agent'}).to_list(1000)
    final_accounts = await db.chart_of_accounts.find({
        'category': 'شركات الصرافة'
    }).to_list(1000)
    
    print(f"\n📈 الإحصائيات النهائية:")
    print(f"   • إجمالي الوكلاء: {len(final_agents)}")
    print(f"   • إجمالي حسابات شركات الصرافة: {len(final_accounts)}")
    
    # التحقق من جميع الوكلاء
    print("\n🔍 التحقق من الربط:")
    print()
    
    all_linked = True
    for agent in final_agents:
        agent_id = agent['id']
        agent_name = agent.get('display_name', agent.get('username'))
        account_id = agent.get('account_id')
        
        if account_id:
            # التحقق من وجود الحساب في chart_of_accounts
            account = await db.chart_of_accounts.find_one({'code': account_id})
            
            if account:
                print(f"✅ {agent_name}: {account_id} - {account.get('name_ar')}")
            else:
                print(f"❌ {agent_name}: حساب {account_id} غير موجود في الدليل!")
                all_linked = False
        else:
            print(f"⚠️  {agent_name}: غير مرتبط بأي حساب!")
            all_linked = False
    
    # ============ النتيجة النهائية ============
    print("\n" + "=" * 80)
    if all_linked:
        print("✅ تم الربط بنجاح! جميع الوكلاء مرتبطون بحسابات في الدليل المحاسبي")
    else:
        print("⚠️  بعض الوكلاء لم يتم ربطهم بشكل صحيح - يرجى المراجعة")
    print("=" * 80)
    
    client.close()

if __name__ == "__main__":
    print("\n🚀 بدء سكريبت الربط التلقائي...\n")
    asyncio.run(auto_link_agents_to_coa())
