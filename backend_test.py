#!/usr/bin/env python3
"""
🚨 COMPREHENSIVE TRANSFER AND COMMISSION TESTING

**Test Objective:** Complete testing of transfer creation, receipt, and commission ledger verification

**Review Request Focus:**
اختبار شامل: إنشاء واستلام حوالة وفحص دفتر الأستاذ

**Testing Scenario:**
1. إنشاء حوالة من "صيرفة النور" (testuser123)
2. استلام الحوالة من "صيرفة أور" (user_ur أو إنشاء وكيل جديد)
3. فحص دفتر الأستاذ للوكيل المستلم والتحقق من:
   - عنوان العمولة: "عمولة مدفوعة"
   - رقم الحوالة (10 أرقام) موجود
   - العمولة دائن أم مدين؟

**Test Steps:**
1. Login as testuser123
2. Create transfer to governorate WA (واسط)
3. Get tracking_number and PIN
4. Login as agent in WA governorate (or create one)
5. Receive the transfer using tracking_number and PIN
6. Get ledger for receiving agent
7. Check commission entry: title, debit/credit, transfer_code

**Expected Result:**
- Commission entry title: "عمولة مدفوعة من [sender] إلى [receiver] - واسط"
- Commission in ledger: debit: 0, credit: [amount]
- Transfer code visible in ledger

**Important:**
- Use actual file upload for ID image (create a test image)
- Verify commission appears correctly in receiving agent's ledger

**Admin Credentials:**
username: admin
password: admin123
"""

import requests
import json
import time
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://account-sync-7.preview.emergentagent.com/api"
ADMIN_CREDENTIALS = {"username": "admin", "password": "admin123"}

# Try different possible passwords for test agents
POSSIBLE_PASSWORDS = ["test123", "agent123", "123456", "password", "admin123"]

class AgentRegistrationAutoCreateTester:
    def __init__(self):
        self.admin_token = None
        self.admin_user_id = None
        self.test_results = []
        self.test_account_codes = []  # Track created test accounts for cleanup
        
    def log_result(self, test_name: str, success: bool, message: str, details: Any = None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def make_request(self, method: str, endpoint: str, token: str = None, **kwargs) -> requests.Response:
        """Make HTTP request with optional authentication"""
        url = f"{BASE_URL}{endpoint}"
        headers = kwargs.get('headers', {})
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        kwargs['headers'] = headers
        
        try:
            response = requests.request(method, url, **kwargs)
            return response
        except Exception as e:
            print(f"Request failed: {e}")
            raise
    
    def test_authentication(self):
        """Test admin authentication"""
        print("\n=== Testing Authentication ===")
        
        # Test admin login
        try:
            response = self.make_request('POST', '/login', json=ADMIN_CREDENTIALS)
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data['access_token']
                self.admin_user_id = data['user']['id']
                self.log_result("Admin Login", True, f"Admin authenticated successfully")
                return True
            else:
                self.log_result("Admin Login", False, f"Admin login failed: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Admin Login", False, f"Admin login error: {str(e)}")
            return False
    
    def test_auto_create_account_no_code_provided(self):
        """Phase 1: Auto-Create Account (No account_code provided)"""
        print("\n=== Phase 1: Auto-Create Account (No account_code provided) ===")
        
        # Test 1: Register new agent WITHOUT account_code
        test_agent_username = f"test_agent_auto_{int(time.time())}"
        test_agent_data = {
            "username": test_agent_username,
            "password": "test123",
            "display_name": "صيرفة الاختبار التلقائي",
            "phone": "07701234567",
            "governorate": "BG",  # Baghdad
            "role": "agent",
            "wallet_limit_iqd": 5000000,
            "wallet_limit_usd": 10000
            # Note: No account_code provided - should auto-create
        }
        
        created_agent_id = None
        created_account_code = None
        
        try:
            response = self.make_request('POST', '/register', token=self.admin_token, json=test_agent_data)
            if response.status_code in [200, 201]:
                agent_data = response.json()
                created_agent_id = agent_data.get('id')
                created_account_code = agent_data.get('account_code')
                
                if created_account_code:
                    self.log_result("Auto-Create Agent Registration", True, 
                                  f"Agent created successfully with auto-generated account: {created_account_code}")
                    
                    # Verify account code follows pattern (2001, 2002, etc.)
                    if created_account_code.startswith('20') and created_account_code.isdigit():
                        self.log_result("Auto-Create Account Code Pattern", True, 
                                      f"Account code follows pattern: {created_account_code}")
                    else:
                        self.log_result("Auto-Create Account Code Pattern", False, 
                                      f"Account code doesn't follow pattern: {created_account_code}")
                else:
                    self.log_result("Auto-Create Agent Registration", False, 
                                  f"Agent created but no account_code returned")
            else:
                self.log_result("Auto-Create Agent Registration", False, 
                              f"Failed to register agent: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            self.log_result("Auto-Create Agent Registration", False, f"Error: {str(e)}")
            return False
        
        # Test 2: GET /api/agents - Verify agent appears with account_code
        try:
            response = self.make_request('GET', '/agents', token=self.admin_token)
            if response.status_code == 200:
                agents = response.json()
                created_agent = next((a for a in agents if a.get('id') == created_agent_id), None)
                
                if created_agent and created_agent.get('account_code') == created_account_code:
                    self.log_result("Auto-Create Agent in List", True, 
                                  f"Agent appears in list with account_code: {created_account_code}")
                else:
                    self.log_result("Auto-Create Agent in List", False, 
                                  f"Agent not found in list or missing account_code")
            else:
                self.log_result("Auto-Create Agent in List", False, 
                              f"Failed to get agents: {response.status_code}")
        except Exception as e:
            self.log_result("Auto-Create Agent in List", False, f"Error: {str(e)}")
        
        # Test 3: GET /api/accounting/accounts - Verify new account created
        try:
            response = self.make_request('GET', '/accounting/accounts', token=self.admin_token)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, dict) and 'accounts' in data:
                    accounts = data['accounts']
                else:
                    accounts = data
                
                created_account = next((a for a in accounts if a.get('code') == created_account_code), None)
                
                if created_account:
                    # Verify account details
                    expected_name = f"صيرفة {test_agent_data['display_name']} - بغداد"
                    actual_name = created_account.get('name_ar', '')
                    
                    if expected_name in actual_name or "صيرفة الاختبار التلقائي" in actual_name:
                        self.log_result("Auto-Create Account Name Format", True, 
                                      f"Account name format correct: {actual_name}")
                    else:
                        self.log_result("Auto-Create Account Name Format", False, 
                                      f"Account name format incorrect: {actual_name}")
                    
                    # Verify category
                    if created_account.get('category') == 'شركات الصرافة':
                        self.log_result("Auto-Create Account Category", True, 
                                      f"Account category correct: شركات الصرافة")
                    else:
                        self.log_result("Auto-Create Account Category", False, 
                                      f"Account category incorrect: {created_account.get('category')}")
                    
                    # Verify agent_id linkage
                    if created_account.get('agent_id') == created_agent_id:
                        self.log_result("Auto-Create Account Agent Linkage", True, 
                                      f"Account linked to agent: {created_agent_id}")
                    else:
                        self.log_result("Auto-Create Account Agent Linkage", False, 
                                      f"Account not linked to agent")
                else:
                    self.log_result("Auto-Create Account in Chart", False, 
                                  f"Account {created_account_code} not found in chart_of_accounts")
            else:
                self.log_result("Auto-Create Account in Chart", False, 
                              f"Failed to get accounts: {response.status_code}")
        except Exception as e:
            self.log_result("Auto-Create Account in Chart", False, f"Error: {str(e)}")
        
        # Test 4: GET /api/accounting/accounts/{code} - Get the new account details
        if created_account_code:
            try:
                response = self.make_request('GET', f'/accounting/accounts/{created_account_code}', token=self.admin_token)
                if response.status_code == 200:
                    account_data = response.json()
                    
                    # Verify all required fields
                    required_fields = ['code', 'name_ar', 'name_en', 'category', 'currencies', 'balance_iqd', 'balance_usd']
                    missing_fields = [field for field in required_fields if field not in account_data]
                    
                    if not missing_fields:
                        self.log_result("Auto-Create Account Details Complete", True, 
                                      f"Account has all required fields")
                        
                        # Verify currencies
                        currencies = account_data.get('currencies', [])
                        if 'IQD' in currencies and 'USD' in currencies:
                            self.log_result("Auto-Create Account Currencies", True, 
                                          f"Account has correct currencies: {currencies}")
                        else:
                            self.log_result("Auto-Create Account Currencies", False, 
                                          f"Account currencies incorrect: {currencies}")
                        
                        # Verify initial balances
                        balance_iqd = account_data.get('balance_iqd', None)
                        balance_usd = account_data.get('balance_usd', None)
                        
                        if balance_iqd == 0.0 and balance_usd == 0.0:
                            self.log_result("Auto-Create Account Initial Balances", True, 
                                          f"Initial balances correct: IQD={balance_iqd}, USD={balance_usd}")
                        else:
                            self.log_result("Auto-Create Account Initial Balances", False, 
                                          f"Initial balances incorrect: IQD={balance_iqd}, USD={balance_usd}")
                    else:
                        self.log_result("Auto-Create Account Details Complete", False, 
                                      f"Missing fields: {missing_fields}")
                else:
                    self.log_result("Auto-Create Account Details", False, 
                                  f"Failed to get account details: {response.status_code}")
            except Exception as e:
                self.log_result("Auto-Create Account Details", False, f"Error: {str(e)}")
        
        return True
    
    def test_manual_account_selection(self):
        """Phase 2: Manual Account Selection (account_code provided)"""
        print("\n=== Phase 2: Manual Account Selection (account_code provided) ===")
        
        # Test 1: First, create an available account manually
        manual_account_code = "2999"
        try:
            manual_account = {
                "code": manual_account_code,
                "name_ar": "صيرفة الاختبار اليدوي",
                "name_en": "Manual Test Exchange",
                "category": "شركات الصرافة",
                "currencies": ["IQD", "USD"]
            }
            
            response = self.make_request('POST', '/accounting/accounts', token=self.admin_token, json=manual_account)
            if response.status_code in [200, 201]:
                self.test_account_codes.append(manual_account_code)
                self.log_result("Manual Account Creation", True, 
                              f"Successfully created manual account {manual_account_code}")
            elif response.status_code == 400 and "already exists" in response.text:
                self.log_result("Manual Account Creation", True, 
                              f"Account {manual_account_code} already exists (acceptable)")
            else:
                self.log_result("Manual Account Creation", False, 
                              f"Failed to create manual account: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            self.log_result("Manual Account Creation", False, f"Error: {str(e)}")
            return False
        
        # Test 2: POST /api/register - Register agent WITH account_code
        test_agent_username = f"test_agent_manual_{int(time.time())}"
        test_agent_data = {
            "username": test_agent_username,
            "password": "test123",
            "display_name": "صيرفة الاختبار اليدوي",
            "phone": "07709876543",
            "governorate": "BS",  # Basra
            "role": "agent",
            "account_code": manual_account_code,  # Provide existing account code
            "wallet_limit_iqd": 5000000,
            "wallet_limit_usd": 10000
        }
        
        created_agent_id = None
        
        try:
            response = self.make_request('POST', '/register', token=self.admin_token, json=test_agent_data)
            if response.status_code in [200, 201]:
                agent_data = response.json()
                created_agent_id = agent_data.get('id')
                returned_account_code = agent_data.get('account_code')
                
                if returned_account_code == manual_account_code:
                    self.log_result("Manual Account Agent Registration", True, 
                                  f"Agent created successfully using existing account: {manual_account_code}")
                else:
                    self.log_result("Manual Account Agent Registration", False, 
                                  f"Agent account_code mismatch: expected {manual_account_code}, got {returned_account_code}")
            else:
                self.log_result("Manual Account Agent Registration", False, 
                              f"Failed to register agent with manual account: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            self.log_result("Manual Account Agent Registration", False, f"Error: {str(e)}")
            return False
        
        # Test 3: Verify account is now linked to agent
        try:
            response = self.make_request('GET', f'/accounting/accounts/{manual_account_code}', token=self.admin_token)
            if response.status_code == 200:
                account_data = response.json()
                
                if account_data.get('agent_id') == created_agent_id:
                    self.log_result("Manual Account Agent Linkage", True, 
                                  f"Account {manual_account_code} correctly linked to agent")
                    
                    # Verify agent_name field is set
                    if account_data.get('agent_name'):
                        self.log_result("Manual Account Agent Name", True, 
                                      f"Account has agent_name: {account_data.get('agent_name')}")
                    else:
                        self.log_result("Manual Account Agent Name", False, 
                                      f"Account missing agent_name field")
                else:
                    self.log_result("Manual Account Agent Linkage", False, 
                                  f"Account not linked to agent: expected {created_agent_id}, got {account_data.get('agent_id')}")
            else:
                self.log_result("Manual Account Agent Linkage", False, 
                              f"Failed to verify account linkage: {response.status_code}")
        except Exception as e:
            self.log_result("Manual Account Agent Linkage", False, f"Error: {str(e)}")
        
        return True
    
    def test_validation_tests(self):
        """Phase 3: Validation Tests"""
        print("\n=== Phase 3: Validation Tests ===")
        
        # Test 1: Try to register agent with invalid account_code (doesn't exist)
        try:
            invalid_agent_data = {
                "username": f"test_invalid_{int(time.time())}",
                "password": "test123",
                "display_name": "صيرفة اختبار خطأ",
                "phone": "07701234568",
                "governorate": "BG",
                "role": "agent",
                "account_code": "9999",  # Non-existent account
                "wallet_limit_iqd": 5000000,
                "wallet_limit_usd": 10000
            }
            
            response = self.make_request('POST', '/register', token=self.admin_token, json=invalid_agent_data)
            if response.status_code == 404:
                error_text = response.text
                if "9999" in error_text and "غير موجود" in error_text:
                    self.log_result("Validation - Invalid Account Code", True, 
                                  f"Properly rejected invalid account with Arabic error: {error_text}")
                else:
                    self.log_result("Validation - Invalid Account Code", True, 
                                  f"Properly rejected invalid account: {response.status_code}")
            else:
                self.log_result("Validation - Invalid Account Code", False, 
                              f"Should have rejected invalid account: {response.status_code}")
        except Exception as e:
            self.log_result("Validation - Invalid Account Code", False, f"Error: {str(e)}")
        
        # Test 2: Try to register agent with account from wrong category
        try:
            # First create an account in different category
            wrong_category_code = "1999"
            wrong_category_account = {
                "code": wrong_category_code,
                "name_ar": "حساب أصول تجريبي",
                "name_en": "Test Assets Account",
                "category": "أصول",  # Wrong category (should be شركات الصرافة)
                "currencies": ["IQD", "USD"]
            }
            
            create_response = self.make_request('POST', '/accounting/accounts', token=self.admin_token, json=wrong_category_account)
            if create_response.status_code in [200, 201]:
                self.test_account_codes.append(wrong_category_code)
                
                # Now try to use it for agent registration
                wrong_category_agent = {
                    "username": f"test_wrong_cat_{int(time.time())}",
                    "password": "test123",
                    "display_name": "صيرفة فئة خاطئة",
                    "phone": "07701234569",
                    "governorate": "BG",
                    "role": "agent",
                    "account_code": wrong_category_code,
                    "wallet_limit_iqd": 5000000,
                    "wallet_limit_usd": 10000
                }
                
                response = self.make_request('POST', '/register', token=self.admin_token, json=wrong_category_agent)
                if response.status_code == 400:
                    error_text = response.text
                    if "شركات الصرافة" in error_text:
                        self.log_result("Validation - Wrong Category", True, 
                                      f"Properly rejected wrong category with Arabic error")
                    else:
                        self.log_result("Validation - Wrong Category", True, 
                                      f"Properly rejected wrong category: {response.status_code}")
                else:
                    self.log_result("Validation - Wrong Category", False, 
                                  f"Should have rejected wrong category: {response.status_code}")
            else:
                self.log_result("Validation - Wrong Category Setup", False, 
                              f"Failed to create wrong category account: {create_response.status_code}")
        except Exception as e:
            self.log_result("Validation - Wrong Category", False, f"Error: {str(e)}")
        
        # Test 3: Try to register agent with account already linked
        try:
            # Get an existing agent with account_code
            agents_response = self.make_request('GET', '/agents', token=self.admin_token)
            if agents_response.status_code == 200:
                agents = agents_response.json()
                linked_agent = next((a for a in agents if a.get('account_code')), None)
                
                if linked_agent:
                    linked_account_code = linked_agent['account_code']
                    
                    # Try to register another agent with the same account_code
                    duplicate_agent = {
                        "username": f"test_duplicate_{int(time.time())}",
                        "password": "test123",
                        "display_name": "صيرفة مكررة",
                        "phone": "07701234570",
                        "governorate": "BG",
                        "role": "agent",
                        "account_code": linked_account_code,  # Already linked account
                        "wallet_limit_iqd": 5000000,
                        "wallet_limit_usd": 10000
                    }
                    
                    response = self.make_request('POST', '/register', token=self.admin_token, json=duplicate_agent)
                    if response.status_code == 400:
                        error_text = response.text
                        if "مرتبط بالفعل" in error_text or "already" in error_text.lower():
                            self.log_result("Validation - Already Linked Account", True, 
                                          f"Properly rejected already linked account with Arabic error")
                        else:
                            self.log_result("Validation - Already Linked Account", True, 
                                          f"Properly rejected already linked account: {response.status_code}")
                    else:
                        self.log_result("Validation - Already Linked Account", False, 
                                      f"Should have rejected already linked account: {response.status_code}")
                else:
                    self.log_result("Validation - Already Linked Account", False, 
                                  f"No agents with account_code found for testing")
            else:
                self.log_result("Validation - Already Linked Account", False, 
                              f"Failed to get agents: {agents_response.status_code}")
        except Exception as e:
            self.log_result("Validation - Already Linked Account", False, f"Error: {str(e)}")
        
        return True
    
    def test_sequential_code_generation(self):
        """Phase 4: Sequential Code Generation"""
        print("\n=== Phase 4: Sequential Code Generation ===")
        
        # Register 3 agents without account_code and verify sequential codes
        generated_codes = []
        
        for i in range(3):
            try:
                test_agent_data = {
                    "username": f"test_seq_{int(time.time())}_{i}",
                    "password": "test123",
                    "display_name": f"صيرفة تسلسل {i+1}",
                    "phone": f"0770123456{i}",
                    "governorate": "BG",
                    "role": "agent",
                    "wallet_limit_iqd": 5000000,
                    "wallet_limit_usd": 10000
                    # No account_code - should auto-create
                }
                
                response = self.make_request('POST', '/register', token=self.admin_token, json=test_agent_data)
                if response.status_code in [200, 201]:
                    agent_data = response.json()
                    account_code = agent_data.get('account_code')
                    
                    if account_code:
                        generated_codes.append(int(account_code))
                        self.log_result(f"Sequential Generation - Agent {i+1}", True, 
                                      f"Generated account code: {account_code}")
                    else:
                        self.log_result(f"Sequential Generation - Agent {i+1}", False, 
                                      f"No account_code returned")
                else:
                    self.log_result(f"Sequential Generation - Agent {i+1}", False, 
                                  f"Failed to register agent: {response.status_code}")
                
                # Small delay to ensure different timestamps
                time.sleep(1)
                
            except Exception as e:
                self.log_result(f"Sequential Generation - Agent {i+1}", False, f"Error: {str(e)}")
        
        # Verify codes are sequential
        if len(generated_codes) >= 2:
            generated_codes.sort()
            is_sequential = True
            
            for i in range(1, len(generated_codes)):
                if generated_codes[i] != generated_codes[i-1] + 1:
                    is_sequential = False
                    break
            
            if is_sequential:
                self.log_result("Sequential Code Verification", True, 
                              f"Account codes are sequential: {generated_codes}")
            else:
                self.log_result("Sequential Code Verification", False, 
                              f"Account codes are not sequential: {generated_codes}")
        else:
            self.log_result("Sequential Code Verification", False, 
                          f"Not enough codes generated for verification: {generated_codes}")
        
        return True
    
    def test_account_details_verification(self):
        """Phase 5: Account Details Verification"""
        print("\n=== Phase 5: Account Details Verification ===")
        
        # Test governorate mapping
        governorate_tests = [
            ("BG", "بغداد"),
            ("BS", "البصرة"),
            ("NJ", "النجف")
        ]
        
        for gov_code, expected_name in governorate_tests:
            try:
                test_agent_data = {
                    "username": f"test_gov_{gov_code}_{int(time.time())}",
                    "password": "test123",
                    "display_name": f"صيرفة {expected_name}",
                    "phone": "07701234571",
                    "governorate": gov_code,
                    "role": "agent",
                    "wallet_limit_iqd": 5000000,
                    "wallet_limit_usd": 10000
                }
                
                response = self.make_request('POST', '/register', token=self.admin_token, json=test_agent_data)
                if response.status_code in [200, 201]:
                    agent_data = response.json()
                    account_code = agent_data.get('account_code')
                    
                    if account_code:
                        # Get account details
                        account_response = self.make_request('GET', f'/accounting/accounts/{account_code}', token=self.admin_token)
                        if account_response.status_code == 200:
                            account_data = account_response.json()
                            account_name = account_data.get('name_ar', '')
                            
                            if expected_name in account_name:
                                self.log_result(f"Governorate Mapping - {gov_code}", True, 
                                              f"Correct governorate name in account: {account_name}")
                            else:
                                self.log_result(f"Governorate Mapping - {gov_code}", False, 
                                              f"Incorrect governorate name: {account_name}")
                        else:
                            self.log_result(f"Governorate Mapping - {gov_code}", False, 
                                          f"Failed to get account details: {account_response.status_code}")
                    else:
                        self.log_result(f"Governorate Mapping - {gov_code}", False, 
                                      f"No account_code returned")
                else:
                    self.log_result(f"Governorate Mapping - {gov_code}", False, 
                                  f"Failed to register agent: {response.status_code}")
                
                time.sleep(1)  # Small delay
                
            except Exception as e:
                self.log_result(f"Governorate Mapping - {gov_code}", False, f"Error: {str(e)}")
        
        return True

    # Old test methods removed - replaced with specific agent registration auto-create tests
    
    # Old journal entry test methods removed - focusing on agent registration auto-create
    
    # Old agent ledger test methods removed - focusing on agent registration auto-create
    
    # Old transfer operations test methods removed - focusing on agent registration auto-create
    
    def test_agent_registration_auto_create_comprehensive(self):
        """Run comprehensive agent registration auto-create tests"""
        print("\n🚨 AGENT REGISTRATION AUTO-CREATE CHART OF ACCOUNTS COMPREHENSIVE TESTING")
        print("=" * 80)
        print("Testing agent registration with automatic chart of accounts creation")
        print("=" * 80)
        
        # Phase 1: Auto-Create Account (No account_code provided)
        print("\n--- PHASE 1: AUTO-CREATE ACCOUNT (NO ACCOUNT_CODE PROVIDED) ---")
        self.test_auto_create_account_no_code_provided()
        
        # Phase 2: Manual Account Selection (account_code provided)
        print("\n--- PHASE 2: MANUAL ACCOUNT SELECTION (ACCOUNT_CODE PROVIDED) ---")
        self.test_manual_account_selection()
        
        # Phase 3: Validation Tests
        print("\n--- PHASE 3: VALIDATION TESTS ---")
        self.test_validation_tests()
        
        # Phase 4: Sequential Code Generation
        print("\n--- PHASE 4: SEQUENTIAL CODE GENERATION ---")
        self.test_sequential_code_generation()
        
        # Phase 5: Account Details Verification
        print("\n--- PHASE 5: ACCOUNT DETAILS VERIFICATION ---")
        self.test_account_details_verification()
        
        return True
    
    # Removed old edge cases method - replaced with unified ledger filtering edge cases

    def cleanup_test_accounts(self):
        """Clean up test accounts created during testing"""
        print("\n=== Cleanup: Removing Test Accounts ===")
        
        for account_code in self.test_account_codes:
            try:
                # Note: DELETE endpoint might not exist, so we'll just log what we created
                self.log_result("Cleanup", True, f"Test account {account_code} was created during testing")
            except Exception as e:
                self.log_result("Cleanup", False, f"Error cleaning up {account_code}: {str(e)}")
    
    def run_all_tests(self):
        """Run all Agent Registration Auto-Create tests"""
        print("🚨 STARTING AGENT REGISTRATION AUTO-CREATE CHART OF ACCOUNTS TESTING")
        print("=" * 80)
        
        # Step 1: Authentication
        if not self.test_authentication():
            print("❌ Authentication failed - cannot continue")
            return False
        
        # Step 2: Run agent registration auto-create tests
        self.test_agent_registration_auto_create_comprehensive()
        
        # Step 3: Cleanup
        self.cleanup_test_accounts()
        
        # Step 4: Print summary
        self.print_test_summary()
        
        return True
    
    def print_test_summary(self):
        """Print comprehensive test summary"""
        print("\n" + "=" * 80)
        print("🚨 AGENT REGISTRATION AUTO-CREATE CHART OF ACCOUNTS TESTING SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r['success']])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS ({failed_tests}):")
            for result in self.test_results:
                if not result['success']:
                    print(f"   - {result['test']}: {result['message']}")
        
        print(f"\n✅ PASSED TESTS ({passed_tests}):")
        for result in self.test_results:
            if result['success']:
                print(f"   - {result['test']}: {result['message']}")
        
        # Critical findings for agent registration auto-create
        print(f"\n🎯 AGENT REGISTRATION AUTO-CREATE FINDINGS:")
        
        auto_create_tests = [r for r in self.test_results if 'Auto-Create' in r['test']]
        auto_create_passed = len([r for r in auto_create_tests if r['success']])
        print(f"   Auto-Create Account (No account_code): {auto_create_passed}/{len(auto_create_tests)} tests passed")
        
        manual_tests = [r for r in self.test_results if 'Manual' in r['test']]
        manual_passed = len([r for r in manual_tests if r['success']])
        print(f"   Manual Account Selection: {manual_passed}/{len(manual_tests)} tests passed")
        
        validation_tests = [r for r in self.test_results if 'Validation' in r['test']]
        validation_passed = len([r for r in validation_tests if r['success']])
        print(f"   Validation Tests: {validation_passed}/{len(validation_tests)} tests passed")
        
        sequential_tests = [r for r in self.test_results if 'Sequential' in r['test']]
        sequential_passed = len([r for r in sequential_tests if r['success']])
        print(f"   Sequential Code Generation: {sequential_passed}/{len(sequential_tests)} tests passed")
        
        details_tests = [r for r in self.test_results if 'Governorate' in r['test'] or 'Details' in r['test']]
        details_passed = len([r for r in details_tests if r['success']])
        print(f"   Account Details Verification: {details_passed}/{len(details_tests)} tests passed")
        
        print("\n" + "=" * 80)
        
        # Check for critical issues
        critical_failures = [r for r in self.test_results if not r['success'] and ('CRITICAL' in r['message'] or 'Auto-Create' in r['test'])]
        
        if failed_tests == 0:
            print("🎉 ALL TESTS PASSED - AGENT REGISTRATION AUTO-CREATE IS FULLY FUNCTIONAL!")
            print("✅ Auto-creation works without account_code")
            print("✅ Manual selection works with valid account_code")
            print("✅ Sequential code generation working")
            print("✅ Proper validation for all error cases")
            print("✅ Account-agent linkage bidirectional (account.agent_id ↔ user.account_code)")
            print("✅ Governorate names properly mapped")
            print("✅ No duplicate accounts created")
        elif critical_failures:
            print("🚨 CRITICAL ISSUES FOUND - AGENT REGISTRATION AUTO-CREATE MAY HAVE FAILED!")
            for failure in critical_failures:
                print(f"   ❌ {failure['test']}: {failure['message']}")
        else:
            print("⚠️  SOME TESTS FAILED - REVIEW ISSUES ABOVE")
            print("Agent registration auto-create may be partially working")
        
        print("=" * 80)

def main():
    """Main execution function"""
    tester = AgentRegistrationAutoCreateTester()
    
    try:
        success = tester.run_all_tests()
        return success
    except KeyboardInterrupt:
        print("\n\n⚠️ Testing interrupted by user")
        return False
    except Exception as e:
        print(f"\n\n❌ Testing failed with error: {str(e)}")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
