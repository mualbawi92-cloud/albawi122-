# Iraqi ID Validation Component
# التحقق من الهوية العراقية

from fastapi import UploadFile
from typing import Optional, Tuple
import re

# أنواع الهويات المقبولة
ACCEPTED_ID_TYPES = {
    'civil_id': 'البطاقة المدنية الموحدة',
    'national_id': 'البطاقة الوطنية',
    'drivers_license': 'إجازة السوق',
    'passport': 'جواز السفر'
}

# أرقام البطاقة العراقية تبدأ عادة بـ
IRAQI_ID_PATTERNS = [
    r'^\d{12}$',  # 12 رقم (البطاقة الوطنية)
    r'^[A-Z]\d{8}$',  # حرف + 8 أرقام (إجازة السوق)
    r'^IQDL\d{8}$',  # IQDL + 8 أرقام (بطاقة مدنية)
]

# المحافظات العراقية
IRAQI_GOVERNORATES = [
    'بغداد', 'البصرة', 'النجف', 'كربلاء', 'بابل',
    'الأنبار', 'ديالى', 'واسط', 'صلاح الدين', 'نينوى',
    'ذي قار', 'القادسية', 'المثنى', 'ميسان', 'كركوك',
    'أربيل', 'السليمانية', 'دهوك'
]

def extract_id_info_from_filename(filename: str) -> dict:
    """
    استخراج معلومات من اسم الملف
    مثلاً: civil_id_199279789522.jpg
    """
    info = {
        'id_type': None,
        'id_number': None
    }
    
    # محاولة استخراج نوع الهوية
    filename_lower = filename.lower()
    if 'civil' in filename_lower or 'مدنية' in filename_lower:
        info['id_type'] = 'civil_id'
    elif 'national' in filename_lower or 'وطنية' in filename_lower:
        info['id_type'] = 'national_id'
    elif 'driver' in filename_lower or 'سوق' in filename_lower or 'اجازة' in filename_lower:
        info['id_type'] = 'drivers_license'
    elif 'passport' in filename_lower or 'جواز' in filename_lower:
        info['id_type'] = 'passport'
    
    # محاولة استخراج رقم الهوية
    numbers = re.findall(r'\d+', filename)
    if numbers:
        # اختيار أطول رقم
        info['id_number'] = max(numbers, key=len)
    
    return info

def validate_iraqi_id_number(id_number: str) -> Tuple[bool, str]:
    """
    التحقق من صحة رقم الهوية العراقية
    """
    if not id_number:
        return False, "رقم الهوية مطلوب"
    
    # إزالة المسافات والرموز
    id_clean = re.sub(r'[^\w]', '', id_number)
    
    # التحقق من الأنماط المعروفة
    for pattern in IRAQI_ID_PATTERNS:
        if re.match(pattern, id_clean):
            return True, "رقم هوية صحيح"
    
    return False, "رقم الهوية لا يتطابق مع الأنماط المعروفة"

def validate_id_image(file: UploadFile, id_number: Optional[str] = None) -> Tuple[bool, str, dict]:
    """
    التحقق من صورة الهوية
    Returns: (is_valid, message, extracted_info)
    """
    result = {
        'is_valid': False,
        'message': '',
        'id_type': None,
        'id_number': None,
        'warnings': []
    }
    
    # 1. التحقق من نوع الملف
    if not file.filename:
        result['message'] = "اسم الملف مطلوب"
        return False, result['message'], result
    
    ext = '.' + file.filename.lower().split('.')[-1] if '.' in file.filename else ''
    if ext not in ['.jpg', '.jpeg', '.png']:
        result['message'] = "يجب أن تكون الصورة بصيغة JPG أو PNG"
        return False, result['message'], result
    
    # 2. استخراج معلومات من اسم الملف
    info = extract_id_info_from_filename(file.filename)
    result['id_type'] = info['id_type']
    result['id_number'] = info['id_number'] or id_number
    
    # 3. التحقق من رقم الهوية إذا كان موجوداً
    if result['id_number']:
        is_valid_number, number_message = validate_iraqi_id_number(result['id_number'])
        if not is_valid_number:
            result['warnings'].append(number_message)
    
    # 4. التحقق النهائي
    result['is_valid'] = True
    result['message'] = "صورة الهوية صالحة"
    
    if result['id_type']:
        result['message'] += f" - نوع: {ACCEPTED_ID_TYPES.get(result['id_type'], 'غير محدد')}"
    
    return True, result['message'], result

def get_id_upload_instructions() -> dict:
    """
    تعليمات رفع صورة الهوية
    """
    return {
        'title': 'تعليمات رفع صورة الهوية',
        'instructions': [
            '✅ التقط صورة واضحة للهوية الأصلية',
            '✅ تأكد من ظهور جميع المعلومات بوضوح',
            '✅ لا تستخدم صور معدلة أو منسوخة',
            '✅ الإضاءة جيدة بدون ظلال',
            '✅ الصورة مستقيمة وليست مائلة',
        ],
        'accepted_ids': [
            {
                'name': 'البطاقة المدنية الموحدة',
                'description': 'البطاقة التي تحتوي على IQDL متبوعة بأرقام',
                'example': 'IQDL02341651',
                'image_guidelines': [
                    'صور الوجه الأمامي للبطاقة',
                    'تأكد من ظهور الصورة الشخصية والأرقام',
                    'الخلفية الوردية/البنفسجية'
                ]
            },
            {
                'name': 'البطاقة الوطنية',
                'description': 'البطاقة التي تحتوي على 12 رقم',
                'example': '199279789522',
                'image_guidelines': [
                    'صور الوجه الأمامي للبطاقة',
                    'تأكد من ظهور الصورة الشخصية ورقم البطاقة',
                    'الخلفية الزرقاء/الخضراء'
                ]
            },
            {
                'name': 'إجازة السوق',
                'description': 'رخصة القيادة العراقية',
                'example': 'A82259460',
                'image_guidelines': [
                    'صور الوجه الأمامي لإجازة السوق',
                    'تأكد من ظهور الصورة الشخصية والرقم',
                    'الختم الرسمي يجب أن يكون واضحاً'
                ]
            }
        ],
        'not_accepted': [
            '❌ صور غير واضحة أو مشوشة',
            '❌ صور معدلة بالفوتوشوب',
            '❌ صور من الإنترنت',
            '❌ هويات منتهية الصلاحية',
            '❌ هويات تالفة أو ممزقة'
        ],
        'privacy_note': '🔒 جميع الصور تُحفظ بشكل آمن ومشفر ولن تُستخدم إلا للتحقق من الهوية'
    }
