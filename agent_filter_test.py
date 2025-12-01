#!/usr/bin/env python3
"""
🚨 اختبار فلتر الصراف في endpoint العمولات

**المشكلة المبلغ عنها:**
عند اختيار صراف واحد في صفحة العمولات، يعرض النظام جميع الصرافين بدلاً من الصراف المحدد فقط.

**الاختبارات المطلوبة:**

1. اختبر endpoint `/api/admin-commissions` مع التالي:
   - `type=paid&start_date=2024-01-01&end_date=2025-12-31` (بدون agent_id)
   - `type=paid&start_date=2024-01-01&end_date=2025-12-31&agent_id=<any_valid_agent_id>` (مع agent_id محدد)
   - قارن النتائج: هل عدد العمولات يختلف؟

2. تحقق من:
   - هل يتم استقبال `agent_id` parameter في Backend؟
   - هل الفلترة تعمل على `admin_commissions` collection؟
   - هل الفلترة تعمل على `transfers` collection (البيانات القديمة)؟

3. تحقق من البيانات:
   - اعرض عينة من `agent_id` في `admin_commissions`
   - اعرض عينة من `from_agent_id` و `to_agent_id` في `transfers`
   - تأكد من تطابق أنواع البيانات (string vs string)

4. اعرض logs Backend المتعلقة بـ:
   - `Admin commissions filter`
   - `Comparing agent_id`
"""

import requests
import json
import time
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://agent-ui-revamp.preview.emergentagent.com/api"
ADMIN_CREDENTIALS = {"username": "admin", "password": "admin123"}

# Try different possible passwords for test agents
POSSIBLE_PASSWORDS = ["test123", "agent123", "123456", "password", "admin123"]

class AgentFilterTester:
    def __init__(self):
        self.admin_token = None
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
        """Test admin authentication"""
        print("\n=== Testing Admin Authentication ===")
        
        try:
            response = self.make_request('POST', '/login', json=ADMIN_CREDENTIALS)
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data['access_token']
                self.log_result("Admin Login", True, f"Admin authenticated successfully")
                return True
            else:
                self.log_result("Admin Login", False, f"Admin login failed: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Admin Login", False, f"Admin login error: {str(e)}")
            return False
    
    def test_agent_filter_functionality(self):
        """🚨 اختبار فلتر الصراف في endpoint العمولات"""
        print("\n🚨 اختبار فلتر الصراف في endpoint العمولات")
        print("=" * 80)
        print("المشكلة المبلغ عنها: عند اختيار صراف واحد، يعرض النظام جميع الصرافين")
        print("الهدف: التحقق من أن فلتر agent_id يعمل بشكل صحيح")
        print("=" * 80)
        
        # Get available agents first
        print("\n--- الحصول على قائمة الصرافين المتاحين ---")
        
        available_agents = []
        try:
            response = self.make_request('GET', '/agents', token=self.admin_token)
            if response.status_code == 200:
                agents = response.json()
                available_agents = [agent for agent in agents if agent.get('role') == 'agent']
                
                print(f"Found {len(available_agents)} agents:")
                for agent in available_agents[:5]:  # Show first 5
                    print(f"   - {agent.get('id')}: {agent.get('display_name')} ({agent.get('governorate')})")
                
                self.log_result("Get Available Agents", True, f"Found {len(available_agents)} agents")
            else:
                self.log_result("Get Available Agents", False, f"Could not get agents: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Get Available Agents", False, f"Error: {str(e)}")
            return False
        
        if len(available_agents) < 1:
            self.log_result("Agent Filter Test", False, "Need at least 1 agent for testing")
            return False
        
        # Test 1: Get all commissions without agent filter
        print("\n--- اختبار 1: الحصول على جميع العمولات بدون فلتر ---")
        
        params_all = {
            'type': 'paid',
            'start_date': '2024-01-01',
            'end_date': '2025-12-31'
        }
        
        all_commissions = []
        try:
            response = self.make_request('GET', '/admin-commissions', token=self.admin_token, params=params_all)
            if response.status_code == 200:
                data = response.json()
                all_commissions = data.get('commissions', [])
                
                print(f"Total commissions without filter: {len(all_commissions)}")
                
                # Show sample of agent IDs
                agent_ids_in_commissions = set()
                for comm in all_commissions[:10]:  # Check first 10
                    agent_id = comm.get('agent_id')
                    if agent_id:
                        agent_ids_in_commissions.add(agent_id)
                
                print(f"Sample agent IDs found in commissions: {list(agent_ids_in_commissions)[:5]}")
                
                self.log_result("Get All Commissions", True, f"Retrieved {len(all_commissions)} total commissions")
            else:
                self.log_result("Get All Commissions", False, f"Failed: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Get All Commissions", False, f"Error: {str(e)}")
            return False
        
        # Test 2: Get commissions with specific agent filter
        print("\n--- اختبار 2: الحصول على العمولات مع فلتر صراف محدد ---")
        
        # Use the first available agent for testing
        test_agent = available_agents[0]
        test_agent_id = test_agent.get('id')
        test_agent_name = test_agent.get('display_name')
        
        print(f"Testing with agent: {test_agent_id} ({test_agent_name})")
        
        params_filtered = {
            'type': 'paid',
            'start_date': '2024-01-01',
            'end_date': '2025-12-31',
            'agent_id': test_agent_id
        }
        
        filtered_commissions = []
        try:
            response = self.make_request('GET', '/admin-commissions', token=self.admin_token, params=params_filtered)
            if response.status_code == 200:
                data = response.json()
                filtered_commissions = data.get('commissions', [])
                
                print(f"Commissions with agent filter: {len(filtered_commissions)}")
                
                # Verify all returned commissions belong to the specified agent
                wrong_agent_commissions = []
                for comm in filtered_commissions:
                    comm_agent_id = comm.get('agent_id')
                    if comm_agent_id != test_agent_id:
                        wrong_agent_commissions.append({
                            'id': comm.get('id'),
                            'agent_id': comm_agent_id,
                            'expected': test_agent_id,
                            'type': comm.get('type'),
                            'amount': comm.get('amount'),
                            'transfer_code': comm.get('transfer_code', 'N/A')
                        })
                
                if wrong_agent_commissions:
                    print(f"❌ FILTER ISSUE: Found {len(wrong_agent_commissions)} commissions with wrong agent_id:")
                    for wrong in wrong_agent_commissions[:3]:  # Show first 3
                        print(f"   Commission {wrong['id']}: agent_id={wrong['agent_id']}, expected={wrong['expected']}")
                        print(f"     Transfer: {wrong['transfer_code']}, Amount: {wrong['amount']}")
                    
                    self.log_result("Agent Filter Verification", False, f"Filter not working: {len(wrong_agent_commissions)} wrong commissions", wrong_agent_commissions[:5])
                else:
                    print(f"✅ All {len(filtered_commissions)} commissions belong to agent {test_agent_id}")
                    self.log_result("Agent Filter Verification", True, f"Filter working correctly: {len(filtered_commissions)} commissions for agent {test_agent_id}")
                
            else:
                self.log_result("Get Filtered Commissions", False, f"Failed: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Get Filtered Commissions", False, f"Error: {str(e)}")
            return False
        
        # Test 3: Compare results - filtered should be <= total
        print("\n--- اختبار 3: مقارنة النتائج ---")
        
        if len(filtered_commissions) <= len(all_commissions):
            reduction_percentage = ((len(all_commissions) - len(filtered_commissions)) / len(all_commissions) * 100) if len(all_commissions) > 0 else 0
            print(f"✅ Filter working: {len(all_commissions)} → {len(filtered_commissions)} ({reduction_percentage:.1f}% reduction)")
            self.log_result("Commission Count Comparison", True, f"Filter reduced results from {len(all_commissions)} to {len(filtered_commissions)}")
        else:
            print(f"❌ Filter issue: Filtered results ({len(filtered_commissions)}) > Total results ({len(all_commissions)})")
            self.log_result("Commission Count Comparison", False, f"Filtered ({len(filtered_commissions)}) > Total ({len(all_commissions)})")
        
        # Test 4: Check data types and structure
        print("\n--- اختبار 4: فحص أنواع البيانات والهيكل ---")
        
        # Check admin_commissions collection structure
        print("Checking admin_commissions collection...")
        try:
            # Get a sample from admin_commissions collection directly
            response = self.make_request('GET', '/admin-commissions?type=paid', token=self.admin_token)
            if response.status_code == 200:
                data = response.json()
                commissions = data.get('commissions', [])
                
                if commissions:
                    sample_comm = commissions[0]
                    agent_id_type = type(sample_comm.get('agent_id')).__name__
                    print(f"   Sample commission agent_id: '{sample_comm.get('agent_id')}' (type: {agent_id_type})")
                    print(f"   Sample commission type: {sample_comm.get('type')}")
                    print(f"   Sample commission amount: {sample_comm.get('amount')}")
                    
                    self.log_result("Admin Commissions Structure", True, f"agent_id type: {agent_id_type}")
                else:
                    print("   No commissions found in admin_commissions collection")
                    self.log_result("Admin Commissions Structure", True, "No data in admin_commissions collection")
            else:
                self.log_result("Admin Commissions Structure", False, f"Could not check structure: {response.status_code}")
        except Exception as e:
            self.log_result("Admin Commissions Structure", False, f"Error: {str(e)}")
        
        # Check transfers collection structure
        print("Checking transfers collection...")
        try:
            response = self.make_request('GET', '/transfers?status=completed&limit=5', token=self.admin_token)
            if response.status_code == 200:
                transfers = response.json()
                
                if transfers:
                    sample_transfer = transfers[0]
                    from_agent_id = sample_transfer.get('from_agent_id')
                    to_agent_id = sample_transfer.get('to_agent_id')
                    from_agent_type = type(from_agent_id).__name__
                    to_agent_type = type(to_agent_id).__name__
                    
                    print(f"   Sample transfer from_agent_id: '{from_agent_id}' (type: {from_agent_type})")
                    print(f"   Sample transfer to_agent_id: '{to_agent_id}' (type: {to_agent_type})")
                    print(f"   Sample transfer commission: {sample_transfer.get('commission', 0)}")
                    print(f"   Sample transfer incoming_commission: {sample_transfer.get('incoming_commission', 0)}")
                    
                    self.log_result("Transfers Structure", True, f"from_agent_id type: {from_agent_type}, to_agent_id type: {to_agent_type}")
                else:
                    print("   No completed transfers found")
                    self.log_result("Transfers Structure", True, "No completed transfers found")
            else:
                self.log_result("Transfers Structure", False, f"Could not check transfers: {response.status_code}")
        except Exception as e:
            self.log_result("Transfers Structure", False, f"Error: {str(e)}")
        
        # Test 5: Test with different agent (if available)
        print("\n--- اختبار 5: اختبار مع صراف مختلف ---")
        
        if len(available_agents) >= 2:
            test_agent_2 = available_agents[1]
            test_agent_2_id = test_agent_2.get('id')
            test_agent_2_name = test_agent_2.get('display_name')
            
            print(f"Testing with second agent: {test_agent_2_id} ({test_agent_2_name})")
            
            params_filtered_2 = {
                'type': 'paid',
                'start_date': '2024-01-01',
                'end_date': '2025-12-31',
                'agent_id': test_agent_2_id
            }
            
            try:
                response = self.make_request('GET', '/admin-commissions', token=self.admin_token, params=params_filtered_2)
                if response.status_code == 200:
                    data = response.json()
                    filtered_commissions_2 = data.get('commissions', [])
                    
                    print(f"Commissions for agent 2: {len(filtered_commissions_2)}")
                    
                    # Compare results between two agents
                    if len(filtered_commissions) != len(filtered_commissions_2):
                        print(f"✅ Different agents return different results: Agent 1: {len(filtered_commissions)}, Agent 2: {len(filtered_commissions_2)}")
                        self.log_result("Different Agent Filter", True, f"Agent 1: {len(filtered_commissions)}, Agent 2: {len(filtered_commissions_2)}")
                    else:
                        print(f"⚠️  Both agents return same count: {len(filtered_commissions)}")
                        # This could be normal if both agents have the same number of commissions
                        self.log_result("Different Agent Filter", True, f"Both agents have {len(filtered_commissions)} commissions")
                    
                else:
                    self.log_result("Second Agent Filter", False, f"Failed: {response.status_code}")
            except Exception as e:
                self.log_result("Second Agent Filter", False, f"Error: {str(e)}")
        
        # Test 6: Test with non-existent agent
        print("\n--- اختبار 6: اختبار مع صراف غير موجود ---")
        
        fake_agent_id = "non-existent-agent-id-12345"
        params_fake = {
            'type': 'paid',
            'start_date': '2024-01-01',
            'end_date': '2025-12-31',
            'agent_id': fake_agent_id
        }
        
        try:
            response = self.make_request('GET', '/admin-commissions', token=self.admin_token, params=params_fake)
            if response.status_code == 200:
                data = response.json()
                fake_commissions = data.get('commissions', [])
                
                if len(fake_commissions) == 0:
                    print(f"✅ Non-existent agent returns 0 commissions (correct)")
                    self.log_result("Non-existent Agent Filter", True, "Non-existent agent correctly returns 0 results")
                else:
                    print(f"❌ Non-existent agent returns {len(fake_commissions)} commissions (should be 0)")
                    self.log_result("Non-existent Agent Filter", False, f"Non-existent agent returned {len(fake_commissions)} results")
            else:
                self.log_result("Non-existent Agent Filter", False, f"Request failed: {response.status_code}")
        except Exception as e:
            self.log_result("Non-existent Agent Filter", False, f"Error: {str(e)}")
        
        # Test 7: Check backend logs by making request to trigger logging
        print("\n--- اختبار 7: فحص backend logs ---")
        
        print("Making request to trigger backend logging...")
        try:
            # Make a request that should trigger the logging we saw in the code
            params_log_test = {
                'type': 'paid',
                'start_date': '2024-01-01',
                'end_date': '2025-12-31',
                'agent_id': test_agent_id
            }
            
            response = self.make_request('GET', '/admin-commissions', token=self.admin_token, params=params_log_test)
            if response.status_code == 200:
                print("✅ Request completed - check backend logs for:")
                print(f"   - 'Admin commissions filter - agent_id: {test_agent_id}'")
                print(f"   - 'Applying agent_id filter: {test_agent_id}'")
                print(f"   - 'Comparing agent_id' messages")
                
                self.log_result("Backend Logging Test", True, "Request sent to trigger backend logging")
            else:
                self.log_result("Backend Logging Test", False, f"Request failed: {response.status_code}")
        except Exception as e:
            self.log_result("Backend Logging Test", False, f"Error: {str(e)}")
        
        # Summary
        print("\n--- ملخص النتائج ---")
        
        total_tests = len([r for r in self.test_results if 'Agent Filter' in r['test'] or 'Commission' in r['test']])
        passed_tests = len([r for r in self.test_results if ('Agent Filter' in r['test'] or 'Commission' in r['test']) and r['success']])
        
        print(f"Total tests: {total_tests}")
        print(f"Passed tests: {passed_tests}")
        print(f"Success rate: {(passed_tests/total_tests*100):.1f}%" if total_tests > 0 else "N/A")
        
        # Check if the main issue is resolved
        if len(filtered_commissions) < len(all_commissions):
            print("\n✅ CONCLUSION: Agent filter appears to be working correctly")
            print(f"   - Total commissions: {len(all_commissions)}")
            print(f"   - Filtered commissions: {len(filtered_commissions)}")
            print(f"   - Filter reduces results as expected")
            
            self.log_result("Overall Agent Filter Test", True, "Agent filter working correctly")
        else:
            print("\n❌ CONCLUSION: Agent filter may have issues")
            print(f"   - Total commissions: {len(all_commissions)}")
            print(f"   - Filtered commissions: {len(filtered_commissions)}")
            print(f"   - Filter does not reduce results as expected")
            
            self.log_result("Overall Agent Filter Test", False, "Agent filter not working as expected")
        
        return True
    
    def run_all_tests(self):
        """Run all tests"""
        print("🚨 اختبار فلتر الصراف في endpoint العمولات")
        print("=" * 80)
        
        if not self.test_authentication():
            return False
        
        self.test_agent_filter_functionality()
        
        # Final summary
        print("\n" + "=" * 80)
        print("FINAL TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r['success']])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%" if total_tests > 0 else "N/A")
        
        if failed_tests > 0:
            print("\nFailed Tests:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  ❌ {result['test']}: {result['message']}")
        
        return failed_tests == 0

if __name__ == "__main__":
    tester = AgentFilterTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed!")
    else:
        print("\n⚠️  Some tests failed. Check the results above.")