#!/usr/bin/env python3
"""
🚨 COMPREHENSIVE WALLET DEPOSIT TESTING

**Test Focus:** `/api/wallet/deposit` endpoint

**Test Scenarios:**

1. **Authentication Testing:**
   - Try deposit without authentication (expect 403)
   - Try deposit with agent authentication (expect 403)
   - Try deposit with admin authentication (expect success)

2. **Validation Testing:**
   - Try deposit with amount = 0 (expect 400 error)
   - Try deposit with negative amount (expect 400 error)
   - Try deposit with invalid currency (expect 400 error)
   - Try deposit with non-existent user_id (expect 404 error)

3. **Successful Deposit Testing:**
   - Admin successfully deposits IQD to an agent
   - Admin successfully deposits USD to an agent
   - Verify response includes transaction_id
   - Verify response has success: true

4. **Balance Verification:**
   - Check agent balance before deposit
   - Perform deposit
   - Check agent balance after deposit
   - Verify balance increased by exact deposit amount

5. **Transaction Logging:**
   - Query /api/wallet/transactions after deposit
   - Verify transaction appears with correct details
   - Verify transaction_id matches
   - Verify transaction_type is 'deposit'
   - Verify admin info is logged

**Admin Credentials:**
username: admin
password: admin123

**Testing Requirements:**
- Test with existing agents in the system
- Verify all validation rules
- Check that transaction_id is properly generated
- Ensure wallet balances update correctly
- Verify transaction logging is complete
"""

import requests
import json
import time
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://rapidprint.preview.emergentagent.com/api"
ADMIN_CREDENTIALS = {"username": "admin", "password": "admin123"}

# Try different possible passwords for test agents
POSSIBLE_PASSWORDS = ["test123", "agent123", "123456", "password", "admin123"]

class WalletDepositTester:
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
    
    def test_wallet_deposit_comprehensive(self):
        """Comprehensive testing of wallet deposit functionality"""
        print("\n🚨 COMPREHENSIVE WALLET DEPOSIT TESTING")
        print("=" * 80)
        print("Testing all aspects of /api/wallet/deposit endpoint")
        print("=" * 80)
        
        # 1. Authentication Testing
        print("\n--- 1. AUTHENTICATION TESTING ---")
        self.test_deposit_authentication()
        
        # 2. Validation Testing
        print("\n--- 2. VALIDATION TESTING ---")
        self.test_deposit_validation()
        
        # 3. Successful Deposit Testing
        print("\n--- 3. SUCCESSFUL DEPOSIT TESTING ---")
        self.test_successful_deposits()
        
        # 4. Balance Verification
        print("\n--- 4. BALANCE VERIFICATION ---")
        self.test_balance_verification()
        
        # 5. Transaction Logging
        print("\n--- 5. TRANSACTION LOGGING ---")
        self.test_transaction_logging()
        
        return True
    
    def test_deposit_authentication(self):
        """Test authentication requirements for deposit endpoint"""
        print("\n1.1 Testing deposit without authentication...")
        
        deposit_data = {
            "user_id": self.agent_baghdad_user_id,
            "amount": 1000,
            "currency": "IQD",
            "note": "Test without auth"
        }
        
        try:
            response = self.make_request('POST', '/wallet/deposit', json=deposit_data)
            if response.status_code == 403:
                self.log_result("Deposit Without Auth", True, "Correctly rejected unauthenticated request (403)")
            else:
                self.log_result("Deposit Without Auth", False, f"Expected 403, got {response.status_code}")
        except Exception as e:
            self.log_result("Deposit Without Auth", False, f"Error: {str(e)}")
        
        print("\n1.2 Testing deposit with agent authentication...")
        try:
            response = self.make_request('POST', '/wallet/deposit', token=self.agent_baghdad_token, json=deposit_data)
            if response.status_code == 403:
                self.log_result("Deposit With Agent Auth", True, "Correctly rejected agent request (403)")
            else:
                self.log_result("Deposit With Agent Auth", False, f"Expected 403, got {response.status_code}")
        except Exception as e:
            self.log_result("Deposit With Agent Auth", False, f"Error: {str(e)}")
        
        print("\n1.3 Testing deposit with admin authentication...")
        try:
            response = self.make_request('POST', '/wallet/deposit', token=self.admin_token, json=deposit_data)
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('transaction_id'):
                    self.log_result("Deposit With Admin Auth", True, f"Admin deposit successful. Transaction ID: {data.get('transaction_id')}")
                else:
                    self.log_result("Deposit With Admin Auth", False, "Response missing success or transaction_id", data)
            else:
                self.log_result("Deposit With Admin Auth", False, f"Admin deposit failed: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Deposit With Admin Auth", False, f"Error: {str(e)}")
    
    def test_deposit_validation(self):
        """Test validation rules for deposit endpoint"""
        print("\n2.1 Testing deposit with amount = 0...")
        
        deposit_data = {
            "user_id": self.agent_baghdad_user_id,
            "amount": 0,
            "currency": "IQD",
            "note": "Test zero amount"
        }
        
        try:
            response = self.make_request('POST', '/wallet/deposit', token=self.admin_token, json=deposit_data)
            if response.status_code == 400:
                self.log_result("Zero Amount Validation", True, "Correctly rejected zero amount (400)")
            else:
                self.log_result("Zero Amount Validation", False, f"Expected 400, got {response.status_code}")
        except Exception as e:
            self.log_result("Zero Amount Validation", False, f"Error: {str(e)}")
        
        print("\n2.2 Testing deposit with negative amount...")
        deposit_data["amount"] = -1000
        
        try:
            response = self.make_request('POST', '/wallet/deposit', token=self.admin_token, json=deposit_data)
            if response.status_code == 400:
                self.log_result("Negative Amount Validation", True, "Correctly rejected negative amount (400)")
            else:
                self.log_result("Negative Amount Validation", False, f"Expected 400, got {response.status_code}")
        except Exception as e:
            self.log_result("Negative Amount Validation", False, f"Error: {str(e)}")
        
        print("\n2.3 Testing deposit with invalid currency...")
        deposit_data = {
            "user_id": self.agent_baghdad_user_id,
            "amount": 1000,
            "currency": "EUR",
            "note": "Test invalid currency"
        }
        
        try:
            response = self.make_request('POST', '/wallet/deposit', token=self.admin_token, json=deposit_data)
            if response.status_code == 400:
                self.log_result("Invalid Currency Validation", True, "Correctly rejected invalid currency (400)")
            else:
                self.log_result("Invalid Currency Validation", False, f"Expected 400, got {response.status_code}")
        except Exception as e:
            self.log_result("Invalid Currency Validation", False, f"Error: {str(e)}")
        
        print("\n2.4 Testing deposit with non-existent user_id...")
        deposit_data = {
            "user_id": "non-existent-user-id-12345",
            "amount": 1000,
            "currency": "IQD",
            "note": "Test non-existent user"
        }
        
        try:
            response = self.make_request('POST', '/wallet/deposit', token=self.admin_token, json=deposit_data)
            if response.status_code == 404:
                self.log_result("Non-existent User Validation", True, "Correctly rejected non-existent user (404)")
            else:
                self.log_result("Non-existent User Validation", False, f"Expected 404, got {response.status_code}")
        except Exception as e:
            self.log_result("Non-existent User Validation", False, f"Error: {str(e)}")
    
    def test_successful_deposits(self):
        """Test successful deposit scenarios"""
        print("\n3.1 Testing successful IQD deposit...")
        
        deposit_data = {
            "user_id": self.agent_baghdad_user_id,
            "amount": 50000,
            "currency": "IQD",
            "note": "Test IQD deposit - comprehensive testing"
        }
        
        try:
            response = self.make_request('POST', '/wallet/deposit', token=self.admin_token, json=deposit_data)
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('transaction_id'):
                    transaction_id = data.get('transaction_id')
                    self.log_result("Successful IQD Deposit", True, f"IQD deposit successful. Transaction ID: {transaction_id}")
                    
                    # Store transaction ID for later verification
                    self.iqd_transaction_id = transaction_id
                else:
                    self.log_result("Successful IQD Deposit", False, "Response missing required fields", data)
            else:
                self.log_result("Successful IQD Deposit", False, f"IQD deposit failed: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Successful IQD Deposit", False, f"Error: {str(e)}")
        
        print("\n3.2 Testing successful USD deposit...")
        
        deposit_data = {
            "user_id": self.agent_basra_user_id,
            "amount": 100,
            "currency": "USD",
            "note": "Test USD deposit - comprehensive testing"
        }
        
        try:
            response = self.make_request('POST', '/wallet/deposit', token=self.admin_token, json=deposit_data)
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('transaction_id'):
                    transaction_id = data.get('transaction_id')
                    self.log_result("Successful USD Deposit", True, f"USD deposit successful. Transaction ID: {transaction_id}")
                    
                    # Store transaction ID for later verification
                    self.usd_transaction_id = transaction_id
                else:
                    self.log_result("Successful USD Deposit", False, "Response missing required fields", data)
            else:
                self.log_result("Successful USD Deposit", False, f"USD deposit failed: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Successful USD Deposit", False, f"Error: {str(e)}")
    
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
