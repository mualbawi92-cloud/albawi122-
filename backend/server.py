from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Form, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import os
import logging
import uuid
import bcrypt
import jwt
import random
import cloudinary
import cloudinary.uploader
import socketio
from collections import defaultdict
import asyncio
import base64
from cryptography.fernet import Fernet
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'secret')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get('ACCESS_TOKEN_EXPIRE_MINUTES', 480))  # 8 hours

# Encryption for PIN storage (reversible)
# Generate a key from JWT_SECRET for consistency
ENCRYPTION_KEY = base64.urlsafe_b64encode(JWT_SECRET.encode().ljust(32)[:32])
cipher = Fernet(ENCRYPTION_KEY)

# Transit Account ID (constant)
TRANSIT_ACCOUNT_ID = "transit_account_main"

# Iraqi Governorate Code to Name Mapping
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

# Security Config
MAX_LOGIN_ATTEMPTS = int(os.environ.get('MAX_LOGIN_ATTEMPTS', 5))
LOCKOUT_DURATION = int(os.environ.get('LOCKOUT_DURATION_MINUTES', 15))
MAX_PIN_ATTEMPTS = int(os.environ.get('MAX_PIN_ATTEMPTS', 5))

# Cloudinary Config
cloudinary.config(
    cloud_name=os.environ.get('CLOUDINARY_CLOUD_NAME'),
    api_key=os.environ.get('CLOUDINARY_API_KEY'),
    api_secret=os.environ.get('CLOUDINARY_API_SECRET'),
    secure=True
)

# Rate limiting storage
login_attempts = defaultdict(lambda: {'count': 0, 'locked_until': None})
pin_attempts_cache = defaultdict(lambda: {'count': 0, 'locked_until': None})

# Socket.IO setup
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ============ AI Monitoring Functions ============

async def check_duplicate_transfers(sender_name: str, receiver_name: str, amount: float, currency: str) -> dict:
    """
    Check for duplicate transfers on the same day
    Returns dict with is_duplicate flag and details
    """
    # Get today's date range
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    # Search for transfers with same sender/receiver name and amount today
    query = {
        'created_at': {
            '$gte': today_start.isoformat(),
            '$lt': today_end.isoformat()
        },
        'amount': amount,
        'currency': currency,
        '$or': [
            {'sender_name': sender_name},
            {'receiver_name': receiver_name}
        ]
    }
    
    duplicates = await db.transfers.find(query).to_list(length=None)
    
    if len(duplicates) > 0:
        return {
            'is_duplicate': True,
            'count': len(duplicates),
            'transfers': [
                {
                    'transfer_code': t.get('transfer_code'),
                    'sender_name': t.get('sender_name'),
                    'receiver_name': t.get('receiver_name'),
                    'amount': t.get('amount'),
                    'created_at': t.get('created_at')
                }
                for t in duplicates
            ]
        }
    
    return {'is_duplicate': False, 'count': 0, 'transfers': []}

async def read_id_card_with_ai(image_url: str) -> dict:
    """
    Use OpenAI Vision to read name from ID card image
    Returns dict with extracted_name and confidence
    """
    try:
        # Download image and convert to base64
        async with httpx.AsyncClient() as client:
            response = await client.get(image_url)
            if response.status_code != 200:
                return {'success': False, 'error': 'Failed to download image'}
            
            image_data = response.content
            image_base64 = base64.b64encode(image_data).decode('utf-8')
        
        # Initialize LLM with Vision
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            return {'success': False, 'error': 'No API key found'}
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"id-card-{uuid.uuid4()}",
            system_message="أنت خبير في قراءة الهويات العراقية. مهمتك استخراج الاسم الثلاثي الكامل بالعربي من صورة الهوية."
        ).with_model("openai", "gpt-4o")
        
        # Create image content
        image_content = ImageContent(image_base64=image_base64)
        
        # Ask AI to extract name
        user_message = UserMessage(
            text="اقرأ الاسم الثلاثي الكامل من هذه الهوية العراقية. أجب فقط بالاسم الثلاثي بدون أي نص إضافي. مثال: أحمد علي حسن",
            file_contents=[image_content]
        )
        
        response = await chat.send_message(user_message)
        
        extracted_name = response.strip()
        
        return {
            'success': True,
            'extracted_name': extracted_name
        }
        
    except Exception as e:
        logger.error(f"Error reading ID card with AI: {str(e)}")
        return {'success': False, 'error': str(e)}

async def create_ai_notification(admin_id: str, notification_type: str, title: str, message: str, related_transfer_id: str = None):
    """
    Create an AI-generated notification for admin
    """
    notification = {
        'id': str(uuid.uuid4()),
        'type': notification_type,  # 'duplicate_transfer', 'id_mismatch', 'suspicious_pattern'
        'title': title,
        'message': message,
        'related_transfer_id': related_transfer_id,
        'is_read': False,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'severity': 'high'
    }
    
    await db.notifications.insert_one(notification)
    
    # Emit socket event for real-time notification
    await sio.emit('new_notification', {
        'notification': notification
    }, room=f'admin_{admin_id}')

# ============ Helper Functions ============

def compute_check_digit(base: str) -> str:
    """Compute mod97 check digit"""
    digits = ''.join(filter(str.isdigit, base))
    if not digits:
        return '0'
    
    rem = 0
    for i in range(0, len(digits), 7):
        chunk = digits[i:i+7]
        rem = (rem * (10 ** len(chunk)) + int(chunk)) % 97
    
    check = (97 - rem) % 10
    return str(check)

async def generate_transfer_code(governorate: str) -> tuple:
    """Generate unique transfer code with check digit"""
    # Get next sequence number
    counter_doc = await db.counters.find_one_and_update(
        {'_id': 'transfer_seq'},
        {'$inc': {'seq': 1}},
        upsert=True,
        return_document=True
    )
    seq_num = counter_doc.get('seq', 1) if counter_doc else 1
    
    datepart = datetime.now(timezone.utc).strftime('%Y%m%d')
    base_code = f"T-{governorate}-{datepart}-{seq_num:06d}"
    check_digit = compute_check_digit(base_code)
    transfer_code = f"{base_code}-{check_digit}"
    
    return transfer_code, seq_num

async def generate_unique_transfer_number() -> str:
    """Generate unique 6-digit transfer number"""
    max_attempts = 100
    for _ in range(max_attempts):
        # Generate random 6-digit number (100000 to 999999)
        transfer_number = str(random.randint(100000, 999999))
        
        # Check if it already exists
        existing = await db.transfers.find_one({'transfer_number': transfer_number})
        if not existing:
            return transfer_number
    
    # If all random attempts fail, use sequential with offset
    counter_doc = await db.counters.find_one_and_update(
        {'_id': 'transfer_number_seq'},
        {'$inc': {'seq': 1}},
        upsert=True,
        return_document=True
    )
    seq_num = counter_doc.get('seq', 1) if counter_doc else 1
    # Start from 100000 and increment
    return str(100000 + (seq_num % 900000))

def generate_pin() -> str:
    """Generate 4-digit PIN"""
    return str(random.randint(1000, 9999))

def hash_pin(pin: str) -> str:
    """Hash PIN using bcrypt"""
    return bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()

def verify_pin(pin: str, pin_hash: str) -> bool:
    """Verify PIN against hash"""
    return bcrypt.checkpw(pin.encode(), pin_hash.encode())

def encrypt_pin(pin: str) -> str:
    """Encrypt PIN for storage (reversible)"""
    return cipher.encrypt(pin.encode()).decode()

def decrypt_pin(encrypted_pin: str) -> str:
    """Decrypt PIN"""
    return cipher.decrypt(encrypted_pin.encode()).decode()

# ============================================
# Transit Account Helper Functions
# ============================================

async def get_or_create_transit_account():
    """Get or create transit account for pending transfers"""
    transit = await db.transit_account.find_one({'id': TRANSIT_ACCOUNT_ID})
    
    if not transit:
        transit = {
            'id': TRANSIT_ACCOUNT_ID,
            'type': 'transit_account',
            'balance_iqd': 0.0,
            'balance_usd': 0.0,
            'created_at': datetime.now(timezone.utc).isoformat(),
            'updated_at': datetime.now(timezone.utc).isoformat()
        }
        await db.transit_account.insert_one(transit)
    
    return transit

async def update_transit_balance(amount: float, currency: str, operation: str, reference_id: str, note: str):
    """
    Update transit account balance
    operation: 'add' or 'subtract'
    """
    await get_or_create_transit_account()
    
    balance_field = f'balance_{currency.lower()}'
    increment = amount if operation == 'add' else -amount
    
    # Update balance
    await db.transit_account.update_one(
        {'id': TRANSIT_ACCOUNT_ID},
        {
            '$inc': {balance_field: increment},
            '$set': {'updated_at': datetime.now(timezone.utc).isoformat()}
        }
    )
    
    # Log transaction
    await db.transit_transactions.insert_one({
        'id': str(uuid.uuid4()),
        'amount': amount,
        'currency': currency,
        'operation': operation,
        'balance_after': 0,  # Will be updated in query
        'reference_id': reference_id,
        'note': note,
        'created_at': datetime.now(timezone.utc).isoformat()
    })

def number_to_arabic(num: float) -> str:
    """Convert number to Arabic words"""
    if num == 0:
        return "صفر"
    
    ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"]
    tens = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"]
    hundreds = ["", "مئة", "مئتان", "ثلاثمئة", "أربعمئة", "خمسمئة", "ستمئة", "سبعمئة", "ثمانمئة", "تسعمئة"]
    
    num = int(num)
    
    if num < 0:
        return "سالب " + number_to_arabic(-num)
    
    if num < 10:
        return ones[num]
    elif num < 20:
        if num == 10:
            return "عشرة"
        elif num == 11:
            return "أحد عشر"
        elif num == 12:
            return "اثنا عشر"
        else:
            return ones[num - 10] + " عشر"
    elif num < 100:
        return tens[num // 10] + (" و" + ones[num % 10] if num % 10 != 0 else "")
    elif num < 1000:
        return hundreds[num // 100] + (" و" + number_to_arabic(num % 100) if num % 100 != 0 else "")
    elif num < 1000000:
        thousands = num // 1000
        remainder = num % 1000
        if thousands == 1:
            result = "ألف"
        elif thousands == 2:
            result = "ألفان"
        elif thousands <= 10:
            result = number_to_arabic(thousands) + " آلاف"
        else:
            result = number_to_arabic(thousands) + " ألف"
        
        if remainder != 0:
            result += " و" + number_to_arabic(remainder)
        return result
    elif num < 1000000000:
        millions = num // 1000000
        remainder = num % 1000000
        if millions == 1:
            result = "مليون"
        elif millions == 2:
            result = "مليونان"
        elif millions <= 10:
            result = number_to_arabic(millions) + " ملايين"
        else:
            result = number_to_arabic(millions) + " مليون"
        
        if remainder != 0:
            result += " و" + number_to_arabic(remainder)
        return result
    else:
        return str(num)  # For very large numbers, just return the number

def create_access_token(data: dict) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token and return current user"""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('sub')
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({'id': user_id}, {'_id': 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        if not user.get('is_active', True):
            raise HTTPException(status_code=403, detail="Account suspended")
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(user: dict = Depends(get_current_user)):
    """Require admin role"""
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def log_audit(transfer_id: Optional[str], user_id: Optional[str], action: str, details: dict):
    """Log audit event"""
    audit_doc = {
        'id': str(uuid.uuid4()),
        'transfer_id': transfer_id,
        'user_id': user_id,
        'action': action,
        'details': details,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.audit_logs.insert_one(audit_doc)

def check_rate_limit(identifier: str, storage: dict, max_attempts: int, lockout_minutes: int) -> bool:
    """Check if identifier is rate limited"""
    entry = storage[identifier]
    
    if entry['locked_until']:
        if datetime.now(timezone.utc) < entry['locked_until']:
            return False
        else:
            entry['count'] = 0
            entry['locked_until'] = None
    
    entry['count'] += 1
    
    if entry['count'] >= max_attempts:
        entry['locked_until'] = datetime.now(timezone.utc) + timedelta(minutes=lockout_minutes)
        return False
    
    return True

# ============ Models ============

class CommissionTier(BaseModel):
    """Commission tier for specific amount range"""
    from_amount: float = 0.0  # من مبلغ
    to_amount: float  # حتى مبلغ
    percentage: float = 0.0  # نسبة من المبلغ (للنسبة المئوية)
    commission_type: str = "percentage"  # نوع العمولة: percentage (نسبة) أو fixed_amount (مبلغ ثابت)
    fixed_amount: float = 0.0  # المبلغ الثابت (للعمولة الثابتة)
    city: Optional[str] = None  # المدينة (None = جميع المدن)
    country: Optional[str] = None  # البلد (None = جميع البلدان)
    currency_type: str = "normal"  # نوع العملة: normal, payable
    type: str = "outgoing"  # النوع: outgoing (صادر), incoming (وارد)

class CommissionRate(BaseModel):
    """Commission rate configuration for an agent"""
    model_config = ConfigDict(extra="ignore")
    id: str
    agent_id: str
    agent_name: str
    currency: str  # IQD or USD
    bulletin_type: str  # transfers (حوالات)
    date: str  # تاريخ النشرة
    tiers: List[CommissionTier]  # قائمة الشرائح
    created_at: str
    updated_at: str

class CommissionRateCreate(BaseModel):
    agent_id: str
    currency: str = "IQD"
    bulletin_type: str = "transfers"
    date: str
    tiers: List[CommissionTier]

# ============================================
# Accounting Models (النماذج المحاسبية)
# ============================================

class AccountCategory(str):
    """Account categories in Arabic"""
    ASSETS = "أصول"  # Assets
    LIABILITIES = "التزامات"  # Liabilities
    EQUITY = "حقوق الملكية"  # Equity
    REVENUES = "إيرادات"  # Revenues
    EXPENSES = "مصاريف"  # Expenses
    EXCHANGE_COMPANIES = "شركات الصرافة"  # Exchange Companies

class Account(BaseModel):
    """Account in chart of accounts"""
    model_config = ConfigDict(extra="ignore")
    id: str
    code: str  # 1010, 1020, etc.
    name_ar: str  # الاسم بالعربي
    name_en: str  # English name
    category: str  # أصول، التزامات، إلخ
    parent_code: Optional[str] = None  # للحسابات الفرعية
    is_active: bool = True
    balance: float = 0.0  # الرصيد الحالي
    currency: str = "IQD"  # العملة
    created_at: str
    updated_at: str

class AccountCreate(BaseModel):
    code: str
    name_ar: str
    name_en: str
    category: str
    parent_code: Optional[str] = None
    currency: str = "IQD"

class JournalEntry(BaseModel):
    """Journal entry (قيد يومية)"""
    model_config = ConfigDict(extra="ignore")
    id: str
    entry_number: str  # رقم القيد
    date: str  # تاريخ القيد
    description: str  # الوصف
    lines: List[dict]  # سطور القيد (مدين ودائن)
    total_debit: float  # إجمالي المدين
    total_credit: float  # إجمالي الدائن
    reference_type: Optional[str] = None  # نوع المرجع (transfer, exchange, etc.)
    reference_id: Optional[str] = None  # معرف المرجع
    created_by: str  # من أنشأ القيد
    created_at: str

class JournalEntryCreate(BaseModel):
    description: str
    lines: List[dict]  # [{"account_code": "1010", "debit": 1000, "credit": 0}, ...]
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None

# ============================================
# Exchange Operations Models (عمليات الصرافة)
# ============================================

class ExchangeRate(BaseModel):
    """Exchange rate settings (أسعار الصرف)"""
    model_config = ConfigDict(extra="ignore")
    id: str
    buy_rate: float  # سعر شراء USD (كم دينار لشراء دولار واحد)
    sell_rate: float  # سعر بيع USD (كم دينار لبيع دولار واحد)
    updated_by: str
    updated_at: str

class ExchangeRateUpdate(BaseModel):
    buy_rate: float
    sell_rate: float

class ExchangeOperation(BaseModel):
    """Exchange operation record (عملية صرف)"""
    model_config = ConfigDict(extra="ignore")
    id: str
    operation_type: str  # "buy" or "sell"
    amount_usd: float  # المبلغ بالدولار
    amount_iqd: float  # المبلغ بالدينار
    exchange_rate: float  # سعر الصرف المستخدم
    profit: float  # الربح من فرق الصرف
    admin_id: str
    admin_name: str
    journal_entry_id: Optional[str] = None  # رقم القيد المحاسبي
    notes: Optional[str] = None
    created_at: str

class ExchangeOperationCreate(BaseModel):
    operation_type: str  # "buy" or "sell"
    amount_usd: float
    exchange_rate: float
    notes: Optional[str] = None

# ============================================

class UserCreate(BaseModel):
    username: str
    password: str
    display_name: str
    governorate: str
    phone: str
    role: str = "agent"
    wallet_limit_iqd: float = 0.0  # حد أقصى للسحب بالدينار
    wallet_limit_usd: float = 0.0  # حد أقصى للسحب بالدولار

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    username: str
    display_name: str
    role: str
    governorate: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool = True
    wallet_balance_iqd: float = 0.0
    wallet_balance_usd: float = 0.0
    wallet_limit_iqd: float = 0.0
    wallet_limit_usd: float = 0.0
    created_at: str

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User

class TransferCreate(BaseModel):
    sender_name: str
    sender_phone: Optional[str] = None  # رقم تلفون المرسل
    receiver_name: str  # اسم المستلم الثلاثي
    amount: float
    currency: str = "IQD"  # IQD or USD
    to_governorate: str
    to_agent_id: Optional[str] = None
    note: Optional[str] = None

class TransferUpdate(BaseModel):
    sender_name: Optional[str] = None
    receiver_name: Optional[str] = None
    amount: Optional[float] = None
    note: Optional[str] = None

class Transfer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    transfer_code: str
    transfer_number: Optional[str] = None  # رقم الحوالة 6 أرقام
    seq_number: int
    from_agent_id: Optional[str] = None
    from_agent_name: Optional[str] = None
    to_governorate: str
    to_agent_id: Optional[str] = None
    to_agent_name: Optional[str] = None
    sender_name: str
    sender_phone: Optional[str] = None  # رقم تلفون المرسل
    receiver_name: Optional[str] = None  # اسم المستلم الثلاثي (Optional for old transfers)
    amount: float
    currency: str = "IQD"
    commission: float = 0.0  # Outgoing commission (للمرسل)
    commission_percentage: float = 0.0  # Changed default from 0.13 to 0.0
    incoming_commission: Optional[float] = 0.0  # Incoming commission (للمستلم)
    incoming_commission_percentage: Optional[float] = 0.0  # نسبة عمولة الاستلام
    status: str
    note: Optional[str] = None
    created_at: str
    updated_at: str

class TransferWithPin(Transfer):
    pin: str  # Only shown once at creation

class TransferReceive(BaseModel):
    pin: str
    receiver_fullname: str

class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    phone: Optional[str] = None
    governorate: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None

class DashboardStats(BaseModel):
    pending_incoming: int
    pending_outgoing: int
    completed_today: int
    total_amount_today: float
    wallet_balance_iqd: float = 0.0
    wallet_balance_usd: float = 0.0

class WalletTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    user_display_name: str
    amount: float
    currency: str
    transaction_type: str  # 'deposit', 'transfer_sent', 'transfer_received'
    reference_id: Optional[str] = None  # transfer_id for transfers
    added_by_admin_id: Optional[str] = None
    added_by_admin_name: Optional[str] = None
    note: Optional[str] = None
    created_at: str

class WalletDeposit(BaseModel):
    user_id: str
    amount: float
    currency: str  # IQD or USD
    note: Optional[str] = None

class AgentStatement(BaseModel):
    agent_id: str
    agent_name: str
    governorate: str
    # Summary
    total_sent: float
    total_sent_count: int
    total_received: float
    total_received_count: int
    total_commission: float
    # Breakdown by currency
    iqd_sent: float
    iqd_received: float
    usd_sent: float
    usd_received: float
    # Transfers
    transfers: List[Transfer]

# ============ API Routes ============

@api_router.post("/register", response_model=User)
async def register_user(user_data: UserCreate, current_user: dict = Depends(require_admin)):
    """Register new agent (admin only)"""
    # Validate username
    if not user_data.username or len(user_data.username) < 3:
        raise HTTPException(status_code=400, detail="اسم المستخدم يجب أن يكون 3 أحرف على الأقل")
    
    if not user_data.password or len(user_data.password) < 6:
        raise HTTPException(status_code=400, detail="كلمة المرور يجب أن تكون 6 أحرف على الأقل")
    
    if not user_data.display_name:
        raise HTTPException(status_code=400, detail="اسم الصيرفة مطلوب")
    
    if not user_data.phone:
        raise HTTPException(status_code=400, detail="رقم الهاتف مطلوب")
    
    # Check if username exists
    existing = await db.users.find_one({'username': user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail=f"اسم المستخدم '{user_data.username}' موجود مسبقاً")
    
    user_id = str(uuid.uuid4())
    password_hash = bcrypt.hashpw(user_data.password.encode(), bcrypt.gensalt()).decode()
    
    user_doc = {
        'id': user_id,
        'username': user_data.username,
        'password_hash': password_hash,
        'display_name': user_data.display_name,
        'role': user_data.role,
        'governorate': user_data.governorate,
        'phone': user_data.phone,
        'is_active': True,
        'wallet_balance_iqd': 0.0,
        'wallet_balance_usd': 0.0,
        'wallet_limit_iqd': user_data.wallet_limit_iqd,
        'wallet_limit_usd': user_data.wallet_limit_usd,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    await log_audit(None, current_user['id'], 'user_created', {'new_user_id': user_id})
    
    # Create accounting entry for agent automatically
    if user_data.role == 'agent':
        try:
            # Get the highest exchange company account code
            exchange_accounts = await db.accounts.find({
                'category': 'شركات الصرافة',
                'code': {'$regex': '^2\\d{3}$'}
            }).sort('code', -1).to_list(length=1)
            
            if exchange_accounts:
                last_code = int(exchange_accounts[0]['code'])
            else:
                last_code = 2000
            
            account_code = str(last_code + 1)
            
            # Create account
            account = {
                'id': f'acc_{user_id}',
                'code': account_code,
                'name_ar': f'صيرفة {user_data.display_name}',
                'name_en': f'Exchange {user_data.display_name}',
                'category': 'شركات الصرافة',
                'parent_code': None,
                'is_active': True,
                'balance': 0,
                'currency': 'IQD',
                'agent_id': user_id,
                'created_at': datetime.now(timezone.utc).isoformat(),
                'updated_at': datetime.now(timezone.utc).isoformat()
            }
            
            await db.accounts.insert_one(account)
            logger.info(f"Created accounting entry {account_code} for agent {user_data.display_name}")
        except Exception as e:
            logger.error(f"Failed to create accounting entry for agent: {str(e)}")
    
    user_doc.pop('password_hash', None)
    user_doc.pop('_id', None)
    return user_doc

@api_router.post("/login", response_model=LoginResponse)
async def login(credentials: LoginRequest, request: Request):
    """Login endpoint with rate limiting"""
    client_ip = request.client.host
    
    # Check rate limit
    if not check_rate_limit(client_ip, login_attempts, MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION):
        raise HTTPException(status_code=429, detail="Too many login attempts. Try again later.")
    
    # Find user
    user = await db.users.find_one({'username': credentials.username})
    if not user or not bcrypt.checkpw(credentials.password.encode(), user['password_hash'].encode()):
        await log_audit(None, None, 'login_failed', {'username': credentials.username, 'ip': client_ip})
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get('is_active', True):
        raise HTTPException(status_code=403, detail="Account suspended")
    
    # Reset rate limit on successful login
    login_attempts[client_ip] = {'count': 0, 'locked_until': None}
    
    # Create token
    access_token = create_access_token({'sub': user['id'], 'role': user['role']})
    
    await log_audit(None, user['id'], 'login_success', {'ip': client_ip})
    
    user.pop('password_hash', None)
    user.pop('_id', None)
    
    return {'access_token': access_token, 'user': user}

@api_router.get("/agents", response_model=List[User])
async def get_agents(governorate: Optional[str] = None, search: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get list of agents with filters"""
    query = {'role': 'agent', 'is_active': True}
    
    if governorate:
        query['governorate'] = governorate
    
    if search:
        query['$or'] = [
            {'display_name': {'$regex': search, '$options': 'i'}},
            {'username': {'$regex': search, '$options': 'i'}}
        ]
    
    agents = await db.users.find(query, {'_id': 0, 'password_hash': 0}).to_list(1000)
    return agents

@api_router.get("/agents/{agent_id}/statement", response_model=AgentStatement)
async def get_agent_statement(agent_id: str, current_user: dict = Depends(get_current_user)):
    """Get agent statement (كشف حساب) with all transactions and totals"""
    # Check permissions: admin or the agent themselves
    if current_user['role'] != 'admin' and current_user['id'] != agent_id:
        raise HTTPException(status_code=403, detail="غير مصرح لك بعرض هذا الكشف")
    
    # Get agent info
    agent = await db.users.find_one({'id': agent_id})
    if not agent:
        raise HTTPException(status_code=404, detail="الصراف غير موجود")
    
    # Get all transfers for this agent (sent and received)
    # Get completed transfers AND cancelled transfers (for reversal entries)
    transfers_cursor = db.transfers.find({
        '$or': [
            {'from_agent_id': agent_id},
            {'to_agent_id': agent_id}
        ],
        'status': {'$in': ['completed', 'cancelled']}  # Include cancelled for reversal entries
    }, {'_id': 0, 'pin_hash': 0}).sort('created_at', -1)
    
    transfers_list = await transfers_cursor.to_list(10000)
    
    # Process transfers to include reversal entries for cancelled
    final_transfers = []
    for transfer in transfers_list:
        if transfer['status'] == 'completed':
            final_transfers.append(transfer)
        elif transfer['status'] == 'cancelled' and transfer.get('from_agent_id') == agent_id:
            # Add reversal entry for cancelled sent transfer
            reversal = transfer.copy()
            reversal['is_reversal'] = True
            reversal['original_status'] = 'cancelled'
            reversal['note'] = f"قيد عكسي - حوالة ملغاة ({transfer.get('transfer_code')})"
            final_transfers.append(reversal)
    
    # Sort by created_at (or cancelled_at for reversals)
    final_transfers.sort(key=lambda x: x.get('cancelled_at') or x.get('created_at'), reverse=True)
    
    transfers = final_transfers
    
    # Calculate totals (all transfers are completed now)
    total_sent = 0.0
    total_sent_count = 0
    total_received = 0.0
    total_received_count = 0
    total_commission = 0.0
    
    iqd_sent = 0.0
    iqd_received = 0.0
    usd_sent = 0.0
    usd_received = 0.0
    
    for t in transfers:
        amount = t.get('amount', 0)
        currency = t.get('currency', 'IQD')
        commission = t.get('commission', 0)
        
        if t.get('from_agent_id') == agent_id:
            # Sent transfers
            total_sent += amount
            total_sent_count += 1
            if currency == 'IQD':
                iqd_sent += amount
            else:
                usd_sent += amount
        
        if t.get('to_agent_id') == agent_id:
            # Received transfers
            total_received += amount
            total_received_count += 1
            total_commission += commission
            if currency == 'IQD':
                iqd_received += amount
            else:
                usd_received += amount
    
    return {
        'agent_id': agent_id,
        'agent_name': agent.get('display_name', ''),
        'governorate': agent.get('governorate', ''),
        'total_sent': total_sent,
        'total_sent_count': total_sent_count,
        'total_received': total_received,
        'total_received_count': total_received_count,
        'total_commission': total_commission,
        'iqd_sent': iqd_sent,
        'iqd_received': iqd_received,
        'usd_sent': usd_sent,
        'usd_received': usd_received,
        'transfers': transfers
    }

@api_router.post("/transfers", response_model=TransferWithPin)
async def create_transfer(transfer_data: TransferCreate, current_user: dict = Depends(get_current_user)):
    """Create new transfer"""
    if current_user['role'] != 'agent':
        raise HTTPException(status_code=403, detail="فقط الصرافين يمكنهم إنشاء حوالات")
    
    # Validate input
    if not transfer_data.sender_name or len(transfer_data.sender_name) < 3:
        raise HTTPException(status_code=400, detail="اسم المرسل يجب أن يكون 3 أحرف على الأقل")
    
    if not transfer_data.receiver_name or len(transfer_data.receiver_name) < 3:
        raise HTTPException(status_code=400, detail="اسم المستلم الثلاثي مطلوب (3 أحرف على الأقل)")
    
    if transfer_data.amount <= 0:
        raise HTTPException(status_code=400, detail="المبلغ يجب أن يكون أكبر من صفر")
    
    if not transfer_data.to_governorate:
        raise HTTPException(status_code=400, detail="المحافظة المستلمة مطلوبة")
    
    # Generate transfer code, transfer number, and PIN
    transfer_code, seq_num = await generate_transfer_code(transfer_data.to_governorate)
    transfer_number = await generate_unique_transfer_number()
    pin = generate_pin()
    pin_hash_str = hash_pin(pin)
    
    transfer_id = str(uuid.uuid4())
    
    # Calculate commission from commission rates (نشرة الأسعار)
    commission_percentage = 0.0
    commission = 0.0
    
    # Try to get commission rate for this agent
    commission_rates = await db.commission_rates.find({
        'agent_id': current_user['id'],
        'currency': transfer_data.currency
    }).to_list(length=None)
    
    if commission_rates:
        # Get the latest rate
        rate = commission_rates[0]
        
        # Convert governorate code to name for comparison
        governorate_name = GOVERNORATE_CODE_TO_NAME.get(transfer_data.to_governorate, transfer_data.to_governorate)
        
        # Find applicable tier for outgoing transfer
        for tier_data in rate.get('tiers', []):
            # Check if tier matches
            if tier_data.get('type') != 'outgoing':
                continue
            
            # Check city/country filters
            city = tier_data.get('city')
            country = tier_data.get('country')
            
            # If city/country specified, check if matches
            # Compare with both code and name for flexibility
            if city and city != '(جميع المدن)' and city != transfer_data.to_governorate and city != governorate_name:
                continue
            
            if country and country != '(جميع البلدان)':
                # Could add country check here if needed
                pass
            
            # Check amount range
            from_amount = tier_data.get('from_amount', 0)
            to_amount = tier_data.get('to_amount', float('inf'))
            
            if from_amount <= transfer_data.amount <= to_amount:
                # Check commission type
                commission_type = tier_data.get('commission_type', 'percentage')
                
                if commission_type == 'fixed_amount':
                    # Fixed amount commission
                    commission = tier_data.get('fixed_amount', 0)
                    commission_percentage = (commission / transfer_data.amount * 100) if transfer_data.amount > 0 else 0
                else:
                    # Percentage commission
                    commission_percentage = tier_data.get('percentage', 0)
                    commission = (transfer_data.amount * commission_percentage) / 100
                break
    
    # If no commission rate found, use 0% (not default 0.13%)
    # Admin must set commission rates for each agent
    
    # Get to_agent name if specified
    to_agent_name = None
    if transfer_data.to_agent_id:
        to_agent = await db.users.find_one({'id': transfer_data.to_agent_id})
        if to_agent:
            to_agent_name = to_agent['display_name']
    
    transfer_doc = {
        'id': transfer_id,
        'transfer_code': transfer_code,
        'transfer_number': transfer_number,
        'seq_number': seq_num,
        'from_agent_id': current_user['id'],
        'from_agent_name': current_user['display_name'],
        'to_governorate': transfer_data.to_governorate,
        'to_agent_id': transfer_data.to_agent_id,
        'to_agent_name': to_agent_name,
        'sender_name': transfer_data.sender_name,
        'sender_phone': transfer_data.sender_phone,
        'receiver_name': transfer_data.receiver_name,
        'amount': transfer_data.amount,
        'currency': transfer_data.currency,
        'commission': commission,
        'commission_percentage': commission_percentage,
        'pin_hash': pin_hash_str,
        'pin_encrypted': encrypt_pin(pin),  # Store encrypted PIN for later retrieval
        'status': 'pending',
        'note': transfer_data.note,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.transfers.insert_one(transfer_doc)
    await log_audit(transfer_id, current_user['id'], 'transfer_created', {'transfer_code': transfer_code})
    
    # ============ AI MONITORING - Check for duplicates ============
    try:
        duplicate_check = await check_duplicate_transfers(
            sender_name=transfer_data.sender_name,
            receiver_name=transfer_data.receiver_name,
            amount=transfer_data.amount,
            currency=transfer_data.currency
        )
        
        if duplicate_check['is_duplicate'] and duplicate_check['count'] > 1:  # More than just current transfer
            # Get admin users
            admin_users = await db.users.find({'role': 'admin'}).to_list(length=None)
            
            duplicate_details = "\n".join([
                f"- {t['transfer_code']}: {t['sender_name']} → {t['receiver_name']} ({t['amount']} {t.get('currency', 'IQD')})"
                for t in duplicate_check['transfers'][:3]  # Show first 3
            ])
            
            for admin in admin_users:
                await create_ai_notification(
                    admin_id=admin['id'],
                    notification_type='duplicate_transfer',
                    title='⚠️ حوالات مكررة مشبوهة',
                    message=f'تحذير: تم اكتشاف {duplicate_check["count"]} حوالة بنفس الاسم والمبلغ اليوم:\n{duplicate_details}',
                    related_transfer_id=transfer_id
                )
            
            logger.warning(f"Duplicate transfers detected: {duplicate_check['count']} transfers")
    except Exception as e:
        logger.error(f"Error in duplicate detection: {str(e)}")
    # ============ END AI MONITORING ============
    
    # Update sender's wallet (decrease balance)
    wallet_field = f'wallet_balance_{transfer_data.currency.lower()}'
    await db.users.update_one(
        {'id': current_user['id']},
        {'$inc': {wallet_field: -transfer_data.amount}}
    )
    
    # Record earned commission for admin (من الحوالة الصادرة)
    if commission > 0:
        await db.admin_commissions.insert_one({
            'id': str(uuid.uuid4()),
            'type': 'earned',  # عمولة محققة
            'amount': commission,
            'currency': transfer_data.currency,
            'transfer_id': transfer_id,
            'transfer_code': transfer_code,
            'agent_id': current_user['id'],
            'agent_name': current_user['display_name'],
            'commission_percentage': commission_percentage,
            'note': f'عمولة محققة من حوالة صادرة',
            'created_at': datetime.now(timezone.utc).isoformat()
        })
    
    # Add amount to transit account (الحوالات الواردة لم تُسلَّم)
    await update_transit_balance(
        amount=transfer_data.amount,
        currency=transfer_data.currency,
        operation='add',
        reference_id=transfer_id,
        note=f'حوالة واردة من {current_user["display_name"]} - {transfer_code}'
    )
    
    # ============ CREATE ACCOUNTING JOURNAL ENTRY ============
    try:
        # Get sender agent account
        sender_account = await db.accounts.find_one({'agent_id': current_user['id']})
        
        if sender_account:
            # Get or create Transit account
            transit_account = await db.accounts.find_one({'code': '1030'})
            if not transit_account:
                transit_account = {
                    'id': 'transit_account',
                    'code': '1030',
                    'name_ar': 'الحوالات الواردة لم تُسلَّم',
                    'name_en': 'Transit Account',
                    'category': 'أصول',
                    'parent_code': None,
                    'is_active': True,
                    'balance': 0,
                    'currency': 'IQD',
                    'created_at': datetime.now(timezone.utc).isoformat(),
                    'updated_at': datetime.now(timezone.utc).isoformat()
                }
                await db.accounts.insert_one(transit_account)
            
            # Create journal entry for transfer
            # المكتب المُصدر (استلم نقدية من العميل) = مدين (المبلغ + العمولة)
            # Transit = دائن (المبلغ فقط)
            # عمولات محققة = دائن (العمولة المستحصلة من الصراف)
            
            commission_amount = transfer_doc.get('commission_amount', 0)
            total_received = transfer_data.amount + commission_amount  # ما استلمه الصراف من العميل
            
            lines = [
                {
                    'account_code': sender_account['code'],  # Sender Account (مدين) - استلم نقدية + عمولة
                    'debit': total_received,
                    'credit': 0
                },
                {
                    'account_code': '1030',  # Transit Account (دائن) - مبلغ الحوالة فقط
                    'debit': 0,
                    'credit': transfer_data.amount
                }
            ]
            
            # Add commission line if exists
            if commission_amount > 0:
                lines.append({
                    'account_code': '4020',  # عمولات محققة (دائن) - العمولة المستحصلة من الصراف
                    'debit': 0,
                    'credit': commission_amount
                })
            
            journal_entry = {
                'id': str(uuid.uuid4()),
                'entry_number': f"TR-{transfer_code}",
                'date': datetime.now(timezone.utc).isoformat(),
                'description': f'حوالة صادرة: {transfer_code} من {current_user["display_name"]} (مبلغ {transfer_data.amount} + عمولة {commission_amount})',
                'lines': lines,
                'total_debit': total_received,
                'total_credit': total_received,
                'reference_type': 'transfer_created',
                'reference_id': transfer_id,
                'created_by': current_user['id'],
                'created_at': datetime.now(timezone.utc).isoformat(),
                'is_cancelled': False
            }
            
            await db.journal_entries.insert_one(journal_entry)
            
            # Update account balances
            # Sender account increases (debit for assets - استلم نقدية + عمولة)
            await db.accounts.update_one(
                {'code': sender_account['code']},
                {'$inc': {'balance': total_received}}
            )
            
            # Transit account decreases (credit for assets - مبلغ الحوالة فقط)
            await db.accounts.update_one(
                {'code': '1030'},
                {'$inc': {'balance': -transfer_data.amount}}
            )
            
            # Commission account increases if exists
            if commission_amount > 0:
                # Get or create earned commission account
                commission_account = await db.accounts.find_one({'code': '4020'})
                if not commission_account:
                    commission_account = {
                        'id': 'earned_commissions',
                        'code': '4020',
                        'name_ar': 'عمولات محققة',
                        'name_en': 'Earned Commissions',
                        'category': 'إيرادات',
                        'parent_code': None,
                        'is_active': True,
                        'balance': 0,
                        'currency': 'IQD',
                        'created_at': datetime.now(timezone.utc).isoformat(),
                        'updated_at': datetime.now(timezone.utc).isoformat()
                    }
                    await db.accounts.insert_one(commission_account)
                
                # Earned commission increases (credit for revenue)
                await db.accounts.update_one(
                    {'code': '4020'},
                    {'$inc': {'balance': commission_amount}}
                )
            
            logger.info(f"Created journal entry for transfer {transfer_code}")
    except Exception as e:
        logger.error(f"Error creating journal entry for transfer: {str(e)}")
    # ============ END ACCOUNTING ENTRY ============
    
    # Log wallet transaction
    await db.wallet_transactions.insert_one({
        'id': str(uuid.uuid4()),
        'user_id': current_user['id'],
        'user_display_name': current_user['display_name'],
        'amount': -transfer_data.amount,
        'currency': transfer_data.currency,
        'transaction_type': 'transfer_sent',
        'reference_id': transfer_id,
        'note': f'حوالة مرسلة: {transfer_code}',
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    # ============================================
    # AI Monitoring: Analyze transfer for suspicious activity
    # ============================================
    try:
        # Check for duplicate transfers today
        duplicate_count = await check_duplicate_transfers_today(
            transfer_data.sender_name,
            transfer_data.receiver_name
        )
        
        if duplicate_count > 2:
            await create_notification(
                title="⚠️ تكرار حوالة مشبوه",
                message=f"تم إنشاء {duplicate_count} حوالات اليوم بين المرسل '{transfer_data.sender_name}' والمستلم '{transfer_data.receiver_name}'",
                severity="medium",
                related_transfer_id=transfer_id,
                related_agent_id=current_user['id']
            )
        
        # Check for large amount (1 billion or more)
        if transfer_data.amount >= 1000000000:
            await create_notification(
                title="🚨 حوالة بمبلغ ضخم!",
                message=f"حوالة بمبلغ {transfer_data.amount:,.0f} {transfer_data.currency} من '{current_user['display_name']}'",
                severity="high",
                related_transfer_id=transfer_id,
                related_agent_id=current_user['id']
            )
        
        # AI Analysis (async - don't wait for it)
        import asyncio
        asyncio.create_task(analyze_and_notify_if_suspicious(transfer_doc))
        
    except Exception as e:
        print(f"Error in AI monitoring: {e}")
    
    # Notify receiving agents via WebSocket
    await sio.emit('new_transfer', {
        'transfer_id': transfer_id,
        'transfer_code': transfer_code,
        'to_governorate': transfer_data.to_governorate,
        'to_agent_id': transfer_data.to_agent_id,
        'amount': transfer_data.amount,
        'sender_name': transfer_data.sender_name
    }, room=f"gov_{transfer_data.to_governorate}")
    
    transfer_doc.pop('_id', None)
    transfer_doc.pop('pin_hash', None)
    transfer_doc['pin'] = pin  # Return PIN only once
    
    return transfer_doc

@api_router.get("/transfers", response_model=List[Transfer])
async def get_transfers(
    status: Optional[str] = None,
    governorate: Optional[str] = None,
    direction: Optional[str] = None,  # 'incoming' or 'outgoing'
    current_user: dict = Depends(get_current_user)
):
    """Get transfers list with filters"""
    query = {}
    
    if status:
        query['status'] = status
    
    if governorate:
        query['to_governorate'] = governorate
    
    if direction == 'incoming':
        query['$or'] = [
            {'to_agent_id': current_user['id']},
            {'to_governorate': current_user.get('governorate'), 'to_agent_id': None}
        ]
    elif direction == 'outgoing':
        query['from_agent_id'] = current_user['id']
    
    if current_user['role'] == 'agent' and not direction:
        # Show both incoming and outgoing for agent
        query['$or'] = [
            {'from_agent_id': current_user['id']},
            {'to_agent_id': current_user['id']},
            {'to_governorate': current_user.get('governorate'), 'to_agent_id': None}
        ]
    
    transfers = await db.transfers.find(query, {'_id': 0, 'pin_hash': 0}).sort('created_at', -1).to_list(1000)
    return transfers

@api_router.get("/transfers/{transfer_id}", response_model=Transfer)
async def get_transfer_details(transfer_id: str, current_user: dict = Depends(get_current_user)):
    """Get transfer details"""
    transfer = await db.transfers.find_one({'id': transfer_id}, {'_id': 0, 'pin_hash': 0})
    
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    # Check access
    if current_user['role'] != 'admin':
        if (transfer['from_agent_id'] != current_user['id'] and 
            transfer.get('to_agent_id') != current_user['id'] and
            transfer['to_governorate'] != current_user.get('governorate')):
            raise HTTPException(status_code=403, detail="Access denied")
    
    return transfer

@api_router.get("/transfers/{transfer_id}/pin")
async def get_transfer_pin(transfer_id: str, current_user: dict = Depends(get_current_user)):
    """Get transfer PIN (only for sender or admin)"""
    transfer = await db.transfers.find_one({'id': transfer_id}, {'_id': 0})
    
    if not transfer:
        raise HTTPException(status_code=404, detail="الحوالة غير موجودة")
    
    # Only sender or admin can view PIN
    if current_user['role'] != 'admin' and transfer['from_agent_id'] != current_user['id']:
        raise HTTPException(status_code=403, detail="فقط المُرسل أو الأدمن يمكنه رؤية الرقم السري")
    
    # Decrypt and return PIN
    pin_encrypted = transfer.get('pin_encrypted')
    if not pin_encrypted:
        raise HTTPException(status_code=404, detail="الرقم السري غير متوفر لهذه الحوالة")
    
    try:
        pin = decrypt_pin(pin_encrypted)
        return {
            'transfer_id': transfer_id,
            'transfer_code': transfer['transfer_code'],
            'pin': pin,
            'sender_name': transfer.get('sender_name'),
            'receiver_name': transfer.get('receiver_name'),
            'amount': transfer.get('amount'),
            'currency': transfer.get('currency', 'IQD')
        }
    except Exception as e:
        logging.error(f"PIN decryption error: {e}")
        raise HTTPException(status_code=500, detail="خطأ في فك تشفير الرقم السري")

@api_router.patch("/transfers/{transfer_id}/cancel")
async def cancel_transfer(transfer_id: str, current_user: dict = Depends(get_current_user)):
    """Cancel a transfer (only sender can cancel pending transfers)"""
    transfer = await db.transfers.find_one({'id': transfer_id})
    
    if not transfer:
        raise HTTPException(status_code=404, detail="الحوالة غير موجودة")
    
    # Only sender can cancel
    if transfer['from_agent_id'] != current_user['id']:
        raise HTTPException(status_code=403, detail="فقط المُرسل يمكنه إلغاء الحوالة")
    
    # Can only cancel pending transfers
    if transfer['status'] != 'pending':
        raise HTTPException(status_code=400, detail="لا يمكن إلغاء حوالة مكتملة")
    
    # Update status to cancelled
    await db.transfers.update_one(
        {'id': transfer_id},
        {'$set': {
            'status': 'cancelled',
            'cancelled_at': datetime.now(timezone.utc).isoformat(),
            'cancelled_by': current_user['id'],
            'cancelled_by_name': current_user['display_name'],
            'updated_at': datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Subtract amount from transit account (return from transit)
    await update_transit_balance(
        amount=transfer['amount'],
        currency=transfer['currency'],
        operation='subtract',
        reference_id=transfer_id,
        note=f'إلغاء حوالة - إرجاع إلى {current_user["display_name"]} - {transfer["transfer_code"]}'
    )
    
    # Return money to sender's wallet (المبلغ فقط بدون العمولة)
    wallet_field = f'wallet_balance_{transfer["currency"].lower()}'
    await db.users.update_one(
        {'id': current_user['id']},
        {'$inc': {wallet_field: transfer['amount']}}
    )
    
    # Log wallet transaction
    await db.wallet_transactions.insert_one({
        'id': str(uuid.uuid4()),
        'user_id': current_user['id'],
        'user_display_name': current_user['display_name'],
        'amount': transfer['amount'],
        'currency': transfer['currency'],
        'transaction_type': 'transfer_cancelled',
        'reference_id': transfer_id,
        'note': f'إلغاء حوالة: {transfer["transfer_code"]}',
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    await log_audit(transfer_id, current_user['id'], 'transfer_cancelled', {})
    
    # ============ CREATE ACCOUNTING JOURNAL ENTRY (REVERSAL) ============
    try:
        # Get sender agent account
        sender_account = await db.accounts.find_one({'agent_id': current_user['id']})
        
        if sender_account:
            # Create reversal journal entry for cancelled transfer
            # Transit = مدين (استرجاع)
            # المكتب المُصدر = دائن (رد النقدية للعميل)
            journal_entry = {
                'id': str(uuid.uuid4()),
                'entry_number': f"TR-CXL-{transfer['transfer_code']}",
                'date': datetime.now(timezone.utc).isoformat(),
                'description': f'إلغاء حوالة: {transfer["transfer_code"]} - إرجاع إلى {current_user["display_name"]}',
                'lines': [
                    {
                        'account_code': '1030',  # Transit Account (مدين)
                        'debit': transfer['amount'],
                        'credit': 0
                    },
                    {
                        'account_code': sender_account['code'],  # Sender Account (دائن) - رد النقدية
                        'debit': 0,
                        'credit': transfer['amount']
                    }
                ],
                'total_debit': transfer['amount'],
                'total_credit': transfer['amount'],
                'reference_type': 'transfer_cancelled',
                'reference_id': transfer_id,
                'created_by': current_user['id'],
                'created_at': datetime.now(timezone.utc).isoformat(),
                'is_cancelled': False
            }
            
            await db.journal_entries.insert_one(journal_entry)
            
            # Update account balances
            # Transit account increases (debit for assets)
            await db.accounts.update_one(
                {'code': '1030'},
                {'$inc': {'balance': transfer['amount']}}
            )
            
            # Sender account decreases (credit for assets - رد النقدية)
            await db.accounts.update_one(
                {'code': sender_account['code']},
                {'$inc': {'balance': -transfer['amount']}}
            )
            
            logger.info(f"Created reversal journal entry for cancelled transfer {transfer['transfer_code']}")
    except Exception as e:
        logger.error(f"Error creating reversal journal entry: {str(e)}")
    # ============ END ACCOUNTING ENTRY ============
    
    return {'success': True, 'message': 'تم إلغاء الحوالة بنجاح'}

@api_router.patch("/transfers/{transfer_id}/update")
async def update_transfer(
    transfer_id: str, 
    update_data: TransferUpdate, 
    current_user: dict = Depends(get_current_user)
):
    """Update a transfer (only sender can update pending transfers)"""
    transfer = await db.transfers.find_one({'id': transfer_id})
    
    if not transfer:
        raise HTTPException(status_code=404, detail="الحوالة غير موجودة")
    
    # Only sender can update
    if transfer['from_agent_id'] != current_user['id']:
        raise HTTPException(status_code=403, detail="فقط المُرسل يمكنه تعديل الحوالة")
    
    # Can only update pending transfers
    if transfer['status'] != 'pending':
        raise HTTPException(status_code=400, detail="لا يمكن تعديل حوالة مكتملة")
    
    # Store old values for audit
    old_values = {
        'sender_name': transfer.get('sender_name'),
        'receiver_name': transfer.get('receiver_name'),
        'amount': transfer.get('amount'),
        'note': transfer.get('note')
    }
    
    # Handle amount change (need to update wallet and transit)
    if update_data.amount is not None and update_data.amount != transfer['amount']:
        amount_diff = update_data.amount - transfer['amount']
        wallet_field = f'wallet_balance_{transfer["currency"].lower()}'
        
        # Decrease or increase wallet balance
        await db.users.update_one(
            {'id': current_user['id']},
            {'$inc': {wallet_field: -amount_diff}}
        )
        
        # Update transit account accordingly
        if amount_diff > 0:
            # Amount increased - add difference to transit
            await update_transit_balance(
                amount=amount_diff,
                currency=transfer['currency'],
                operation='add',
                reference_id=transfer_id,
                note=f'زيادة مبلغ حوالة {transfer["transfer_code"]} - فرق: {amount_diff}'
            )
        else:
            # Amount decreased - subtract difference from transit
            await update_transit_balance(
                amount=abs(amount_diff),
                currency=transfer['currency'],
                operation='subtract',
                reference_id=transfer_id,
                note=f'تقليل مبلغ حوالة {transfer["transfer_code"]} - فرق: {abs(amount_diff)}'
            )
        
        # Recalculate commission
        commission = (update_data.amount * 0.13) / 100
    else:
        commission = transfer.get('commission')
    
    # Build update document
    update_doc = {
        'updated_at': datetime.now(timezone.utc).isoformat(),
        'last_modified_by': current_user['id'],
        'last_modified_by_name': current_user['display_name']
    }
    
    if update_data.sender_name is not None:
        update_doc['sender_name'] = update_data.sender_name
    if update_data.receiver_name is not None:
        update_doc['receiver_name'] = update_data.receiver_name
    if update_data.amount is not None:
        update_doc['amount'] = update_data.amount
        update_doc['commission'] = commission
    if update_data.note is not None:
        update_doc['note'] = update_data.note
    
    # Update transfer
    await db.transfers.update_one(
        {'id': transfer_id},
        {'$set': update_doc}
    )
    
    await log_audit(transfer_id, current_user['id'], 'transfer_updated', {
        'old_values': old_values,
        'new_values': update_doc
    })
    
    return {'success': True, 'message': 'تم تعديل الحوالة بنجاح'}

@api_router.get("/transfers/search/{transfer_code}")
async def search_transfer_by_code(transfer_code: str, current_user: dict = Depends(get_current_user)):
    """Search transfer by transfer_code (for receiving step 1)"""
    transfer = await db.transfers.find_one({'transfer_code': transfer_code}, {'_id': 0, 'pin_hash': 0, 'pin_encrypted': 0})
    
    if not transfer:
        raise HTTPException(status_code=404, detail="رقم الحوالة غير صحيح")
    
    # Check if transfer is pending
    if transfer['status'] != 'pending':
        raise HTTPException(status_code=400, detail=f"هذه الحوالة {transfer['status']} بالفعل")
    
    # Return basic info for verification
    return {
        'id': transfer['id'],
        'transfer_code': transfer['transfer_code'],
        'sender_name': transfer.get('sender_name'),
        'receiver_name': transfer.get('receiver_name'),
        'amount': transfer.get('amount'),
        'currency': transfer.get('currency', 'IQD'),
        'from_agent_name': transfer.get('from_agent_name'),
        'to_governorate': transfer.get('to_governorate'),
        'created_at': transfer.get('created_at')
    }

@api_router.post("/transfers/{transfer_id}/receive")
async def receive_transfer(
    transfer_id: str,
    pin: str = Form(...),
    receiver_fullname: str = Form(...),
    id_image: UploadFile = File(...),
    request: Request = None,
    current_user: dict = Depends(get_current_user)
):
    """Receive/complete transfer"""
    # Get transfer
    transfer = await db.transfers.find_one({'id': transfer_id})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    if transfer['status'] != 'pending':
        raise HTTPException(status_code=400, detail="Transfer already processed")
    
    # Prevent sender from receiving their own transfer
    if transfer['from_agent_id'] == current_user['id']:
        raise HTTPException(status_code=403, detail="لا يمكن للمُرسل استلام حوالته الخاصة")
    
    # Check rate limit for PIN attempts
    rate_limit_key = f"{transfer_id}_{current_user['id']}"
    if not check_rate_limit(rate_limit_key, pin_attempts_cache, MAX_PIN_ATTEMPTS, LOCKOUT_DURATION):
        raise HTTPException(status_code=429, detail="Too many PIN attempts. Try again later.")
    
    # Verify receiver full name - only check first name matches
    expected_receiver_name = transfer.get('receiver_name', '')
    
    # If no receiver_name in old transfers, skip name validation
    if expected_receiver_name:
        # Import the name matching function
        from iraqi_id_validator import validate_receiver_name
        
        # Validate first name match
        is_valid, validation_message = validate_receiver_name(
            expected_receiver_name,
            receiver_fullname
        )
        
        if not is_valid:
            # Log failed attempt for incorrect name
            await db.pin_attempts.insert_one({
                'id': str(uuid.uuid4()),
                'transfer_id': transfer_id,
                'attempted_by_agent': current_user['id'],
                'attempt_ip': request.client.host if request else None,
                'success': False,
                'failure_reason': 'incorrect_name',
                'created_at': datetime.now(timezone.utc).isoformat()
            })
            await log_audit(transfer_id, current_user['id'], 'name_failed', {
                'ip': request.client.host if request else None,
                'attempted_name': receiver_fullname,
                'expected_name': expected_receiver_name
            })
            raise HTTPException(status_code=400, detail=f"الاسم الأول غير مطابق. {validation_message}")
    
    # Verify PIN
    if not verify_pin(pin, transfer['pin_hash']):
        # Log failed attempt
        await db.pin_attempts.insert_one({
            'id': str(uuid.uuid4()),
            'transfer_id': transfer_id,
            'attempted_by_agent': current_user['id'],
            'attempt_ip': request.client.host if request else None,
            'success': False,
            'failure_reason': 'incorrect_pin',
            'created_at': datetime.now(timezone.utc).isoformat()
        })
        await log_audit(transfer_id, current_user['id'], 'pin_failed', {'ip': request.client.host if request else None})
        raise HTTPException(status_code=401, detail="الرقم السري غير صحيح")
    
    # Upload ID image to Cloudinary
    try:
        contents = await id_image.read()
        upload_result = cloudinary.uploader.upload(
            contents,
            folder="money_transfer/id_images",
            resource_type="image",
            format="jpg"
        )
        id_image_url = upload_result['secure_url']
    except Exception as e:
        logging.error(f"Cloudinary upload error: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload ID image")
    
    # ============ AI MONITORING ============
    
    # 1. Read ID card with AI and check if name matches
    try:
        ai_result = await read_id_card_with_ai(id_image_url)
        
        if ai_result.get('success'):
            extracted_name = ai_result.get('extracted_name', '').strip()
            input_name = receiver_fullname.strip()
            
            # Compare names (exact match)
            if extracted_name != input_name:
                # Get admin users
                admin_users = await db.users.find({'role': 'admin'}).to_list(length=None)
                
                for admin in admin_users:
                    await create_ai_notification(
                        admin_id=admin['id'],
                        notification_type='id_mismatch',
                        title='⚠️ عدم تطابق الاسم مع الهوية',
                        message=f'تحذير: الاسم المدخل "{input_name}" لا يطابق الاسم في الهوية "{extracted_name}" للحوالة {transfer["transfer_code"]}',
                        related_transfer_id=transfer_id
                    )
                
                logger.warning(f"ID name mismatch: input={input_name}, extracted={extracted_name}, transfer={transfer['transfer_code']}")
        else:
            logger.error(f"Failed to read ID card: {ai_result.get('error')}")
    except Exception as e:
        logger.error(f"Error in AI ID reading: {str(e)}")
    
    # ============ END AI MONITORING ============
    
    # Create receipt
    receipt_doc = {
        'id': str(uuid.uuid4()),
        'transfer_id': transfer_id,
        'receiver_fullname': receiver_fullname,
        'id_image_path': id_image_url,
        'received_by_agent': current_user['id'],
        'received_at': datetime.now(timezone.utc).isoformat()
    }
    await db.receipts.insert_one(receipt_doc)
    
    # Update transfer status
    # Calculate incoming commission for receiving agent
    incoming_commission = 0.0
    incoming_commission_percentage = 0.0
    
    # Try to get commission rate for receiving agent
    commission_rates = await db.commission_rates.find({
        'agent_id': current_user['id'],
        'currency': transfer['currency']
    }).to_list(length=None)
    
    if commission_rates:
        rate = commission_rates[0]
        for tier_data in rate.get('tiers', []):
            if tier_data.get('type') != 'incoming':
                continue
            
            city = tier_data.get('city')
            country = tier_data.get('country')
            
            if city and city != '(جميع المدن)':
                # Could check city here
                pass
            
            from_amount = tier_data.get('from_amount', 0)
            to_amount = tier_data.get('to_amount', float('inf'))
            
            if from_amount <= transfer['amount'] <= to_amount:
                incoming_commission_percentage = tier_data.get('percentage', 0)
                incoming_commission = (transfer['amount'] * incoming_commission_percentage) / 100
                break
    
    await db.transfers.update_one(
        {'id': transfer_id},
        {'$set': {
            'status': 'completed',
            'to_agent_id': current_user['id'],
            'to_agent_name': current_user['display_name'],
            'incoming_commission': incoming_commission,
            'incoming_commission_percentage': incoming_commission_percentage,
            'updated_at': datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Subtract amount from transit account (الحوالات الواردة لم تُسلَّم)
    await update_transit_balance(
        amount=transfer['amount'],
        currency=transfer['currency'],
        operation='subtract',
        reference_id=transfer_id,
        note=f'حوالة مُسلَّمة إلى {current_user["display_name"]} - {transfer["transfer_code"]}'
    )
    
    # Update receiver's wallet (increase balance + incoming commission)
    wallet_field = f'wallet_balance_{transfer["currency"].lower()}'
    total_amount_to_add = transfer['amount'] + incoming_commission
    await db.users.update_one(
        {'id': current_user['id']},
        {'$inc': {wallet_field: total_amount_to_add}}
    )
    
    # Record paid commission for admin (عمولة مدفوعة للمستلم)
    if incoming_commission > 0:
        await db.admin_commissions.insert_one({
            'id': str(uuid.uuid4()),
            'type': 'paid',  # عمولة مدفوعة
            'amount': incoming_commission,
            'currency': transfer['currency'],
            'transfer_id': transfer_id,
            'transfer_code': transfer['transfer_code'],
            'agent_id': current_user['id'],
            'agent_name': current_user['display_name'],
            'commission_percentage': incoming_commission_percentage,
            'note': f'عمولة مدفوعة للمستلم على حوالة واردة',
            'created_at': datetime.now(timezone.utc).isoformat()
        })
    
    # Log wallet transaction for receiver
    await db.wallet_transactions.insert_one({
        'id': str(uuid.uuid4()),
        'user_id': current_user['id'],
        'user_display_name': current_user['display_name'],
        'amount': transfer['amount'],
        'currency': transfer['currency'],
        'transaction_type': 'transfer_received',
        'reference_id': transfer_id,
        'note': f'حوالة مستلمة: {transfer["transfer_code"]}',
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    # Log successful PIN attempt
    await db.pin_attempts.insert_one({
        'id': str(uuid.uuid4()),
        'transfer_id': transfer_id,
        'attempted_by_agent': current_user['id'],
        'attempt_ip': request.client.host if request else None,
        'success': True,
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    await log_audit(transfer_id, current_user['id'], 'transfer_completed', {
        'receiver_fullname': receiver_fullname,
        'id_image_url': id_image_url
    })
    
    # ============ CREATE ACCOUNTING JOURNAL ENTRY ============
    try:
        # Get receiver agent account
        receiver_account = await db.accounts.find_one({'agent_id': current_user['id']})
        
        if receiver_account:
            # Create journal entry for receiving transfer
            # Transit = مدين
            # المكتب المُسلِّم (دفع نقدية للمستلم) = دائن
            journal_entry = {
                'id': str(uuid.uuid4()),
                'entry_number': f"TR-RCV-{transfer['transfer_code']}",
                'date': datetime.now(timezone.utc).isoformat(),
                'description': f'حوالة مستلمة: {transfer["transfer_code"]} من قبل {current_user["display_name"]}',
                'lines': [
                    {
                        'account_code': '1030',  # Transit Account (مدين)
                        'debit': transfer['amount'],
                        'credit': 0
                    },
                    {
                        'account_code': receiver_account['code'],  # Receiver Account (دائن) - دفع نقدية
                        'debit': 0,
                        'credit': transfer['amount']
                    }
                ],
                'total_debit': transfer['amount'],
                'total_credit': transfer['amount'],
                'reference_type': 'transfer_received',
                'reference_id': transfer_id,
                'created_by': current_user['id'],
                'created_at': datetime.now(timezone.utc).isoformat(),
                'is_cancelled': False
            }
            
            await db.journal_entries.insert_one(journal_entry)
            
            # Update account balances
            # Transit account increases (debit for assets)
            await db.accounts.update_one(
                {'code': '1030'},
                {'$inc': {'balance': transfer['amount']}}
            )
            
            # Receiver account decreases (credit for assets - دفع نقدية)
            await db.accounts.update_one(
                {'code': receiver_account['code']},
                {'$inc': {'balance': -transfer['amount']}}
            )
            
            logger.info(f"Created journal entry for receiving transfer {transfer['transfer_code']}")
    except Exception as e:
        logger.error(f"Error creating journal entry for receiving transfer: {str(e)}")
    # ============ END ACCOUNTING ENTRY ============
    
    # Notify via WebSocket
    await sio.emit('transfer_completed', {'transfer_id': transfer_id})
    
    return {'success': True, 'message': 'Transfer completed successfully'}

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    """Get dashboard statistics"""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Pending incoming
    pending_incoming = await db.transfers.count_documents({
        '$or': [
            {'to_agent_id': current_user['id'], 'status': 'pending'},
            {'to_governorate': current_user.get('governorate'), 'to_agent_id': None, 'status': 'pending'}
        ]
    })
    
    # Pending outgoing
    pending_outgoing = await db.transfers.count_documents({
        'from_agent_id': current_user['id'],
        'status': 'pending'
    })
    
    # Completed today
    completed_today = await db.transfers.count_documents({
        '$or': [
            {'from_agent_id': current_user['id']},
            {'to_agent_id': current_user['id']}
        ],
        'status': 'completed',
        'updated_at': {'$gte': today_start.isoformat()}
    })
    
    # Total amount today
    pipeline = [
        {
            '$match': {
                '$or': [
                    {'from_agent_id': current_user['id']},
                    {'to_agent_id': current_user['id']}
                ],
                'status': 'completed',
                'updated_at': {'$gte': today_start.isoformat()}
            }
        },
        {
            '$group': {
                '_id': None,
                'total': {'$sum': '$amount'}
            }
        }
    ]
    
    result = await db.transfers.aggregate(pipeline).to_list(1)
    total_amount = result[0]['total'] if result else 0.0
    
    # Get wallet balances
    user_data = await db.users.find_one({'id': current_user['id']})
    wallet_balance_iqd = user_data.get('wallet_balance_iqd', 0.0) if user_data else 0.0
    wallet_balance_usd = user_data.get('wallet_balance_usd', 0.0) if user_data else 0.0
    
    return {
        'pending_incoming': pending_incoming,
        'pending_outgoing': pending_outgoing,
        'completed_today': completed_today,
        'total_amount_today': total_amount,
        'wallet_balance_iqd': wallet_balance_iqd,
        'wallet_balance_usd': wallet_balance_usd
    }

@api_router.get("/audit-logs")
async def get_audit_logs(
    transfer_id: Optional[str] = None,
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(require_admin)
):
    """Get audit logs (admin only)"""
    query = {}
    if transfer_id:
        query['transfer_id'] = transfer_id
    if user_id:
        query['user_id'] = user_id
    if action:
        query['action'] = action
    
    logs = await db.audit_logs.find(query, {'_id': 0}).sort('created_at', -1).limit(limit).to_list(limit)
    return logs

@api_router.get("/commissions/report")
async def get_commissions_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    status: Optional[str] = "completed",
    current_user: dict = Depends(require_admin)
):
    """Get commissions report (admin only)"""
    query = {}
    
    # Filter by status (default: completed)
    if status:
        query['status'] = status
    
    # Date range filter
    if start_date:
        query['created_at'] = {'$gte': start_date}
    if end_date:
        if 'created_at' not in query:
            query['created_at'] = {}
        query['created_at']['$lte'] = end_date
    
    # Get all transfers matching criteria
    transfers = await db.transfers.find(query, {'_id': 0}).sort('created_at', -1).to_list(10000)
    
    # Calculate totals
    total_transfers = len(transfers)
    total_amount = sum(t.get('amount', 0) for t in transfers)
    total_commission = sum(t.get('commission', 0) for t in transfers)
    
    # Group by currency
    by_currency = {}
    for t in transfers:
        currency = t.get('currency', 'IQD')
        if currency not in by_currency:
            by_currency[currency] = {
                'count': 0,
                'total_amount': 0,
                'total_commission': 0
            }
        by_currency[currency]['count'] += 1
        by_currency[currency]['total_amount'] += t.get('amount', 0)
        by_currency[currency]['total_commission'] += t.get('commission', 0)
    
    return {
        'total_transfers': total_transfers,
        'total_amount': total_amount,
        'total_commission': total_commission,
        'by_currency': by_currency,
        'commission_percentage': 0.13,
        'transfers': transfers[:100]  # Return last 100 for display
    }

@api_router.post("/wallet/deposit")
async def add_wallet_deposit(deposit: WalletDeposit, current_user: dict = Depends(require_admin)):
    """Add funds to user's wallet (admin only)"""
    # Validate amount
    if deposit.amount <= 0:
        raise HTTPException(status_code=400, detail="المبلغ يجب أن يكون أكبر من صفر")
    
    # Validate currency
    if deposit.currency not in ['IQD', 'USD']:
        raise HTTPException(status_code=400, detail="العملة غير صحيحة")
    
    # Get user
    user = await db.users.find_one({'id': deposit.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    
    # Update wallet balance
    wallet_field = f'wallet_balance_{deposit.currency.lower()}'
    await db.users.update_one(
        {'id': deposit.user_id},
        {'$inc': {wallet_field: deposit.amount}}
    )
    
    # Log wallet transaction
    transaction_id = str(uuid.uuid4())
    await db.wallet_transactions.insert_one({
        'id': transaction_id,
        'user_id': deposit.user_id,
        'user_display_name': user['display_name'],
        'amount': deposit.amount,
        'currency': deposit.currency,
        'transaction_type': 'deposit',
        'added_by_admin_id': current_user['id'],
        'added_by_admin_name': current_user['display_name'],
        'note': deposit.note or 'إضافة رصيد من قبل الإدارة',
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    
    await log_audit(None, current_user['id'], 'wallet_deposit', {
        'user_id': deposit.user_id,
        'amount': deposit.amount,
        'currency': deposit.currency
    })
    
    return {'success': True, 'transaction_id': transaction_id}

@api_router.get("/wallet/transactions", response_model=List[WalletTransaction])
async def get_wallet_transactions(
    user_id: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Get wallet transactions"""
    # If not admin, can only see own transactions
    if current_user['role'] != 'admin':
        user_id = current_user['id']
    
    query = {}
    if user_id:
        query['user_id'] = user_id
    
    transactions = await db.wallet_transactions.find(query, {'_id': 0}).sort('created_at', -1).limit(limit).to_list(limit)
    return transactions

@api_router.get("/wallet/balance")
async def get_wallet_balance(current_user: dict = Depends(get_current_user)):
    """Get current user's wallet balance"""
    user = await db.users.find_one({'id': current_user['id']})
    if not user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    
    return {
        'wallet_balance_iqd': user.get('wallet_balance_iqd', 0.0),
        'wallet_balance_usd': user.get('wallet_balance_usd', 0.0)
    }

@api_router.patch("/users/{user_id}/status")
async def update_user_status(user_id: str, is_active: bool, current_user: dict = Depends(require_admin)):
    """Activate/suspend user (admin only)"""
    result = await db.users.update_one(
        {'id': user_id},
        {'$set': {'is_active': is_active}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    
    await log_audit(None, current_user['id'], 'user_status_changed', {'target_user_id': user_id, 'is_active': is_active})
    
    return {'success': True}

@api_router.put("/profile")
async def update_profile(user_data: UserUpdate, current_user: dict = Depends(get_current_user)):
    """Update current user profile"""
    update_fields = {}
    
    if user_data.display_name:
        if len(user_data.display_name) < 3:
            raise HTTPException(status_code=400, detail="اسم العرض يجب أن يكون 3 أحرف على الأقل")
        update_fields['display_name'] = user_data.display_name
    
    if user_data.phone:
        update_fields['phone'] = user_data.phone
    
    if user_data.governorate:
        update_fields['governorate'] = user_data.governorate
    
    # Password change
    if user_data.new_password:
        if not user_data.current_password:
            raise HTTPException(status_code=400, detail="كلمة المرور الحالية مطلوبة لتغيير كلمة المرور")
        
        # Verify current password
        user = await db.users.find_one({'id': current_user['id']})
        if not bcrypt.checkpw(user_data.current_password.encode(), user['password_hash'].encode()):
            raise HTTPException(status_code=400, detail="كلمة المرور الحالية غير صحيحة")
        
        if len(user_data.new_password) < 6:
            raise HTTPException(status_code=400, detail="كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل")
        
        update_fields['password_hash'] = bcrypt.hashpw(user_data.new_password.encode(), bcrypt.gensalt()).decode()
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="لا توجد بيانات للتحديث")
    
    result = await db.users.update_one(
        {'id': current_user['id']},
        {'$set': update_fields}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    
    await log_audit(None, current_user['id'], 'profile_updated', {'fields': list(update_fields.keys())})
    
    # Return updated user
    updated_user = await db.users.find_one({'id': current_user['id']}, {'_id': 0, 'password_hash': 0})
    return updated_user

@api_router.put("/users/{user_id}")
async def update_user_by_admin(user_id: str, user_data: UserUpdate, current_user: dict = Depends(require_admin)):
    """Update user by admin"""
    update_fields = {}
    
    if user_data.display_name:
        if len(user_data.display_name) < 3:
            raise HTTPException(status_code=400, detail="اسم العرض يجب أن يكون 3 أحرف على الأقل")
        update_fields['display_name'] = user_data.display_name
    
    if user_data.phone:
        update_fields['phone'] = user_data.phone
    
    if user_data.governorate:
        update_fields['governorate'] = user_data.governorate
    
    # Admin can set new password without current password
    if user_data.new_password:
        if len(user_data.new_password) < 6:
            raise HTTPException(status_code=400, detail="كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل")
        
        update_fields['password_hash'] = bcrypt.hashpw(user_data.new_password.encode(), bcrypt.gensalt()).decode()
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="لا توجد بيانات للتحديث")
    
    result = await db.users.update_one(
        {'id': user_id},
        {'$set': update_fields}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    
    await log_audit(None, current_user['id'], 'user_updated_by_admin', {'target_user_id': user_id, 'fields': list(update_fields.keys())})
    
    # Return updated user
    updated_user = await db.users.find_one({'id': user_id}, {'_id': 0, 'password_hash': 0})
    return updated_user

# ============ WebSocket Events ============

@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")

@sio.event
async def join_governorate(sid, data):
    """Join governorate room for notifications"""
    governorate = data.get('governorate')
    if governorate:
        sio.enter_room(sid, f"gov_{governorate}")
        print(f"Client {sid} joined governorate {governorate}")

# ============ Commission Rate Endpoints ============

@api_router.post("/commission-rates", response_model=CommissionRate)
async def create_commission_rate(rate_data: CommissionRateCreate, current_user: dict = Depends(require_admin)):
    """Create or update commission rate for an agent"""
    # Get agent info
    agent = await db.users.find_one({'id': rate_data.agent_id})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    rate_id = str(uuid.uuid4())
    rate_doc = {
        'id': rate_id,
        'agent_id': rate_data.agent_id,
        'agent_name': agent['display_name'],
        'currency': rate_data.currency,
        'bulletin_type': rate_data.bulletin_type,
        'date': rate_data.date,
        'tiers': [tier.model_dump() for tier in rate_data.tiers],
        'created_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.commission_rates.insert_one(rate_doc)
    return CommissionRate(**rate_doc)

@api_router.get("/commission-rates/agent/{agent_id}", response_model=List[CommissionRate])
async def get_agent_commission_rates(agent_id: str, current_user: dict = Depends(get_current_user)):
    """Get all commission rates for an agent"""
    rates = await db.commission_rates.find({'agent_id': agent_id}).to_list(length=None)
    return [CommissionRate(**rate) for rate in rates]

@api_router.get("/commission-rates", response_model=List[CommissionRate])
async def get_all_commission_rates(current_user: dict = Depends(require_admin)):
    """Get all commission rates (admin only)"""
    rates = await db.commission_rates.find().to_list(length=None)
    return [CommissionRate(**rate) for rate in rates]

@api_router.delete("/commission-rates/{rate_id}")
async def delete_commission_rate(rate_id: str, current_user: dict = Depends(require_admin)):
    """Delete commission rate"""
    result = await db.commission_rates.delete_one({'id': rate_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Commission rate not found")
    return {"message": "Commission rate deleted"}

@api_router.put("/commission-rates/{rate_id}")
async def update_commission_rate(rate_id: str, rate_data: CommissionRateCreate, current_user: dict = Depends(require_admin)):
    """Update commission rate"""
    # Check if rate exists
    existing_rate = await db.commission_rates.find_one({'id': rate_id})
    if not existing_rate:
        raise HTTPException(status_code=404, detail="Commission rate not found")
    
    # Prepare update data
    update_doc = {
        'agent_id': rate_data.agent_id,
        'currency': rate_data.currency,
        'bulletin_type': rate_data.bulletin_type,
        'date': rate_data.date,
        'tiers': [tier.model_dump() for tier in rate_data.tiers],
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    
    # Update
    result = await db.commission_rates.update_one(
        {'id': rate_id},
        {'$set': update_doc}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Failed to update commission rate")
    
    # Get updated rate
    updated_rate = await db.commission_rates.find_one({'id': rate_id})
    return CommissionRate(**updated_rate)

@api_router.post("/commission-rates/calculate")
async def calculate_commission(amount: float, agent_id: str, transfer_type: str, city: str, country: str, currency: str = "IQD"):
    """Calculate commission for a transfer"""
    # Find applicable commission rate
    rates = await db.commission_rates.find({
        'agent_id': agent_id,
        'currency': currency
    }).to_list(length=None)
    
    if not rates:
        return {"commission": 0, "percentage": 0}
    
    # Get the latest rate
    rate = rates[0]
    
    # Find applicable tier
    for tier_data in rate['tiers']:
        tier = CommissionTier(**tier_data)
        
        # Check if tier matches the criteria
        if tier.type != transfer_type:
            continue
        
        if tier.city and tier.city != city and tier.city != "(جميع المدن)":
            continue
        
        if tier.country and tier.country != country and tier.country != "(جميع البلدان)":
            continue
        
        # Check amount range
        if tier.from_amount <= amount <= tier.to_amount:
            commission = (amount * tier.percentage) / 100
            return {
                "commission": commission,
                "percentage": tier.percentage,
                "from_amount": tier.from_amount,
                "to_amount": tier.to_amount
            }
    
    return {"commission": 0, "percentage": 0}

@api_router.get("/commission/calculate-preview")
async def calculate_commission_preview(
    amount: float,
    currency: str,
    to_governorate: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Calculate commission for current user's transfer before creating it
    Used by frontend to show commission preview in real-time
    """
    if amount <= 0:
        return {
            "commission_percentage": 0.0,
            "commission_amount": 0.0,
            "message": "Invalid amount"
        }
    
    # Try to get commission rate for this agent
    commission_rates = await db.commission_rates.find({
        'agent_id': current_user['id'],
        'currency': currency
    }).to_list(length=None)
    
    commission_percentage = 0.0
    commission_amount = 0.0
    
    if commission_rates:
        # Get the latest rate
        rate = commission_rates[0]
        
        # Convert governorate code to name for comparison
        governorate_name = GOVERNORATE_CODE_TO_NAME.get(to_governorate, to_governorate)
        
        # Find applicable tier for outgoing transfer
        for tier_data in rate.get('tiers', []):
            # Check if tier matches
            if tier_data.get('type') != 'outgoing':
                continue
            
            # Check city/country filters
            city = tier_data.get('city')
            country = tier_data.get('country')
            
            # If city/country specified, check if matches
            # Compare with both code and name for flexibility
            if city and city != '(جميع المدن)' and city != to_governorate and city != governorate_name:
                continue
            
            if country and country != '(جميع البلدان)':
                # Could add country check here if needed
                pass
            
            # Check amount range
            from_amount = tier_data.get('from_amount', 0)
            to_amount = tier_data.get('to_amount', float('inf'))
            
            if from_amount <= amount <= to_amount:
                # Check commission type
                commission_type = tier_data.get('commission_type', 'percentage')
                
                if commission_type == 'fixed_amount':
                    # Fixed amount commission
                    commission_amount = tier_data.get('fixed_amount', 0)
                    commission_percentage = (commission_amount / amount * 100) if amount > 0 else 0
                else:
                    # Percentage commission
                    commission_percentage = tier_data.get('percentage', 0)
                    commission_amount = (amount * commission_percentage) / 100
                break
    
    return {
        "commission_percentage": commission_percentage,
        "commission_amount": commission_amount,
        "currency": currency
    }

# ============================================
# Reports Endpoints (التقارير)
# ============================================

@api_router.get("/reports/commissions")
async def get_detailed_commissions_report(
    report_type: str = "daily",  # daily, monthly, yearly
    date: str = None,  # YYYY-MM-DD for daily, YYYY-MM for monthly, YYYY for yearly
    current_user: dict = Depends(require_admin)
):
    """
    Get commissions report
    report_type: daily, monthly, yearly
    date: specific date/month/year to filter
    """
    from datetime import datetime as dt, timedelta
    
    # Parse date parameter
    if not date:
        date = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    
    # Build query based on report type
    if report_type == "daily":
        start_date = dt.strptime(date, '%Y-%m-%d')
        end_date = start_date + timedelta(days=1)
    elif report_type == "monthly":
        start_date = dt.strptime(date + "-01", '%Y-%m-%d')
        next_month = start_date.month + 1 if start_date.month < 12 else 1
        next_year = start_date.year if start_date.month < 12 else start_date.year + 1
        end_date = dt(next_year, next_month, 1)
    elif report_type == "yearly":
        start_date = dt.strptime(date + "-01-01", '%Y-%m-%d')
        end_date = dt(start_date.year + 1, 1, 1)
    else:
        raise HTTPException(status_code=400, detail="Invalid report_type")
    
    start_iso = start_date.isoformat()
    end_iso = end_date.isoformat()
    
    # Get earned commissions (عمولات محققة)
    earned_commissions = await db.admin_commissions.find({
        'type': 'earned',
        'created_at': {'$gte': start_iso, '$lt': end_iso}
    }).to_list(length=None)
    
    # Get paid commissions (عمولات مدفوعة)
    paid_commissions = await db.admin_commissions.find({
        'type': 'paid',
        'created_at': {'$gte': start_iso, '$lt': end_iso}
    }).to_list(length=None)
    
    # Calculate totals by currency
    totals = {
        'IQD': {'earned': 0, 'paid': 0, 'net': 0},
        'USD': {'earned': 0, 'paid': 0, 'net': 0}
    }
    
    for comm in earned_commissions:
        comm.pop('_id', None)
        currency = comm.get('currency', 'IQD')
        totals[currency]['earned'] += comm.get('amount', 0)
    
    for comm in paid_commissions:
        comm.pop('_id', None)
        currency = comm.get('currency', 'IQD')
        totals[currency]['paid'] += comm.get('amount', 0)
    
    # Calculate net profit
    for currency in totals:
        totals[currency]['net'] = totals[currency]['earned'] - totals[currency]['paid']
    
    return {
        "report_type": report_type,
        "date": date,
        "start_date": start_iso,
        "end_date": end_iso,
        "earned_commissions": earned_commissions,
        "paid_commissions": paid_commissions,
        "totals": totals,
        "summary": {
            "total_earned_iqd": totals['IQD']['earned'],
            "total_paid_iqd": totals['IQD']['paid'],
            "net_profit_iqd": totals['IQD']['net'],
            "total_earned_usd": totals['USD']['earned'],
            "total_paid_usd": totals['USD']['paid'],
            "net_profit_usd": totals['USD']['net']
        }
    }

@api_router.get("/reports/agents-profit")
async def get_agents_profit_report(
    report_type: str = "daily",
    date: str = None,
    current_user: dict = Depends(require_admin)
):
    """
    Get profit report per agent (صافي ربح كل صيرفة)
    """
    from datetime import datetime as dt, timedelta
    
    if not date:
        date = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    
    # Build date range
    if report_type == "daily":
        start_date = dt.strptime(date, '%Y-%m-%d')
        end_date = start_date + timedelta(days=1)
    elif report_type == "monthly":
        start_date = dt.strptime(date + "-01", '%Y-%m-%d')
        next_month = start_date.month + 1 if start_date.month < 12 else 1
        next_year = start_date.year if start_date.month < 12 else start_date.year + 1
        end_date = dt(next_year, next_month, 1)
    elif report_type == "yearly":
        start_date = dt.strptime(date + "-01-01", '%Y-%m-%d')
        end_date = dt(start_date.year + 1, 1, 1)
    else:
        raise HTTPException(status_code=400, detail="Invalid report_type")
    
    start_iso = start_date.isoformat()
    end_iso = end_date.isoformat()
    
    # Get all commissions in date range
    all_commissions = await db.admin_commissions.find({
        'created_at': {'$gte': start_iso, '$lt': end_iso}
    }).to_list(length=None)
    
    # Group by agent
    agents_data = {}
    
    for comm in all_commissions:
        agent_id = comm.get('agent_id')
        agent_name = comm.get('agent_name', 'Unknown')
        currency = comm.get('currency', 'IQD')
        amount = comm.get('amount', 0)
        comm_type = comm.get('type')
        
        if agent_id not in agents_data:
            agents_data[agent_id] = {
                'agent_id': agent_id,
                'agent_name': agent_name,
                'IQD': {'earned': 0, 'paid': 0, 'net': 0},
                'USD': {'earned': 0, 'paid': 0, 'net': 0},
                'earned_transactions': [],
                'paid_transactions': []
            }
        
        if comm_type == 'earned':
            agents_data[agent_id][currency]['earned'] += amount
            agents_data[agent_id]['earned_transactions'].append(comm)
        elif comm_type == 'paid':
            agents_data[agent_id][currency]['paid'] += amount
            agents_data[agent_id]['paid_transactions'].append(comm)
    
    # Calculate net profit for each agent
    for agent_id in agents_data:
        for currency in ['IQD', 'USD']:
            agents_data[agent_id][currency]['net'] = (
                agents_data[agent_id][currency]['earned'] - 
                agents_data[agent_id][currency]['paid']
            )
    
    return {
        "report_type": report_type,
        "date": date,
        "start_date": start_iso,
        "end_date": end_iso,
        "agents": list(agents_data.values())
    }

# ============================================
# Transit Account Endpoints
# ============================================

@api_router.get("/transit-account/balance")
async def get_transit_account_balance(current_user: dict = Depends(require_admin)):
    """Get transit account balance (Admin only)"""
    transit = await get_or_create_transit_account()
    
    # Get count of pending transfers
    pending_transfers = await db.transfers.count_documents({'status': 'pending'})
    
    return {
        "balance_iqd": transit.get('balance_iqd', 0),
        "balance_usd": transit.get('balance_usd', 0),
        "pending_transfers_count": pending_transfers,
        "updated_at": transit.get('updated_at')
    }

@api_router.get("/transit-account/transactions")
async def get_transit_transactions(
    limit: int = 50,
    current_user: dict = Depends(require_admin)
):
    """Get transit account transaction history (Admin only)"""
    transactions = await db.transit_transactions.find().sort('created_at', -1).limit(limit).to_list(length=limit)
    
    for transaction in transactions:
        transaction.pop('_id', None)
    
    return transactions

@api_router.get("/transit-account/pending-transfers")
async def get_transit_pending_transfers(current_user: dict = Depends(require_admin)):
    """Get all pending transfers in transit (Admin only)"""
    pending_transfers = await db.transfers.find({'status': 'pending'}).to_list(length=None)
    
    # Calculate totals by currency
    totals = {'IQD': 0, 'USD': 0}
    for transfer in pending_transfers:
        transfer.pop('_id', None)
        transfer.pop('pin_hash', None)
        transfer.pop('pin_encrypted', None)
        
        currency = transfer.get('currency', 'IQD')
        totals[currency] += transfer.get('amount', 0)
    
    return {
        "pending_transfers": pending_transfers,
        "total_count": len(pending_transfers),
        "totals": totals
    }

# ============================================
# AI Monitoring System (نظام المراقبة بالذكاء الاصطناعي)
# ============================================

async def analyze_transfer_with_ai(transfer_data: dict) -> dict:
    """
    Analyze transfer using AI to detect suspicious patterns
    """
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    from dotenv import load_dotenv
    import os
    
    load_dotenv()
    
    api_key = os.getenv('EMERGENT_LLM_KEY')
    
    # Prepare transfer details for AI analysis
    analysis_prompt = f"""
أنت نظام مراقبة ذكي لنظام الحوالات المالية. حلل الحوالة التالية وأخبرني إذا كان هناك شيء مشبوه:

**تفاصيل الحوالة:**
- رقم الحوالة: {transfer_data.get('transfer_code')}
- المبلغ: {transfer_data.get('amount'):,.0f} {transfer_data.get('currency')}
- المرسل: {transfer_data.get('sender_name')}
- المستلم: {transfer_data.get('receiver_name')}
- من صراف: {transfer_data.get('from_agent_name')}
- إلى: {transfer_data.get('to_governorate')}
- التاريخ: {transfer_data.get('created_at')}

**معايير الكشف:**
1. أسماء غريبة أو غير طبيعية (أسماء أجنبية، رموز، أرقام)
2. مبلغ كبير جداً (مليار دينار أو أكثر)
3. نمط غير طبيعي

**المطلوب:**
- هل هذه الحوالة مشبوهة؟ (نعم/لا)
- مستوى الخطر: (منخفض/متوسط/عالي)
- السبب: اشرح لماذا تعتبرها مشبوهة أو آمنة (بالعربي)

أجب بتنسيق JSON فقط:
{{
  "is_suspicious": true/false,
  "risk_level": "low/medium/high",
  "reason": "السبب بالعربي",
  "recommendations": "التوصيات للمدير"
}}
"""
    
    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"transfer_analysis_{transfer_data.get('id')}",
            system_message="أنت نظام مراقبة ذكي متخصص في كشف الحوالات المشبوهة. أجب دائماً بتنسيق JSON."
        ).with_model("openai", "gpt-4o")
        
        user_message = UserMessage(text=analysis_prompt)
        response = await chat.send_message(user_message)
        
        # Parse JSON response
        import json
        import re
        
        # Extract JSON from response
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            analysis_result = json.loads(json_match.group())
        else:
            analysis_result = {
                "is_suspicious": False,
                "risk_level": "low",
                "reason": "فشل التحليل",
                "recommendations": "يرجى المراجعة اليدوية"
            }
        
        return analysis_result
    except Exception as e:
        print(f"Error in AI analysis: {e}")
        return {
            "is_suspicious": False,
            "risk_level": "low",
            "reason": f"خطأ في التحليل: {str(e)}",
            "recommendations": "يرجى المراجعة اليدوية"
        }

async def check_duplicate_transfers_today(sender_name: str, receiver_name: str) -> int:
    """
    Check how many times the same sender/receiver pair appeared today
    """
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    count = await db.transfers.count_documents({
        'sender_name': sender_name,
        'receiver_name': receiver_name,
        'created_at': {
            '$gte': today_start.isoformat(),
            '$lt': today_end.isoformat()
        }
    })
    
    return count

async def check_delayed_transfers():
    """
    Check for delayed transfers (pending for more than 1-2 days)
    """
    one_day_ago = datetime.now(timezone.utc) - timedelta(days=1)
    two_days_ago = datetime.now(timezone.utc) - timedelta(days=2)
    
    delayed_transfers = await db.transfers.find({
        'status': 'pending',
        'created_at': {'$lt': one_day_ago.isoformat()}
    }).to_list(length=None)
    
    return delayed_transfers

async def create_notification(title: str, message: str, severity: str, related_transfer_id: str = None, related_agent_id: str = None):
    """
    Create a notification for admin
    severity: low, medium, high, critical
    """
    notification = {
        'id': str(uuid.uuid4()),
        'title': title,
        'message': message,
        'severity': severity,
        'related_transfer_id': related_transfer_id,
        'related_agent_id': related_agent_id,
        'is_read': False,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.notifications.insert_one(notification)
    return notification

async def analyze_and_notify_if_suspicious(transfer_data: dict):
    """
    Analyze transfer with AI and create notification if suspicious
    """
    try:
        analysis = await analyze_transfer_with_ai(transfer_data)
        
        if analysis.get('is_suspicious'):
            severity_map = {'low': 'low', 'medium': 'medium', 'high': 'critical'}
            severity = severity_map.get(analysis.get('risk_level', 'low'), 'medium')
            
            await create_notification(
                title=f"🤖 حوالة مشبوهة اكتشفها الذكاء الاصطناعي",
                message=f"**السبب:** {analysis.get('reason')}\n\n**التوصيات:** {analysis.get('recommendations')}",
                severity=severity,
                related_transfer_id=transfer_data.get('id'),
                related_agent_id=transfer_data.get('from_agent_id')
            )
    except Exception as e:
        print(f"Error in AI analysis task: {e}")

# ============================================
# Notifications Endpoints
# ============================================

@api_router.get("/notifications")
async def get_notifications(
    unread_only: bool = False,
    limit: int = 50,
    current_user: dict = Depends(require_admin)
):
    """
    Get notifications for admin
    """
    query = {}
    if unread_only:
        query['is_read'] = False
    
    notifications = await db.notifications.find(query).sort('created_at', -1).limit(limit).to_list(length=limit)
    
    for notif in notifications:
        notif.pop('_id', None)
    
    return {
        "notifications": notifications,
        "unread_count": await db.notifications.count_documents({'is_read': False})
    }

@api_router.patch("/notifications/{notification_id}/mark-read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(require_admin)
):
    """
    Mark notification as read
    """
    result = await db.notifications.update_one(
        {'id': notification_id},
        {'$set': {'is_read': True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification marked as read"}

@api_router.post("/monitoring/check-delayed-transfers")
async def manual_check_delayed_transfers(current_user: dict = Depends(require_admin)):
    """
    Manually trigger check for delayed transfers
    """
    delayed = await check_delayed_transfers()
    
    for transfer in delayed:
        # Calculate delay in hours
        created_at = datetime.fromisoformat(transfer['created_at'].replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        delay_hours = (now - created_at).total_seconds() / 3600
        
        if delay_hours >= 24:
            await create_notification(
                title="⏰ حوالة متأخرة!",
                message=f"الحوالة رقم {transfer['transfer_code']} معلقة منذ {delay_hours:.1f} ساعة. المرسل: {transfer['sender_name']}",
                severity="medium" if delay_hours < 48 else "high",
                related_transfer_id=transfer['id'],
                related_agent_id=transfer.get('from_agent_id')
            )
    
    return {
        "message": f"تم فحص {len(delayed)} حوالة متأخرة",
        "delayed_count": len(delayed)
    }

# ============================================
# Accounting Endpoints (الحسابات)
# ============================================

@api_router.post("/accounting/initialize")
async def initialize_chart_of_accounts(current_user: dict = Depends(require_admin)):
    """
    Initialize the chart of accounts with default accounts
    """
    default_accounts = [
        # الأصول - Assets
        {"code": "1000", "name_ar": "الأصول", "name_en": "Assets", "category": "أصول", "parent_code": None, "currency": "IQD"},
        {"code": "1010", "name_ar": "صندوق بالدينار", "name_en": "Cash IQD", "category": "أصول", "parent_code": "1000", "currency": "IQD"},
        {"code": "1020", "name_ar": "صندوق بالدولار", "name_en": "Cash USD", "category": "أصول", "parent_code": "1000", "currency": "USD"},
        {"code": "1030", "name_ar": "صندوق عملات أجنبية أخرى", "name_en": "Cash Other Currencies", "category": "أصول", "parent_code": "1000", "currency": "IQD"},
        {"code": "1100", "name_ar": "الذمم المدينة", "name_en": "Accounts Receivable", "category": "أصول", "parent_code": "1000", "currency": "IQD"},
        {"code": "1110", "name_ar": "ذمم زبائن", "name_en": "Customer Receivables", "category": "أصول", "parent_code": "1100", "currency": "IQD"},
        {"code": "1120", "name_ar": "ذمم شركات صرافة", "name_en": "Exchange Company Receivables", "category": "أصول", "parent_code": "1100", "currency": "IQD"},
        {"code": "1200", "name_ar": "حوالات قيد الاستلام", "name_en": "Transfers Receivable", "category": "أصول", "parent_code": "1000", "currency": "IQD"},
        
        # الالتزامات - Liabilities
        {"code": "2000", "name_ar": "الالتزامات", "name_en": "Liabilities", "category": "التزامات", "parent_code": None, "currency": "IQD"},
        {"code": "2010", "name_ar": "ذمم زبائن دائنة", "name_en": "Customer Payables", "category": "التزامات", "parent_code": "2000", "currency": "IQD"},
        {"code": "2020", "name_ar": "ذمم شركات صرافة دائنة", "name_en": "Exchange Company Payables", "category": "التزامات", "parent_code": "2000", "currency": "IQD"},
        {"code": "2100", "name_ar": "حوالات قيد التسليم", "name_en": "Transfers Payable", "category": "التزامات", "parent_code": "2000", "currency": "IQD"},
        
        # حقوق الملكية - Equity
        {"code": "3000", "name_ar": "حقوق الملكية", "name_en": "Equity", "category": "حقوق الملكية", "parent_code": None, "currency": "IQD"},
        {"code": "3000", "name_ar": "رأس المال", "name_en": "Capital", "category": "حقوق الملكية", "parent_code": None, "currency": "IQD"},
        {"code": "3100", "name_ar": "أرباح وخسائر مرحلة", "name_en": "Retained Earnings", "category": "حقوق الملكية", "parent_code": "3000", "currency": "IQD"},
        
        # الإيرادات - Revenues
        {"code": "4000", "name_ar": "الإيرادات", "name_en": "Revenues", "category": "إيرادات", "parent_code": None, "currency": "IQD"},
        {"code": "4010", "name_ar": "أرباح فرق صرف (بيع وشراء)", "name_en": "Exchange Profit", "category": "إيرادات", "parent_code": "4000", "currency": "IQD"},
        {"code": "4100", "name_ar": "إيرادات الحوالات", "name_en": "Transfer Revenues", "category": "إيرادات", "parent_code": "4000", "currency": "IQD"},
        {"code": "4110", "name_ar": "عمولة حوالات واردة (محققة)", "name_en": "Incoming Transfer Commission", "category": "إيرادات", "parent_code": "4100", "currency": "IQD"},
        {"code": "4120", "name_ar": "عمولة حوالات صادرة (محققة)", "name_en": "Outgoing Transfer Commission", "category": "إيرادات", "parent_code": "4100", "currency": "IQD"},
        
        # المصاريف - Expenses
        {"code": "5000", "name_ar": "المصاريف", "name_en": "Expenses", "category": "مصاريف", "parent_code": None, "currency": "IQD"},
        {"code": "5010", "name_ar": "رواتب وأجور", "name_en": "Salaries", "category": "مصاريف", "parent_code": "5000", "currency": "IQD"},
        {"code": "5020", "name_ar": "إيجار مكتب", "name_en": "Office Rent", "category": "مصاريف", "parent_code": "5000", "currency": "IQD"},
        {"code": "5030", "name_ar": "كهرباء وماء وإنترنت", "name_en": "Utilities", "category": "مصاريف", "parent_code": "5000", "currency": "IQD"},
        {"code": "5040", "name_ar": "مصاريف اتصالات", "name_en": "Communication Expenses", "category": "مصاريف", "parent_code": "5000", "currency": "IQD"},
        {"code": "5050", "name_ar": "مصاريف متنوعة", "name_en": "Miscellaneous Expenses", "category": "مصاريف", "parent_code": "5000", "currency": "IQD"},
        {"code": "5100", "name_ar": "عمولات مدفوعة", "name_en": "Commission Paid", "category": "مصاريف", "parent_code": "5000", "currency": "IQD"},
        {"code": "5110", "name_ar": "عمولات حوالات مدفوعة", "name_en": "Transfer Commission Paid", "category": "مصاريف", "parent_code": "5100", "currency": "IQD"},
    ]
    
    # Check if already initialized
    existing = await db.accounts.count_documents({})
    if existing > 0:
        raise HTTPException(status_code=400, detail="Chart of accounts already initialized")
    
    # Insert all accounts
    for acc_data in default_accounts:
        account = {
            'id': str(uuid.uuid4()),
            **acc_data,
            'balance': 0.0,
            'is_active': True,
            'created_at': datetime.now(timezone.utc).isoformat(),
            'updated_at': datetime.now(timezone.utc).isoformat()
        }
        await db.accounts.insert_one(account)
    
    return {"message": f"تم إنشاء {len(default_accounts)} حساب بنجاح", "count": len(default_accounts)}

@api_router.get("/accounting/accounts")
async def get_chart_of_accounts(current_user: dict = Depends(require_admin)):
    """
    Get all accounts in chart of accounts
    """
    accounts = await db.accounts.find({'is_active': True}).sort('code', 1).to_list(length=None)
    
    for acc in accounts:
        acc.pop('_id', None)
    
    return {"accounts": accounts}

@api_router.post("/accounting/accounts")
async def create_account(account_data: AccountCreate, current_user: dict = Depends(require_admin)):
    """
    Create a new account
    """
    # Check if code already exists
    existing = await db.accounts.find_one({'code': account_data.code})
    if existing:
        raise HTTPException(status_code=400, detail="Account code already exists")
    
    account = {
        'id': str(uuid.uuid4()),
        **account_data.model_dump(),
        'balance': 0.0,
        'is_active': True,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.accounts.insert_one(account)
    account.pop('_id', None)
    
    return account

@api_router.get("/accounting/accounts/{account_code}")
async def get_account(account_code: str, current_user: dict = Depends(require_admin)):
    """
    Get specific account details and balance
    """
    account = await db.accounts.find_one({'code': account_code})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    account.pop('_id', None)
    return account

@api_router.get("/accounting/reports/trial-balance")
async def get_trial_balance(
    start_date: str = None,
    end_date: str = None,
    current_user: dict = Depends(require_admin)
):
    """
    Get trial balance report (ميزان المراجعة)
    Shows all accounts with debit and credit totals
    """
    # Get all accounts
    accounts = await db.accounts.find({'is_active': True}).sort('code', 1).to_list(length=None)
    
    # Build query for journal entries
    query = {'is_cancelled': False}
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query['$gte'] = start_date
        if end_date:
            date_query['$lte'] = end_date
        query['date'] = date_query
    
    # Get all journal entries in period
    entries = await db.journal_entries.find(query).to_list(length=None)
    
    # Calculate totals for each account
    account_totals = {}
    for account in accounts:
        account_totals[account['code']] = {
            'code': account['code'],
            'name_ar': account['name_ar'],
            'name_en': account['name_en'],
            'category': account['category'],
            'debit': 0,
            'credit': 0,
            'balance': 0
        }
    
    # Sum up debits and credits from journal entries
    for entry in entries:
        for line in entry.get('lines', []):
            code = line.get('account_code')
            if code in account_totals:
                account_totals[code]['debit'] += line.get('debit', 0)
                account_totals[code]['credit'] += line.get('credit', 0)
    
    # Calculate balances based on account type
    total_debit = 0
    total_credit = 0
    
    for code, data in account_totals.items():
        category = data['category']
        # Assets and Expenses: Debit increases, Credit decreases
        if category in ['أصول', 'مصاريف']:
            data['balance'] = data['debit'] - data['credit']
        else:  # Liabilities, Equity, Revenues: Credit increases, Debit decreases
            data['balance'] = data['credit'] - data['debit']
        
        total_debit += data['debit']
        total_credit += data['credit']
    
    # Filter out accounts with no activity (optional)
    active_accounts = [data for data in account_totals.values() if data['debit'] != 0 or data['credit'] != 0]
    
    return {
        "accounts": active_accounts,
        "total_debit": total_debit,
        "total_credit": total_credit,
        "is_balanced": abs(total_debit - total_credit) < 0.01,
        "start_date": start_date,
        "end_date": end_date
    }

@api_router.get("/accounting/reports/income-statement")
async def get_income_statement(
    start_date: str = None,
    end_date: str = None,
    current_user: dict = Depends(require_admin)
):
    """
    Get income statement (قائمة الدخل)
    Shows revenues, expenses, and net profit/loss
    """
    # Get revenue and expense accounts
    revenue_accounts = await db.accounts.find({
        'category': 'إيرادات',
        'is_active': True
    }).to_list(length=None)
    
    expense_accounts = await db.accounts.find({
        'category': 'مصاريف',
        'is_active': True
    }).to_list(length=None)
    
    # Build query for journal entries
    query = {'is_cancelled': False}
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query['$gte'] = start_date
        if end_date:
            date_query['$lte'] = end_date
        query['date'] = date_query
    
    entries = await db.journal_entries.find(query).to_list(length=None)
    
    # Calculate revenue totals
    revenues = []
    total_revenue = 0
    for account in revenue_accounts:
        debit = 0
        credit = 0
        for entry in entries:
            for line in entry.get('lines', []):
                if line.get('account_code') == account['code']:
                    debit += line.get('debit', 0)
                    credit += line.get('credit', 0)
        
        # For revenue: credit increases, debit decreases
        balance = credit - debit
        if balance != 0:
            revenues.append({
                'code': account['code'],
                'name_ar': account['name_ar'],
                'amount': balance
            })
            total_revenue += balance
    
    # Calculate expense totals
    expenses = []
    total_expenses = 0
    for account in expense_accounts:
        debit = 0
        credit = 0
        for entry in entries:
            for line in entry.get('lines', []):
                if line.get('account_code') == account['code']:
                    debit += line.get('debit', 0)
                    credit += line.get('credit', 0)
        
        # For expenses: debit increases, credit decreases
        balance = debit - credit
        if balance != 0:
            expenses.append({
                'code': account['code'],
                'name_ar': account['name_ar'],
                'amount': balance
            })
            total_expenses += balance
    
    net_profit = total_revenue - total_expenses
    
    return {
        "revenues": revenues,
        "expenses": expenses,
        "total_revenue": total_revenue,
        "total_expenses": total_expenses,
        "net_profit": net_profit,
        "start_date": start_date,
        "end_date": end_date
    }

@api_router.get("/accounting/reports/balance-sheet")
async def get_balance_sheet(
    end_date: str = None,
    current_user: dict = Depends(require_admin)
):
    """
    Get balance sheet (الميزانية العمومية)
    Shows assets, liabilities, and equity at a specific date
    """
    # Get accounts by category
    asset_accounts = await db.accounts.find({
        'category': 'أصول',
        'is_active': True
    }).to_list(length=None)
    
    liability_accounts = await db.accounts.find({
        'category': 'التزامات',
        'is_active': True
    }).to_list(length=None)
    
    equity_accounts = await db.accounts.find({
        'category': 'حقوق الملكية',
        'is_active': True
    }).to_list(length=None)
    
    # Build query for journal entries up to end_date
    query = {'is_cancelled': False}
    if end_date:
        query['date'] = {'$lte': end_date}
    
    entries = await db.journal_entries.find(query).to_list(length=None)
    
    # Calculate asset totals
    assets = []
    total_assets = 0
    for account in asset_accounts:
        debit = 0
        credit = 0
        for entry in entries:
            for line in entry.get('lines', []):
                if line.get('account_code') == account['code']:
                    debit += line.get('debit', 0)
                    credit += line.get('credit', 0)
        
        balance = debit - credit
        if balance != 0:
            assets.append({
                'code': account['code'],
                'name_ar': account['name_ar'],
                'amount': balance
            })
            total_assets += balance
    
    # Calculate liability totals
    liabilities = []
    total_liabilities = 0
    for account in liability_accounts:
        debit = 0
        credit = 0
        for entry in entries:
            for line in entry.get('lines', []):
                if line.get('account_code') == account['code']:
                    debit += line.get('debit', 0)
                    credit += line.get('credit', 0)
        
        balance = credit - debit
        if balance != 0:
            liabilities.append({
                'code': account['code'],
                'name_ar': account['name_ar'],
                'amount': balance
            })
            total_liabilities += balance
    
    # Calculate equity totals
    equity = []
    total_equity = 0
    for account in equity_accounts:
        debit = 0
        credit = 0
        for entry in entries:
            for line in entry.get('lines', []):
                if line.get('account_code') == account['code']:
                    debit += line.get('debit', 0)
                    credit += line.get('credit', 0)
        
        balance = credit - debit
        if balance != 0:
            equity.append({
                'code': account['code'],
                'name_ar': account['name_ar'],
                'amount': balance
            })
            total_equity += balance
    
    # Add net income to equity
    income_statement = await get_income_statement(None, end_date, current_user)
    net_income = income_statement['net_profit']
    if net_income != 0:
        equity.append({
            'code': 'NET_INCOME',
            'name_ar': 'صافي الربح/الخسارة للفترة',
            'amount': net_income
        })
        total_equity += net_income
    
    total_liabilities_equity = total_liabilities + total_equity
    is_balanced = abs(total_assets - total_liabilities_equity) < 0.01
    
    return {
        "assets": assets,
        "liabilities": liabilities,
        "equity": equity,
        "total_assets": total_assets,
        "total_liabilities": total_liabilities,
        "total_equity": total_equity,
        "total_liabilities_equity": total_liabilities_equity,
        "is_balanced": is_balanced,
        "end_date": end_date
    }

@api_router.delete("/accounting/accounts/{account_code}")
async def delete_account(account_code: str, current_user: dict = Depends(require_admin)):
    """
    Delete an account from chart of accounts
    """
    # Check if account exists
    account = await db.accounts.find_one({'code': account_code})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Check if account has child accounts
    children = await db.accounts.count_documents({'parent_code': account_code})
    if children > 0:
        raise HTTPException(status_code=400, detail="Cannot delete account with child accounts. Delete children first.")
    
    # Check if account has transactions (has non-zero balance)
    if account.get('balance', 0) != 0:
        raise HTTPException(status_code=400, detail="Cannot delete account with non-zero balance")
    
    # Delete the account
    result = await db.accounts.delete_one({'code': account_code})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=500, detail="Failed to delete account")
    
    return {"message": "تم حذف الحساب بنجاح", "code": account_code}

# ============================================
# Journal Entry Endpoints (القيود المحاسبية)
# ============================================

@api_router.post("/accounting/journal-entries")
async def create_journal_entry(entry_data: JournalEntryCreate, current_user: dict = Depends(require_admin)):
    """
    Create a manual journal entry (قيد يومي يدوي)
    """
    # Validate that total debit equals total credit
    total_debit = sum(line.get('debit', 0) for line in entry_data.lines)
    total_credit = sum(line.get('credit', 0) for line in entry_data.lines)
    
    if abs(total_debit - total_credit) > 0.01:  # Allow small floating point differences
        raise HTTPException(
            status_code=400, 
            detail=f"القيد غير متوازن: المدين {total_debit} ≠ الدائن {total_credit}"
        )
    
    # Validate all account codes exist
    for line in entry_data.lines:
        account = await db.accounts.find_one({'code': line['account_code']})
        if not account:
            raise HTTPException(
                status_code=404,
                detail=f"الحساب {line['account_code']} غير موجود"
            )
    
    # Generate entry number
    last_entry = await db.journal_entries.find_one(sort=[('created_at', -1)])
    if last_entry and 'entry_number' in last_entry:
        try:
            last_num = int(last_entry['entry_number'].replace('JE-', ''))
            entry_number = f"JE-{last_num + 1:06d}"
        except:
            entry_number = f"JE-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    else:
        entry_number = "JE-000001"
    
    # Create journal entry
    journal_entry = {
        'id': str(uuid.uuid4()),
        'entry_number': entry_number,
        'date': datetime.now(timezone.utc).isoformat(),
        'description': entry_data.description,
        'lines': entry_data.lines,
        'total_debit': total_debit,
        'total_credit': total_credit,
        'reference_type': entry_data.reference_type,
        'reference_id': entry_data.reference_id,
        'created_by': current_user['id'],
        'created_at': datetime.now(timezone.utc).isoformat(),
        'is_cancelled': False
    }
    
    await db.journal_entries.insert_one(journal_entry)
    
    # Update account balances
    for line in entry_data.lines:
        account_code = line['account_code']
        debit = line.get('debit', 0)
        credit = line.get('credit', 0)
        
        account = await db.accounts.find_one({'code': account_code})
        if account:
            # For assets and expenses: debit increases, credit decreases
            # For liabilities, equity, and revenues: credit increases, debit decreases
            category = account.get('category', '')
            if category in ['أصول', 'مصاريف']:
                balance_change = debit - credit
            else:  # التزامات, حقوق الملكية, إيرادات
                balance_change = credit - debit
            
            new_balance = account.get('balance', 0) + balance_change
            
            await db.accounts.update_one(
                {'code': account_code},
                {
                    '$set': {
                        'balance': new_balance,
                        'updated_at': datetime.now(timezone.utc).isoformat()
                    }
                }
            )
    
    journal_entry.pop('_id', None)
    return journal_entry

@api_router.get("/accounting/journal-entries")
async def get_journal_entries(
    start_date: str = None,
    end_date: str = None,
    current_user: dict = Depends(require_admin)
):
    """
    Get all journal entries (دفتر اليومية)
    Optional filters: start_date, end_date (ISO format)
    """
    query = {'is_cancelled': False}
    
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query['$gte'] = start_date
        if end_date:
            date_query['$lte'] = end_date
        query['date'] = date_query
    
    entries = await db.journal_entries.find(query).sort('date', -1).to_list(length=None)
    
    for entry in entries:
        entry.pop('_id', None)
    
    return {"entries": entries, "total": len(entries)}

@api_router.get("/accounting/ledger/{account_code}")
async def get_account_ledger(
    account_code: str,
    start_date: str = None,
    end_date: str = None,
    current_user: dict = Depends(require_admin)
):
    """
    Get ledger for a specific account (دفتر الأستاذ)
    """
    # Verify account exists
    account = await db.accounts.find_one({'code': account_code})
    if not account:
        raise HTTPException(status_code=404, detail="الحساب غير موجود")
    
    # Build query
    query = {'is_cancelled': False}
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query['$gte'] = start_date
        if end_date:
            date_query['$lte'] = end_date
        query['date'] = date_query
    
    # Get all journal entries
    entries = await db.journal_entries.find(query).sort('date', 1).to_list(length=None)
    
    # Filter and transform entries containing this account
    ledger_entries = []
    running_balance = 0
    
    for entry in entries:
        for line in entry.get('lines', []):
            if line.get('account_code') == account_code:
                debit = line.get('debit', 0)
                credit = line.get('credit', 0)
                
                # Calculate balance change based on account category
                category = account.get('category', '')
                if category in ['أصول', 'مصاريف']:
                    balance_change = debit - credit
                else:
                    balance_change = credit - debit
                
                running_balance += balance_change
                
                ledger_entries.append({
                    'date': entry['date'],
                    'entry_number': entry['entry_number'],
                    'description': entry['description'],
                    'debit': debit,
                    'credit': credit,
                    'balance': running_balance
                })
    
    account.pop('_id', None)
    
    return {
        "account": account,
        "entries": ledger_entries,
        "total_entries": len(ledger_entries),
        "current_balance": account.get('balance', 0)
    }

@api_router.patch("/accounting/journal-entries/{entry_id}")
async def update_journal_entry(
    entry_id: str,
    entry_data: JournalEntryCreate,
    current_user: dict = Depends(require_admin)
):
    """
    Update a journal entry (تعديل قيد)
    """
    # Get existing entry
    existing = await db.journal_entries.find_one({'id': entry_id})
    if not existing:
        raise HTTPException(status_code=404, detail="القيد غير موجود")
    
    if existing.get('is_cancelled'):
        raise HTTPException(status_code=400, detail="لا يمكن تعديل قيد ملغى")
    
    # Validate new entry balance
    total_debit = sum(line.get('debit', 0) for line in entry_data.lines)
    total_credit = sum(line.get('credit', 0) for line in entry_data.lines)
    
    if abs(total_debit - total_credit) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"القيد غير متوازن: المدين {total_debit} ≠ الدائن {total_credit}"
        )
    
    # Validate all account codes exist
    for line in entry_data.lines:
        account = await db.accounts.find_one({'code': line['account_code']})
        if not account:
            raise HTTPException(
                status_code=404,
                detail=f"الحساب {line['account_code']} غير موجود"
            )
    
    # Reverse old entry effects on account balances
    for line in existing.get('lines', []):
        account_code = line['account_code']
        debit = line.get('debit', 0)
        credit = line.get('credit', 0)
        
        account = await db.accounts.find_one({'code': account_code})
        if account:
            category = account.get('category', '')
            if category in ['أصول', 'مصاريف']:
                balance_change = -(debit - credit)
            else:
                balance_change = -(credit - debit)
            
            new_balance = account.get('balance', 0) + balance_change
            
            await db.accounts.update_one(
                {'code': account_code},
                {'$set': {'balance': new_balance, 'updated_at': datetime.now(timezone.utc).isoformat()}}
            )
    
    # Apply new entry effects
    for line in entry_data.lines:
        account_code = line['account_code']
        debit = line.get('debit', 0)
        credit = line.get('credit', 0)
        
        account = await db.accounts.find_one({'code': account_code})
        if account:
            category = account.get('category', '')
            if category in ['أصول', 'مصاريف']:
                balance_change = debit - credit
            else:
                balance_change = credit - debit
            
            new_balance = account.get('balance', 0) + balance_change
            
            await db.accounts.update_one(
                {'code': account_code},
                {'$set': {'balance': new_balance, 'updated_at': datetime.now(timezone.utc).isoformat()}}
            )
    
    # Update journal entry
    updated_entry = {
        'description': entry_data.description,
        'lines': entry_data.lines,
        'total_debit': total_debit,
        'total_credit': total_credit,
        'reference_type': entry_data.reference_type,
        'reference_id': entry_data.reference_id,
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.journal_entries.update_one(
        {'id': entry_id},
        {'$set': updated_entry}
    )
    
    result = await db.journal_entries.find_one({'id': entry_id})
    result.pop('_id', None)
    
    return result

@api_router.delete("/accounting/journal-entries/{entry_id}")
async def cancel_journal_entry(entry_id: str, current_user: dict = Depends(require_admin)):
    """
    Cancel a journal entry (إلغاء قيد)
    """
    # Get existing entry
    existing = await db.journal_entries.find_one({'id': entry_id})
    if not existing:
        raise HTTPException(status_code=404, detail="القيد غير موجود")
    
    if existing.get('is_cancelled'):
        raise HTTPException(status_code=400, detail="القيد ملغى مسبقاً")
    
    # Reverse entry effects on account balances
    for line in existing.get('lines', []):
        account_code = line['account_code']
        debit = line.get('debit', 0)
        credit = line.get('credit', 0)
        
        account = await db.accounts.find_one({'code': account_code})
        if account:
            category = account.get('category', '')
            if category in ['أصول', 'مصاريف']:
                balance_change = -(debit - credit)
            else:
                balance_change = -(credit - debit)
            
            new_balance = account.get('balance', 0) + balance_change
            
            await db.accounts.update_one(
                {'code': account_code},
                {'$set': {'balance': new_balance, 'updated_at': datetime.now(timezone.utc).isoformat()}}
            )
    
    # Mark as cancelled
    await db.journal_entries.update_one(
        {'id': entry_id},
        {
            '$set': {
                'is_cancelled': True,
                'cancelled_at': datetime.now(timezone.utc).isoformat(),
                'cancelled_by': current_user['id']
            }
        }
    )
    
    return {"message": "تم إلغاء القيد بنجاح", "entry_id": entry_id}

# ============================================
# Exchange Operations Endpoints (عمليات الصرافة)
# ============================================

@api_router.get("/exchange-rates")
async def get_exchange_rates(current_user: dict = Depends(require_admin)):
    """
    Get current exchange rates (أسعار الصرف الحالية)
    """
    rates = await db.exchange_rates.find_one(sort=[('updated_at', -1)])
    
    if not rates:
        # Create default rates if none exist
        default_rates = {
            'id': str(uuid.uuid4()),
            'buy_rate': 1480.0,  # Default: 1480 IQD per 1 USD
            'sell_rate': 1470.0,  # Default: 1470 IQD per 1 USD
            'updated_by': current_user['id'],
            'updated_at': datetime.now(timezone.utc).isoformat()
        }
        await db.exchange_rates.insert_one(default_rates)
        rates = default_rates
    
    rates.pop('_id', None)
    return rates

@api_router.post("/exchange-rates")
async def update_exchange_rates(
    rates_data: ExchangeRateUpdate,
    current_user: dict = Depends(require_admin)
):
    """
    Update exchange rates (تحديث أسعار الصرف)
    """
    if rates_data.buy_rate <= 0 or rates_data.sell_rate <= 0:
        raise HTTPException(status_code=400, detail="الأسعار يجب أن تكون أكبر من صفر")
    
    if rates_data.buy_rate <= rates_data.sell_rate:
        raise HTTPException(
            status_code=400,
            detail="سعر الشراء يجب أن يكون أكبر من سعر البيع لتحقيق ربح"
        )
    
    new_rates = {
        'id': str(uuid.uuid4()),
        'buy_rate': rates_data.buy_rate,
        'sell_rate': rates_data.sell_rate,
        'updated_by': current_user['id'],
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.exchange_rates.insert_one(new_rates)
    new_rates.pop('_id', None)
    
    return new_rates

@api_router.post("/exchange/buy")
async def buy_currency(
    operation: ExchangeOperationCreate,
    current_user: dict = Depends(require_admin)
):
    """
    Buy USD (شراء دولار - دفع دينار واستلام دولار)
    """
    if operation.operation_type != "buy":
        raise HTTPException(status_code=400, detail="نوع العملية يجب أن يكون 'buy'")
    
    if operation.amount_usd <= 0:
        raise HTTPException(status_code=400, detail="المبلغ يجب أن يكون أكبر من صفر")
    
    # Calculate amounts
    amount_iqd = operation.amount_usd * operation.exchange_rate
    
    # Get current rates to calculate profit
    current_rates = await db.exchange_rates.find_one(sort=[('updated_at', -1)])
    if not current_rates:
        raise HTTPException(status_code=400, detail="لا توجد أسعار صرف محددة")
    
    # Profit = (buy_rate - actual_rate) * amount_usd
    profit = (current_rates['buy_rate'] - operation.exchange_rate) * operation.amount_usd
    
    # Update admin wallet
    admin = await db.users.find_one({'id': current_user['id']})
    if not admin:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    
    current_iqd = admin.get('wallet_balance_iqd', 0)
    current_usd = admin.get('wallet_balance_usd', 0)
    
    # Check if admin has enough IQD
    if current_iqd < amount_iqd:
        raise HTTPException(
            status_code=400,
            detail=f"رصيد الدينار غير كافٍ. الرصيد الحالي: {current_iqd:,.0f}"
        )
    
    new_iqd = current_iqd - amount_iqd
    new_usd = current_usd + operation.amount_usd
    
    await db.users.update_one(
        {'id': current_user['id']},
        {
            '$set': {
                'wallet_balance_iqd': new_iqd,
                'wallet_balance_usd': new_usd,
                'updated_at': datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Create journal entry
    journal_entry = {
        'id': str(uuid.uuid4()),
        'entry_number': f"EX-BUY-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        'date': datetime.now(timezone.utc).isoformat(),
        'description': f"شراء دولار: {operation.amount_usd:,.2f} USD بسعر {operation.exchange_rate:,.2f}",
        'lines': [
            {'account_code': '1020', 'debit': amount_iqd, 'credit': 0},  # صندوق USD
            {'account_code': '1010', 'debit': 0, 'credit': amount_iqd},  # صندوق IQD
            {'account_code': '4010', 'debit': 0, 'credit': profit} if profit > 0 else {'account_code': '5010', 'debit': abs(profit), 'credit': 0}  # Profit/Loss
        ],
        'total_debit': amount_iqd + (abs(profit) if profit < 0 else 0),
        'total_credit': amount_iqd + (profit if profit > 0 else 0),
        'reference_type': 'exchange_buy',
        'reference_id': None,
        'created_by': current_user['id'],
        'created_at': datetime.now(timezone.utc).isoformat(),
        'is_cancelled': False
    }
    
    await db.journal_entries.insert_one(journal_entry)
    
    # Create exchange operation record
    exchange_op = {
        'id': str(uuid.uuid4()),
        'operation_type': 'buy',
        'amount_usd': operation.amount_usd,
        'amount_iqd': amount_iqd,
        'exchange_rate': operation.exchange_rate,
        'profit': profit,
        'admin_id': current_user['id'],
        'admin_name': current_user['display_name'],
        'journal_entry_id': journal_entry['id'],
        'notes': operation.notes,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.exchange_operations.insert_one(exchange_op)
    exchange_op.pop('_id', None)
    
    return exchange_op

@api_router.post("/exchange/sell")
async def sell_currency(
    operation: ExchangeOperationCreate,
    current_user: dict = Depends(require_admin)
):
    """
    Sell USD (بيع دولار - دفع دولار واستلام دينار)
    """
    if operation.operation_type != "sell":
        raise HTTPException(status_code=400, detail="نوع العملية يجب أن يكون 'sell'")
    
    if operation.amount_usd <= 0:
        raise HTTPException(status_code=400, detail="المبلغ يجب أن يكون أكبر من صفر")
    
    # Calculate amounts
    amount_iqd = operation.amount_usd * operation.exchange_rate
    
    # Get current rates to calculate profit
    current_rates = await db.exchange_rates.find_one(sort=[('updated_at', -1)])
    if not current_rates:
        raise HTTPException(status_code=400, detail="لا توجد أسعار صرف محددة")
    
    # Profit = (actual_rate - sell_rate) * amount_usd
    profit = (operation.exchange_rate - current_rates['sell_rate']) * operation.amount_usd
    
    # Update admin wallet
    admin = await db.users.find_one({'id': current_user['id']})
    if not admin:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    
    current_iqd = admin.get('wallet_balance_iqd', 0)
    current_usd = admin.get('wallet_balance_usd', 0)
    
    # Check if admin has enough USD
    if current_usd < operation.amount_usd:
        raise HTTPException(
            status_code=400,
            detail=f"رصيد الدولار غير كافٍ. الرصيد الحالي: {current_usd:,.2f}"
        )
    
    new_iqd = current_iqd + amount_iqd
    new_usd = current_usd - operation.amount_usd
    
    await db.users.update_one(
        {'id': current_user['id']},
        {
            '$set': {
                'wallet_balance_iqd': new_iqd,
                'wallet_balance_usd': new_usd,
                'updated_at': datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Create journal entry
    journal_entry = {
        'id': str(uuid.uuid4()),
        'entry_number': f"EX-SELL-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        'date': datetime.now(timezone.utc).isoformat(),
        'description': f"بيع دولار: {operation.amount_usd:,.2f} USD بسعر {operation.exchange_rate:,.2f}",
        'lines': [
            {'account_code': '1010', 'debit': amount_iqd, 'credit': 0},  # صندوق IQD
            {'account_code': '1020', 'debit': 0, 'credit': amount_iqd},  # صندوق USD
            {'account_code': '4010', 'debit': 0, 'credit': profit} if profit > 0 else {'account_code': '5010', 'debit': abs(profit), 'credit': 0}  # Profit/Loss
        ],
        'total_debit': amount_iqd + (abs(profit) if profit < 0 else 0),
        'total_credit': amount_iqd + (profit if profit > 0 else 0),
        'reference_type': 'exchange_sell',
        'reference_id': None,
        'created_by': current_user['id'],
        'created_at': datetime.now(timezone.utc).isoformat(),
        'is_cancelled': False
    }
    
    await db.journal_entries.insert_one(journal_entry)
    
    # Create exchange operation record
    exchange_op = {
        'id': str(uuid.uuid4()),
        'operation_type': 'sell',
        'amount_usd': operation.amount_usd,
        'amount_iqd': amount_iqd,
        'exchange_rate': operation.exchange_rate,
        'profit': profit,
        'admin_id': current_user['id'],
        'admin_name': current_user['display_name'],
        'journal_entry_id': journal_entry['id'],
        'notes': operation.notes,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.exchange_operations.insert_one(exchange_op)
    exchange_op.pop('_id', None)
    
    return exchange_op

@api_router.get("/exchange/operations")
async def get_exchange_operations(
    start_date: str = None,
    end_date: str = None,
    current_user: dict = Depends(require_admin)
):
    """
    Get all exchange operations (سجل عمليات الصرف)
    """
    query = {}
    
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query['$gte'] = start_date
        if end_date:
            date_query['$lte'] = end_date
        query['created_at'] = date_query
    
    operations = await db.exchange_operations.find(query).sort('created_at', -1).to_list(length=None)
    
    for op in operations:
        op.pop('_id', None)
    
    return {"operations": operations, "total": len(operations)}

@api_router.get("/exchange/profit-report")
async def get_exchange_profit_report(
    report_type: str = "daily",  # daily, monthly, yearly
    date: str = None,
    current_user: dict = Depends(require_admin)
):
    """
    Get exchange profit report (تقرير أرباح فرق الصرف)
    """
    from datetime import datetime as dt, timedelta
    
    if not date:
        date = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    
    # Build date range
    if report_type == "daily":
        start_date = dt.strptime(date, '%Y-%m-%d')
        end_date = start_date + timedelta(days=1)
    elif report_type == "monthly":
        start_date = dt.strptime(date + "-01", '%Y-%m-%d')
        next_month = start_date.month + 1 if start_date.month < 12 else 1
        next_year = start_date.year if start_date.month < 12 else start_date.year + 1
        end_date = dt(next_year, next_month, 1)
    elif report_type == "yearly":
        start_date = dt.strptime(date + "-01-01", '%Y-%m-%d')
        end_date = dt(start_date.year + 1, 1, 1)
    else:
        raise HTTPException(status_code=400, detail="Invalid report_type")
    
    start_iso = start_date.isoformat()
    end_iso = end_date.isoformat()
    
    # Get operations in date range
    operations = await db.exchange_operations.find({
        'created_at': {'$gte': start_iso, '$lt': end_iso}
    }).to_list(length=None)
    
    # Calculate totals
    buy_operations = [op for op in operations if op['operation_type'] == 'buy']
    sell_operations = [op for op in operations if op['operation_type'] == 'sell']
    
    total_buy_usd = sum(op.get('amount_usd', 0) for op in buy_operations)
    total_sell_usd = sum(op.get('amount_usd', 0) for op in sell_operations)
    total_profit = sum(op.get('profit', 0) for op in operations)
    
    for op in operations:
        op.pop('_id', None)
    
    return {
        "report_type": report_type,
        "date": date,
        "start_date": start_iso,
        "end_date": end_iso,
        "buy_operations": buy_operations,
        "sell_operations": sell_operations,
        "total_buy_usd": total_buy_usd,
        "total_sell_usd": total_sell_usd,
        "total_profit": total_profit,
        "operations_count": len(operations)
    }

# Mount Socket.IO
socket_app = socketio.ASGIApp(sio, app)

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()