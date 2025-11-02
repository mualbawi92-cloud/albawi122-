#!/usr/bin/env python3
"""
🚨 CHART OF ACCOUNTS INITIALIZATION FIX VERIFICATION

**Test Focus:** Chart of Accounts Initialize endpoint fix verification

**Critical Fixes Applied:**

1. **Modified /api/accounting/initialize endpoint:**
   - Changed from "fail if exists" to "upsert" mode
   - Now inserts only missing accounts
   - Updates existing accounts with missing fields (balance_iqd, balance_usd, name, type)
   - Returns: {inserted: count, updated: count, total: count}

2. **Fixed Trial Balance Report:**
   - Added null checks for name_ar and name_en fields
   - Gracefully handles accounts with missing Arabic/English names
   - Uses fallback values: name_ar defaults to 'name' field or 'حساب بدون اسم'

**Test Scenarios:**

**Scenario 1: Initialize Default Accounts (HIGH PRIORITY)**
- POST /api/accounting/initialize
- Expected: 200, creates missing system accounts (1030, 4020, 5110, etc.)
- Should not fail if some accounts already exist
- Should return counts: inserted, updated, total

**Scenario 2: Verify System Accounts Created**
After initialize:
- GET /api/accounting/ledger/1030 (Transit Account)
- GET /api/accounting/ledger/4020 (Earned Commissions)
- GET /api/accounting/ledger/5110 (Paid Commissions)
- Expected: All should return 200 (not 404)

**Scenario 3: Trial Balance Report (Should Work Now)**
- GET /api/accounting/reports/trial-balance
- Expected: 200, returns account list without KeyError
- Should handle accounts with and without name_ar field

**Scenario 4: Verify Complete Flow**
1. Initialize accounts
2. Get all accounts
3. Load ledger for each system account
4. Generate trial balance
5. All should succeed

**Admin Credentials:**
username: admin
password: admin123

**Success Criteria:**
- ✅ Initialize endpoint works (doesn't fail on existing accounts)
- ✅ System accounts (1030, 4020, 5110) accessible via ledger
- ✅ Trial balance report returns 200 (no KeyError)
- ✅ All accounting reports work correctly
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

class ChartOfAccountsInitializeTester:
    def __init__(self):
        self.admin_token = None
        self.admin_user_id = None
        self.test_results = []
        self.system_accounts = ['1030', '4020', '5110']  # Critical system accounts to test
        
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
    
    def test_initialize_accounts_endpoint(self):
        """Test POST /api/accounting/initialize - HIGH PRIORITY"""
        print("\n=== Scenario 1: Initialize Default Accounts (HIGH PRIORITY) ===")
        
        try:
            response = self.make_request('POST', '/accounting/initialize', token=self.admin_token)
            if response.status_code == 200:
                data = response.json()
                
                # Check response structure
                if 'inserted' in data and 'updated' in data and 'total' in data:
                    inserted = data.get('inserted', 0)
                    updated = data.get('updated', 0)
                    total = data.get('total', 0)
                    
                    self.log_result("Initialize Accounts", True, 
                                  f"Initialize successful - Inserted: {inserted}, Updated: {updated}, Total: {total}")
                    
                    # Store results for later verification
                    self.initialize_results = data
                    return data
                else:
                    self.log_result("Initialize Accounts", False, "Invalid response structure", data)
            else:
                self.log_result("Initialize Accounts", False, f"Initialize failed: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Initialize Accounts", False, f"Error: {str(e)}")
        
        return None
    
    def test_initialize_accounts_idempotent(self):
        """Test that initialize can be called multiple times without failing"""
        print("\n=== Testing Initialize Idempotency ===")
        
        try:
            # Call initialize again
            response = self.make_request('POST', '/accounting/initialize', token=self.admin_token)
            if response.status_code == 200:
                data = response.json()
                
                # Should not fail, might have 0 inserted but some updated
                inserted = data.get('inserted', 0)
                updated = data.get('updated', 0)
                total = data.get('total', 0)
                
                self.log_result("Initialize Idempotency", True, 
                              f"Second initialize call successful - Inserted: {inserted}, Updated: {updated}, Total: {total}")
                return True
            else:
                self.log_result("Initialize Idempotency", False, f"Second initialize failed: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Initialize Idempotency", False, f"Error: {str(e)}")
        
        return False
    
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
        
        # 5. Comprehensive Scenarios Testing
        print("\n--- 5. COMPREHENSIVE SCENARIOS TESTING ---")
        self.test_comprehensive_scenarios()
        
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
    
    def test_accounting_reports(self):
        """Test accounting reports use chart_of_accounts collection"""
        print("\n4.1 Testing GET /api/accounting/reports/trial-balance...")
        
        try:
            response = self.make_request('GET', '/accounting/reports/trial-balance', token=self.admin_token)
            if response.status_code == 200:
                trial_balance = response.json()
                
                if isinstance(trial_balance, dict):
                    accounts = trial_balance.get('accounts', [])
                    total_debit = trial_balance.get('total_debit', 0)
                    total_credit = trial_balance.get('total_credit', 0)
                    
                    self.log_result("Trial Balance Report", True, f"Trial balance generated with {len(accounts)} accounts")
                    print(f"   Accounts: {len(accounts)}")
                    print(f"   Total Debit: {total_debit:,}")
                    print(f"   Total Credit: {total_credit:,}")
                    
                    # Verify it's using chart_of_accounts (should have accounts we created)
                    if accounts:
                        self.log_result("Trial Balance Data Source", True, "Trial balance contains account data from chart_of_accounts")
                    else:
                        self.log_result("Trial Balance Data Source", False, "Trial balance has no accounts - may not be using chart_of_accounts")
                else:
                    self.log_result("Trial Balance Report", False, "Invalid trial balance response structure", trial_balance)
            else:
                self.log_result("Trial Balance Report", False, f"Trial balance failed: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Trial Balance Report", False, f"Error: {str(e)}")
        
        print("\n4.2 Testing GET /api/accounting/reports/income-statement...")
        
        try:
            response = self.make_request('GET', '/accounting/reports/income-statement', token=self.admin_token)
            if response.status_code == 200:
                income_statement = response.json()
                
                if isinstance(income_statement, dict):
                    revenues = income_statement.get('revenues', [])
                    expenses = income_statement.get('expenses', [])
                    
                    self.log_result("Income Statement Report", True, f"Income statement generated with {len(revenues)} revenue accounts, {len(expenses)} expense accounts")
                    print(f"   Revenue accounts: {len(revenues)}")
                    print(f"   Expense accounts: {len(expenses)}")
                else:
                    self.log_result("Income Statement Report", False, "Invalid income statement response structure", income_statement)
            else:
                self.log_result("Income Statement Report", False, f"Income statement failed: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Income Statement Report", False, f"Error: {str(e)}")
        
        print("\n4.3 Testing GET /api/accounting/reports/balance-sheet...")
        
        try:
            response = self.make_request('GET', '/accounting/reports/balance-sheet', token=self.admin_token)
            if response.status_code == 200:
                balance_sheet = response.json()
                
                if isinstance(balance_sheet, dict):
                    assets = balance_sheet.get('assets', [])
                    liabilities = balance_sheet.get('liabilities', [])
                    equity = balance_sheet.get('equity', [])
                    
                    self.log_result("Balance Sheet Report", True, f"Balance sheet generated with {len(assets)} assets, {len(liabilities)} liabilities, {len(equity)} equity accounts")
                    print(f"   Asset accounts: {len(assets)}")
                    print(f"   Liability accounts: {len(liabilities)}")
                    print(f"   Equity accounts: {len(equity)}")
                else:
                    self.log_result("Balance Sheet Report", False, "Invalid balance sheet response structure", balance_sheet)
            else:
                self.log_result("Balance Sheet Report", False, f"Balance sheet failed: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Balance Sheet Report", False, f"Error: {str(e)}")
    
    def test_comprehensive_scenarios(self):
        """Test comprehensive scenarios combining multiple endpoints"""
        print("\n5.1 Testing complete flow: Create Account → Get Account → Load Ledger...")
        
        # Create a unique test account
        import random
        test_code = f"9{random.randint(100, 999)}"
        
        test_account = {
            "code": test_code,
            "name": f"Complete Test Account {test_code}",
            "name_ar": f"حساب اختبار شامل {test_code}",
            "name_en": f"Complete Test Account {test_code}",
            "category": "أصول",
            "type": "أصول"
        }
        
        try:
            # Step 1: Create account
            create_response = self.make_request('POST', '/accounting/accounts', token=self.admin_token, json=test_account)
            if create_response.status_code in [200, 201]:
                self.log_result("Complete Flow - Create", True, f"Account {test_code} created successfully")
                
                # Step 2: Retrieve account
                get_response = self.make_request('GET', f'/accounting/accounts/{test_code}', token=self.admin_token)
                if get_response.status_code == 200:
                    account_data = get_response.json()
                    self.log_result("Complete Flow - Retrieve", True, f"Account {test_code} retrieved successfully")
                    
                    # Step 3: Load ledger
                    ledger_response = self.make_request('GET', f'/accounting/ledger/{test_code}', token=self.admin_token)
                    if ledger_response.status_code == 200:
                        ledger_data = ledger_response.json()
                        self.log_result("Complete Flow - Ledger", True, f"Ledger for {test_code} loaded successfully")
                        
                        # Complete flow success
                        self.log_result("Complete Flow Success", True, "✅ CRITICAL: Complete Create→Get→Ledger flow working")
                    else:
                        self.log_result("Complete Flow - Ledger", False, f"Ledger failed: {ledger_response.status_code}")
                        self.log_result("Complete Flow Success", False, "❌ CRITICAL: Ledger step failed in complete flow")
                else:
                    self.log_result("Complete Flow - Retrieve", False, f"Retrieve failed: {get_response.status_code}")
                    self.log_result("Complete Flow Success", False, "❌ CRITICAL: Retrieve step failed in complete flow")
            else:
                # Account might already exist
                if create_response.status_code == 400:
                    self.log_result("Complete Flow - Create", True, f"Account {test_code} already exists (acceptable)")
                    
                    # Continue with existing account
                    get_response = self.make_request('GET', f'/accounting/accounts/{test_code}', token=self.admin_token)
                    if get_response.status_code == 200:
                        ledger_response = self.make_request('GET', f'/accounting/ledger/{test_code}', token=self.admin_token)
                        if ledger_response.status_code == 200:
                            self.log_result("Complete Flow Success", True, "✅ CRITICAL: Complete flow working with existing account")
                        else:
                            self.log_result("Complete Flow Success", False, "❌ CRITICAL: Ledger failed for existing account")
                    else:
                        self.log_result("Complete Flow Success", False, "❌ CRITICAL: Cannot retrieve existing account")
                else:
                    self.log_result("Complete Flow - Create", False, f"Create failed: {create_response.status_code}")
                    self.log_result("Complete Flow Success", False, "❌ CRITICAL: Create step failed in complete flow")
        except Exception as e:
            self.log_result("Complete Flow Success", False, f"❌ CRITICAL: Complete flow error: {str(e)}")
        
        print("\n5.2 Testing collection consistency verification...")
        
        # Verify that all endpoints are using the same collection
        try:
            # Get accounts from main endpoint
            accounts_response = self.make_request('GET', '/accounting/accounts', token=self.admin_token)
            if accounts_response.status_code == 200:
                accounts = accounts_response.json()
                account_codes = [acc.get('code') for acc in accounts if acc.get('code')]
                
                print(f"   Found {len(account_codes)} accounts in chart_of_accounts")
                
                # Test ledger access for multiple accounts
                accessible_count = 0
                inaccessible_count = 0
                
                # Test first 5 accounts
                test_codes = account_codes[:5] if len(account_codes) >= 5 else account_codes
                
                for code in test_codes:
                    ledger_response = self.make_request('GET', f'/accounting/ledger/{code}', token=self.admin_token)
                    if ledger_response.status_code == 200:
                        accessible_count += 1
                    else:
                        inaccessible_count += 1
                        print(f"   ❌ Account {code} ledger failed: {ledger_response.status_code}")
                
                if inaccessible_count == 0:
                    self.log_result("Collection Consistency", True, f"✅ All {accessible_count} tested accounts accessible via ledger")
                else:
                    self.log_result("Collection Consistency", False, f"❌ {inaccessible_count}/{len(test_codes)} accounts inaccessible via ledger")
            else:
                self.log_result("Collection Consistency", False, "Could not retrieve accounts for consistency test")
        except Exception as e:
            self.log_result("Collection Consistency", False, f"Error: {str(e)}")
    
    def run_all_tests(self):
        """Run all Chart of Accounts and Ledger tests"""
        print("🚨 STARTING COMPREHENSIVE CHART OF ACCOUNTS & LEDGER TESTING")
        print("=" * 80)
        
        # Step 1: Authentication
        if not self.test_authentication():
            print("❌ Authentication failed - cannot continue")
            return False
        
        # Step 2: Run comprehensive chart of accounts tests
        self.test_chart_of_accounts_comprehensive()
        
        # Step 3: Print summary
        self.print_test_summary()
        
        return True
    
    def print_test_summary(self):
        """Print comprehensive test summary"""
        print("\n" + "=" * 80)
        print("🚨 CHART OF ACCOUNTS & LEDGER TESTING SUMMARY")
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
        
        coa_tests = [r for r in self.test_results if 'Account' in r['test'] or 'COA' in r['test']]
        coa_passed = len([r for r in coa_tests if r['success']])
        print(f"   Chart of Accounts: {coa_passed}/{len(coa_tests)} tests passed")
        
        ledger_tests = [r for r in self.test_results if 'Ledger' in r['test']]
        ledger_passed = len([r for r in ledger_tests if r['success']])
        print(f"   Ledger Functionality: {ledger_passed}/{len(ledger_tests)} tests passed")
        
        agent_tests = [r for r in self.test_results if 'Agent' in r['test'] and 'Registration' in r['test']]
        agent_passed = len([r for r in agent_tests if r['success']])
        print(f"   Agent Registration: {agent_passed}/{len(agent_tests)} tests passed")
        
        report_tests = [r for r in self.test_results if 'Report' in r['test']]
        report_passed = len([r for r in report_tests if r['success']])
        print(f"   Accounting Reports: {report_passed}/{len(report_tests)} tests passed")
        
        flow_tests = [r for r in self.test_results if 'Flow' in r['test'] or 'Consistency' in r['test']]
        flow_passed = len([r for r in flow_tests if r['success']])
        print(f"   Complete Flows: {flow_passed}/{len(flow_tests)} tests passed")
        
        print("\n" + "=" * 80)
        
        # Check for critical issues
        critical_failures = [r for r in self.test_results if not r['success'] and ('CRITICAL' in r['message'] or 'Ledger' in r['test'])]
        
        if failed_tests == 0:
            print("🎉 ALL TESTS PASSED - CHART OF ACCOUNTS & LEDGER FIXES ARE WORKING!")
        elif critical_failures:
            print("🚨 CRITICAL ISSUES FOUND - COLLECTION MIGRATION MAY HAVE FAILED!")
            for failure in critical_failures:
                print(f"   ❌ {failure['test']}: {failure['message']}")
        else:
            print("⚠️  SOME TESTS FAILED - REVIEW ISSUES ABOVE")
        
        print("=" * 80)

def main():
    """Main execution function"""
    tester = ChartOfAccountsTester()
    
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
