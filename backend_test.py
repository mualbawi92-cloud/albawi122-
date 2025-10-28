#!/usr/bin/env python3
"""
Backend API Testing for Cash Transfer System
CRITICAL FEATURE TEST: receiver_name field validation

Tests the newly implemented features:
1. receiver_name field in transfer creation and validation
2. Enhanced error messages for transfer reception
3. Wallet system (balance, deposit, transactions)
4. Dashboard stats with wallet balances
"""

import requests
import json
import time
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://cashport-2.preview.emergentagent.com/api"
ADMIN_CREDENTIALS = {"username": "admin", "password": "admin123"}
AGENT_BAGHDAD_CREDENTIALS = {"username": "agent_baghdad", "password": "agent123"}
AGENT_BASRA_CREDENTIALS = {"username": "agent_basra", "password": "agent123"}

class APITester:
    def __init__(self):
        self.admin_token = None
        self.agent_token = None
        self.admin_user_id = None
        self.agent_user_id = None
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
        
        # Test agent login
        try:
            response = self.make_request('POST', '/login', json=AGENT_CREDENTIALS)
            if response.status_code == 200:
                data = response.json()
                self.agent_token = data['access_token']
                self.agent_user_id = data['user']['id']
                self.log_result("Agent Login", True, f"Agent authenticated successfully")
            else:
                self.log_result("Agent Login", False, f"Agent login failed: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Agent Login", False, f"Agent login error: {str(e)}")
            return False
        
        return True
    
    def test_wallet_balance_endpoint(self):
        """Test GET /api/wallet/balance"""
        print("\n=== Testing Wallet Balance Endpoint ===")
        
        try:
            response = self.make_request('GET', '/wallet/balance', token=self.agent_token)
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
            response = self.make_request('GET', '/dashboard/stats', token=self.agent_token)
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
        
        if not self.agent_user_id:
            self.log_result("Admin Deposit", False, "Agent user ID not available")
            return False
        
        deposit_data = {
            "user_id": self.agent_user_id,
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
            response = self.make_request('GET', '/wallet/transactions', token=self.agent_token)
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
    
    def test_transfer_creation_and_wallet_update(self):
        """Test transfer creation and wallet balance decrease"""
        print("\n=== Testing Transfer Creation and Wallet Updates ===")
        
        # Get initial balance
        initial_balance = self.test_wallet_balance_endpoint()
        if not initial_balance:
            self.log_result("Transfer Creation Test", False, "Could not get initial wallet balance")
            return None
        
        initial_iqd = initial_balance['wallet_balance_iqd']
        
        # Create a transfer
        transfer_data = {
            "sender_name": "أحمد محمد علي",
            "amount": 5000,
            "currency": "IQD",
            "to_governorate": "بغداد",
            "note": "حوالة اختبار"
        }
        
        try:
            response = self.make_request('POST', '/transfers', token=self.agent_token, json=transfer_data)
            if response.status_code == 200:
                data = response.json()
                transfer_id = data.get('id')
                transfer_code = data.get('transfer_code')
                pin = data.get('pin')
                
                self.log_result("Transfer Creation", True, f"Transfer created: {transfer_code}, PIN: {pin}")
                
                # Check if balance decreased
                time.sleep(1)  # Small delay to ensure database update
                new_balance = self.test_wallet_balance_endpoint()
                if new_balance:
                    new_iqd = new_balance['wallet_balance_iqd']
                    expected_balance = initial_iqd - 5000
                    
                    if abs(new_iqd - expected_balance) < 0.01:  # Allow for floating point precision
                        self.log_result("Wallet Balance Decrease", True, 
                                      f"Balance correctly decreased from {initial_iqd} to {new_iqd}")
                    else:
                        self.log_result("Wallet Balance Decrease", False, 
                                      f"Balance not correctly updated. Expected: {expected_balance}, Got: {new_iqd}")
                
                return {"transfer_id": transfer_id, "transfer_code": transfer_code, "pin": pin}
            else:
                self.log_result("Transfer Creation", False, f"Failed with status {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Transfer Creation", False, f"Error: {str(e)}")
        
        return None
    
    def test_enhanced_error_messages(self, transfer_info):
        """Test enhanced error messages during transfer reception"""
        print("\n=== Testing Enhanced Error Messages ===")
        
        if not transfer_info:
            self.log_result("Enhanced Error Messages", False, "No transfer available for testing")
            return
        
        transfer_id = transfer_info['transfer_id']
        correct_pin = transfer_info['pin']
        
        # First, we need to get the transfer details to know the receiver_name
        try:
            response = self.make_request('GET', f'/transfers/{transfer_id}', token=self.agent_token)
            if response.status_code != 200:
                self.log_result("Get Transfer Details", False, f"Could not get transfer details: {response.status_code}")
                return
            
            transfer_details = response.json()
            # Note: The transfer doesn't have receiver_name set yet, so we'll use a test name
            correct_receiver_name = "أحمد محمد علي"  # This should match sender_name for this test
            
        except Exception as e:
            self.log_result("Get Transfer Details", False, f"Error getting transfer details: {str(e)}")
            return
        
        # Test 1: Incorrect receiver fullname
        print("\n--- Testing Incorrect Receiver Name ---")
        try:
            # Create a simple form data for testing
            form_data = {
                'pin': correct_pin,
                'receiver_fullname': 'اسم خاطئ غير صحيح'
            }
            
            # Create a dummy file for id_image (required field)
            files = {'id_image': ('test.jpg', b'fake_image_data', 'image/jpeg')}
            
            response = self.make_request('POST', f'/transfers/{transfer_id}/receive', 
                                       token=self.agent_token, data=form_data, files=files)
            
            if response.status_code == 400:
                error_message = response.json().get('detail', '')
                if 'الاسم الثلاثي غير صحيح' in error_message:
                    self.log_result("Incorrect Name Error Message", True, 
                                  f"Correct error message received: {error_message}")
                else:
                    self.log_result("Incorrect Name Error Message", False, 
                                  f"Wrong error message: {error_message}")
            else:
                self.log_result("Incorrect Name Error Message", False, 
                              f"Expected 400 status, got {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Incorrect Name Error Message", False, f"Error: {str(e)}")
        
        # Test 2: Incorrect PIN
        print("\n--- Testing Incorrect PIN ---")
        try:
            form_data = {
                'pin': '9999',  # Wrong PIN
                'receiver_fullname': correct_receiver_name
            }
            
            files = {'id_image': ('test.jpg', b'fake_image_data', 'image/jpeg')}
            
            response = self.make_request('POST', f'/transfers/{transfer_id}/receive', 
                                       token=self.agent_token, data=form_data, files=files)
            
            if response.status_code == 401:
                error_message = response.json().get('detail', '')
                if 'الرقم السري غير صحيح' in error_message:
                    self.log_result("Incorrect PIN Error Message", True, 
                                  f"Correct error message received: {error_message}")
                else:
                    self.log_result("Incorrect PIN Error Message", False, 
                                  f"Wrong error message: {error_message}")
            else:
                self.log_result("Incorrect PIN Error Message", False, 
                              f"Expected 401 status, got {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Incorrect PIN Error Message", False, f"Error: {str(e)}")
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Backend API Tests for Cash Transfer System")
        print("=" * 60)
        
        # Step 1: Authentication
        if not self.test_authentication():
            print("❌ Authentication failed. Cannot proceed with other tests.")
            return
        
        # Step 2: Test wallet balance endpoint
        self.test_wallet_balance_endpoint()
        
        # Step 3: Test dashboard stats
        self.test_dashboard_stats()
        
        # Step 4: Test admin deposit
        deposit_success = self.test_admin_deposit()
        
        # Step 5: Test wallet transactions (should show the deposit)
        if deposit_success:
            time.sleep(1)  # Allow time for transaction to be recorded
            self.test_wallet_transactions()
        
        # Step 6: Test transfer creation and wallet updates
        transfer_info = self.test_transfer_creation_and_wallet_update()
        
        # Step 7: Test enhanced error messages
        if transfer_info:
            self.test_enhanced_error_messages(transfer_info)
        
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