#!/usr/bin/env python3
"""
Backend API Testing for Cash Transfer System
FOCUS: Commission Calculate Preview Endpoint

Tests the commission calculation preview endpoint:
1. GET /api/commission/calculate-preview with valid parameters
2. Test with different amounts and currencies (IQD, USD)
3. Test with missing parameters
4. Test with invalid amounts (0, negative)
5. Test authentication requirements
"""

import requests
import json
import time
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://agentpay-1.preview.emergentagent.com/api"
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
            response = self.make_request('POST', '/transfers', token=self.agent_baghdad_token, json=transfer_data)
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
    
    def test_commission_calculate_preview(self):
        """Test GET /api/commission/calculate-preview endpoint"""
        print("\n=== Testing Commission Calculate Preview Endpoint ===")
        
        # Test 1: Valid parameters with IQD amount=1000000, to_governorate=BG
        print("\n--- Test 1: Valid IQD parameters (1,000,000 IQD to BG) ---")
        try:
            params = {
                'amount': 1000000,
                'currency': 'IQD',
                'to_governorate': 'BG'
            }
            
            response = self.make_request('GET', '/commission/calculate-preview', 
                                       token=self.agent_baghdad_token, params=params)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ['commission_percentage', 'commission_amount', 'currency']
                
                missing_fields = [field for field in required_fields if field not in data]
                if not missing_fields:
                    self.log_result("Commission Preview - Valid IQD", True, 
                                  f"Commission: {data['commission_percentage']}% = {data['commission_amount']} {data['currency']}")
                else:
                    self.log_result("Commission Preview - Valid IQD", False, 
                                  f"Missing required fields: {missing_fields}", data)
            else:
                self.log_result("Commission Preview - Valid IQD", False, 
                              f"Failed with status {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Commission Preview - Valid IQD", False, f"Error: {str(e)}")
        
        # Test 2: Valid parameters with USD amount=5000, to_governorate=BS
        print("\n--- Test 2: Valid USD parameters (5,000 USD to BS) ---")
        try:
            params = {
                'amount': 5000,
                'currency': 'USD',
                'to_governorate': 'BS'
            }
            
            response = self.make_request('GET', '/commission/calculate-preview', 
                                       token=self.agent_baghdad_token, params=params)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ['commission_percentage', 'commission_amount', 'currency']
                
                missing_fields = [field for field in required_fields if field not in data]
                if not missing_fields:
                    self.log_result("Commission Preview - Valid USD", True, 
                                  f"Commission: {data['commission_percentage']}% = {data['commission_amount']} {data['currency']}")
                else:
                    self.log_result("Commission Preview - Valid USD", False, 
                                  f"Missing required fields: {missing_fields}", data)
            else:
                self.log_result("Commission Preview - Valid USD", False, 
                              f"Failed with status {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Commission Preview - Valid USD", False, f"Error: {str(e)}")
        
        # Test 3: Missing parameters
        print("\n--- Test 3: Missing parameters ---")
        try:
            # Missing amount parameter
            params = {
                'currency': 'IQD',
                'to_governorate': 'BG'
            }
            
            response = self.make_request('GET', '/commission/calculate-preview', 
                                       token=self.agent_baghdad_token, params=params)
            
            if response.status_code == 422:  # FastAPI validation error
                self.log_result("Commission Preview - Missing Amount", True, 
                              "Correctly rejected request with missing amount parameter")
            else:
                self.log_result("Commission Preview - Missing Amount", False, 
                              f"Expected 422 status, got {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Commission Preview - Missing Amount", False, f"Error: {str(e)}")
        
        # Test 4: Invalid amount (0)
        print("\n--- Test 4: Invalid amount (0) ---")
        try:
            params = {
                'amount': 0,
                'currency': 'IQD',
                'to_governorate': 'BG'
            }
            
            response = self.make_request('GET', '/commission/calculate-preview', 
                                       token=self.agent_baghdad_token, params=params)
            
            if response.status_code == 200:
                data = response.json()
                # Should return 0 commission for invalid amount
                if data.get('commission_percentage') == 0.0 and data.get('commission_amount') == 0.0:
                    self.log_result("Commission Preview - Zero Amount", True, 
                                  "Correctly returned 0 commission for zero amount")
                else:
                    self.log_result("Commission Preview - Zero Amount", False, 
                                  f"Expected 0 commission, got: {data}")
            else:
                self.log_result("Commission Preview - Zero Amount", False, 
                              f"Unexpected status {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Commission Preview - Zero Amount", False, f"Error: {str(e)}")
        
        # Test 5: Invalid amount (negative)
        print("\n--- Test 5: Invalid amount (negative) ---")
        try:
            params = {
                'amount': -1000,
                'currency': 'IQD',
                'to_governorate': 'BG'
            }
            
            response = self.make_request('GET', '/commission/calculate-preview', 
                                       token=self.agent_baghdad_token, params=params)
            
            if response.status_code == 200:
                data = response.json()
                # Should return 0 commission for invalid amount
                if data.get('commission_percentage') == 0.0 and data.get('commission_amount') == 0.0:
                    self.log_result("Commission Preview - Negative Amount", True, 
                                  "Correctly returned 0 commission for negative amount")
                else:
                    self.log_result("Commission Preview - Negative Amount", False, 
                                  f"Expected 0 commission, got: {data}")
            else:
                self.log_result("Commission Preview - Negative Amount", False, 
                              f"Unexpected status {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Commission Preview - Negative Amount", False, f"Error: {str(e)}")
        
        # Test 6: Authentication required
        print("\n--- Test 6: Authentication required ---")
        try:
            params = {
                'amount': 1000,
                'currency': 'IQD',
                'to_governorate': 'BG'
            }
            
            response = self.make_request('GET', '/commission/calculate-preview', 
                                       token=None, params=params)  # No token
            
            if response.status_code == 403:  # Forbidden
                self.log_result("Commission Preview - No Auth", True, 
                              "Correctly rejected request without authentication")
            else:
                self.log_result("Commission Preview - No Auth", False, 
                              f"Expected 403 status, got {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Commission Preview - No Auth", False, f"Error: {str(e)}")
    
    def test_commission_with_rates(self):
        """Test commission calculation with configured rates"""
        print("\n=== Testing Commission with Configured Rates ===")
        
        # First, create a commission rate for the agent
        print("\n--- Setting up commission rate ---")
        commission_rate_data = {
            "agent_id": self.agent_baghdad_user_id,
            "currency": "IQD",
            "bulletin_type": "transfers",
            "date": "2024-01-01",
            "tiers": [
                {
                    "from_amount": 0,
                    "to_amount": 1000000,
                    "percentage": 1.5,
                    "city": "(جميع المدن)",
                    "country": "(جميع البلدان)",
                    "currency_type": "normal",
                    "type": "outgoing"
                },
                {
                    "from_amount": 1000000,
                    "to_amount": 10000000,
                    "percentage": 1.0,
                    "city": "(جميع المدن)",
                    "country": "(جميع البلدان)",
                    "currency_type": "normal",
                    "type": "outgoing"
                }
            ]
        }
        
        try:
            response = self.make_request('POST', '/commission-rates', 
                                       token=self.admin_token, json=commission_rate_data)
            
            if response.status_code == 200:
                self.log_result("Commission Rate Creation", True, "Commission rate created successfully")
                
                # Now test the preview with the configured rate
                print("\n--- Testing preview with configured rate (500,000 IQD) ---")
                params = {
                    'amount': 500000,
                    'currency': 'IQD',
                    'to_governorate': 'BG'
                }
                
                response = self.make_request('GET', '/commission/calculate-preview', 
                                           token=self.agent_baghdad_token, params=params)
                
                if response.status_code == 200:
                    data = response.json()
                    expected_percentage = 1.5
                    expected_amount = 500000 * 1.5 / 100  # 7500
                    
                    if (abs(data['commission_percentage'] - expected_percentage) < 0.01 and 
                        abs(data['commission_amount'] - expected_amount) < 0.01):
                        self.log_result("Commission Preview - With Rate (500K)", True, 
                                      f"Correct commission: {data['commission_percentage']}% = {data['commission_amount']} IQD")
                    else:
                        self.log_result("Commission Preview - With Rate (500K)", False, 
                                      f"Wrong commission. Expected: {expected_percentage}% = {expected_amount}, Got: {data['commission_percentage']}% = {data['commission_amount']}")
                else:
                    self.log_result("Commission Preview - With Rate (500K)", False, 
                                  f"Failed with status {response.status_code}", response.text)
                
                # Test with higher amount (different tier)
                print("\n--- Testing preview with higher amount (2,000,000 IQD) ---")
                params = {
                    'amount': 2000000,
                    'currency': 'IQD',
                    'to_governorate': 'BG'
                }
                
                response = self.make_request('GET', '/commission/calculate-preview', 
                                           token=self.agent_baghdad_token, params=params)
                
                if response.status_code == 200:
                    data = response.json()
                    expected_percentage = 1.0  # Second tier
                    expected_amount = 2000000 * 1.0 / 100  # 20000
                    
                    if (abs(data['commission_percentage'] - expected_percentage) < 0.01 and 
                        abs(data['commission_amount'] - expected_amount) < 0.01):
                        self.log_result("Commission Preview - With Rate (2M)", True, 
                                      f"Correct commission: {data['commission_percentage']}% = {data['commission_amount']} IQD")
                    else:
                        self.log_result("Commission Preview - With Rate (2M)", False, 
                                      f"Wrong commission. Expected: {expected_percentage}% = {expected_amount}, Got: {data['commission_percentage']}% = {data['commission_amount']}")
                else:
                    self.log_result("Commission Preview - With Rate (2M)", False, 
                                  f"Failed with status {response.status_code}", response.text)
                
            else:
                self.log_result("Commission Rate Creation", False, 
                              f"Failed to create commission rate: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Commission Rate Creation", False, f"Error: {str(e)}")
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Backend API Tests for Commission Calculate Preview Endpoint")
        print("=" * 60)
        
        # Step 1: Authentication
        if not self.test_authentication():
            print("❌ Authentication failed. Cannot proceed with other tests.")
            return
        
        # Step 2: Test commission calculate preview endpoint (MAIN FOCUS)
        self.test_commission_calculate_preview()
        
        # Step 3: Test commission calculation with configured rates
        self.test_commission_with_rates()
        
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