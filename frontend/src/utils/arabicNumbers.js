// تحويل الأرقام إلى عربي
export const numberToArabic = (num) => {
  if (num === 0) return "صفر";
  
  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
  const tens = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const hundreds = ["", "مئة", "مئتان", "ثلاثمئة", "أربعمئة", "خمسمئة", "ستمئة", "سبعمئة", "ثمانمئة", "تسعمئة"];
  
  num = Math.floor(num);
  
  if (num < 0) return "سالب " + numberToArabic(-num);
  
  if (num < 10) return ones[num];
  if (num < 20) {
    if (num === 10) return "عشرة";
    if (num === 11) return "أحد عشر";
    if (num === 12) return "اثنا عشر";
    return ones[num - 10] + " عشر";
  }
  if (num < 100) {
    return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? " و" + ones[num % 10] : "");
  }
  if (num < 1000) {
    return hundreds[Math.floor(num / 100)] + (num % 100 !== 0 ? " و" + numberToArabic(num % 100) : "");
  }
  if (num < 1000000) {
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;
    let result;
    
    if (thousands === 1) result = "ألف";
    else if (thousands === 2) result = "ألفان";
    else if (thousands <= 10) result = numberToArabic(thousands) + " آلاف";
    else result = numberToArabic(thousands) + " ألف";
    
    if (remainder !== 0) result += " و" + numberToArabic(remainder);
    return result;
  }
  if (num < 1000000000) {
    const millions = Math.floor(num / 1000000);
    const remainder = num % 1000000;
    let result;
    
    if (millions === 1) result = "مليون";
    else if (millions === 2) result = "مليونان";
    else if (millions <= 10) result = numberToArabic(millions) + " ملايين";
    else result = numberToArabic(millions) + " مليون";
    
    if (remainder !== 0) result += " و" + numberToArabic(remainder);
    return result;
  }
  
  return num.toLocaleString();
};

export const formatWalletRequired = (balance, limit, currency) => {
  if (limit === 0) return { status: "غير محدد", number: null, text: null };
  
  const required = limit - balance;
  if (required <= 0) return { status: "لا يحتاج", number: null, text: null };
  
  const arabicNum = numberToArabic(required);
  const currencyName = currency === 'IQD' ? 'دينار' : 'دولار';
  
  return {
    status: null,
    number: required.toLocaleString(),
    text: `${arabicNum} ${currencyName}`
  };
};
