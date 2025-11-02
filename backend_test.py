#!/usr/bin/env python3
"""
🚨 COMPREHENSIVE CHART OF ACCOUNTS & LEDGER TESTING

**Test Focus:** Chart of Accounts and Ledger endpoints after collection migration fix

**Critical Fixes to Test:**

1. **Chart of Accounts Endpoints (HIGH PRIORITY):**
   - POST /api/accounting/accounts - Create new account
   - GET /api/accounting/accounts - List all accounts
   - GET /api/accounting/accounts/{account_code} - Get specific account
   - Verify all use `chart_of_accounts` collection

2. **Ledger Endpoint (HIGH PRIORITY):**
   - GET /api/accounting/ledger/{account_code}
   - Must successfully load ledger for any account from COA
   - Should handle accounts with no entries gracefully

3. **Agent Registration with Auto-COA (MEDIUM PRIORITY):**
   - POST /api/register - Create new agent
   - Verify account auto-created in chart_of_accounts
   - Check account code follows pattern: 2001, 2002, 2003...
   - Verify account includes governorate in name

4. **Accounting Reports (MEDIUM PRIORITY):**
   - GET /api/accounting/reports/trial-balance
   - GET /api/accounting/reports/income-statement
   - GET /api/accounting/reports/balance-sheet
   - All must use chart_of_accounts collection

**Test Scenarios:**

**Scenario 1: Create Account**
- POST /api/accounting/accounts
- Body: {code: "2010", name: "Test Account", name_ar: "حساب تجريبي", name_en: "Test Account", category: "شركات الصرافة", type: "شركات الصرافة"}
- Expected: 200/201, account created in chart_of_accounts

**Scenario 2: Get All Accounts**
- GET /api/accounting/accounts
- Expected: 200, returns accounts array from chart_of_accounts

**Scenario 3: Get Ledger (Should Work Now)**
- First get an account code from /api/accounting/accounts
- Then GET /api/accounting/ledger/{that_code}
- Expected: 200, returns ledger data (even if empty entries)
- Should NOT return 404 "الحساب غير موجود"

**Scenario 4: Create Agent**
- POST /api/register
- Body: Include all agent fields (username, password, display_name, governorate, phone, role="agent")
- Expected: Agent created AND account auto-created in chart_of_accounts
- Verify: GET /api/accounting/accounts returns the new agent account

**Admin Credentials:**
username: admin
password: admin123

**Success Criteria:**
- ✅ No 404 errors for existing accounts
- ✅ Ledger loads for any COA account
- ✅ New accounts appear in GET /api/accounting/accounts
- ✅ Agent registration creates COA account
- ✅ All reports return data from chart_of_accounts
"""

import requests
import json
import time
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://transferhub-11.preview.emergentagent.com/api"
ADMIN_CREDENTIALS = {"username": "admin", "password": "admin123"}

# Try different possible passwords for test agents
POSSIBLE_PASSWORDS = ["test123", "agent123", "123456", "password", "admin123"]

class ChartOfAccountsTester:
    def __init__(self):
        self.admin_token = None
        self.agent_baghdad_token = None
        self.agent_basra_token = None
        self.admin_user_id = None
        self.agent_baghdad_user_id = None
        self.agent_basra_user_id = None
        self.test_results = []
        
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
        """Test admin and agent authentication, create agents if needed"""
        print("\n=== Testing Authentication ===")
        
        # Test admin login
        try:
            response = self.make_request('POST', '/login', json=ADMIN_CREDENTIALS)
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data['access_token']
                self.admin_user_id = data['user']['id']
                self.log_result("Admin Login", True, f"Admin authenticated successfully")
            else:
                self.log_result("Admin Login", False, f"Admin login failed: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Admin Login", False, f"Admin login error: {str(e)}")
            return False
        
        # Try to login as agent_baghdad with different passwords
        agent_baghdad_authenticated = False
        for password in POSSIBLE_PASSWORDS:
            try:
                credentials = {"username": "agent_baghdad", "password": password}
                response = self.make_request('POST', '/login', json=credentials)
                if response.status_code == 200:
                    data = response.json()
                    self.agent_baghdad_token = data['access_token']
                    self.agent_baghdad_user_id = data['user']['id']
                    self.log_result("Agent Baghdad Login", True, f"Agent Baghdad authenticated with password: {password}")
                    agent_baghdad_authenticated = True
                    break
            except Exception as e:
                continue
        
        if not agent_baghdad_authenticated:
            self.log_result("Agent Baghdad Login", False, "Could not authenticate with any common password")
            return False
        
        # Try to login as agent_basra with different passwords
        agent_basra_authenticated = False
        for password in POSSIBLE_PASSWORDS:
            try:
                credentials = {"username": "agent_basra", "password": password}
                response = self.make_request('POST', '/login', json=credentials)
                if response.status_code == 200:
                    data = response.json()
                    self.agent_basra_token = data['access_token']
                    self.agent_basra_user_id = data['user']['id']
                    self.log_result("Agent Basra Login", True, f"Agent Basra authenticated with password: {password}")
                    agent_basra_authenticated = True
                    break
            except Exception as e:
                continue
        
        if not agent_basra_authenticated:
            self.log_result("Agent Basra Login", False, "Could not authenticate with any common password")
            return False
        
        return True
    
    def test_wallet_balance_endpoint(self):
        """Test GET /api/wallet/balance"""
        print("\n=== Testing Wallet Balance Endpoint ===")
        
        try:
            response = self.make_request('GET', '/wallet/balance', token=self.agent_baghdad_token)
            if response.status_code == 200:
                data = response.json()
                if 'wallet_balance_iqd' in data and 'wallet_balance_usd' in data:
                    self.log_result("Wallet Balance Endpoint", True, 
                                  f"Balance retrieved: IQD={data['wallet_balance_iqd']}, USD={data['wallet_balance_usd']}")
                    return data
                else:
                    self.log_result("Wallet Balance Endpoint", False, "Missing wallet balance fields", data)
            else:
                self.log_result("Wallet Balance Endpoint", False, f"Failed with status {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Wallet Balance Endpoint", False, f"Error: {str(e)}")
        
        return None
    
    def test_dashboard_stats(self):
        """Test GET /api/dashboard/stats includes wallet balances"""
        print("\n=== Testing Dashboard Stats ===")
        
        try:
            response = self.make_request('GET', '/dashboard/stats', token=self.agent_baghdad_token)
            if response.status_code == 200:
                data = response.json()
                required_fields = ['pending_incoming', 'pending_outgoing', 'completed_today', 
                                 'total_amount_today', 'wallet_balance_iqd', 'wallet_balance_usd']
                
                missing_fields = [field for field in required_fields if field not in data]
                if not missing_fields:
                    self.log_result("Dashboard Stats", True, 
                                  f"All required fields present. Wallet: IQD={data['wallet_balance_iqd']}, USD={data['wallet_balance_usd']}")
                    return data
                else:
                    self.log_result("Dashboard Stats", False, f"Missing fields: {missing_fields}", data)
            else:
                self.log_result("Dashboard Stats", False, f"Failed with status {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Dashboard Stats", False, f"Error: {str(e)}")
        
        return None
    
    def test_chart_of_accounts_comprehensive(self):
        """Comprehensive testing of Chart of Accounts and Ledger functionality"""
        print("\n🚨 COMPREHENSIVE CHART OF ACCOUNTS & LEDGER TESTING")
        print("=" * 80)
        print("Testing Chart of Accounts endpoints after collection migration fix")
        print("=" * 80)
        
        # 1. Chart of Accounts Endpoints Testing
        print("\n--- 1. CHART OF ACCOUNTS ENDPOINTS TESTING ---")
        self.test_coa_endpoints()
        
        # 2. Ledger Endpoint Testing
        print("\n--- 2. LEDGER ENDPOINT TESTING ---")
        self.test_ledger_endpoints()
        
        # 3. Agent Registration with Auto-COA
        print("\n--- 3. AGENT REGISTRATION WITH AUTO-COA ---")
        self.test_agent_registration_coa()
        
        # 4. Accounting Reports Testing
        print("\n--- 4. ACCOUNTING REPORTS TESTING ---")
        self.test_accounting_reports()
        
        return True
    
    def test_coa_endpoints(self):
        """Test Chart of Accounts endpoints"""
        print("\n1.1 Testing GET /api/accounting/accounts...")
        
        try:
            response = self.make_request('GET', '/accounting/accounts', token=self.admin_token)
            if response.status_code == 200:
                accounts = response.json()
                if isinstance(accounts, list):
                    self.log_result("Get All Accounts", True, f"Retrieved {len(accounts)} accounts from chart_of_accounts")
                    self.existing_accounts = accounts
                    
                    # Show some account details
                    if accounts:
                        print(f"   Sample accounts:")
                        for i, acc in enumerate(accounts[:3]):
                            code = acc.get('code', 'N/A')
                            name_ar = acc.get('name_ar', 'N/A')
                            category = acc.get('category', 'N/A')
                            print(f"     {i+1}. {code}: {name_ar} ({category})")
                else:
                    self.log_result("Get All Accounts", False, "Response is not a list", accounts)
            else:
                self.log_result("Get All Accounts", False, f"Failed with status {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Get All Accounts", False, f"Error: {str(e)}")
        
        print("\n1.2 Testing POST /api/accounting/accounts (Create Account)...")
        
        # Create a test account
        test_account = {
            "code": "2010",
            "name": "Test Account",
            "name_ar": "حساب تجريبي",
            "name_en": "Test Account",
            "category": "شركات الصرافة",
            "type": "شركات الصرافة"
        }
        
        try:
            response = self.make_request('POST', '/accounting/accounts', token=self.admin_token, json=test_account)
            if response.status_code in [200, 201]:
                data = response.json()
                self.log_result("Create Account", True, f"Account created successfully: {test_account['code']}")
                self.test_account_code = test_account['code']
            else:
                # Check if account already exists
                if response.status_code == 400 and "موجود" in response.text:
                    self.log_result("Create Account", True, f"Account {test_account['code']} already exists (expected)")
                    self.test_account_code = test_account['code']
                else:
                    self.log_result("Create Account", False, f"Failed with status {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Create Account", False, f"Error: {str(e)}")
        
        print("\n1.3 Testing GET /api/accounting/accounts/{account_code}...")
        
        # Test getting specific account
        if hasattr(self, 'test_account_code'):
            try:
                response = self.make_request('GET', f'/accounting/accounts/{self.test_account_code}', token=self.admin_token)
                if response.status_code == 200:
                    account = response.json()
                    if account.get('code') == self.test_account_code:
                        self.log_result("Get Specific Account", True, f"Retrieved account {self.test_account_code} successfully")
                    else:
                        self.log_result("Get Specific Account", False, f"Wrong account returned", account)
                else:
                    self.log_result("Get Specific Account", False, f"Failed with status {response.status_code}", response.text)
            except Exception as e:
                self.log_result("Get Specific Account", False, f"Error: {str(e)}")
        else:
            self.log_result("Get Specific Account", False, "No test account code available")
    
    def test_ledger_endpoints(self):
        """Test Ledger endpoints - the critical fix"""
        print("\n2.1 Testing GET /api/accounting/ledger/{account_code} - CRITICAL TEST...")
        
        # First, get an account code from the chart of accounts
        account_code_to_test = None
        
        if hasattr(self, 'existing_accounts') and self.existing_accounts:
            # Use the first available account
            account_code_to_test = self.existing_accounts[0].get('code')
            print(f"   Using account code: {account_code_to_test}")
        elif hasattr(self, 'test_account_code'):
            # Use our test account
            account_code_to_test = self.test_account_code
            print(f"   Using test account code: {account_code_to_test}")
        else:
            # Try a common account code
            account_code_to_test = "1030"
            print(f"   Using default account code: {account_code_to_test}")
        
        if account_code_to_test:
            try:
                response = self.make_request('GET', f'/accounting/ledger/{account_code_to_test}', token=self.admin_token)
                if response.status_code == 200:
                    ledger_data = response.json()
                    
                    # Check if it has the expected structure
                    if isinstance(ledger_data, dict):
                        entries = ledger_data.get('entries', [])
                        account_info = ledger_data.get('account', {})
                        
                        self.log_result("Ledger Load Success", True, 
                                      f"Ledger loaded successfully for account {account_code_to_test}. Entries: {len(entries)}")
                        
                        print(f"   Account: {account_info.get('name_ar', 'N/A')}")
                        print(f"   Entries: {len(entries)}")
                        print(f"   Balance: {account_info.get('balance', 0)}")
                        
                        # This is the critical test - it should NOT return 404 "الحساب غير موجود"
                        self.log_result("Ledger No 404 Error", True, "No 404 error - account found in chart_of_accounts")
                        
                    else:
                        self.log_result("Ledger Load Success", False, "Invalid ledger response structure", ledger_data)
                        
                elif response.status_code == 404:
                    # This is the bug we're testing for
                    self.log_result("Ledger Load Success", False, f"❌ CRITICAL BUG: Got 404 'الحساب غير موجود' for account {account_code_to_test}")
                    self.log_result("Ledger No 404 Error", False, "❌ CRITICAL: Still getting 404 errors - collection migration may have failed")
                else:
                    self.log_result("Ledger Load Success", False, f"Unexpected status {response.status_code}", response.text)
                    
            except Exception as e:
                self.log_result("Ledger Load Success", False, f"Error: {str(e)}")
        else:
            self.log_result("Ledger Load Success", False, "No account code available for testing")
        
        print("\n2.2 Testing ledger with multiple account codes...")
        
        # Test with a few different account codes to ensure consistency
        test_codes = ["1030", "2001", "4020", "5110"]
        
        for code in test_codes:
            try:
                response = self.make_request('GET', f'/accounting/ledger/{code}', token=self.admin_token)
                if response.status_code == 200:
                    self.log_result(f"Ledger {code}", True, f"Account {code} ledger accessible")
                elif response.status_code == 404:
                    self.log_result(f"Ledger {code}", False, f"❌ Account {code} returned 404 - collection issue")
                else:
                    self.log_result(f"Ledger {code}", False, f"Account {code} returned {response.status_code}")
            except Exception as e:
                self.log_result(f"Ledger {code}", False, f"Error testing {code}: {str(e)}")
    
    def test_agent_registration_coa(self):
        """Test agent registration creates COA account automatically"""
        print("\n3.1 Testing agent registration with auto-COA creation...")
        
        # Create a unique test agent
        import random
        test_suffix = random.randint(1000, 9999)
        
        agent_data = {
            "username": f"test_agent_{test_suffix}",
            "password": "test123456",
            "display_name": f"صيرفة الاختبار {test_suffix}",
            "governorate": "بغداد",
            "phone": f"07901234{test_suffix}",
            "role": "agent"
        }
        
        try:
            # First, get current account count
            accounts_before_response = self.make_request('GET', '/accounting/accounts', token=self.admin_token)
            accounts_before_count = 0
            if accounts_before_response.status_code == 200:
                accounts_before = accounts_before_response.json()
                accounts_before_count = len(accounts_before)
                print(f"   Accounts before registration: {accounts_before_count}")
            
            # Register the agent
            response = self.make_request('POST', '/register', token=self.admin_token, json=agent_data)
            if response.status_code == 200:
                agent_result = response.json()
                agent_id = agent_result.get('id')
                
                self.log_result("Agent Registration", True, f"Agent {agent_data['username']} registered successfully")
                
                # Wait a moment for account creation
                time.sleep(1)
                
                # Check if COA account was created
                accounts_after_response = self.make_request('GET', '/accounting/accounts', token=self.admin_token)
                if accounts_after_response.status_code == 200:
                    accounts_after = accounts_after_response.json()
                    accounts_after_count = len(accounts_after)
                    
                    print(f"   Accounts after registration: {accounts_after_count}")
                    
                    if accounts_after_count > accounts_before_count:
                        self.log_result("Auto-COA Creation", True, f"COA account automatically created (+{accounts_after_count - accounts_before_count})")
                        
                        # Find the new account
                        new_accounts = [acc for acc in accounts_after if acc not in accounts_before]
                        if new_accounts:
                            new_account = new_accounts[0]
                            account_code = new_account.get('code')
                            account_name = new_account.get('name_ar', new_account.get('name'))
                            
                            print(f"   New account: {account_code} - {account_name}")
                            
                            # Verify account code pattern (should be 200X)
                            if account_code and account_code.startswith('20') and len(account_code) == 4:
                                self.log_result("Account Code Pattern", True, f"Account code {account_code} follows pattern 200X")
                            else:
                                self.log_result("Account Code Pattern", False, f"Account code {account_code} doesn't follow expected pattern")
                            
                            # Verify governorate in name
                            if agent_data['governorate'] in account_name:
                                self.log_result("Governorate in Name", True, f"Governorate '{agent_data['governorate']}' included in account name")
                            else:
                                self.log_result("Governorate in Name", False, f"Governorate not found in account name: {account_name}")
                            
                            # Store for ledger testing
                            self.new_agent_account_code = account_code
                        else:
                            self.log_result("Auto-COA Creation", False, "Could not identify the new account")
                    else:
                        self.log_result("Auto-COA Creation", False, f"No new accounts created (before: {accounts_before_count}, after: {accounts_after_count})")
                else:
                    self.log_result("Auto-COA Creation", False, "Could not retrieve accounts after registration")
            else:
                self.log_result("Agent Registration", False, f"Agent registration failed: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Agent Registration", False, f"Error: {str(e)}")
        
        print("\n3.2 Testing ledger access for new agent account...")
        
        # Test that the new agent account can be accessed via ledger
        if hasattr(self, 'new_agent_account_code'):
            try:
                response = self.make_request('GET', f'/accounting/ledger/{self.new_agent_account_code}', token=self.admin_token)
                if response.status_code == 200:
                    self.log_result("New Agent Ledger Access", True, f"New agent account {self.new_agent_account_code} accessible via ledger")
                else:
                    self.log_result("New Agent Ledger Access", False, f"New agent account ledger failed: {response.status_code}")
            except Exception as e:
                self.log_result("New Agent Ledger Access", False, f"Error: {str(e)}")
        else:
            self.log_result("New Agent Ledger Access", False, "No new agent account code available")
    
    def test_balance_verification(self):
        """Test balance verification after deposits"""
        print("\n4.1 Verifying IQD balance increase...")
        
        # Get current balance for Baghdad agent
        try:
            response = self.make_request('GET', '/wallet/balance', token=self.agent_baghdad_token)
            if response.status_code == 200:
                balance_data = response.json()
                current_iqd = balance_data.get('wallet_balance_iqd', 0)
                
                self.log_result("IQD Balance Check", True, f"Current IQD balance: {current_iqd:,}")
                print(f"   Agent Baghdad IQD balance: {current_iqd:,}")
                
                # Verify balance increased (we deposited 50,000 IQD earlier)
                if current_iqd >= 50000:
                    self.log_result("IQD Balance Increase Verification", True, f"Balance shows deposit was processed (≥50,000)")
                else:
                    self.log_result("IQD Balance Increase Verification", False, f"Balance too low: {current_iqd}")
            else:
                self.log_result("IQD Balance Check", False, f"Could not get balance: {response.status_code}")
        except Exception as e:
            self.log_result("IQD Balance Check", False, f"Error: {str(e)}")
        
        print("\n4.2 Verifying USD balance increase...")
        
        # Get current balance for Basra agent
        try:
            response = self.make_request('GET', '/wallet/balance', token=self.agent_basra_token)
            if response.status_code == 200:
                balance_data = response.json()
                current_usd = balance_data.get('wallet_balance_usd', 0)
                
                self.log_result("USD Balance Check", True, f"Current USD balance: {current_usd:,}")
                print(f"   Agent Basra USD balance: {current_usd:,}")
                
                # Verify balance increased (we deposited 100 USD earlier)
                if current_usd >= 100:
                    self.log_result("USD Balance Increase Verification", True, f"Balance shows deposit was processed (≥100)")
                else:
                    self.log_result("USD Balance Increase Verification", False, f"Balance too low: {current_usd}")
            else:
                self.log_result("USD Balance Check", False, f"Could not get balance: {response.status_code}")
        except Exception as e:
            self.log_result("USD Balance Check", False, f"Error: {str(e)}")
        
        print("\n4.3 Testing precise balance verification with new deposit...")
        
        # Get exact balance before deposit
        try:
            response = self.make_request('GET', '/wallet/balance', token=self.agent_baghdad_token)
            if response.status_code == 200:
                before_balance = response.json()
                before_iqd = before_balance.get('wallet_balance_iqd', 0)
                
                print(f"   Balance before deposit: {before_iqd:,} IQD")
                
                # Make a precise deposit
                deposit_amount = 25000
                deposit_data = {
                    "user_id": self.agent_baghdad_user_id,
                    "amount": deposit_amount,
                    "currency": "IQD",
                    "note": "Precise balance verification test"
                }
                
                deposit_response = self.make_request('POST', '/wallet/deposit', token=self.admin_token, json=deposit_data)
                if deposit_response.status_code == 200:
                    deposit_result = deposit_response.json()
                    transaction_id = deposit_result.get('transaction_id')
                    
                    # Wait a moment for database update
                    time.sleep(1)
                    
                    # Check balance after deposit
                    after_response = self.make_request('GET', '/wallet/balance', token=self.agent_baghdad_token)
                    if after_response.status_code == 200:
                        after_balance = after_response.json()
                        after_iqd = after_balance.get('wallet_balance_iqd', 0)
                        
                        expected_balance = before_iqd + deposit_amount
                        actual_increase = after_iqd - before_iqd
                        
                        print(f"   Balance after deposit: {after_iqd:,} IQD")
                        print(f"   Expected increase: {deposit_amount:,} IQD")
                        print(f"   Actual increase: {actual_increase:,} IQD")
                        
                        if abs(actual_increase - deposit_amount) < 0.01:
                            self.log_result("Precise Balance Verification", True, f"Balance increased exactly by {deposit_amount:,} IQD")
                        else:
                            self.log_result("Precise Balance Verification", False, f"Expected +{deposit_amount:,}, got +{actual_increase:,}")
                    else:
                        self.log_result("Precise Balance Verification", False, "Could not get balance after deposit")
                else:
                    self.log_result("Precise Balance Verification", False, f"Deposit failed: {deposit_response.status_code}")
            else:
                self.log_result("Precise Balance Verification", False, "Could not get initial balance")
        except Exception as e:
            self.log_result("Precise Balance Verification", False, f"Error: {str(e)}")
    
    def test_transaction_logging(self):
        """Test transaction logging functionality"""
        print("\n5.1 Testing wallet transactions endpoint...")
        
        # Get transactions for Baghdad agent
        try:
            response = self.make_request('GET', '/wallet/transactions', token=self.agent_baghdad_token)
            if response.status_code == 200:
                transactions = response.json()
                
                if isinstance(transactions, list):
                    self.log_result("Wallet Transactions Endpoint", True, f"Retrieved {len(transactions)} transactions")
                    
                    # Look for our test deposits
                    deposit_transactions = [t for t in transactions if t.get('transaction_type') == 'deposit']
                    
                    print(f"   Total transactions: {len(transactions)}")
                    print(f"   Deposit transactions: {len(deposit_transactions)}")
                    
                    if deposit_transactions:
                        print("   Recent deposit transactions:")
                        for i, txn in enumerate(deposit_transactions[:3]):  # Show first 3
                            amount = txn.get('amount', 0)
                            currency = txn.get('currency', 'N/A')
                            admin_name = txn.get('added_by_admin_name', 'N/A')
                            note = txn.get('note', 'N/A')
                            created_at = txn.get('created_at', 'N/A')
                            
                            print(f"     {i+1}. {amount:,} {currency} by {admin_name}")
                            print(f"        Note: {note}")
                            print(f"        Date: {created_at}")
                        
                        self.log_result("Deposit Transaction Logging", True, f"Found {len(deposit_transactions)} deposit transactions")
                    else:
                        self.log_result("Deposit Transaction Logging", False, "No deposit transactions found")
                else:
                    self.log_result("Wallet Transactions Endpoint", False, "Response is not a list", transactions)
            else:
                self.log_result("Wallet Transactions Endpoint", False, f"Failed: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Wallet Transactions Endpoint", False, f"Error: {str(e)}")
        
        print("\n5.2 Verifying transaction details...")
        
        # Check if we have stored transaction IDs from earlier tests
        if hasattr(self, 'iqd_transaction_id'):
            try:
                response = self.make_request('GET', '/wallet/transactions', token=self.agent_baghdad_token)
                if response.status_code == 200:
                    transactions = response.json()
                    
                    # Find our specific transaction
                    target_txn = next((t for t in transactions if t.get('id') == self.iqd_transaction_id), None)
                    
                    if target_txn:
                        print(f"   Found target transaction: {self.iqd_transaction_id}")
                        
                        # Verify all required fields
                        required_fields = ['id', 'user_id', 'amount', 'currency', 'transaction_type', 
                                         'added_by_admin_id', 'added_by_admin_name', 'created_at']
                        
                        missing_fields = [field for field in required_fields if field not in target_txn]
                        
                        if not missing_fields:
                            # Verify specific values
                            checks = []
                            checks.append(("Transaction Type", target_txn.get('transaction_type') == 'deposit'))
                            checks.append(("Amount", target_txn.get('amount') == 50000))
                            checks.append(("Currency", target_txn.get('currency') == 'IQD'))
                            checks.append(("Admin ID", target_txn.get('added_by_admin_id') == self.admin_user_id))
                            
                            all_correct = all(check[1] for check in checks)
                            
                            if all_correct:
                                self.log_result("Transaction Details Verification", True, "All transaction details correct")
                                
                                print("   Transaction details:")
                                print(f"     ID: {target_txn.get('id')}")
                                print(f"     User: {target_txn.get('user_display_name')}")
                                print(f"     Amount: {target_txn.get('amount'):,} {target_txn.get('currency')}")
                                print(f"     Type: {target_txn.get('transaction_type')}")
                                print(f"     Admin: {target_txn.get('added_by_admin_name')}")
                                print(f"     Note: {target_txn.get('note')}")
                                print(f"     Date: {target_txn.get('created_at')}")
                            else:
                                failed_checks = [check[0] for check in checks if not check[1]]
                                self.log_result("Transaction Details Verification", False, f"Failed checks: {failed_checks}")
                        else:
                            self.log_result("Transaction Details Verification", False, f"Missing fields: {missing_fields}")
                    else:
                        self.log_result("Transaction Details Verification", False, f"Transaction {self.iqd_transaction_id} not found")
                else:
                    self.log_result("Transaction Details Verification", False, "Could not retrieve transactions")
            except Exception as e:
                self.log_result("Transaction Details Verification", False, f"Error: {str(e)}")
        else:
            print("   No stored transaction ID for verification")
        
        print("\n5.3 Testing admin access to all transactions...")
        
        # Test admin can see transactions for specific user
        try:
            params = {'user_id': self.agent_baghdad_user_id}
            response = self.make_request('GET', '/wallet/transactions', token=self.admin_token, params=params)
            if response.status_code == 200:
                admin_view_transactions = response.json()
                
                if isinstance(admin_view_transactions, list):
                    self.log_result("Admin Transaction Access", True, f"Admin can view {len(admin_view_transactions)} transactions for specific user")
                else:
                    self.log_result("Admin Transaction Access", False, "Admin response not a list")
            else:
                self.log_result("Admin Transaction Access", False, f"Admin access failed: {response.status_code}")
        except Exception as e:
            self.log_result("Admin Transaction Access", False, f"Error: {str(e)}")
        
        print("\n5.4 Testing agent access restriction...")
        
        # Test agent cannot see other agent's transactions
        try:
            params = {'user_id': self.agent_basra_user_id}  # Baghdad agent trying to see Basra transactions
            response = self.make_request('GET', '/wallet/transactions', token=self.agent_baghdad_token, params=params)
            if response.status_code == 200:
                agent_restricted_transactions = response.json()
                
                # Should only see own transactions, not the requested user's
                if isinstance(agent_restricted_transactions, list):
                    # Check if any transaction belongs to the other agent
                    other_agent_txns = [t for t in agent_restricted_transactions if t.get('user_id') == self.agent_basra_user_id]
                    
                    if not other_agent_txns:
                        self.log_result("Agent Access Restriction", True, "Agent correctly restricted to own transactions")
                    else:
                        self.log_result("Agent Access Restriction", False, f"Agent can see {len(other_agent_txns)} transactions from other agent")
                else:
                    self.log_result("Agent Access Restriction", False, "Unexpected response format")
            else:
                self.log_result("Agent Access Restriction", False, f"Agent access test failed: {response.status_code}")
        except Exception as e:
            self.log_result("Agent Access Restriction", False, f"Error: {str(e)}")
    
    def run_all_tests(self):
        """Run all wallet deposit tests"""
        print("🚨 STARTING COMPREHENSIVE WALLET DEPOSIT TESTING")
        print("=" * 80)
        
        # Step 1: Authentication
        if not self.test_authentication():
            print("❌ Authentication failed - cannot continue")
            return False
        
        # Step 2: Run comprehensive wallet deposit tests
        self.test_wallet_deposit_comprehensive()
        
        # Step 3: Print summary
        self.print_test_summary()
        
        return True
    
    def print_test_summary(self):
        """Print comprehensive test summary"""
        print("\n" + "=" * 80)
        print("🚨 WALLET DEPOSIT TESTING SUMMARY")
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
        
        # Critical findings
        print(f"\n🎯 CRITICAL FINDINGS:")
        
        auth_tests = [r for r in self.test_results if 'Auth' in r['test']]
        auth_passed = len([r for r in auth_tests if r['success']])
        print(f"   Authentication Security: {auth_passed}/{len(auth_tests)} tests passed")
        
        validation_tests = [r for r in self.test_results if 'Validation' in r['test']]
        validation_passed = len([r for r in validation_tests if r['success']])
        print(f"   Input Validation: {validation_passed}/{len(validation_tests)} tests passed")
        
        deposit_tests = [r for r in self.test_results if 'Deposit' in r['test'] and 'Successful' in r['test']]
        deposit_passed = len([r for r in deposit_tests if r['success']])
        print(f"   Deposit Functionality: {deposit_passed}/{len(deposit_tests)} tests passed")
        
        balance_tests = [r for r in self.test_results if 'Balance' in r['test']]
        balance_passed = len([r for r in balance_tests if r['success']])
        print(f"   Balance Management: {balance_passed}/{len(balance_tests)} tests passed")
        
        transaction_tests = [r for r in self.test_results if 'Transaction' in r['test']]
        transaction_passed = len([r for r in transaction_tests if r['success']])
        print(f"   Transaction Logging: {transaction_passed}/{len(transaction_tests)} tests passed")
        
        print("\n" + "=" * 80)
        
        if failed_tests == 0:
            print("🎉 ALL TESTS PASSED - WALLET DEPOSIT FEATURE IS FULLY FUNCTIONAL!")
        else:
            print("⚠️  SOME TESTS FAILED - REVIEW ISSUES ABOVE")
        
        print("=" * 80)

def main():
    """Main execution function"""
    tester = WalletDepositTester()
    
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
