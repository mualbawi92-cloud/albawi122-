#!/usr/bin/env python3
"""
Backend API Testing for Cash Transfer System
FOCUS: Chart of Accounts DELETE Endpoint Testing

Tests the Chart of Accounts DELETE functionality:
1. GET /api/accounting/accounts - Get list of accounts
2. POST /api/accounting/accounts - Create test accounts
3. DELETE /api/accounting/accounts/{account_code} - Delete account
4. Admin authentication requirement
5. Verification of deletion and business rules
6. Error handling (account not found, has children, non-zero balance)
"""

import requests
import json
import time
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://hawala-dash.preview.emergentagent.com/api"
ADMIN_CREDENTIALS = {"username": "admin", "password": "admin123"}
AGENT_BAGHDAD_CREDENTIALS = {"username": "agent_baghdad", "password": "agent123"}
AGENT_BASRA_CREDENTIALS = {"username": "agent_basra", "password": "agent123"}

class APITester:
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
        """Test admin and agent authentication"""
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
        
        # Test agent_baghdad login
        try:
            response = self.make_request('POST', '/login', json=AGENT_BAGHDAD_CREDENTIALS)
            if response.status_code == 200:
                data = response.json()
                self.agent_baghdad_token = data['access_token']
                self.agent_baghdad_user_id = data['user']['id']
                self.log_result("Agent Baghdad Login", True, f"Agent Baghdad authenticated successfully")
            else:
                self.log_result("Agent Baghdad Login", False, f"Agent Baghdad login failed: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Agent Baghdad Login", False, f"Agent Baghdad login error: {str(e)}")
            return False
        
        # Test agent_basra login
        try:
            response = self.make_request('POST', '/login', json=AGENT_BASRA_CREDENTIALS)
            if response.status_code == 200:
                data = response.json()
                self.agent_basra_token = data['access_token']
                self.agent_basra_user_id = data['user']['id']
                self.log_result("Agent Basra Login", True, f"Agent Basra authenticated successfully")
            else:
                self.log_result("Agent Basra Login", False, f"Agent Basra login failed: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Agent Basra Login", False, f"Agent Basra login error: {str(e)}")
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
    
    def test_admin_deposit(self):
        """Test POST /api/wallet/deposit (admin only)"""
        print("\n=== Testing Admin Deposit Functionality ===")
        
        if not self.agent_baghdad_user_id:
            self.log_result("Admin Deposit", False, "Agent user ID not available")
            return False
        
        deposit_data = {
            "user_id": self.agent_baghdad_user_id,
            "amount": 10000,
            "currency": "IQD",
            "note": "Test deposit from automated testing"
        }
        
        try:
            response = self.make_request('POST', '/wallet/deposit', token=self.admin_token, json=deposit_data)
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log_result("Admin Deposit", True, f"Deposit successful. Transaction ID: {data.get('transaction_id')}")
                    return True
                else:
                    self.log_result("Admin Deposit", False, "Deposit response indicates failure", data)
            else:
                self.log_result("Admin Deposit", False, f"Failed with status {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Admin Deposit", False, f"Error: {str(e)}")
        
        return False
    
    def test_wallet_transactions(self):
        """Test GET /api/wallet/transactions"""
        print("\n=== Testing Wallet Transactions ===")
        
        try:
            response = self.make_request('GET', '/wallet/transactions', token=self.agent_baghdad_token)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Wallet Transactions", True, f"Retrieved {len(data)} transactions")
                    
                    # Check if recent deposit appears
                    deposit_found = any(t.get('transaction_type') == 'deposit' and 
                                      t.get('amount') == 10000 for t in data)
                    if deposit_found:
                        self.log_result("Recent Deposit in Transactions", True, "Recent deposit found in transaction history")
                    else:
                        self.log_result("Recent Deposit in Transactions", False, "Recent deposit not found in transaction history")
                    
                    return data
                else:
                    self.log_result("Wallet Transactions", False, "Response is not a list", data)
            else:
                self.log_result("Wallet Transactions", False, f"Failed with status {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Wallet Transactions", False, f"Error: {str(e)}")
        
        return None
    
    def test_transfer_flow_with_transit(self):
        """Test complete transfer flow with transit account integration"""
        print("\n=== Testing Transfer Flow with Transit Account ===")
        
        # Step 1: Get initial balances
        print("\n--- Step 1: Getting initial balances ---")
        initial_sender_balance = self.test_wallet_balance_endpoint()
        if not initial_sender_balance:
            self.log_result("Transfer Flow - Initial Balance", False, "Could not get sender's initial wallet balance")
            return None
        
        initial_transit_balance = self.test_transit_account_balance()
        if not initial_transit_balance:
            self.log_result("Transfer Flow - Initial Transit", False, "Could not get initial transit balance")
            return None
        
        initial_sender_iqd = initial_sender_balance['wallet_balance_iqd']
        initial_transit_iqd = initial_transit_balance['balance_iqd']
        
        print(f"Initial sender balance: {initial_sender_iqd} IQD")
        print(f"Initial transit balance: {initial_transit_iqd} IQD")
        
        # Step 2: Create a transfer
        print("\n--- Step 2: Creating transfer ---")
        transfer_amount = 50000
        transfer_data = {
            "sender_name": "محمد أحمد علي",
            "receiver_name": "فاطمة حسن محمد",
            "amount": transfer_amount,
            "currency": "IQD",
            "to_governorate": "البصرة",
            "note": "حوالة اختبار نظام الترانزيت"
        }
        
        try:
            response = self.make_request('POST', '/transfers', token=self.agent_baghdad_token, json=transfer_data)
            if response.status_code == 200:
                data = response.json()
                transfer_id = data.get('id')
                transfer_code = data.get('transfer_code')
                pin = data.get('pin')
                
                self.log_result("Transfer Creation", True, f"Transfer created: {transfer_code}, PIN: {pin}")
                
                # Step 3: Verify sender's wallet decreased
                print("\n--- Step 3: Verifying sender wallet decrease ---")
                time.sleep(1)  # Small delay to ensure database update
                new_sender_balance = self.test_wallet_balance_endpoint()
                if new_sender_balance:
                    new_sender_iqd = new_sender_balance['wallet_balance_iqd']
                    expected_sender_balance = initial_sender_iqd - transfer_amount
                    
                    if abs(new_sender_iqd - expected_sender_balance) < 0.01:
                        self.log_result("Sender Wallet Decrease", True, 
                                      f"Sender balance correctly decreased from {initial_sender_iqd} to {new_sender_iqd}")
                    else:
                        self.log_result("Sender Wallet Decrease", False, 
                                      f"Sender balance incorrect. Expected: {expected_sender_balance}, Got: {new_sender_iqd}")
                
                # Step 4: Verify transit account increased
                print("\n--- Step 4: Verifying transit account increase ---")
                new_transit_balance = self.test_transit_account_balance()
                if new_transit_balance:
                    new_transit_iqd = new_transit_balance['balance_iqd']
                    expected_transit_balance = initial_transit_iqd + transfer_amount
                    
                    if abs(new_transit_iqd - expected_transit_balance) < 0.01:
                        self.log_result("Transit Account Increase", True, 
                                      f"Transit balance correctly increased from {initial_transit_iqd} to {new_transit_iqd}")
                    else:
                        self.log_result("Transit Account Increase", False, 
                                      f"Transit balance incorrect. Expected: {expected_transit_balance}, Got: {new_transit_iqd}")
                
                # Step 5: Test cancel transfer (return money from transit to sender)
                print("\n--- Step 5: Testing transfer cancellation ---")
                try:
                    cancel_response = self.make_request('PATCH', f'/transfers/{transfer_id}/cancel', token=self.agent_baghdad_token)
                    if cancel_response.status_code == 200:
                        self.log_result("Transfer Cancellation", True, "Transfer cancelled successfully")
                        
                        # Verify money returned to sender (without commission)
                        time.sleep(1)
                        final_sender_balance = self.test_wallet_balance_endpoint()
                        final_transit_balance = self.test_transit_account_balance()
                        
                        if final_sender_balance and final_transit_balance:
                            final_sender_iqd = final_sender_balance['wallet_balance_iqd']
                            final_transit_iqd = final_transit_balance['balance_iqd']
                            
                            # Sender should get back the full amount (without commission)
                            if abs(final_sender_iqd - initial_sender_iqd) < 0.01:
                                self.log_result("Cancel - Sender Refund", True, 
                                              f"Sender correctly refunded. Balance: {final_sender_iqd}")
                            else:
                                self.log_result("Cancel - Sender Refund", False, 
                                              f"Sender refund incorrect. Expected: {initial_sender_iqd}, Got: {final_sender_iqd}")
                            
                            # Transit should return to original balance
                            if abs(final_transit_iqd - initial_transit_iqd) < 0.01:
                                self.log_result("Cancel - Transit Decrease", True, 
                                              f"Transit correctly decreased. Balance: {final_transit_iqd}")
                            else:
                                self.log_result("Cancel - Transit Decrease", False, 
                                              f"Transit decrease incorrect. Expected: {initial_transit_iqd}, Got: {final_transit_iqd}")
                    else:
                        self.log_result("Transfer Cancellation", False, f"Cancel failed: {cancel_response.status_code}", cancel_response.text)
                except Exception as e:
                    self.log_result("Transfer Cancellation", False, f"Cancel error: {str(e)}")
                
                return {"transfer_id": transfer_id, "transfer_code": transfer_code, "pin": pin}
            else:
                self.log_result("Transfer Creation", False, f"Failed with status {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Transfer Creation", False, f"Error: {str(e)}")
        
        return None
    
    def test_transfer_reception_with_transit(self):
        """Test transfer reception flow with transit account"""
        print("\n=== Testing Transfer Reception with Transit Account ===")
        
        # First create a new transfer for reception testing
        print("\n--- Creating transfer for reception test ---")
        transfer_amount = 25000
        transfer_data = {
            "sender_name": "علي حسن محمد",
            "receiver_name": "زينب أحمد علي",
            "amount": transfer_amount,
            "currency": "IQD",
            "to_governorate": "البصرة",
            "note": "حوالة اختبار الاستلام"
        }
        
        try:
            response = self.make_request('POST', '/transfers', token=self.agent_baghdad_token, json=transfer_data)
            if response.status_code == 200:
                data = response.json()
                transfer_id = data.get('id')
                transfer_code = data.get('transfer_code')
                pin = data.get('pin')
                
                self.log_result("Reception Test - Transfer Creation", True, f"Transfer created: {transfer_code}")
                
                # Get initial balances
                initial_receiver_balance = None
                try:
                    initial_receiver_response = self.make_request('GET', '/wallet/balance', token=self.agent_basra_token)
                    if initial_receiver_response.status_code == 200:
                        initial_receiver_balance = initial_receiver_response.json()
                        initial_receiver_iqd = initial_receiver_balance['wallet_balance_iqd']
                        print(f"Initial receiver balance: {initial_receiver_iqd} IQD")
                except Exception as e:
                    print(f"Could not get receiver balance: {e}")
                
                initial_transit_balance = self.test_transit_account_balance()
                if initial_transit_balance:
                    initial_transit_iqd = initial_transit_balance['balance_iqd']
                    print(f"Transit balance before reception: {initial_transit_iqd} IQD")
                
                # Note: We cannot fully test transfer reception due to Cloudinary image upload requirement
                # But we can test the search functionality
                print("\n--- Testing transfer search by code ---")
                try:
                    search_response = self.make_request('GET', f'/transfers/search/{transfer_code}', token=self.agent_basra_token)
                    if search_response.status_code == 200:
                        search_data = search_response.json()
                        if search_data.get('transfer_code') == transfer_code:
                            self.log_result("Transfer Search by Code", True, f"Transfer found: {search_data.get('sender_name')} -> {search_data.get('receiver_name')}")
                        else:
                            self.log_result("Transfer Search by Code", False, "Transfer code mismatch", search_data)
                    else:
                        self.log_result("Transfer Search by Code", False, f"Search failed: {search_response.status_code}", search_response.text)
                except Exception as e:
                    self.log_result("Transfer Search by Code", False, f"Search error: {str(e)}")
                
                # Clean up - cancel the transfer
                try:
                    cancel_response = self.make_request('PATCH', f'/transfers/{transfer_id}/cancel', token=self.agent_baghdad_token)
                    if cancel_response.status_code == 200:
                        print("✓ Test transfer cancelled for cleanup")
                except Exception as e:
                    print(f"Could not cancel test transfer: {e}")
                
                return True
            else:
                self.log_result("Reception Test - Transfer Creation", False, f"Failed: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Reception Test - Transfer Creation", False, f"Error: {str(e)}")
        
        return False
    
    def test_transit_account_balance(self):
        """Test GET /api/transit-account/balance (Admin only)"""
        print("\n=== Testing Transit Account Balance Endpoint ===")
        
        try:
            response = self.make_request('GET', '/transit-account/balance', token=self.admin_token)
            if response.status_code == 200:
                data = response.json()
                required_fields = ['balance_iqd', 'balance_usd', 'pending_transfers_count']
                
                missing_fields = [field for field in required_fields if field not in data]
                if not missing_fields:
                    self.log_result("Transit Account Balance", True, 
                                  f"Balance retrieved: IQD={data['balance_iqd']}, USD={data['balance_usd']}, Pending={data['pending_transfers_count']}")
                    return data
                else:
                    self.log_result("Transit Account Balance", False, f"Missing fields: {missing_fields}", data)
            else:
                self.log_result("Transit Account Balance", False, f"Failed with status {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Transit Account Balance", False, f"Error: {str(e)}")
        
        # Test admin-only access
        try:
            response = self.make_request('GET', '/transit-account/balance', token=self.agent_baghdad_token)
            if response.status_code == 403:
                self.log_result("Transit Account Balance - Agent Access", True, "Correctly rejected agent access")
            else:
                self.log_result("Transit Account Balance - Agent Access", False, f"Expected 403, got {response.status_code}")
        except Exception as e:
            self.log_result("Transit Account Balance - Agent Access", False, f"Error: {str(e)}")
        
        return None
    
    def test_transit_account_transactions(self):
        """Test GET /api/transit-account/transactions (Admin only)"""
        print("\n=== Testing Transit Account Transactions Endpoint ===")
        
        try:
            # Test with default limit
            response = self.make_request('GET', '/transit-account/transactions', token=self.admin_token)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Transit Account Transactions", True, f"Retrieved {len(data)} transactions")
                else:
                    self.log_result("Transit Account Transactions", False, "Response is not a list", data)
            else:
                self.log_result("Transit Account Transactions", False, f"Failed with status {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Transit Account Transactions", False, f"Error: {str(e)}")
        
        # Test with limit parameter
        try:
            params = {'limit': 10}
            response = self.make_request('GET', '/transit-account/transactions', token=self.admin_token, params=params)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) <= 10:
                    self.log_result("Transit Account Transactions - With Limit", True, f"Retrieved {len(data)} transactions (limit 10)")
                else:
                    self.log_result("Transit Account Transactions - With Limit", False, f"Expected max 10 transactions, got {len(data) if isinstance(data, list) else 'non-list'}")
            else:
                self.log_result("Transit Account Transactions - With Limit", False, f"Failed with status {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Transit Account Transactions - With Limit", False, f"Error: {str(e)}")
        
        # Test admin-only access
        try:
            response = self.make_request('GET', '/transit-account/transactions', token=self.agent_baghdad_token)
            if response.status_code == 403:
                self.log_result("Transit Account Transactions - Agent Access", True, "Correctly rejected agent access")
            else:
                self.log_result("Transit Account Transactions - Agent Access", False, f"Expected 403, got {response.status_code}")
        except Exception as e:
            self.log_result("Transit Account Transactions - Agent Access", False, f"Error: {str(e)}")
    
    def test_transit_account_pending_transfers(self):
        """Test GET /api/transit-account/pending-transfers (Admin only)"""
        print("\n=== Testing Transit Account Pending Transfers Endpoint ===")
        
        try:
            response = self.make_request('GET', '/transit-account/pending-transfers', token=self.admin_token)
            if response.status_code == 200:
                data = response.json()
                if 'pending_transfers' in data and 'totals' in data:
                    transfers = data['pending_transfers']
                    totals = data['totals']
                    self.log_result("Transit Account Pending Transfers", True, 
                                  f"Retrieved {len(transfers)} pending transfers. Totals: {totals}")
                    return data
                else:
                    self.log_result("Transit Account Pending Transfers", False, "Missing 'pending_transfers' or 'totals' fields", data)
            else:
                self.log_result("Transit Account Pending Transfers", False, f"Failed with status {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Transit Account Pending Transfers", False, f"Error: {str(e)}")
        
        # Test admin-only access
        try:
            response = self.make_request('GET', '/transit-account/pending-transfers', token=self.agent_baghdad_token)
            if response.status_code == 403:
                self.log_result("Transit Account Pending Transfers - Agent Access", True, "Correctly rejected agent access")
            else:
                self.log_result("Transit Account Pending Transfers - Agent Access", False, f"Expected 403, got {response.status_code}")
        except Exception as e:
            self.log_result("Transit Account Pending Transfers - Agent Access", False, f"Error: {str(e)}")
        
        return None
    
    # Removed commission testing methods - focus is now on Transit Account System
    
    def test_chart_of_accounts_delete_endpoint(self):
        """Test DELETE /api/accounting/accounts/{account_code} - Chart of Accounts DELETE functionality"""
        print("\n=== Testing Chart of Accounts DELETE Endpoint ===")
        
        # Step 1: Login as admin (already done in authentication)
        print("\n--- Step 1: Admin authentication verified ---")
        if not self.admin_token:
            self.log_result("Admin Authentication", False, "Admin token not available")
            return False
        
        # Step 2: Get list of accounts (GET /api/accounting/accounts)
        print("\n--- Step 2: Getting list of accounts ---")
        initial_accounts = []
        try:
            response = self.make_request('GET', '/accounting/accounts', token=self.admin_token)
            if response.status_code == 200:
                data = response.json()
                initial_accounts = data.get('accounts', [])
                self.log_result("Get Accounts List", True, f"Retrieved {len(initial_accounts)} accounts")
                
                # Display existing accounts
                if initial_accounts:
                    print("Existing accounts:")
                    for acc in initial_accounts[:3]:  # Show first 3
                        print(f"  - Code: {acc.get('code')}, Name: {acc.get('name_ar')}, Balance: {acc.get('balance', 0)}")
                else:
                    print("No existing accounts found")
            else:
                self.log_result("Get Accounts List", False, f"Failed with status {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Get Accounts List", False, f"Error: {str(e)}")
            return False
        
        # Step 3: Create test accounts for deletion testing
        print("\n--- Step 3: Creating test accounts ---")
        
        # Create parent account
        parent_account_data = {
            "code": "9999",
            "name_ar": "حساب اختبار رئيسي",
            "name_en": "Test Parent Account",
            "category": "أصول",
            "currency": "IQD"
        }
        
        parent_account_code = None
        try:
            response = self.make_request('POST', '/accounting/accounts', token=self.admin_token, json=parent_account_data)
            if response.status_code == 200:
                data = response.json()
                parent_account_code = data.get('code')
                self.log_result("Parent Account Creation", True, f"Parent account created: {parent_account_code}")
            else:
                self.log_result("Parent Account Creation", False, f"Failed with status {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Parent Account Creation", False, f"Error: {str(e)}")
            return False
        
        # Create child account
        child_account_data = {
            "code": "9999001",
            "name_ar": "حساب اختبار فرعي",
            "name_en": "Test Child Account",
            "category": "أصول",
            "parent_code": parent_account_code,
            "currency": "IQD"
        }
        
        child_account_code = None
        try:
            response = self.make_request('POST', '/accounting/accounts', token=self.admin_token, json=child_account_data)
            if response.status_code == 200:
                data = response.json()
                child_account_code = data.get('code')
                self.log_result("Child Account Creation", True, f"Child account created: {child_account_code}")
            else:
                self.log_result("Child Account Creation", False, f"Failed with status {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Child Account Creation", False, f"Error: {str(e)}")
            return False
        
        # Create standalone account for successful deletion test
        standalone_account_data = {
            "code": "8888",
            "name_ar": "حساب اختبار مستقل",
            "name_en": "Test Standalone Account",
            "category": "مصاريف",
            "currency": "IQD"
        }
        
        standalone_account_code = None
        try:
            response = self.make_request('POST', '/accounting/accounts', token=self.admin_token, json=standalone_account_data)
            if response.status_code == 200:
                data = response.json()
                standalone_account_code = data.get('code')
                self.log_result("Standalone Account Creation", True, f"Standalone account created: {standalone_account_code}")
            else:
                self.log_result("Standalone Account Creation", False, f"Failed with status {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Standalone Account Creation", False, f"Error: {str(e)}")
            return False
        
        # Step 4: Test successful deletion (standalone account with zero balance)
        print("\n--- Step 4: Testing successful deletion ---")
        try:
            response = self.make_request('DELETE', f'/accounting/accounts/{standalone_account_code}', token=self.admin_token)
            if response.status_code == 200:
                data = response.json()
                self.log_result("Successful Account DELETE", True, f"Account deleted successfully: {data.get('message', 'Success')}")
            else:
                self.log_result("Successful Account DELETE", False, f"Delete failed with status {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Successful Account DELETE", False, f"Error: {str(e)}")
        
        # Step 5: Verify deletion persists in database
        print("\n--- Step 5: Verifying deletion persists ---")
        try:
            response = self.make_request('GET', '/accounting/accounts', token=self.admin_token)
            if response.status_code == 200:
                data = response.json()
                accounts_after = data.get('accounts', [])
                account_still_exists = any(acc.get('code') == standalone_account_code for acc in accounts_after)
                if not account_still_exists:
                    self.log_result("Deletion Verification", True, f"Account {standalone_account_code} successfully removed from database")
                else:
                    self.log_result("Deletion Verification", False, f"Account {standalone_account_code} still exists after deletion")
            else:
                self.log_result("Deletion Verification", False, f"Failed to verify deletion: {response.status_code}")
        except Exception as e:
            self.log_result("Deletion Verification", False, f"Error: {str(e)}")
        
        # Step 6: Test deletion of account with child accounts (should fail)
        print("\n--- Step 6: Testing deletion of account with children ---")
        try:
            response = self.make_request('DELETE', f'/accounting/accounts/{parent_account_code}', token=self.admin_token)
            if response.status_code == 400:
                self.log_result("Delete Account with Children", True, "Correctly rejected deletion of account with children (400)")
            else:
                self.log_result("Delete Account with Children", False, f"Expected 400, got {response.status_code}")
        except Exception as e:
            self.log_result("Delete Account with Children", False, f"Error: {str(e)}")
        
        # Step 7: Test authentication & authorization
        print("\n--- Step 7: Testing authentication & authorization ---")
        
        # Test with agent token (should fail)
        try:
            response = self.make_request('DELETE', f'/accounting/accounts/{child_account_code}', token=self.agent_baghdad_token)
            if response.status_code == 403:
                self.log_result("Agent Access Rejection", True, "Correctly rejected agent access (403)")
            else:
                self.log_result("Agent Access Rejection", False, f"Expected 403, got {response.status_code}")
        except Exception as e:
            self.log_result("Agent Access Rejection", False, f"Error: {str(e)}")
        
        # Test without authentication
        try:
            response = self.make_request('DELETE', f'/accounting/accounts/{child_account_code}')  # No token
            if response.status_code in [401, 403]:
                self.log_result("No Auth Rejection", True, f"Correctly rejected unauthenticated request ({response.status_code})")
            else:
                self.log_result("No Auth Rejection", False, f"Expected 401/403, got {response.status_code}")
        except Exception as e:
            self.log_result("No Auth Rejection", False, f"Error: {str(e)}")
        
        # Step 8: Test error cases
        print("\n--- Step 8: Testing error cases ---")
        
        # Test with non-existent account code
        try:
            fake_account_code = "NONEXISTENT999"
            response = self.make_request('DELETE', f'/accounting/accounts/{fake_account_code}', token=self.admin_token)
            if response.status_code == 404:
                self.log_result("Account Not Found Error", True, "Correctly returned 404 for non-existent account")
            else:
                self.log_result("Account Not Found Error", False, f"Expected 404, got {response.status_code}")
        except Exception as e:
            self.log_result("Account Not Found Error", False, f"Error: {str(e)}")
        
        # Step 9: Test integration with existing endpoints
        print("\n--- Step 9: Testing integration with existing endpoints ---")
        
        # Test POST endpoint still works
        try:
            new_account_data = {
                "code": "7777",
                "name_ar": "حساب اختبار جديد",
                "name_en": "New Test Account",
                "category": "إيرادات",
                "currency": "USD"
            }
            response = self.make_request('POST', '/accounting/accounts', token=self.admin_token, json=new_account_data)
            if response.status_code == 200:
                self.log_result("POST Integration Test", True, "POST endpoint still working after DELETE tests")
                
                # Clean up the new account
                self.make_request('DELETE', f'/accounting/accounts/7777', token=self.admin_token)
            else:
                self.log_result("POST Integration Test", False, f"POST failed with status {response.status_code}")
        except Exception as e:
            self.log_result("POST Integration Test", False, f"Error: {str(e)}")
        
        # Step 10: Clean up test accounts
        print("\n--- Step 10: Cleaning up test accounts ---")
        
        # Delete child account first
        if child_account_code:
            try:
                response = self.make_request('DELETE', f'/accounting/accounts/{child_account_code}', token=self.admin_token)
                if response.status_code == 200:
                    print(f"✓ Cleaned up child account: {child_account_code}")
                else:
                    print(f"⚠ Could not clean up child account: {response.status_code}")
            except Exception as e:
                print(f"⚠ Error cleaning up child account: {e}")
        
        # Delete parent account
        if parent_account_code:
            try:
                response = self.make_request('DELETE', f'/accounting/accounts/{parent_account_code}', token=self.admin_token)
                if response.status_code == 200:
                    print(f"✓ Cleaned up parent account: {parent_account_code}")
                else:
                    print(f"⚠ Could not clean up parent account: {response.status_code}")
            except Exception as e:
                print(f"⚠ Error cleaning up parent account: {e}")
        
        return True

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Backend API Tests for Commission Rate DELETE Endpoint")
        print("=" * 70)
        
        # Step 1: Authentication
        if not self.test_authentication():
            print("❌ Authentication failed. Cannot proceed with other tests.")
            return
        
        # Step 2: Test Commission Rate DELETE Endpoint (MAIN FOCUS)
        print("\n📊 Testing Commission Rate DELETE Endpoint")
        self.test_commission_rate_delete_endpoint()
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  • {result['test']}: {result['message']}")
        
        print("\n" + "=" * 60)

if __name__ == "__main__":
    tester = APITester()
    tester.run_all_tests()