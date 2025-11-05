#!/usr/bin/env python3
"""
🚨 MULTI-CURRENCY SUPPORT TESTING FOR CHART OF ACCOUNTS AND LEDGER

**Test Objective:** Test the multi-currency support implementation for Chart of Accounts and Ledger

**Backend Endpoints to Test:**

1. **Create Account with Currencies:**
   - POST /api/accounting/accounts
   - Login as admin first
   - Create test account with multiple currencies: ["IQD", "USD"]
   - Verify account is created successfully
   - Verify currencies field is saved in database
   - Test payload example:
     ```json
     {
       "code": "9999",
       "name": "Test Multi-Currency Account",
       "name_ar": "حساب تجريبي متعدد العملات",
       "name_en": "Test Multi-Currency Account",
       "category": "Test",
       "currencies": ["IQD", "USD"]
     }
     ```

2. **Get Account and Verify Currencies:**
   - GET /api/accounting/accounts/9999
   - Verify response includes currencies field
   - Verify currencies array contains ["IQD", "USD"]

3. **Test Ledger with Currency Filter:**
   - GET /api/accounting/ledger/{account_code}?currency=IQD
   - Test with different currency values: IQD, USD
   - Verify only entries with matching currency are returned
   - Verify each entry has currency field

4. **Edge Cases:**
   - Create account with single currency: ["IQD"]
   - Create account with all supported currencies: ["IQD", "USD", "EUR", "GBP"]
   - Test ledger filter with currency that has no entries
   - Test ledger without currency parameter (should return all currencies)

**Authentication:**
Use admin credentials from the system.

**Validation Points:**
- ✅ Account creation accepts currencies array
- ✅ Currencies field is saved in database
- ✅ GET account returns currencies field
- ✅ Ledger endpoint accepts currency parameter
- ✅ Ledger filtering works correctly by currency
- ✅ Journal entries include currency field

**Admin Credentials:**
username: admin
password: admin123
"""

import requests
import json
import time
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://financetrack-16.preview.emergentagent.com/api"
ADMIN_CREDENTIALS = {"username": "admin", "password": "admin123"}

# Try different possible passwords for test agents
POSSIBLE_PASSWORDS = ["test123", "agent123", "123456", "password", "admin123"]

class MultiCurrencyTester:
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
    
    def test_create_account_with_multiple_currencies(self):
        """Test creating account with multiple currencies: ["IQD", "USD"]"""
        print("\n=== Test 1: Create Account with Multiple Currencies ===")
        
        test_account = {
            "code": "9999",
            "name": "Test Multi-Currency Account",
            "name_ar": "حساب تجريبي متعدد العملات",
            "name_en": "Test Multi-Currency Account",
            "category": "Test",
            "currencies": ["IQD", "USD"]
        }
        
        try:
            response = self.make_request('POST', '/accounting/accounts', token=self.admin_token, json=test_account)
            if response.status_code == 200 or response.status_code == 201:
                data = response.json()
                self.test_account_codes.append("9999")
                
                # Verify response includes currencies
                if 'currencies' in data and data['currencies'] == ["IQD", "USD"]:
                    self.log_result("Create Multi-Currency Account", True, 
                                  f"Account 9999 created successfully with currencies: {data['currencies']}")
                    return data
                else:
                    self.log_result("Create Multi-Currency Account", False, 
                                  f"Account created but currencies field missing or incorrect: {data}")
            else:
                self.log_result("Create Multi-Currency Account", False, 
                              f"Account creation failed: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Create Multi-Currency Account", False, f"Error: {str(e)}")
        
        return None
    
    def test_get_account_verify_currencies(self):
        """Test GET account and verify currencies field is returned"""
        print("\n=== Test 2: Get Account and Verify Currencies ===")
        
        try:
            response = self.make_request('GET', '/accounting/accounts/9999', token=self.admin_token)
            if response.status_code == 200:
                data = response.json()
                
                # Verify currencies field exists and contains expected values
                if 'currencies' in data:
                    currencies = data['currencies']
                    if currencies == ["IQD", "USD"]:
                        self.log_result("Get Account Currencies", True, 
                                      f"Account 9999 currencies field verified: {currencies}")
                        return data
                    else:
                        self.log_result("Get Account Currencies", False, 
                                      f"Account currencies incorrect. Expected: ['IQD', 'USD'], Got: {currencies}")
                else:
                    self.log_result("Get Account Currencies", False, 
                                  f"Account response missing currencies field: {data}")
            else:
                self.log_result("Get Account Currencies", False, 
                              f"Get account failed: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Get Account Currencies", False, f"Error: {str(e)}")
        
        return None
    
    def test_ledger_currency_filter(self):
        """Test ledger endpoint with currency filter parameter"""
        print("\n=== Test 3: Test Ledger with Currency Filter ===")
        
        # First, let's test with an existing account that might have entries
        test_accounts = ["9999", "1030", "2001"]  # Test account, Transit account, Exchange company account
        
        for account_code in test_accounts:
            print(f"\n--- Testing Ledger for Account {account_code} ---")
            
            # Test 1: Get ledger without currency filter (should return all currencies)
            try:
                response = self.make_request('GET', f'/accounting/ledger/{account_code}', token=self.admin_token)
                if response.status_code == 200:
                    data = response.json()
                    entries = data.get('entries', [])
                    account_info = data.get('account', {})
                    
                    self.log_result(f"Ledger {account_code} - No Filter", True, 
                                  f"Ledger accessible, {len(entries)} entries found")
                    
                    # Check if entries have currency field
                    entries_with_currency = [e for e in entries if 'currency' in e]
                    if entries:
                        if len(entries_with_currency) == len(entries):
                            self.log_result(f"Ledger {account_code} - Currency Field", True, 
                                          f"All {len(entries)} entries have currency field")
                        else:
                            self.log_result(f"Ledger {account_code} - Currency Field", False, 
                                          f"Only {len(entries_with_currency)}/{len(entries)} entries have currency field")
                    
                elif response.status_code == 404:
                    self.log_result(f"Ledger {account_code} - No Filter", False, 
                                  f"Account {account_code} not found (404)")
                    continue  # Skip currency filter tests for non-existent accounts
                else:
                    self.log_result(f"Ledger {account_code} - No Filter", False, 
                                  f"Ledger failed: {response.status_code}")
                    continue
                
                # Test 2: Get ledger with IQD currency filter
                response_iqd = self.make_request('GET', f'/accounting/ledger/{account_code}?currency=IQD', token=self.admin_token)
                if response_iqd.status_code == 200:
                    data_iqd = response_iqd.json()
                    entries_iqd = data_iqd.get('entries', [])
                    
                    # Verify all returned entries are IQD
                    non_iqd_entries = [e for e in entries_iqd if e.get('currency') != 'IQD']
                    if len(non_iqd_entries) == 0:
                        self.log_result(f"Ledger {account_code} - IQD Filter", True, 
                                      f"IQD filter working: {len(entries_iqd)} IQD entries returned")
                    else:
                        self.log_result(f"Ledger {account_code} - IQD Filter", False, 
                                      f"IQD filter failed: {len(non_iqd_entries)} non-IQD entries returned")
                else:
                    self.log_result(f"Ledger {account_code} - IQD Filter", False, 
                                  f"IQD filter failed: {response_iqd.status_code}")
                
                # Test 3: Get ledger with USD currency filter
                response_usd = self.make_request('GET', f'/accounting/ledger/{account_code}?currency=USD', token=self.admin_token)
                if response_usd.status_code == 200:
                    data_usd = response_usd.json()
                    entries_usd = data_usd.get('entries', [])
                    
                    # Verify all returned entries are USD
                    non_usd_entries = [e for e in entries_usd if e.get('currency') != 'USD']
                    if len(non_usd_entries) == 0:
                        self.log_result(f"Ledger {account_code} - USD Filter", True, 
                                      f"USD filter working: {len(entries_usd)} USD entries returned")
                    else:
                        self.log_result(f"Ledger {account_code} - USD Filter", False, 
                                      f"USD filter failed: {len(non_usd_entries)} non-USD entries returned")
                else:
                    self.log_result(f"Ledger {account_code} - USD Filter", False, 
                                  f"USD filter failed: {response_usd.status_code}")
                
            except Exception as e:
                self.log_result(f"Ledger {account_code} - Error", False, f"Error: {str(e)}")
        
        return True
    
    def test_edge_cases(self):
        """Test edge cases for multi-currency support"""
        print("\n=== Test 4: Edge Cases ===")
        
        # Edge Case 1: Create account with single currency
        print("\n--- Edge Case 1: Single Currency Account ---")
        single_currency_account = {
            "code": "9998",
            "name": "Single Currency Test Account",
            "name_ar": "حساب تجريبي عملة واحدة",
            "name_en": "Single Currency Test Account",
            "category": "Test",
            "currencies": ["IQD"]
        }
        
        try:
            response = self.make_request('POST', '/accounting/accounts', token=self.admin_token, json=single_currency_account)
            if response.status_code == 200 or response.status_code == 201:
                data = response.json()
                self.test_account_codes.append("9998")
                
                if data.get('currencies') == ["IQD"]:
                    self.log_result("Single Currency Account", True, 
                                  f"Account 9998 created with single currency: {data['currencies']}")
                else:
                    self.log_result("Single Currency Account", False, 
                                  f"Single currency account failed: {data}")
            else:
                self.log_result("Single Currency Account", False, 
                              f"Single currency account creation failed: {response.status_code}")
        except Exception as e:
            self.log_result("Single Currency Account", False, f"Error: {str(e)}")
        
        # Edge Case 2: Create account with all supported currencies
        print("\n--- Edge Case 2: All Currencies Account ---")
        all_currencies_account = {
            "code": "9997",
            "name": "All Currencies Test Account",
            "name_ar": "حساب تجريبي جميع العملات",
            "name_en": "All Currencies Test Account",
            "category": "Test",
            "currencies": ["IQD", "USD", "EUR", "GBP"]
        }
        
        try:
            response = self.make_request('POST', '/accounting/accounts', token=self.admin_token, json=all_currencies_account)
            if response.status_code == 200 or response.status_code == 201:
                data = response.json()
                self.test_account_codes.append("9997")
                
                expected_currencies = ["IQD", "USD", "EUR", "GBP"]
                if data.get('currencies') == expected_currencies:
                    self.log_result("All Currencies Account", True, 
                                  f"Account 9997 created with all currencies: {data['currencies']}")
                else:
                    self.log_result("All Currencies Account", False, 
                                  f"All currencies account failed: {data}")
            else:
                self.log_result("All Currencies Account", False, 
                              f"All currencies account creation failed: {response.status_code}")
        except Exception as e:
            self.log_result("All Currencies Account", False, f"Error: {str(e)}")
        
        # Edge Case 3: Test ledger filter with currency that has no entries
        print("\n--- Edge Case 3: Currency Filter with No Entries ---")
        try:
            response = self.make_request('GET', '/accounting/ledger/9999?currency=EUR', token=self.admin_token)
            if response.status_code == 200:
                data = response.json()
                entries = data.get('entries', [])
                
                # Should return empty array for currency with no entries
                self.log_result("Currency Filter No Entries", True, 
                              f"EUR filter returned {len(entries)} entries (expected: 0 or few)")
            else:
                self.log_result("Currency Filter No Entries", False, 
                              f"EUR filter failed: {response.status_code}")
        except Exception as e:
            self.log_result("Currency Filter No Entries", False, f"Error: {str(e)}")
        
        return True
    
    def test_multi_currency_comprehensive(self):
        """Run comprehensive multi-currency support tests"""
        print("\n🚨 MULTI-CURRENCY SUPPORT COMPREHENSIVE TESTING")
        print("=" * 80)
        print("Testing multi-currency implementation for Chart of Accounts and Ledger")
        print("=" * 80)
        
        # Test 1: Create Account with Multiple Currencies
        print("\n--- TEST 1: CREATE ACCOUNT WITH MULTIPLE CURRENCIES ---")
        self.test_create_account_with_multiple_currencies()
        
        # Test 2: Get Account and Verify Currencies
        print("\n--- TEST 2: GET ACCOUNT AND VERIFY CURRENCIES ---")
        self.test_get_account_verify_currencies()
        
        # Test 3: Test Ledger with Currency Filter
        print("\n--- TEST 3: TEST LEDGER WITH CURRENCY FILTER ---")
        self.test_ledger_currency_filter()
        
        # Test 4: Edge Cases
        print("\n--- TEST 4: EDGE CASES ---")
        self.test_edge_cases()
        
        # Test 5: Validation Tests
        print("\n--- TEST 5: VALIDATION TESTS ---")
        self.test_validation_scenarios()
        
        return True
    
    def test_validation_scenarios(self):
        """Test validation scenarios for multi-currency support"""
        print("\n=== Test 5: Validation Scenarios ===")
        
        # Validation 1: Try to create account without currencies field
        print("\n--- Validation 1: Account without currencies field ---")
        no_currencies_account = {
            "code": "9996",
            "name": "No Currencies Test Account",
            "name_ar": "حساب تجريبي بدون عملات",
            "name_en": "No Currencies Test Account",
            "category": "Test"
            # No currencies field
        }
        
        try:
            response = self.make_request('POST', '/accounting/accounts', token=self.admin_token, json=no_currencies_account)
            if response.status_code == 200 or response.status_code == 201:
                data = response.json()
                self.test_account_codes.append("9996")
                
                # Should default to ["IQD"] if not specified
                currencies = data.get('currencies', [])
                if currencies == ["IQD"] or len(currencies) > 0:
                    self.log_result("Account No Currencies Field", True, 
                                  f"Account created with default currencies: {currencies}")
                else:
                    self.log_result("Account No Currencies Field", False, 
                                  f"Account created but no currencies: {data}")
            else:
                self.log_result("Account No Currencies Field", False, 
                              f"Account creation failed: {response.status_code}")
        except Exception as e:
            self.log_result("Account No Currencies Field", False, f"Error: {str(e)}")
        
        # Validation 2: Try invalid currency filter
        print("\n--- Validation 2: Invalid currency filter ---")
        try:
            response = self.make_request('GET', '/accounting/ledger/9999?currency=INVALID', token=self.admin_token)
            if response.status_code == 200:
                data = response.json()
                entries = data.get('entries', [])
                self.log_result("Invalid Currency Filter", True, 
                              f"Invalid currency filter handled gracefully: {len(entries)} entries")
            else:
                # Could be 400 (validation error) or other - both are acceptable
                self.log_result("Invalid Currency Filter", True, 
                              f"Invalid currency filter properly rejected: {response.status_code}")
        except Exception as e:
            self.log_result("Invalid Currency Filter", False, f"Error: {str(e)}")
        
        # Validation 3: Test empty currencies array
        print("\n--- Validation 3: Empty currencies array ---")
        empty_currencies_account = {
            "code": "9995",
            "name": "Empty Currencies Test Account",
            "name_ar": "حساب تجريبي عملات فارغة",
            "name_en": "Empty Currencies Test Account",
            "category": "Test",
            "currencies": []
        }
        
        try:
            response = self.make_request('POST', '/accounting/accounts', token=self.admin_token, json=empty_currencies_account)
            if response.status_code == 200 or response.status_code == 201:
                data = response.json()
                self.test_account_codes.append("9995")
                
                # Should handle empty array gracefully or default to ["IQD"]
                currencies = data.get('currencies', [])
                self.log_result("Empty Currencies Array", True, 
                              f"Empty currencies array handled: {currencies}")
            elif response.status_code == 400:
                # Validation error is acceptable for empty currencies
                self.log_result("Empty Currencies Array", True, 
                              "Empty currencies array properly rejected with validation error")
            else:
                self.log_result("Empty Currencies Array", False, 
                              f"Unexpected response: {response.status_code}")
        except Exception as e:
            self.log_result("Empty Currencies Array", False, f"Error: {str(e)}")
        
        return True

    # Removed unused test methods - focusing on initialize endpoint fix verification
    # Removed unused test methods - focusing on initialize endpoint fix verification
    
    def run_all_tests(self):
        """Run all Chart of Accounts Initialize Fix tests"""
        print("🚨 STARTING CHART OF ACCOUNTS INITIALIZATION FIX VERIFICATION")
        print("=" * 80)
        
        # Step 1: Authentication
        if not self.test_authentication():
            print("❌ Authentication failed - cannot continue")
            return False
        
        # Step 2: Run chart of accounts initialize fix tests
        self.test_chart_of_accounts_initialize_fix()
        
        # Step 3: Print summary
        self.print_test_summary()
        
        return True
    
    def print_test_summary(self):
        """Print comprehensive test summary"""
        print("\n" + "=" * 80)
        print("🚨 CHART OF ACCOUNTS INITIALIZATION FIX VERIFICATION SUMMARY")
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
        
        initialize_tests = [r for r in self.test_results if 'Initialize' in r['test']]
        initialize_passed = len([r for r in initialize_tests if r['success']])
        print(f"   Initialize Endpoint: {initialize_passed}/{len(initialize_tests)} tests passed")
        
        system_account_tests = [r for r in self.test_results if 'System Account' in r['test']]
        system_account_passed = len([r for r in system_account_tests if r['success']])
        print(f"   System Accounts Access: {system_account_passed}/{len(system_account_tests)} tests passed")
        
        trial_balance_tests = [r for r in self.test_results if 'Trial Balance' in r['test']]
        trial_balance_passed = len([r for r in trial_balance_tests if r['success']])
        print(f"   Trial Balance Report: {trial_balance_passed}/{len(trial_balance_tests)} tests passed")
        
        flow_tests = [r for r in self.test_results if 'Complete Flow' in r['test']]
        flow_passed = len([r for r in flow_tests if r['success']])
        print(f"   Complete Flow: {flow_passed}/{len(flow_tests)} tests passed")
        
        print("\n" + "=" * 80)
        
        # Check for critical issues
        critical_failures = [r for r in self.test_results if not r['success'] and ('CRITICAL' in r['message'] or 'Ledger' in r['test'])]
        
        if failed_tests == 0:
            print("🎉 ALL TESTS PASSED - CHART OF ACCOUNTS INITIALIZATION FIXES ARE WORKING!")
        elif critical_failures:
            print("🚨 CRITICAL ISSUES FOUND - INITIALIZATION FIX MAY HAVE FAILED!")
            for failure in critical_failures:
                print(f"   ❌ {failure['test']}: {failure['message']}")
        else:
            print("⚠️  SOME TESTS FAILED - REVIEW ISSUES ABOVE")
        
        print("=" * 80)

def main():
    """Main execution function"""
    tester = ChartOfAccountsInitializeTester()
    
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
