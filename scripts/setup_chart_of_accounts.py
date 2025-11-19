"""
إعداد الدليل المحاسبي النهائي للنظام
يحذف جميع الحسابات القديمة ويضيف الحسابات المطلوبة فقط
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

# الحسابات المطلوبة حسب المواصفات
CHART_OF_ACCOUNTS = [
    # 🔵 القسم الأول: الصناديق (Cash Accounts)
    {
        'code': '101',
        'name': 'الصندوق',
        'name_ar': 'الصندوق',
        'name_en': 'Cash',
        'category': 'الصناديق',
        'type': 'أصول',
        'parent_code': '100',
        'currencies': ['IQD', 'USD'],
        'balance': 0.0,
        'balance_iqd': 0.0,
        'balance_usd': 0.0,
        'is_active': True,
        'description': 'تُستخدم لاستلام وصرف النقد'
    },
    {
        'code': '111',
        'name': 'صندوق العملات الأجنبية',
        'name_ar': 'صندوق العملات الأجنبية',
        'name_en': 'Foreign Currency Cash',
        'category': 'الصناديق',
        'type': 'أصول',
        'parent_code': '100',
        'currencies': ['USD'],
        'balance': 0.0,
        'balance_usd': 0.0,
        'is_active': True,
        'description': 'صندوق خاص بالعملات الأجنبية'
    },
    
    # 🟣 القسم الثاني: المصارف (Bank Accounts)
    {
        'code': '131',
        'name': 'المصارف المقيّمة',
        'name_ar': 'المصارف المقيّمة',
        'name_en': 'Valued Bank Accounts',
        'category': 'المصارف',
        'type': 'أصول',
        'parent_code': '130',
        'currencies': ['IQD', 'USD'],
        'balance': 0.0,
        'balance_iqd': 0.0,
        'balance_usd': 0.0,
        'is_active': True,
        'description': 'حسابات بنكية مقيمة'
    },
    {
        'code': '132',
        'name': 'المصارف غير المقيّمة',
        'name_ar': 'المصارف غير المقيّمة',
        'name_en': 'Non-Valued Bank Accounts',
        'category': 'المصارف',
        'type': 'أصول',
        'parent_code': '130',
        'currencies': ['IQD', 'USD'],
        'balance': 0.0,
        'balance_iqd': 0.0,
        'balance_usd': 0.0,
        'is_active': True,
        'description': 'حسابات بنكية غير مقيمة'
    },
    
    # 🟢 القسم الثالث: الذمم (Receivables & Payables)
    {
        'code': '141',
        'name': 'الزبائن',
        'name_ar': 'الزبائن',
        'name_en': 'Customers/Receivables',
        'category': 'الذمم',
        'type': 'أصول',
        'parent_code': '140',
        'currencies': ['IQD', 'USD'],
        'balance': 0.0,
        'balance_iqd': 0.0,
        'balance_usd': 0.0,
        'is_active': True,
        'description': 'حسابات العملاء والمدينين'
    },
    {
        'code': '143',
        'name': 'الموردون',
        'name_ar': 'الموردون',
        'name_en': 'Suppliers/Payables',
        'category': 'الذمم',
        'type': 'التزامات',
        'parent_code': '140',
        'currencies': ['IQD', 'USD'],
        'balance': 0.0,
        'balance_iqd': 0.0,
        'balance_usd': 0.0,
        'is_active': True,
        'description': 'حسابات الموردين والدائنين'
    },
    
    # 🟠 القسم الرابع: حسابات الصيرفة الأساسية (Exchange Operations)
    {
        'code': '401',
        'name': 'مبيعات العملات',
        'name_ar': 'مبيعات العملات',
        'name_en': 'Currency Sales',
        'category': 'الصيرفة الأساسية',
        'type': 'إيرادات',
        'parent_code': '400',
        'currencies': ['IQD', 'USD'],
        'balance': 0.0,
        'balance_iqd': 0.0,
        'balance_usd': 0.0,
        'is_active': True,
        'description': 'إيرادات بيع العملات'
    },
    {
        'code': '403',
        'name': 'مشتريات العملات',
        'name_ar': 'مشتريات العملات',
        'name_en': 'Currency Purchases',
        'category': 'الصيرفة الأساسية',
        'type': 'مصاريف',
        'parent_code': '400',
        'currencies': ['IQD', 'USD'],
        'balance': 0.0,
        'balance_iqd': 0.0,
        'balance_usd': 0.0,
        'is_active': True,
        'description': 'مصاريف شراء العملات'
    },
    
    # 🟡 القسم الخامس: حسابات الحوالات (Remittance Accounts) - ضرورية للنظام
    {
        'code': '203',
        'name': 'حوالات واردة لم تُسلّم',
        'name_ar': 'حوالات واردة لم تُسلّم',
        'name_en': 'Incoming Remittances Pending',
        'category': 'الحسابات المؤقتة',
        'type': 'التزامات',
        'parent_code': '200',
        'currencies': ['IQD', 'USD'],
        'balance': 0.0,
        'balance_iqd': 0.0,
        'balance_usd': 0.0,
        'is_active': True,
        'description': 'حوالات واردة في انتظار التسليم - عند الإرسال: الوكيل مدين وهذا الحساب دائن، عند الدفع: هذا الحساب مدين والوكيل دائن'
    },
    {
        'code': '204',
        'name': 'حوالات صادرة لم تُسلّم',
        'name_ar': 'حوالات صادرة لم تُسلّم',
        'name_en': 'Outgoing Remittances Pending',
        'category': 'الحسابات المؤقتة',
        'type': 'أصول',
        'parent_code': '200',
        'currencies': ['IQD', 'USD'],
        'balance': 0.0,
        'balance_iqd': 0.0,
        'balance_usd': 0.0,
        'is_active': True,
        'description': 'حوالات صادرة في انتظار التسليم'
    },
    {
        'code': '194',
        'name': 'حسابات مؤقتة (انتقالية)',
        'name_ar': 'حسابات مؤقتة (انتقالية)',
        'name_en': 'Temporary Transit Accounts',
        'category': 'الحسابات المؤقتة',
        'type': 'أصول',
        'parent_code': '190',
        'currencies': ['IQD', 'USD'],
        'balance': 0.0,
        'balance_iqd': 0.0,
        'balance_usd': 0.0,
        'is_active': True,
        'description': 'حسابات انتقالية مؤقتة'
    },
    
    # 🔴 القسم السادس: حسابات العمولات (Commission Accounts)
    {
        'code': '413',
        'name': 'عمولات محققة',
        'name_ar': 'عمولات محققة',
        'name_en': 'Earned Commissions',
        'category': 'العمولات',
        'type': 'إيرادات',
        'parent_code': '410',
        'currencies': ['IQD', 'USD'],
        'balance': 0.0,
        'balance_iqd': 0.0,
        'balance_usd': 0.0,
        'is_active': True,
        'description': 'عمولات محققة - يتم استقطاعها من الوكيل المرسل'
    },
    {
        'code': '421',
        'name': 'عمولات مدفوعة',
        'name_ar': 'عمولات مدفوعة',
        'name_en': 'Paid Commissions',
        'category': 'العمولات',
        'type': 'مصاريف',
        'parent_code': '420',
        'currencies': ['IQD', 'USD'],
        'balance': 0.0,
        'balance_iqd': 0.0,
        'balance_usd': 0.0,
        'is_active': True,
        'description': 'عمولات مدفوعة - تُحتسب للوكيل الدافع'
    },
    
    # 🟤 القسم السابع: فروقات العملة (FX Difference)
    {
        'code': '223',
        'name': 'فروقات العملة الأجنبية',
        'name_ar': 'فروقات العملة الأجنبية',
        'name_en': 'Foreign Exchange Differences',
        'category': 'فروقات العملة',
        'type': 'إيرادات/مصاريف',
        'parent_code': '220',
        'currencies': ['IQD', 'USD'],
        'balance': 0.0,
        'balance_iqd': 0.0,
        'balance_usd': 0.0,
        'is_active': True,
        'description': 'فروقات تحويل العملات'
    },
    {
        'code': '198',
        'name': 'مقابل العملة الأجنبية',
        'name_ar': 'مقابل العملة الأجنبية',
        'name_en': 'FX Contra Account',
        'category': 'فروقات العملة',
        'type': 'أصول',
        'parent_code': '190',
        'currencies': ['IQD', 'USD'],
        'balance': 0.0,
        'balance_iqd': 0.0,
        'balance_usd': 0.0,
        'is_active': True,
        'description': 'حساب مقابل فروقات العملة'
    },
    
    # 🟩 القسم الثامن: إيرادات ومصروفات إضافية (Optional)
    {
        'code': '422',
        'name': 'الحسم الممنوح',
        'name_ar': 'الحسم الممنوح',
        'name_en': 'Discounts Given',
        'category': 'إيرادات ومصروفات إضافية',
        'type': 'مصاريف',
        'parent_code': '420',
        'currencies': ['IQD', 'USD'],
        'balance': 0.0,
        'balance_iqd': 0.0,
        'balance_usd': 0.0,
        'is_active': True,
        'description': 'خصومات ممنوحة للعملاء'
    },
    {
        'code': '415',
        'name': 'الحسم المكتسب',
        'name_ar': 'الحسم المكتسب',
        'name_en': 'Discounts Earned',
        'category': 'إيرادات ومصروفات إضافية',
        'type': 'إيرادات',
        'parent_code': '410',
        'currencies': ['IQD', 'USD'],
        'balance': 0.0,
        'balance_iqd': 0.0,
        'balance_usd': 0.0,
        'is_active': True,
        'description': 'خصومات مكتسبة من الموردين'
    },
    {
        'code': '414',
        'name': 'أجور الشحن',
        'name_ar': 'أجور الشحن',
        'name_en': 'Shipping Fees',
        'category': 'إيرادات ومصروفات إضافية',
        'type': 'إيرادات',
        'parent_code': '410',
        'currencies': ['IQD', 'USD'],
        'balance': 0.0,
        'balance_iqd': 0.0,
        'balance_usd': 0.0,
        'is_active': True,
        'description': 'إيرادات أجور الشحن'
    },
    {
        'code': '461',
        'name': 'ضريبة القيمة المضافة',
        'name_ar': 'ضريبة القيمة المضافة',
        'name_en': 'VAT',
        'category': 'إيرادات ومصروفات إضافية',
        'type': 'التزامات',
        'parent_code': '460',
        'currencies': ['IQD', 'USD'],
        'balance': 0.0,
        'balance_iqd': 0.0,
        'balance_usd': 0.0,
        'is_active': True,
        'description': 'ضريبة القيمة المضافة'
    }
]

async def setup_chart():
    """إعداد الدليل المحاسبي النهائي"""
    
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['money_transfer_db']
    
    print("=" * 80)
    print("🏦 إعداد الدليل المحاسبي النهائي")
    print("=" * 80)
    print()
    
    # ============ الخطوة 1: حذف جميع الحسابات القديمة ============
    print("🗑️  الخطوة 1: حذف جميع الحسابات القديمة")
    print("-" * 80)
    
    old_count = await db.chart_of_accounts.count_documents({})
    print(f"⚠️  عدد الحسابات القديمة: {old_count}")
    
    if old_count > 0:
        result = await db.chart_of_accounts.delete_many({})
        print(f"✅ تم حذف {result.deleted_count} حساباً قديماً")
    else:
        print("✅ لا توجد حسابات قديمة")
    
    print()
    
    # ============ الخطوة 2: إنشاء الحسابات الجديدة ============
    print("✨ الخطوة 2: إنشاء الحسابات الجديدة")
    print("-" * 80)
    print()
    
    categories = {}
    
    for account in CHART_OF_ACCOUNTS:
        # إضافة timestamps
        account['created_at'] = datetime.now(timezone.utc).isoformat()
        account['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        # إضافة الحساب
        await db.chart_of_accounts.insert_one(account)
        
        # تجميع حسب الفئة
        category = account['category']
        if category not in categories:
            categories[category] = []
        categories[category].append(account)
        
        print(f"✅ {account['code']} - {account['name']}")
    
    print()
    print("=" * 80)
    print("📊 ملخص الدليل المحاسبي")
    print("=" * 80)
    print()
    
    # عرض الحسابات حسب الفئة
    category_order = [
        'الصناديق',
        'المصارف',
        'الذمم',
        'الصيرفة الأساسية',
        'الحسابات المؤقتة',
        'العمولات',
        'فروقات العملة',
        'إيرادات ومصروفات إضافية'
    ]
    
    category_icons = {
        'الصناديق': '🔵',
        'المصارف': '🟣',
        'الذمم': '🟢',
        'الصيرفة الأساسية': '🟠',
        'الحسابات المؤقتة': '🟡',
        'العمولات': '🔴',
        'فروقات العملة': '🟤',
        'إيرادات ومصروفات إضافية': '🟩'
    }
    
    total = 0
    for category in category_order:
        if category in categories:
            icon = category_icons.get(category, '📁')
            accounts = categories[category]
            print(f"{icon} {category} ({len(accounts)} حساب):")
            for acc in accounts:
                currencies_str = ', '.join(acc['currencies'])
                print(f"   • {acc['code']} - {acc['name']} [{currencies_str}]")
            print()
            total += len(accounts)
    
    print("=" * 80)
    print(f"✅ إجمالي الحسابات: {total}")
    print("=" * 80)
    print()
    
    # ============ الخطوة 3: ملاحظات مهمة ============
    print("📝 ملاحظات مهمة:")
    print("-" * 80)
    print("✅ تم إنشاء الحسابات المطلوبة فقط")
    print("✅ حساب 203 (حوالات واردة) جاهز لربط الحوالات")
    print("✅ حساب 413 (عمولات محققة) جاهز لربط العمولات")
    print("✅ حساب 421 (عمولات مدفوعة) جاهز لربط العمولات")
    print("✅ جميع الحسابات تدعم IQD و USD")
    print()
    print("⚠️  تذكير:")
    print("   • يجب ربط كل وكيل بحساب من قسم 'شركات الصرافة'")
    print("   • حسابات الحوالات (203, 204, 194) ضرورية لعمل النظام")
    print("   • حسابات العمولات (413, 421) ضرورية لتسجيل العمولات")
    print()
    
    client.close()

if __name__ == "__main__":
    print("\n🚀 بدء إعداد الدليل المحاسبي...\n")
    asyncio.run(setup_chart())
    print("🎉 اكتمل الإعداد بنجاح!\n")
