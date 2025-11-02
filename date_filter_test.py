#!/usr/bin/env python3
"""
🚨 CRITICAL DATE FILTER FIX TESTING

**Context:**
User reported that date filtering in TransfersListPage is not working - all transfers show 
regardless of selected date range. Backend date comparison logic has been fixed in 5 endpoints.

**What Was Fixed:**
Backend was comparing date strings like "2024-01-01" against ISO datetime strings 
"2024-01-01T12:34:56.789Z" in MongoDB. Updated to convert dates to full ISO format before comparison:
- Start date: "2024-01-01" → "2024-01-01T00:00:00.000Z"
- End date: "2024-01-31" → "2024-01-31T23:59:59.999Z"

**Endpoints Fixed:**
1. GET /api/transfers?start_date&end_date&direction&currency
2. GET /api/commissions/report?start_date&end_date
3. GET /api/admin-commissions?start_date&end_date&type&agent_id
4. GET /api/accounting/journal-entries?start_date&end_date
5. GET /api/accounting/ledger/{account_code}?start_date&end_date

**PRIORITY 1: Test /api/transfers endpoint (CRITICAL)**
"""

import requests
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List

# Configuration
BASE_URL = "https://transferhub-11.preview.emergentagent.com/api"
ADMIN_CREDENTIALS = {"username": "admin", "password": "admin123"}

# Try different possible passwords for test agents
POSSIBLE_PASSWORDS = ["test123", "agent123", "123456", "password", "admin123"]

class DateFilterTester:
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
    
    def authenticate(self):
        """Authenticate admin and agents"""
        print("\n=== Authentication ===")
        
        # Test admin login
        try:
            response = self.make_request('POST', '/login', json=ADMIN_CREDENTIALS)
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data['access_token']
                self.admin_user_id = data['user']['id']
                self.log_result("Admin Login", True, "Admin authenticated successfully")
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
                    self.log_result("Agent Baghdad Login", True, f"Agent Baghdad authenticated")
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
                    self.log_result("Agent Basra Login", True, f"Agent Basra authenticated")
                    agent_basra_authenticated = True
                    break
            except Exception as e:
                continue
        
        if not agent_basra_authenticated:
            self.log_result("Agent Basra Login", False, "Could not authenticate with any common password")
            return False
        
        return True
    
    def get_existing_transfers_for_date_analysis(self) -> Dict[str, Any]:
        """Get existing transfers to analyze date distribution"""
        print("\n=== Analyzing Existing Transfer Dates ===")
        
        try:
            # Get all transfers without date filter (baseline)
            response = self.make_request('GET', '/transfers', token=self.admin_token, params={'limit': 1000})
            if response.status_code == 200:
                all_transfers = response.json()
                
                if not all_transfers:
                    self.log_result("Transfer Data Analysis", False, "No transfers found in system")
                    return {}
                
                # Analyze dates
                dates = []
                for transfer in all_transfers:
                    created_at = transfer.get('created_at', '')
                    if created_at:
                        # Extract date part from ISO string
                        date_part = created_at.split('T')[0] if 'T' in created_at else created_at
                        dates.append(date_part)
                
                # Get unique dates and sort
                unique_dates = sorted(list(set(dates)))
                
                print(f"Found {len(all_transfers)} total transfers")
                print(f"Date range: {unique_dates[0] if unique_dates else 'N/A'} to {unique_dates[-1] if unique_dates else 'N/A'}")
                print(f"Unique dates: {len(unique_dates)}")
                
                # Show date distribution
                from collections import Counter
                date_counts = Counter(dates)
                print("\nDate distribution (top 10):")
                for date, count in date_counts.most_common(10):
                    print(f"  {date}: {count} transfers")
                
                self.log_result("Transfer Data Analysis", True, f"Analyzed {len(all_transfers)} transfers across {len(unique_dates)} dates")
                
                return {
                    'total_transfers': len(all_transfers),
                    'unique_dates': unique_dates,
                    'date_counts': dict(date_counts),
                    'sample_transfers': all_transfers[:5]  # First 5 for reference
                }
            else:
                self.log_result("Transfer Data Analysis", False, f"Failed to get transfers: {response.status_code}")
                return {}
        except Exception as e:
            self.log_result("Transfer Data Analysis", False, f"Error: {str(e)}")
            return {}
    
    def test_transfers_endpoint_date_filter(self, transfer_data: Dict[str, Any]):
        """Test /api/transfers endpoint date filtering - PRIORITY 1"""
        print("\n🚨 PRIORITY 1: Testing /api/transfers Date Filter")
        print("=" * 60)
        
        if not transfer_data or not transfer_data.get('unique_dates'):
            print("⚠️  No transfer data available for date filter testing")
            return False
        
        unique_dates = transfer_data['unique_dates']
        total_transfers = transfer_data['total_transfers']
        
        print(f"Baseline: {total_transfers} total transfers")
        print(f"Available date range: {unique_dates[0]} to {unique_dates[-1]}")
        
        # Test Case A: No Date Filter (Baseline)
        print("\n--- Test Case A: No Date Filter (Baseline) ---")
        try:
            response = self.make_request('GET', '/transfers', token=self.admin_token, params={'limit': 1000})
            if response.status_code == 200:
                baseline_transfers = response.json()
                baseline_count = len(baseline_transfers)
                
                self.log_result("A. No Date Filter", True, f"Baseline: {baseline_count} transfers returned")
                print(f"   ✅ Baseline count: {baseline_count}")
            else:
                self.log_result("A. No Date Filter", False, f"Failed: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("A. No Date Filter", False, f"Error: {str(e)}")
            return False
        
        # Test Case B: Date Range Filter (Main Test)
        print("\n--- Test Case B: Date Range Filter (Main Test) ---")
        
        # Use a date range that should have fewer transfers than total
        if len(unique_dates) >= 2:
            # Use first date to middle date
            start_date = unique_dates[0]
            end_date = unique_dates[len(unique_dates)//2] if len(unique_dates) > 2 else unique_dates[-1]
            
            print(f"Testing date range: {start_date} to {end_date}")
            
            try:
                params = {
                    'start_date': start_date,
                    'end_date': end_date,
                    'limit': 1000
                }
                response = self.make_request('GET', '/transfers', token=self.admin_token, params=params)
                
                if response.status_code == 200:
                    filtered_transfers = response.json()
                    filtered_count = len(filtered_transfers)
                    
                    print(f"   Filtered count: {filtered_count}")
                    print(f"   Baseline count: {baseline_count}")
                    
                    # Verify count is different (should be less or equal)
                    if filtered_count <= baseline_count:
                        self.log_result("B. Date Range Filter - Count", True, 
                                      f"Filtered count ({filtered_count}) ≤ baseline ({baseline_count})")
                        
                        # Verify all returned transfers are within date range
                        all_within_range = True
                        out_of_range_transfers = []
                        
                        for transfer in filtered_transfers:
                            created_at = transfer.get('created_at', '')
                            if created_at:
                                # Extract date part
                                transfer_date = created_at.split('T')[0] if 'T' in created_at else created_at
                                
                                if not (start_date <= transfer_date <= end_date):
                                    all_within_range = False
                                    out_of_range_transfers.append({
                                        'id': transfer.get('id'),
                                        'code': transfer.get('transfer_code'),
                                        'date': transfer_date
                                    })
                        
                        if all_within_range:
                            self.log_result("B. Date Range Filter - Date Validation", True, 
                                          f"All {filtered_count} transfers within range {start_date} to {end_date}")
                        else:
                            self.log_result("B. Date Range Filter - Date Validation", False, 
                                          f"{len(out_of_range_transfers)} transfers outside range", 
                                          out_of_range_transfers[:5])
                    else:
                        self.log_result("B. Date Range Filter - Count", False, 
                                      f"Filtered count ({filtered_count}) > baseline ({baseline_count}) - filter not working")
                else:
                    self.log_result("B. Date Range Filter", False, f"Failed: {response.status_code}")
            except Exception as e:
                self.log_result("B. Date Range Filter", False, f"Error: {str(e)}")
        
        # Test Case C: Single Day Filter
        print("\n--- Test Case C: Single Day Filter ---")
        
        # Find a date that has transfers
        date_counts = transfer_data.get('date_counts', {})
        if date_counts:
            # Pick a date with transfers
            test_date = max(date_counts.keys(), key=lambda x: date_counts[x])  # Date with most transfers
            expected_count = date_counts[test_date]
            
            print(f"Testing single day: {test_date} (expected: {expected_count} transfers)")
            
            try:
                params = {
                    'start_date': test_date,
                    'end_date': test_date,
                    'limit': 1000
                }
                response = self.make_request('GET', '/transfers', token=self.admin_token, params=params)
                
                if response.status_code == 200:
                    single_day_transfers = response.json()
                    actual_count = len(single_day_transfers)
                    
                    print(f"   Expected: {expected_count}, Got: {actual_count}")
                    
                    if actual_count == expected_count:
                        self.log_result("C. Single Day Filter", True, 
                                      f"Correct count: {actual_count} transfers for {test_date}")
                        
                        # Verify all transfers are from that day
                        all_correct_date = True
                        for transfer in single_day_transfers:
                            created_at = transfer.get('created_at', '')
                            transfer_date = created_at.split('T')[0] if 'T' in created_at else created_at
                            if transfer_date != test_date:
                                all_correct_date = False
                                break
                        
                        if all_correct_date:
                            self.log_result("C. Single Day Filter - Date Validation", True, 
                                          f"All transfers from {test_date}")
                        else:
                            self.log_result("C. Single Day Filter - Date Validation", False, 
                                          "Some transfers from wrong date")
                    else:
                        self.log_result("C. Single Day Filter", False, 
                                      f"Count mismatch: expected {expected_count}, got {actual_count}")
                else:
                    self.log_result("C. Single Day Filter", False, f"Failed: {response.status_code}")
            except Exception as e:
                self.log_result("C. Single Day Filter", False, f"Error: {str(e)}")
        
        # Test Case D: Recent Period (Last 7 Days)
        print("\n--- Test Case D: Recent Period (Last 7 Days) ---")
        
        today = datetime.now().strftime('%Y-%m-%d')
        seven_days_ago = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
        
        print(f"Testing last 7 days: {seven_days_ago} to {today}")
        
        try:
            params = {
                'start_date': seven_days_ago,
                'end_date': today,
                'limit': 1000
            }
            response = self.make_request('GET', '/transfers', token=self.admin_token, params=params)
            
            if response.status_code == 200:
                recent_transfers = response.json()
                recent_count = len(recent_transfers)
                
                print(f"   Recent transfers (last 7 days): {recent_count}")
                
                # Should be less than or equal to baseline
                if recent_count <= baseline_count:
                    self.log_result("D. Recent Period Filter", True, 
                                  f"Recent count ({recent_count}) ≤ baseline ({baseline_count})")
                    
                    # Verify dates are within last 7 days
                    all_recent = True
                    for transfer in recent_transfers:
                        created_at = transfer.get('created_at', '')
                        transfer_date = created_at.split('T')[0] if 'T' in created_at else created_at
                        if not (seven_days_ago <= transfer_date <= today):
                            all_recent = False
                            break
                    
                    if all_recent:
                        self.log_result("D. Recent Period - Date Validation", True, 
                                      f"All {recent_count} transfers within last 7 days")
                    else:
                        self.log_result("D. Recent Period - Date Validation", False, 
                                      "Some transfers outside 7-day range")
                else:
                    self.log_result("D. Recent Period Filter", False, 
                                  f"Recent count ({recent_count}) > baseline ({baseline_count})")
            else:
                self.log_result("D. Recent Period Filter", False, f"Failed: {response.status_code}")
        except Exception as e:
            self.log_result("D. Recent Period Filter", False, f"Error: {str(e)}")
        
        # Test Case E: Future Date Range
        print("\n--- Test Case E: Future Date Range ---")
        
        future_start = "2099-01-01"
        future_end = "2099-12-31"
        
        print(f"Testing future dates: {future_start} to {future_end}")
        
        try:
            params = {
                'start_date': future_start,
                'end_date': future_end,
                'limit': 1000
            }
            response = self.make_request('GET', '/transfers', token=self.admin_token, params=params)
            
            if response.status_code == 200:
                future_transfers = response.json()
                future_count = len(future_transfers)
                
                if future_count == 0:
                    self.log_result("E. Future Date Range", True, "Correctly returned empty array for future dates")
                else:
                    self.log_result("E. Future Date Range", False, 
                                  f"Expected 0 transfers, got {future_count}")
            else:
                self.log_result("E. Future Date Range", False, f"Failed: {response.status_code}")
        except Exception as e:
            self.log_result("E. Future Date Range", False, f"Error: {str(e)}")
        
        # Test Case F: Direction + Date Filter
        print("\n--- Test Case F: Direction + Date Filter ---")
        
        if unique_dates:
            test_date = unique_dates[0]
            
            print(f"Testing direction=outgoing + date={test_date}")
            
            try:
                params = {
                    'direction': 'outgoing',
                    'start_date': test_date,
                    'end_date': test_date,
                    'limit': 1000
                }
                response = self.make_request('GET', '/transfers', token=self.agent_baghdad_token, params=params)
                
                if response.status_code == 200:
                    direction_filtered = response.json()
                    direction_count = len(direction_filtered)
                    
                    self.log_result("F. Direction + Date Filter", True, 
                                  f"Combined filter returned {direction_count} transfers")
                    
                    # Verify all are outgoing from this agent and from the specified date
                    all_valid = True
                    for transfer in direction_filtered:
                        from_agent_id = transfer.get('from_agent_id')
                        created_at = transfer.get('created_at', '')
                        transfer_date = created_at.split('T')[0] if 'T' in created_at else created_at
                        
                        if from_agent_id != self.agent_baghdad_user_id or transfer_date != test_date:
                            all_valid = False
                            break
                    
                    if all_valid:
                        self.log_result("F. Direction + Date - Validation", True, 
                                      "All transfers match direction and date criteria")
                    else:
                        self.log_result("F. Direction + Date - Validation", False, 
                                      "Some transfers don't match criteria")
                else:
                    self.log_result("F. Direction + Date Filter", False, f"Failed: {response.status_code}")
            except Exception as e:
                self.log_result("F. Direction + Date Filter", False, f"Error: {str(e)}")
        
        # Test Case G: Currency + Date Filter
        print("\n--- Test Case G: Currency + Date Filter ---")
        
        if unique_dates:
            test_date = unique_dates[0]
            
            print(f"Testing currency=IQD + date={test_date}")
            
            try:
                params = {
                    'currency': 'IQD',
                    'start_date': test_date,
                    'end_date': test_date,
                    'limit': 1000
                }
                response = self.make_request('GET', '/transfers', token=self.admin_token, params=params)
                
                if response.status_code == 200:
                    currency_filtered = response.json()
                    currency_count = len(currency_filtered)
                    
                    self.log_result("G. Currency + Date Filter", True, 
                                  f"Combined filter returned {currency_count} transfers")
                    
                    # Verify all are IQD and from the specified date
                    all_valid = True
                    for transfer in currency_filtered:
                        currency = transfer.get('currency', '')
                        created_at = transfer.get('created_at', '')
                        transfer_date = created_at.split('T')[0] if 'T' in created_at else created_at
                        
                        if currency != 'IQD' or transfer_date != test_date:
                            all_valid = False
                            break
                    
                    if all_valid:
                        self.log_result("G. Currency + Date - Validation", True, 
                                      "All transfers match currency and date criteria")
                    else:
                        self.log_result("G. Currency + Date - Validation", False, 
                                      "Some transfers don't match criteria")
                else:
                    self.log_result("G. Currency + Date Filter", False, f"Failed: {response.status_code}")
            except Exception as e:
                self.log_result("G. Currency + Date Filter", False, f"Error: {str(e)}")
        
        return True
    
    def test_other_endpoints_date_filter(self, transfer_data: Dict[str, Any]):
        """Test other endpoints with date filtering - PRIORITY 2"""
        print("\n🔍 PRIORITY 2: Testing Other Endpoints Date Filter")
        print("=" * 60)
        
        if not transfer_data or not transfer_data.get('unique_dates'):
            print("⚠️  No transfer data available for other endpoint testing")
            return False
        
        unique_dates = transfer_data['unique_dates']
        
        # Test /api/admin-commissions
        print("\n--- Testing /api/admin-commissions Date Filter ---")
        
        try:
            # Test without date filter first
            response = self.make_request('GET', '/admin-commissions', token=self.admin_token, 
                                       params={'type': 'paid', 'limit': 1000})
            if response.status_code == 200:
                all_commissions = response.json()
                all_count = len(all_commissions)
                
                print(f"   All paid commissions: {all_count}")
                
                # Test with date filter
                if unique_dates:
                    start_date = unique_dates[0]
                    end_date = unique_dates[-1]
                    
                    response = self.make_request('GET', '/admin-commissions', token=self.admin_token, 
                                               params={
                                                   'type': 'paid',
                                                   'start_date': start_date,
                                                   'end_date': end_date,
                                                   'limit': 1000
                                               })
                    if response.status_code == 200:
                        filtered_commissions = response.json()
                        filtered_count = len(filtered_commissions)
                        
                        print(f"   Filtered commissions ({start_date} to {end_date}): {filtered_count}")
                        
                        if filtered_count <= all_count:
                            self.log_result("Admin Commissions Date Filter", True, 
                                          f"Filter working: {filtered_count} ≤ {all_count}")
                            
                            # Verify dates are within range
                            all_within_range = True
                            for commission in filtered_commissions:
                                created_at = commission.get('created_at', '')
                                if created_at:
                                    commission_date = created_at.split('T')[0] if 'T' in created_at else created_at
                                    if not (start_date <= commission_date <= end_date):
                                        all_within_range = False
                                        break
                            
                            if all_within_range:
                                self.log_result("Admin Commissions Date Validation", True, 
                                              f"All commissions within date range")
                            else:
                                self.log_result("Admin Commissions Date Validation", False, 
                                              "Some commissions outside date range")
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
        
        # Test /api/accounting/journal-entries
        print("\n--- Testing /api/accounting/journal-entries Date Filter ---")
        
        try:
            # Test without date filter first
            response = self.make_request('GET', '/accounting/journal-entries', token=self.admin_token)
            if response.status_code == 200:
                journal_data = response.json()
                all_entries = journal_data.get('entries', [])
                all_count = len(all_entries)
                
                print(f"   All journal entries: {all_count}")
                
                # Test with date filter
                if unique_dates and all_count > 0:
                    start_date = unique_dates[0]
                    end_date = unique_dates[-1]
                    
                    response = self.make_request('GET', '/accounting/journal-entries', token=self.admin_token,
                                               params={
                                                   'start_date': start_date,
                                                   'end_date': end_date
                                               })
                    if response.status_code == 200:
                        filtered_data = response.json()
                        filtered_entries = filtered_data.get('entries', [])
                        filtered_count = len(filtered_entries)
                        
                        print(f"   Filtered entries ({start_date} to {end_date}): {filtered_count}")
                        
                        if filtered_count <= all_count:
                            self.log_result("Journal Entries Date Filter", True, 
                                          f"Filter working: {filtered_count} ≤ {all_count}")
                            
                            # Verify dates are within range
                            all_within_range = True
                            for entry in filtered_entries:
                                entry_date = entry.get('date', '')
                                if entry_date:
                                    date_part = entry_date.split('T')[0] if 'T' in entry_date else entry_date
                                    if not (start_date <= date_part <= end_date):
                                        all_within_range = False
                                        break
                            
                            if all_within_range:
                                self.log_result("Journal Entries Date Validation", True, 
                                              f"All entries within date range")
                            else:
                                self.log_result("Journal Entries Date Validation", False, 
                                              "Some entries outside date range")
                        else:
                            self.log_result("Journal Entries Date Filter", False, 
                                          f"Filter not working: {filtered_count} > {all_count}")
                    else:
                        self.log_result("Journal Entries Date Filter", False, 
                                      f"Filtered request failed: {response.status_code}")
                else:
                    self.log_result("Journal Entries Date Filter", True, 
                                  "No entries to test or no date range available")
            else:
                self.log_result("Journal Entries Date Filter", False, 
                              f"Base request failed: {response.status_code}")
        except Exception as e:
            self.log_result("Journal Entries Date Filter", False, f"Error: {str(e)}")
        
        return True
    
    def run_comprehensive_date_filter_test(self):
        """Run comprehensive date filter testing"""
        print("🚨 CRITICAL DATE FILTER FIX TESTING")
        print("=" * 80)
        print("Testing date filtering functionality across all fixed endpoints")
        print("Focus: Verify date comparison logic works correctly")
        print("=" * 80)
        
        # Step 1: Authentication
        if not self.authenticate():
            print("❌ Authentication failed - cannot proceed with testing")
            return False
        
        # Step 2: Analyze existing transfer data
        transfer_data = self.get_existing_transfers_for_date_analysis()
        if not transfer_data:
            print("❌ No transfer data available - cannot test date filtering")
            return False
        
        # Step 3: Test main transfers endpoint (PRIORITY 1)
        success_transfers = self.test_transfers_endpoint_date_filter(transfer_data)
        
        # Step 4: Test other endpoints (PRIORITY 2)
        success_others = self.test_other_endpoints_date_filter(transfer_data)
        
        # Step 5: Summary
        self.print_test_summary()
        
        return success_transfers and success_others
    
    def print_test_summary(self):
        """Print comprehensive test summary"""
        print("\n" + "=" * 80)
        print("🔍 COMPREHENSIVE TEST RESULTS SUMMARY")
        print("=" * 80)
        
        passed_tests = [r for r in self.test_results if r['success']]
        failed_tests = [r for r in self.test_results if not r['success']]
        
        print(f"Total Tests: {len(self.test_results)}")
        print(f"✅ Passed: {len(passed_tests)}")
        print(f"❌ Failed: {len(failed_tests)}")
        print(f"Success Rate: {len(passed_tests)/len(self.test_results)*100:.1f}%")
        
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"   - {test['test']}: {test['message']}")
        
        print("\n✅ PASSED TESTS:")
        for test in passed_tests:
            print(f"   - {test['test']}: {test['message']}")
        
        # Critical assessment
        print("\n🎯 CRITICAL ASSESSMENT:")
        
        # Check if main transfers endpoint tests passed
        transfers_tests = [r for r in self.test_results if 'transfers' in r['test'].lower() and 'date' in r['test'].lower()]
        transfers_passed = [r for r in transfers_tests if r['success']]
        
        if len(transfers_passed) >= len(transfers_tests) * 0.8:  # 80% pass rate
            print("✅ TRANSFERS DATE FILTERING: WORKING CORRECTLY")
        else:
            print("❌ TRANSFERS DATE FILTERING: ISSUES DETECTED")
        
        # Check other endpoints
        other_tests = [r for r in self.test_results if 'commissions' in r['test'].lower() or 'journal' in r['test'].lower()]
        other_passed = [r for r in other_tests if r['success']]
        
        if len(other_passed) >= len(other_tests) * 0.8:  # 80% pass rate
            print("✅ OTHER ENDPOINTS DATE FILTERING: WORKING CORRECTLY")
        else:
            print("❌ OTHER ENDPOINTS DATE FILTERING: ISSUES DETECTED")
        
        print("\n" + "=" * 80)

def main():
    """Main test execution"""
    tester = DateFilterTester()
    success = tester.run_comprehensive_date_filter_test()
    
    if success:
        print("\n🎉 DATE FILTER TESTING COMPLETED SUCCESSFULLY")
        exit(0)
    else:
        print("\n💥 DATE FILTER TESTING FAILED")
        exit(1)

if __name__ == "__main__":
    main()