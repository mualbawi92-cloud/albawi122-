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
    percentage: float  # نسبة من المبلغ
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
    commission: float = 0.0  # Admin commission
    commission_percentage: float = 0.13
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
    
    # Calculate commission (0.13%)
    commission_percentage = 0.13
    commission = (transfer_data.amount * commission_percentage) / 100
    
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
    
    # Update sender's wallet (decrease balance)
    wallet_field = f'wallet_balance_{transfer_data.currency.lower()}'
    await db.users.update_one(
        {'id': current_user['id']},
        {'$inc': {wallet_field: -transfer_data.amount}}
    )
    
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
    
    # Return money to sender's wallet
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
    
    # Handle amount change (need to update wallet)
    if update_data.amount is not None and update_data.amount != transfer['amount']:
        amount_diff = update_data.amount - transfer['amount']
        wallet_field = f'wallet_balance_{transfer["currency"].lower()}'
        
        # Decrease or increase wallet balance
        await db.users.update_one(
            {'id': current_user['id']},
            {'$inc': {wallet_field: -amount_diff}}
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
    
    # Verify receiver full name matches the one registered in the transfer
    expected_receiver_name = transfer.get('receiver_name', '')
    
    # If no receiver_name in old transfers, skip name validation
    if expected_receiver_name and receiver_fullname.strip() != expected_receiver_name.strip():
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
            'attempted_name': receiver_fullname
        })
        raise HTTPException(status_code=400, detail="الاسم الثلاثي غير صحيح")
    
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
    await db.transfers.update_one(
        {'id': transfer_id},
        {'$set': {
            'status': 'completed',
            'to_agent_id': current_user['id'],
            'to_agent_name': current_user['display_name'],
            'updated_at': datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update receiver's wallet (increase balance)
    wallet_field = f'wallet_balance_{transfer["currency"].lower()}'
    await db.users.update_one(
        {'id': current_user['id']},
        {'$inc': {wallet_field: transfer['amount']}}
    )
    
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