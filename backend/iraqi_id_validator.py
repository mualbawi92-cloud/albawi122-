# Simple ID Validation - Name Matching Only
# التحقق البسيط من مطابقة الاسم

from typing import Tuple
import re

def normalize_name(name: str) -> str:
    """
    تطبيع الاسم للمقارنة (إزالة المسافات، التشكيل، توحيد الحروف)
    """
    if not name:
        return ""
    
    # تحويل إلى lowercase
    name = name.lower().strip()
    
    # إزالة التشكيل العربي
    arabic_diacritics = re.compile("""
        ّ    | # Tashdid
        َ    | # Fatha
        ً    | # Tanwin Fath
        ُ    | # Damma
        ٌ    | # Tanwin Damm
        ِ    | # Kasra
        ٍ    | # Tanwin Kasr
        ْ    | # Sukun
        ـ     # Tatwil/Kashida
    """, re.VERBOSE)
    name = re.sub(arabic_diacritics, '', name)
    
    # إزالة المسافات الزائدة
    name = ' '.join(name.split())
    
    return name

def extract_first_name(full_name: str) -> str:
    """
    استخراج الاسم الأول من الاسم الكامل
    """
    if not full_name:
        return ""
    
    normalized = normalize_name(full_name)
    
    # الاسم الأول هو أول كلمة
    parts = normalized.split()
    if parts:
        return parts[0]
    
    return normalized

def match_first_name(name1: str, name2: str) -> Tuple[bool, str, dict]:
    """
    مطابقة الاسم الأول بين اسمين
    
    Args:
        name1: الاسم الأول (مثلاً من الحوالة)
        name2: الاسم الثاني (مثلاً من المستخدم)
    
    Returns:
        (is_match, message, details)
    """
    # استخراج الأسماء الأولى
    first_name1 = extract_first_name(name1)
    first_name2 = extract_first_name(name2)
    
    result = {
        'name1_first': first_name1,
        'name2_first': first_name2,
        'match': False,
        'similarity': 0
    }
    
    # التحقق من وجود أسماء
    if not first_name1 or not first_name2:
        return False, "الاسم الأول مطلوب", result
    
    # مطابقة كاملة
    if first_name1 == first_name2:
        result['match'] = True
        result['similarity'] = 100
        return True, "الاسم الأول متطابق تماماً", result
    
    # مطابقة جزئية (أول 3 أحرف)
    min_length = min(len(first_name1), len(first_name2))
    if min_length >= 3:
        # حساب التشابه
        matching_chars = sum(1 for a, b in zip(first_name1, first_name2) if a == b)
        similarity = (matching_chars / max(len(first_name1), len(first_name2))) * 100
        result['similarity'] = similarity
        
        # إذا كان التشابه أكثر من 70%
        if similarity >= 70:
            result['match'] = True
            return True, f"الاسم الأول متشابه ({similarity:.0f}%)", result
        
        # إذا كانت أول 3 أحرف متطابقة
        if first_name1[:3] == first_name2[:3]:
            result['match'] = True
            return True, "الاسم الأول متشابه (أول 3 أحرف متطابقة)", result
    
    # لا يوجد تطابق
    return False, f"الاسم الأول غير متطابق: '{first_name1}' ≠ '{first_name2}'", result

def validate_receiver_name(transfer_receiver_name: str, entered_fullname: str) -> Tuple[bool, str]:
    """
    التحقق من مطابقة اسم المستلم
    
    Args:
        transfer_receiver_name: اسم المستلم في الحوالة
        entered_fullname: الاسم الكامل الذي أدخله المستخدم
    
    Returns:
        (is_valid, message)
    """
    is_match, message, details = match_first_name(
        transfer_receiver_name,
        entered_fullname
    )
    
    if is_match:
        return True, f"✅ تم التحقق من الاسم الأول: {details['name1_first']}"
    else:
        return False, f"❌ {message}"

# مثال على الاستخدام:
# is_valid, message = validate_receiver_name("محمد علي حسن", "محمد أحمد")
# print(is_valid, message)  # True, "✅ تم التحقق من الاسم الأول: محمد"

