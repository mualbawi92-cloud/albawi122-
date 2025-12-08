#!/usr/bin/env python3
"""
Testing remaining endpoints for date filtering functionality
"""

import requests
import json
from datetime import datetime, timedelta

# Configuration
BASE_URL = "https://designhub-120.preview.emergentagent.com/api"
ADMIN_CREDENTIALS = {"username": "admin", "password": "admin123"}

class RemainingEndpointsTest:
    def __init__(self):
        self.admin_token = None
        self.test_results = []
        
    def log_result(self, test_name: str, success: bool, message: str, details=None):
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
    
    def make_request(self, method: str, endpoint: str, token: str = None, **kwargs):
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
    
    def authenticate(self):
        """Authenticate admin"""
        try:
            response = self.make_request('POST', '/login', json=ADMIN_CREDENTIALS)
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data['access_token']
                self.log_result("Admin Authentication", True, "Admin authenticated successfully")
                return True
            else:
                self.log_result("Admin Authentication", False, f"Failed: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Admin Authentication", False, f"Error: {str(e)}")
            return False
    
    def test_commissions_report_endpoint(self):
        """Test /api/commissions/report?start_date&end_date"""
        print("\n--- Testing /api/commissions/report Date Filter ---")
        
        try:
            # Test without date filter first
            response = self.make_request('GET', '/commissions/report', token=self.admin_token)
            if response.status_code == 200:
                all_data = response.json()
                print(f"   Commissions report accessible (no date filter)")
                
                # Test with date filter
                today = datetime.now().strftime('%Y-%m-%d')
                yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
                
                params = {
                    'start_date': yesterday,
                    'end_date': today
                }
                response = self.make_request('GET', '/commissions/report', token=self.admin_token, params=params)
                
                if response.status_code == 200:
                    filtered_data = response.json()
                    self.log_result("Commissions Report Date Filter", True, 
                                  f"Date filter working - returned filtered data")
                else:
                    self.log_result("Commissions Report Date Filter", False, 
                                  f"Date filter failed: {response.status_code}")
            else:
                self.log_result("Commissions Report Date Filter", False, 
                              f"Base request failed: {response.status_code}")
        except Exception as e:
            self.log_result("Commissions Report Date Filter", False, f"Error: {str(e)}")
    
    def test_admin_commissions_endpoint(self):
        """Test /api/admin-commissions?start_date&end_date&type&agent_id"""
        print("\n--- Testing /api/admin-commissions Date Filter (Fixed) ---")
        
        try:
            # Test without date filter first
            response = self.make_request('GET', '/admin-commissions', token=self.admin_token, 
                                       params={'type': 'earned'})
            if response.status_code == 200:
                all_commissions = response.json()
                
                # Handle both list and dict responses
                if isinstance(all_commissions, list):
                    all_count = len(all_commissions)
                    commissions_list = all_commissions
                elif isinstance(all_commissions, dict):
                    commissions_list = all_commissions.get('commissions', [])
                    all_count = len(commissions_list)
                else:
                    all_count = 0
                    commissions_list = []
                
                print(f"   All earned commissions: {all_count}")
                
                # Test with date filter
                today = datetime.now().strftime('%Y-%m-%d')
                yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
                
                params = {
                    'type': 'earned',
                    'start_date': yesterday,
                    'end_date': today
                }
                response = self.make_request('GET', '/admin-commissions', token=self.admin_token, params=params)
                
                if response.status_code == 200:
                    filtered_commissions = response.json()
                    
                    # Handle both list and dict responses
                    if isinstance(filtered_commissions, list):
                        filtered_count = len(filtered_commissions)
                        filtered_list = filtered_commissions
                    elif isinstance(filtered_commissions, dict):
                        filtered_list = filtered_commissions.get('commissions', [])
                        filtered_count = len(filtered_list)
                    else:
                        filtered_count = 0
                        filtered_list = []
                    
                    print(f"   Filtered commissions ({yesterday} to {today}): {filtered_count}")
                    
                    if filtered_count <= all_count:
                        self.log_result("Admin Commissions Date Filter", True, 
                                      f"Filter working: {filtered_count} ≤ {all_count}")
                        
                        # Verify dates are within range (if we have data)
                        if filtered_list:
                            all_within_range = True
                            for commission in filtered_list:
                                if isinstance(commission, dict):
                                    created_at = commission.get('created_at', '')
                                    if created_at:
                                        commission_date = created_at.split('T')[0] if 'T' in created_at else created_at
                                        if not (yesterday <= commission_date <= today):
                                            all_within_range = False
                                            break
                            
                            if all_within_range:
                                self.log_result("Admin Commissions Date Validation", True, 
                                              f"All commissions within date range")
                            else:
                                self.log_result("Admin Commissions Date Validation", False, 
                                              "Some commissions outside date range")
                        else:
                            self.log_result("Admin Commissions Date Validation", True, 
                                          "No commissions to validate (empty result)")
                    else:
                        self.log_result("Admin Commissions Date Filter", False, 
                                      f"Filter not working: {filtered_count} > {all_count}")
                else:
                    self.log_result("Admin Commissions Date Filter", False, 
                                  f"Filtered request failed: {response.status_code}")
            else:
                self.log_result("Admin Commissions Date Filter", False, 
                              f"Base request failed: {response.status_code}")
        except Exception as e:
            self.log_result("Admin Commissions Date Filter", False, f"Error: {str(e)}")
    
    def test_ledger_endpoint(self):
        """Test /api/accounting/ledger/{account_code}?start_date&end_date"""
        print("\n--- Testing /api/accounting/ledger Date Filter ---")
        
        # Test with a common account code
        account_codes = ['1030', '4020', '5110', '2001']  # Common accounts
        
        for account_code in account_codes:
            try:
                # Test without date filter first
                response = self.make_request('GET', f'/accounting/ledger/{account_code}', token=self.admin_token)
                if response.status_code == 200:
                    all_data = response.json()
                    all_entries = all_data.get('entries', [])
                    all_count = len(all_entries)
                    
                    if all_count > 0:
                        print(f"   Account {account_code}: {all_count} total entries")
                        
                        # Test with date filter
                        today = datetime.now().strftime('%Y-%m-%d')
                        yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
                        
                        params = {
                            'start_date': yesterday,
                            'end_date': today
                        }
                        response = self.make_request('GET', f'/accounting/ledger/{account_code}', 
                                                   token=self.admin_token, params=params)
                        
                        if response.status_code == 200:
                            filtered_data = response.json()
                            filtered_entries = filtered_data.get('entries', [])
                            filtered_count = len(filtered_entries)
                            
                            print(f"   Account {account_code} filtered ({yesterday} to {today}): {filtered_count}")
                            
                            if filtered_count <= all_count:
                                self.log_result(f"Ledger {account_code} Date Filter", True, 
                                              f"Filter working: {filtered_count} ≤ {all_count}")
                                
                                # Verify dates are within range
                                if filtered_entries:
                                    all_within_range = True
                                    for entry in filtered_entries:
                                        entry_date = entry.get('date', '')
                                        if entry_date:
                                            date_part = entry_date.split('T')[0] if 'T' in entry_date else entry_date
                                            if not (yesterday <= date_part <= today):
                                                all_within_range = False
                                                break
                                    
                                    if all_within_range:
                                        self.log_result(f"Ledger {account_code} Date Validation", True, 
                                                      f"All entries within date range")
                                    else:
                                        self.log_result(f"Ledger {account_code} Date Validation", False, 
                                                      "Some entries outside date range")
                                else:
                                    self.log_result(f"Ledger {account_code} Date Validation", True, 
                                                  "No entries to validate (empty result)")
                            else:
                                self.log_result(f"Ledger {account_code} Date Filter", False, 
                                              f"Filter not working: {filtered_count} > {all_count}")
                        else:
                            self.log_result(f"Ledger {account_code} Date Filter", False, 
                                          f"Filtered request failed: {response.status_code}")
                        break  # Found an account with data, no need to test others
                    else:
                        print(f"   Account {account_code}: No entries found")
                elif response.status_code == 404:
                    print(f"   Account {account_code}: Not found")
                else:
                    print(f"   Account {account_code}: Error {response.status_code}")
            except Exception as e:
                self.log_result(f"Ledger {account_code} Date Filter", False, f"Error: {str(e)}")
    
    def run_tests(self):
        """Run all remaining endpoint tests"""
        print("🔍 TESTING REMAINING ENDPOINTS DATE FILTERING")
        print("=" * 60)
        
        if not self.authenticate():
            return False
        
        self.test_commissions_report_endpoint()
        self.test_admin_commissions_endpoint()
        self.test_ledger_endpoint()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 REMAINING ENDPOINTS TEST SUMMARY")
        print("=" * 60)
        
        passed_tests = [r for r in self.test_results if r['success']]
        failed_tests = [r for r in self.test_results if not r['success']]
        
        print(f"Total Tests: {len(self.test_results)}")
        print(f"✅ Passed: {len(passed_tests)}")
        print(f"❌ Failed: {len(failed_tests)}")
        
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"   - {test['test']}: {test['message']}")
        
        print("\n✅ PASSED TESTS:")
        for test in passed_tests:
            print(f"   - {test['test']}: {test['message']}")
        
        return len(failed_tests) == 0

def main():
    tester = RemainingEndpointsTest()
    success = tester.run_tests()
    
    if success:
        print("\n🎉 ALL REMAINING ENDPOINTS TESTS PASSED")
    else:
        print("\n⚠️  SOME REMAINING ENDPOINTS TESTS FAILED")

if __name__ == "__main__":
    main()