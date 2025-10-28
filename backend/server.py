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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'secret')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get('ACCESS_TOKEN_EXPIRE_MINUTES', 60))

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

def generate_pin() -> str:
    """Generate 4-digit PIN"""
    return str(random.randint(1000, 9999))

def hash_pin(pin: str) -> str:
    """Hash PIN using bcrypt"""
    return bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()

def verify_pin(pin: str, pin_hash: str) -> bool:
    """Verify PIN against hash"""
    return bcrypt.checkpw(pin.encode(), pin_hash.encode())

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

class UserCreate(BaseModel):
    username: str
    password: str
    display_name: str
    governorate: str
    phone: str
    role: str = "agent"

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    username: str
    display_name: str
    role: str
    governorate: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool = True
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
    amount: float
    currency: str = "IQD"  # IQD or USD
    to_governorate: str
    to_agent_id: Optional[str] = None
    note: Optional[str] = None

class Transfer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    transfer_code: str
    seq_number: int
    from_agent_id: Optional[str] = None
    from_agent_name: Optional[str] = None
    to_governorate: str
    to_agent_id: Optional[str] = None
    to_agent_name: Optional[str] = None
    sender_name: str
    amount: float
    currency: str = "IQD"
    status: str
    note: Optional[str] = None
    created_at: str
    updated_at: str

class TransferWithPin(Transfer):
    pin: str  # Only shown once at creation

class TransferReceive(BaseModel):
    pin: str
    receiver_fullname: str

class DashboardStats(BaseModel):
    pending_incoming: int
    pending_outgoing: int
    completed_today: int
    total_amount_today: float

# ============ API Routes ============

@api_router.post("/register", response_model=User)
async def register_user(user_data: UserCreate, current_user: dict = Depends(require_admin)):
    """Register new agent (admin only)"""
    # Check if username exists
    existing = await db.users.find_one({'username': user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
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

@api_router.post("/transfers", response_model=TransferWithPin)
async def create_transfer(transfer_data: TransferCreate, current_user: dict = Depends(get_current_user)):
    """Create new transfer"""
    if current_user['role'] != 'agent':
        raise HTTPException(status_code=403, detail="Only agents can create transfers")
    
    # Generate transfer code and PIN
    transfer_code, seq_num = await generate_transfer_code(transfer_data.to_governorate)
    pin = generate_pin()
    pin_hash_str = hash_pin(pin)
    
    transfer_id = str(uuid.uuid4())
    
    # Get to_agent name if specified
    to_agent_name = None
    if transfer_data.to_agent_id:
        to_agent = await db.users.find_one({'id': transfer_data.to_agent_id})
        if to_agent:
            to_agent_name = to_agent['display_name']
    
    transfer_doc = {
        'id': transfer_id,
        'transfer_code': transfer_code,
        'seq_number': seq_num,
        'from_agent_id': current_user['id'],
        'from_agent_name': current_user['display_name'],
        'to_governorate': transfer_data.to_governorate,
        'to_agent_id': transfer_data.to_agent_id,
        'to_agent_name': to_agent_name,
        'sender_name': transfer_data.sender_name,
        'amount': transfer_data.amount,
        'pin_hash': pin_hash_str,
        'status': 'pending',
        'note': transfer_data.note,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.transfers.insert_one(transfer_doc)
    await log_audit(transfer_id, current_user['id'], 'transfer_created', {'transfer_code': transfer_code})
    
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
    
    # Check rate limit for PIN attempts
    rate_limit_key = f"{transfer_id}_{current_user['id']}"
    if not check_rate_limit(rate_limit_key, pin_attempts_cache, MAX_PIN_ATTEMPTS, LOCKOUT_DURATION):
        raise HTTPException(status_code=429, detail="Too many PIN attempts. Try again later.")
    
    # Verify PIN
    if not verify_pin(pin, transfer['pin_hash']):
        # Log failed attempt
        await db.pin_attempts.insert_one({
            'id': str(uuid.uuid4()),
            'transfer_id': transfer_id,
            'attempted_by_agent': current_user['id'],
            'attempt_ip': request.client.host if request else None,
            'success': False,
            'created_at': datetime.now(timezone.utc).isoformat()
        })
        await log_audit(transfer_id, current_user['id'], 'pin_failed', {'ip': request.client.host if request else None})
        raise HTTPException(status_code=401, detail="Invalid PIN")
    
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
    
    return {
        'pending_incoming': pending_incoming,
        'pending_outgoing': pending_outgoing,
        'completed_today': completed_today,
        'total_amount_today': total_amount
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

@api_router.patch("/users/{user_id}/status")
async def update_user_status(user_id: str, is_active: bool, current_user: dict = Depends(require_admin)):
    """Activate/suspend user (admin only)"""
    result = await db.users.update_one(
        {'id': user_id},
        {'$set': {'is_active': is_active}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    await log_audit(None, current_user['id'], 'user_status_changed', {'target_user_id': user_id, 'is_active': is_active})
    
    return {'success': True}

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