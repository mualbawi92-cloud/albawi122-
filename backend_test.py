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
BASE_URL = "https://financetrack-16.preview.emergentagent.com/api"
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
    
    def test_chart_of_accounts_initialize_fix(self):
        """Test Chart of Accounts Initialize endpoint fix verification"""
        print("\n🚨 CHART OF ACCOUNTS INITIALIZATION FIX VERIFICATION")
        print("=" * 80)
        print("Testing Initialize endpoint and Trial Balance Report fixes")
        print("=" * 80)
        
        # Scenario 1: Initialize Default Accounts (HIGH PRIORITY)
        print("\n--- SCENARIO 1: INITIALIZE DEFAULT ACCOUNTS ---")
        self.test_initialize_accounts_endpoint()
        
        # Test idempotency
        self.test_initialize_accounts_idempotent()
        
        # Scenario 2: Verify System Accounts Created
        print("\n--- SCENARIO 2: VERIFY SYSTEM ACCOUNTS CREATED ---")
        self.test_system_accounts_accessible()
        
        # Scenario 3: Trial Balance Report (Should Work Now)
        print("\n--- SCENARIO 3: TRIAL BALANCE REPORT ---")
        self.test_trial_balance_report()
        
        # Scenario 4: Verify Complete Flow
        print("\n--- SCENARIO 4: COMPLETE FLOW VERIFICATION ---")
        self.test_complete_flow_verification()
        
        return True
    
    def test_system_accounts_accessible(self):
        """Test that system accounts (1030, 4020, 5110) are accessible via ledger"""
        print("\n=== Scenario 2: Verify System Accounts Created ===")
        
        for account_code in self.system_accounts:
            try:
                response = self.make_request('GET', f'/accounting/ledger/{account_code}', token=self.admin_token)
                if response.status_code == 200:
                    ledger_data = response.json()
                    account_info = ledger_data.get('account', {})
                    account_name = account_info.get('name_ar', account_info.get('name', 'Unknown'))
                    
                    self.log_result(f"System Account {account_code} Access", True, 
                                  f"Account {account_code} ({account_name}) accessible via ledger")
                elif response.status_code == 404:
                    self.log_result(f"System Account {account_code} Access", False, 
                                  f"❌ CRITICAL: Account {account_code} returns 404 - not created by initialize")
                else:
                    self.log_result(f"System Account {account_code} Access", False, 
                                  f"Account {account_code} failed: {response.status_code}")
            except Exception as e:
                self.log_result(f"System Account {account_code} Access", False, f"Error: {str(e)}")
    
    def test_trial_balance_report(self):
        """Test Trial Balance Report with null safety fixes"""
        print("\n=== Scenario 3: Trial Balance Report (Should Work Now) ===")
        
        try:
            response = self.make_request('GET', '/accounting/reports/trial-balance', token=self.admin_token)
            if response.status_code == 200:
                trial_balance = response.json()
                
                if isinstance(trial_balance, dict):
                    accounts = trial_balance.get('accounts', [])
                    total_debit = trial_balance.get('total_debit', 0)
                    total_credit = trial_balance.get('total_credit', 0)
                    
                    self.log_result("Trial Balance Report", True, 
                                  f"✅ Trial balance generated successfully with {len(accounts)} accounts")
                    
                    print(f"   Accounts: {len(accounts)}")
                    print(f"   Total Debit: {total_debit:,}")
                    print(f"   Total Credit: {total_credit:,}")
                    
                    # Check for accounts with missing name_ar (should be handled gracefully)
                    accounts_with_missing_names = 0
                    for account in accounts:
                        if not account.get('name_ar'):
                            accounts_with_missing_names += 1
                    
                    if accounts_with_missing_names > 0:
                        self.log_result("Trial Balance Null Safety", True, 
                                      f"✅ Handled {accounts_with_missing_names} accounts with missing name_ar gracefully")
                    else:
                        self.log_result("Trial Balance Null Safety", True, 
                                      "✅ All accounts have name_ar field")
                    
                    return trial_balance
                else:
                    self.log_result("Trial Balance Report", False, "Invalid trial balance response structure", trial_balance)
            elif response.status_code == 500:
                # Check if it's the KeyError we're trying to fix
                error_text = response.text
                if 'KeyError' in error_text and 'name_ar' in error_text:
                    self.log_result("Trial Balance Report", False, 
                                  "❌ CRITICAL: Still getting KeyError for name_ar - fix not working")
                else:
                    self.log_result("Trial Balance Report", False, f"Trial balance 500 error: {error_text}")
            else:
                self.log_result("Trial Balance Report", False, f"Trial balance failed: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Trial Balance Report", False, f"Error: {str(e)}")
        
        return None
    
    def test_complete_flow_verification(self):
        """Test complete flow: Initialize → Get Accounts → Load Ledgers → Generate Reports"""
        print("\n=== Scenario 4: Complete Flow Verification ===")
        
        # Step 1: Get all accounts
        try:
            response = self.make_request('GET', '/accounting/accounts', token=self.admin_token)
            if response.status_code == 200:
                accounts = response.json()
                account_count = len(accounts)
                self.log_result("Complete Flow - Get Accounts", True, f"Retrieved {account_count} accounts")
                
                # Step 2: Test ledger access for system accounts
                system_accounts_accessible = 0
                for account_code in self.system_accounts:
                    ledger_response = self.make_request('GET', f'/accounting/ledger/{account_code}', token=self.admin_token)
                    if ledger_response.status_code == 200:
                        system_accounts_accessible += 1
                
                if system_accounts_accessible == len(self.system_accounts):
                    self.log_result("Complete Flow - System Ledgers", True, 
                                  f"✅ All {len(self.system_accounts)} system accounts accessible")
                else:
                    self.log_result("Complete Flow - System Ledgers", False, 
                                  f"❌ Only {system_accounts_accessible}/{len(self.system_accounts)} system accounts accessible")
                
                # Step 3: Test trial balance
                trial_response = self.make_request('GET', '/accounting/reports/trial-balance', token=self.admin_token)
                if trial_response.status_code == 200:
                    self.log_result("Complete Flow - Trial Balance", True, "✅ Trial balance report working")
                    
                    # Complete flow success
                    if system_accounts_accessible == len(self.system_accounts):
                        self.log_result("Complete Flow Success", True, 
                                      "✅ COMPLETE FLOW SUCCESS: Initialize → Accounts → Ledgers → Reports all working")
                    else:
                        self.log_result("Complete Flow Success", False, 
                                      "❌ Complete flow partially failed - some system accounts inaccessible")
                else:
                    self.log_result("Complete Flow - Trial Balance", False, f"Trial balance failed: {trial_response.status_code}")
                    self.log_result("Complete Flow Success", False, "❌ Complete flow failed at trial balance step")
            else:
                self.log_result("Complete Flow - Get Accounts", False, f"Get accounts failed: {response.status_code}")
                self.log_result("Complete Flow Success", False, "❌ Complete flow failed at get accounts step")
        except Exception as e:
            self.log_result("Complete Flow Success", False, f"❌ Complete flow error: {str(e)}")

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
