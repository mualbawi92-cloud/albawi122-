"""
الدليل المحاسبي المبسط - خاص بالحوالات والصيرفة فقط
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

# الحسابات الجديدة - مبسطة
SIMPLE_ACCOUNTS = [
    # 1️⃣ قسم شركات الصرافة
    {
        'code': '501',
        'name': 'شركات الصرافة – آجل',
        'name_ar': 'شركات الصرافة – آجل',
        'name_en': 'Exchange Companies - Credit',
        'category': 'شركات الصرافة',
        'type': 'التزامات',
        'parent_code': '500',
        'currencies': ['IQD', 'USD'],
        'balance': 0.0,
        'balance_iqd': 0.0,
        'balance_usd': 0.0,
        'is_active': True,
        'description': 'حساب رئيسي لشركات الصرافة - الحسابات الفرعية تُنشأ تلقائياً للوكلاء'
    },
    
    # 2️⃣ قسم الإيرادات
    {
        'code': '601',
        'name': 'عمولة حواله محققه',
        'name_ar': 'عمولة حواله محققه',
        'name_en': 'Earned Transfer Commission',
        'category': 'الإيرادات',
        'type': 'إيرادات',
        'parent_code': '600',
        'currencies': ['IQD', 'USD'],
        'balance': 0.0,
        'balance_iqd': 0.0,
        'balance_usd': 0.0,
        'is_active': True,
        'description': '⭐ حساب أساسي - العمولات المحققة من الوكيل في حال وجود نسبة عمولة مثبتة'
    },
    {
        'code': '602',
        'name': 'فروقات الصيرفة إيجابية',
        'name_ar': 'فروقات الصيرفة إيجابية',
        'name_en': 'Positive Exchange Differences',
        'category': 'الإيرادات',
        'type': 'إيرادات',
        'parent_code': '600',
        'currencies': ['IQD', 'USD'],
        'balance': 0.0,
        'balance_iqd': 0.0,
        'balance_usd': 0.0,
        'is_active': True,
        'description': 'أرباح من فروقات الصرف'
    },
    
    # 3️⃣ قسم المصروفات
    {
        'code': '701',
        'name': 'عمولة حواله مدفوعة',
        'name_ar': 'عمولة حواله مدفوعة',
        'name_en': 'Paid Transfer Commission',
        'category': 'المصروفات',
        'type': 'مصاريف',
        'parent_code': '700',
        'currencies': ['IQD', 'USD'],
        'balance': 0.0,
        'balance_iqd': 0.0,
        'balance_usd': 0.0,
        'is_active': True,
        'description': '⭐ حساب أساسي - عمولة مدفوعة للوكيل في حال وجود نسبة عمولة مثبتة'
    },
    {
        'code': '702',
        'name': 'فروقات الصيرفة سلبية',
        'name_ar': 'فروقات الصيرفة سلبية',
        'name_en': 'Negative Exchange Differences',
        'category': 'المصروفات',
        'type': 'مصاريف',
        'parent_code': '700',
        'currencies': ['IQD', 'USD'],
        'balance': 0.0,
        'balance_iqd': 0.0,
        'balance_usd': 0.0,
        'is_active': True,
        'description': '⭐ حساب أساسي - خسائر بيع الدولار'
    },
    
    # 5️⃣ قسم الحسابات المؤقتة
    {
        'code': '901',
        'name': 'حوالات واردة لم تُسلّم',
        'name_ar': 'حوالات واردة لم تُسلّم',
        'name_en': 'Incoming Remittances Pending',
        'category': 'حسابات مؤقتة',
        'type': 'التزامات',
        'parent_code': '900',
        'currencies': ['IQD', 'USD'],
        'balance': 0.0,
        'balance_iqd': 0.0,
        'balance_usd': 0.0,
        'is_active': True,
        'description': '⭐ حساب أساسي - مرتبط بالحوالات التي تأتي من الوكيل لحين التسليم للزبون'
    }
]

# الأقسام
CATEGORIES = [
    {'code': '1', 'name_ar': 'شركات الصرافة', 'name_en': 'Exchange Companies', 'description': 'حسابات الوكلاء والصرافين'},
    {'code': '2', 'name_ar': 'الإيرادات', 'name_en': 'Revenues', 'description': 'حسابات الإيرادات والعمولات المحققة'},
    {'code': '3', 'name_ar': 'المصروفات', 'name_en': 'Expenses', 'description': 'حسابات المصروفات والعمولات المدفوعة'},
    {'code': '4', 'name_ar': 'حسابات مؤقتة', 'name_en': 'Temporary Accounts', 'description': 'الحسابات الانتقالية للحوالات'}
]

async def setup_simple_chart():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['money_transfer_db']
    
    print("=" * 80)
    print("📘 إنشاء الدليل المحاسبي المبسط")
    print("=" * 80)
    print()
    
    # ============ حذف الحسابات القديمة ============
    print("🗑️  الخطوة 1: حذف جميع الحسابات القديمة")
    print("-" * 80)
    
    old_accounts = await db.chart_of_accounts.count_documents({})
    if old_accounts > 0:
        result = await db.chart_of_accounts.delete_many({})
        print(f"✅ تم حذف {result.deleted_count} حساباً قديماً")
    else:
        print("✅ لا توجد حسابات قديمة")
    
    print()
    
    # ============ حذف الأقسام القديمة ============
    old_categories = await db.account_categories.count_documents({})
    if old_categories > 0:
        await db.account_categories.delete_many({})
        print(f"🗑️  تم حذف {old_categories} قسم قديم")
        print()
    
    # ============ إنشاء الأقسام الجديدة ============
    print("📁 الخطوة 2: إنشاء الأقسام")
    print("-" * 80)
    
    for cat in CATEGORIES:
        cat['is_active'] = True
        cat['is_system'] = False
        cat['created_at'] = datetime.now(timezone.utc).isoformat()
        cat['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        await db.account_categories.insert_one(cat)
        print(f"✅ {cat['code']}. {cat['name_ar']}")
    
    print()
    
    # ============ إنشاء الحسابات الجديدة ============
    print("💼 الخطوة 3: إنشاء الحسابات")
    print("-" * 80)
    print()
    
    for account in SIMPLE_ACCOUNTS:
        account['created_at'] = datetime.now(timezone.utc).isoformat()
        account['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        await db.chart_of_accounts.insert_one(account)
        
        icon = "⭐" if "أساسي" in account['description'] else "•"
        print(f"{icon} {account['code']} - {account['name']}")
        print(f"  └─ {account['description']}")
        print()
    
    # ============ الملخص النهائي ============
    print("=" * 80)
    print("📊 الدليل المحاسبي المبسط - الملخص")
    print("=" * 80)
    print()
    
    print("1️⃣  قسم شركات الصرافة:")
    print("   • 501 – شركات الصرافة – آجل")
    print()
    
    print("2️⃣  قسم الإيرادات:")
    print("   ⭐ 601 – عمولة حواله محققه (أساسي)")
    print("   • 602 – فروقات الصيرفة إيجابية")
    print()
    
    print("3️⃣  قسم المصروفات:")
    print("   ⭐ 701 – عمولة حواله مدفوعة (أساسي)")
    print("   ⭐ 702 – فروقات الصيرفة سلبية (أساسي)")
    print()
    
    print("5️⃣  قسم الحسابات المؤقتة:")
    print("   ⭐ 901 – حوالات واردة لم تُسلّم (أساسي)")
    print()
    
    print("=" * 80)
    print("✅ إجمالي الحسابات: 5 حسابات")
    print("✅ إجمالي الأقسام: 4 أقسام")
    print("=" * 80)
    print()
    
    print("⚠️  ملاحظات مهمة:")
    print("   • الحسابات الأساسية (⭐) مرتبطة بالنظام تلقائياً")
    print("   • حساب 601: يُستخدم للعمولات المحققة من الوكيل")
    print("   • حساب 701: يُستخدم للعمولات المدفوعة للوكيل")
    print("   • حساب 901: يُستخدم للحوالات الواردة قبل التسليم")
    print("   • حساب 501: الحسابات الفرعية للوكلاء (501-01, 501-02...)")
    print()
    
    client.close()

if __name__ == "__main__":
    print("\n🚀 بدء إنشاء الدليل المحاسبي المبسط...\n")
    asyncio.run(setup_simple_chart())
    print("🎉 اكتمل الإعداد بنجاح!\n")
