"""
سكريبت تنظيف شامل لحذف الحسابات القديمة والاعتماد على الدليل المحاسبي فقط

هذا السكريبت سيقوم بـ:
1. حذف جميع البيانات في مجموعة accounts القديمة
2. حذف الوكلاء غير المرتبطين بأي حساب في chart_of_accounts
3. التحقق من أن جميع الوكلاء مرتبطين بحسابات صحيحة
4. تنظيف القيود المحاسبية التي تشير لحسابات غير موجودة
5. عرض تقرير شامل بعد التنظيف
"""

import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def complete_cleanup():
    """تنظيف شامل للبيانات القديمة"""
    
    # الاتصال بقاعدة البيانات
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'hawalat_db')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("=" * 80)
    print("🧹 بدء التنظيف الشامل للنظام المحاسبي")
    print("=" * 80)
    print(f"\n📊 قاعدة البيانات: {db_name}")
    print(f"🔗 الاتصال: نشط\n")
    
    # ============ الخطوة 1: فحص الوضع الحالي ============
    print("\n📊 الخطوة 1: فحص الوضع الحالي للنظام")
    print("-" * 80)
    
    # عدد الحسابات في chart_of_accounts
    chart_accounts_count = await db.chart_of_accounts.count_documents({})
    print(f"✅ الحسابات في الدليل المحاسبي (chart_of_accounts): {chart_accounts_count}")
    
    # عدد الحسابات القديمة
    old_accounts_count = await db.accounts.count_documents({})
    print(f"⚠️  الحسابات القديمة (accounts): {old_accounts_count}")
    
    # عدد المستخدمين
    all_users = await db.users.count_documents({})
    agent_users = await db.users.count_documents({'role': 'agent'})
    admin_users = await db.users.count_documents({'role': 'admin'})
    print(f"👥 إجمالي المستخدمين: {all_users} (وكلاء: {agent_users}, مدراء: {admin_users})")
    
    # عدد القيود المحاسبية
    journal_entries_count = await db.journal_entries.count_documents({})
    print(f"📝 القيود المحاسبية: {journal_entries_count}")
    
    # عدد الحوالات
    transfers_count = await db.transfers.count_documents({})
    print(f"💸 الحوالات: {transfers_count}")
    
    # ============ الخطوة 2: الحصول على الحسابات الصالحة من الدليل المحاسبي ============
    print("\n\n📋 الخطوة 2: جمع الحسابات الصالحة من الدليل المحاسبي")
    print("-" * 80)
    
    valid_accounts = await db.chart_of_accounts.find({}).to_list(1000)
    valid_account_codes = set([acc['code'] for acc in valid_accounts])
    
    print(f"✅ تم العثور على {len(valid_accounts)} حساباً في الدليل المحاسبي")
    
    # عرض حسابات شركات الصرافة
    exchange_accounts = [acc for acc in valid_accounts if 
                        'شركات' in str(acc.get('category', '')) or 
                        str(acc.get('code', '')).startswith('2')]
    
    print(f"\n🏦 حسابات شركات الصرافة ({len(exchange_accounts)}):")
    for acc in exchange_accounts[:10]:  # عرض أول 10 فقط
        print(f"   • {acc['code']}: {acc.get('name_ar', acc.get('name'))}")
    if len(exchange_accounts) > 10:
        print(f"   ... و {len(exchange_accounts) - 10} حساباً آخر")
    
    # ============ الخطوة 3: حذف مجموعة accounts القديمة ============
    print("\n\n🗑️  الخطوة 3: حذف مجموعة accounts القديمة")
    print("-" * 80)
    
    if old_accounts_count > 0:
        print(f"⚠️  سيتم حذف {old_accounts_count} حساباً قديماً")
        print("⏳ الانتظار 2 ثانية...")
        await asyncio.sleep(2)
        
        # حذف جميع البيانات القديمة
        result = await db.accounts.delete_many({})
        print(f"✅ تم حذف {result.deleted_count} حساباً من المجموعة القديمة")
        
        # التأكد من الحذف
        remaining = await db.accounts.count_documents({})
        if remaining == 0:
            print("✅ المجموعة القديمة فارغة تماماً الآن")
        else:
            print(f"⚠️  تحذير: لا يزال هناك {remaining} حساباً")
    else:
        print("✅ المجموعة القديمة فارغة بالفعل")
    
    # ============ الخطوة 4: التحقق من ربط الوكلاء بالحسابات ============
    print("\n\n👥 الخطوة 4: التحقق من ربط الوكلاء بالحسابات")
    print("-" * 80)
    
    agents = await db.users.find({'role': 'agent'}).to_list(1000)
    
    linked_agents = 0
    unlinked_agents = 0
    invalid_linked_agents = 0
    agents_to_delete = []
    
    print(f"📋 فحص {len(agents)} وكيل:")
    print()
    
    for agent in agents:
        agent_id = agent['id']
        agent_name = agent.get('display_name', agent.get('username'))
        account_id = agent.get('account_id')
        
        if not account_id:
            # الوكيل غير مرتبط
            print(f"⚠️  {agent_name}: غير مرتبط بأي حساب")
            
            # البحث في chart_of_accounts بواسطة agent_id
            chart_account = await db.chart_of_accounts.find_one({'agent_id': agent_id})
            
            if chart_account:
                # ربط الوكيل بالحساب
                await db.users.update_one(
                    {'id': agent_id},
                    {'$set': {'account_id': chart_account['code']}}
                )
                print(f"   ✅ تم ربطه بالحساب {chart_account['code']}")
                linked_agents += 1
            else:
                # لا يوجد حساب للوكيل
                print(f"   ❌ لا يوجد حساب في الدليل المحاسبي - سيتم حذفه")
                agents_to_delete.append(agent_id)
                unlinked_agents += 1
        
        elif account_id not in valid_account_codes:
            # الوكيل مرتبط بحساب غير موجود
            print(f"❌ {agent_name}: مرتبط بحساب غير صالح ({account_id})")
            
            # البحث في chart_of_accounts بواسطة agent_id
            chart_account = await db.chart_of_accounts.find_one({'agent_id': agent_id})
            
            if chart_account:
                # تصحيح الربط
                await db.users.update_one(
                    {'id': agent_id},
                    {'$set': {'account_id': chart_account['code']}}
                )
                print(f"   ✅ تم تصحيح الربط إلى {chart_account['code']}")
                linked_agents += 1
            else:
                # حذف الربط غير الصالح
                await db.users.update_one(
                    {'id': agent_id},
                    {'$unset': {'account_id': ''}}
                )
                print(f"   ❌ تم حذف الربط غير الصالح - سيتم حذف الوكيل")
                agents_to_delete.append(agent_id)
                invalid_linked_agents += 1
        else:
            # الوكيل مرتبط بشكل صحيح
            print(f"✅ {agent_name}: مرتبط بالحساب {account_id}")
            linked_agents += 1
    
    # ============ الخطوة 5: حذف الوكلاء غير المرتبطين ============
    print("\n\n🗑️  الخطوة 5: حذف الوكلاء غير المرتبطين بالدليل المحاسبي")
    print("-" * 80)
    
    if len(agents_to_delete) > 0:
        print(f"⚠️  سيتم حذف {len(agents_to_delete)} وكيل غير مرتبط:")
        
        for agent_id in agents_to_delete:
            agent = next((a for a in agents if a['id'] == agent_id), None)
            if agent:
                agent_name = agent.get('display_name', agent.get('username'))
                print(f"   • {agent_name} (ID: {agent_id})")
        
        print("\n⏳ الانتظار 2 ثانية قبل الحذف...")
        await asyncio.sleep(2)
        
        # حذف الوكلاء
        delete_result = await db.users.delete_many({'id': {'$in': agents_to_delete}})
        print(f"\n✅ تم حذف {delete_result.deleted_count} وكيل")
    else:
        print("✅ جميع الوكلاء مرتبطون بشكل صحيح - لا يوجد شيء للحذف")
    
    # ============ الخطوة 6: فحص القيود المحاسبية ============
    print("\n\n📝 الخطوة 6: فحص القيود المحاسبية")
    print("-" * 80)
    
    journal_entries = await db.journal_entries.find({}).to_list(10000)
    
    invalid_entries = []
    valid_entries = 0
    
    for entry in journal_entries:
        entry_has_invalid_account = False
        
        for line in entry.get('lines', []):
            account_code = line.get('account_code')
            if account_code and account_code not in valid_account_codes:
                entry_has_invalid_account = True
                break
        
        if entry_has_invalid_account:
            invalid_entries.append(entry['id'])
        else:
            valid_entries += 1
    
    print(f"✅ قيود محاسبية صحيحة: {valid_entries}")
    print(f"⚠️  قيود محاسبية تحتوي على حسابات غير موجودة: {len(invalid_entries)}")
    
    if len(invalid_entries) > 0:
        print(f"\n⚠️  ملاحظة: القيود غير الصحيحة ستبقى للسجلات التاريخية")
        print(f"   ولكن لن تظهر في التقارير المحاسبية")
    
    # ============ الخطوة 7: التقرير النهائي ============
    print("\n\n" + "=" * 80)
    print("📊 التقرير النهائي بعد التنظيف")
    print("=" * 80)
    
    # إعادة حساب الإحصائيات
    final_chart_accounts = await db.chart_of_accounts.count_documents({})
    final_old_accounts = await db.accounts.count_documents({})
    final_agents = await db.users.count_documents({'role': 'agent'})
    final_linked_agents = await db.users.count_documents({
        'role': 'agent',
        'account_id': {'$exists': True, '$ne': None}
    })
    
    print(f"\n📋 الحسابات:")
    print(f"   • الدليل المحاسبي (chart_of_accounts): {final_chart_accounts}")
    print(f"   • المجموعة القديمة (accounts): {final_old_accounts}")
    
    print(f"\n👥 الوكلاء:")
    print(f"   • إجمالي الوكلاء: {final_agents}")
    print(f"   • وكلاء مرتبطون بالدليل المحاسبي: {final_linked_agents}")
    print(f"   • وكلاء غير مرتبطين: {final_agents - final_linked_agents}")
    
    print(f"\n📝 القيود المحاسبية:")
    print(f"   • إجمالي القيود: {journal_entries_count}")
    print(f"   • قيود صحيحة: {valid_entries}")
    print(f"   • قيود بحسابات قديمة: {len(invalid_entries)}")
    
    print(f"\n📊 ملخص التغييرات:")
    print(f"   • حسابات قديمة محذوفة: {old_accounts_count}")
    print(f"   • وكلاء محذوفون: {len(agents_to_delete)}")
    print(f"   • وكلاء تم ربطهم: {linked_agents}")
    
    # ============ الخطوة 8: عرض حالة الوكلاء النهائية ============
    print("\n\n🏦 حالة الوكلاء النهائية:")
    print("-" * 80)
    
    final_agents_list = await db.users.find({'role': 'agent'}).to_list(1000)
    
    if len(final_agents_list) == 0:
        print("⚠️  لا يوجد أي وكلاء في النظام")
    else:
        print(f"📋 الوكلاء النشطون ({len(final_agents_list)}):\n")
        
        for agent in final_agents_list:
            agent_name = agent.get('display_name', agent.get('username'))
            account_id = agent.get('account_id', 'غير محدد')
            
            # البحث عن الحساب في الدليل
            if account_id and account_id != 'غير محدد':
                account = await db.chart_of_accounts.find_one({'code': account_id})
                if account:
                    account_name = account.get('name_ar', account.get('name'))
                    print(f"✅ {agent_name}: {account_id} - {account_name}")
                else:
                    print(f"❌ {agent_name}: {account_id} - الحساب غير موجود!")
            else:
                print(f"⚠️  {agent_name}: غير مرتبط بأي حساب")
    
    print("\n" + "=" * 80)
    print("✅ اكتمل التنظيف الشامل بنجاح!")
    print("=" * 80)
    print("\n💡 ملاحظات مهمة:")
    print("   1. النظام الآن يعتمد فقط على الدليل المحاسبي (chart_of_accounts)")
    print("   2. جميع الوكلاء يجب أن يكونوا مرتبطين بحسابات في الدليل")
    print("   3. تأكد من تحديث الكود ليستخدم chart_of_accounts بدلاً من accounts")
    print("   4. الحوالات الجديدة ستعمل فقط مع الوكلاء المرتبطين\n")
    
    client.close()

if __name__ == "__main__":
    print("\n🚀 بدء سكريبت التنظيف الشامل...\n")
    asyncio.run(complete_cleanup())
