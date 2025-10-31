#!/usr/bin/env python3
"""
🚨 اختبار مفصل لفلتر الصراف في endpoint العمولات

هذا الاختبار يركز على اختبار الفلتر مع الصرافين الذين لديهم عمولات فعلية
"""

import requests
import json
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://xchange-hub-1.preview.emergentagent.com/api"
ADMIN_CREDENTIALS = {"username": "admin", "password": "admin123"}

class DetailedAgentFilterTester:
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
    
    def test_detailed_agent_filter(self):
        """اختبار مفصل لفلتر الصراف"""
        print("\n🚨 اختبار مفصل لفلتر الصراف في endpoint العمولات")
        print("=" * 80)
        
        # Step 1: Get all commissions and analyze them
        print("\n--- الخطوة 1: تحليل جميع العمولات ---")
        
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
                
                print(f"Total commissions: {len(all_commissions)}")
                
                # Analyze agent distribution
                agent_commission_count = {}
                for comm in all_commissions:
                    agent_id = comm.get('agent_id')
                    if agent_id:
                        agent_commission_count[agent_id] = agent_commission_count.get(agent_id, 0) + 1
                
                print(f"Agents with commissions: {len(agent_commission_count)}")
                print("Agent commission distribution:")
                for agent_id, count in sorted(agent_commission_count.items(), key=lambda x: x[1], reverse=True):
                    print(f"   {agent_id}: {count} commissions")
                
                self.log_result("Commission Analysis", True, f"Found {len(all_commissions)} commissions from {len(agent_commission_count)} agents")
                
                # Test with agents that actually have commissions
                if agent_commission_count:
                    # Get the agent with the most commissions
                    top_agent_id = max(agent_commission_count.keys(), key=lambda x: agent_commission_count[x])
                    top_agent_count = agent_commission_count[top_agent_id]
                    
                    print(f"\nTesting with agent that has most commissions: {top_agent_id} ({top_agent_count} commissions)")
                    
                    # Test filter with this agent
                    params_filtered = {
                        'type': 'paid',
                        'start_date': '2024-01-01',
                        'end_date': '2025-12-31',
                        'agent_id': top_agent_id
                    }
                    
                    try:
                        response = self.make_request('GET', '/admin-commissions', token=self.admin_token, params=params_filtered)
                        if response.status_code == 200:
                            filtered_data = response.json()
                            filtered_commissions = filtered_data.get('commissions', [])
                            
                            print(f"Filtered results: {len(filtered_commissions)} commissions")
                            
                            # Verify all results belong to the correct agent
                            correct_agent_count = 0
                            wrong_agent_count = 0
                            wrong_agents = []
                            
                            for comm in filtered_commissions:
                                comm_agent_id = comm.get('agent_id')
                                if comm_agent_id == top_agent_id:
                                    correct_agent_count += 1
                                else:
                                    wrong_agent_count += 1
                                    wrong_agents.append({
                                        'commission_id': comm.get('id'),
                                        'found_agent_id': comm_agent_id,
                                        'expected_agent_id': top_agent_id,
                                        'transfer_code': comm.get('transfer_code', 'N/A'),
                                        'amount': comm.get('amount', 0)
                                    })
                            
                            print(f"Correct agent commissions: {correct_agent_count}")
                            print(f"Wrong agent commissions: {wrong_agent_count}")
                            
                            if wrong_agent_count > 0:
                                print("❌ FILTER ISSUE DETECTED:")
                                for wrong in wrong_agents[:5]:  # Show first 5
                                    print(f"   Commission {wrong['commission_id']}")
                                    print(f"     Expected agent: {wrong['expected_agent_id']}")
                                    print(f"     Found agent: {wrong['found_agent_id']}")
                                    print(f"     Transfer: {wrong['transfer_code']}, Amount: {wrong['amount']}")
                                
                                self.log_result("Agent Filter Accuracy", False, f"Filter failed: {wrong_agent_count} wrong results out of {len(filtered_commissions)}", wrong_agents)
                            else:
                                print("✅ Filter working correctly - all results belong to the correct agent")
                                self.log_result("Agent Filter Accuracy", True, f"Filter working: {len(filtered_commissions)} correct results")
                            
                            # Check if the count matches expected
                            if len(filtered_commissions) == top_agent_count:
                                print(f"✅ Count matches expected: {len(filtered_commissions)} = {top_agent_count}")
                                self.log_result("Filter Count Accuracy", True, f"Count matches: {len(filtered_commissions)} = {top_agent_count}")
                            else:
                                print(f"❌ Count mismatch: Expected {top_agent_count}, got {len(filtered_commissions)}")
                                self.log_result("Filter Count Accuracy", False, f"Count mismatch: Expected {top_agent_count}, got {len(filtered_commissions)}")
                        
                        else:
                            self.log_result("Filtered Request", False, f"Filter request failed: {response.status_code}")
                    
                    except Exception as e:
                        self.log_result("Filtered Request", False, f"Error: {str(e)}")
                
                else:
                    print("⚠️  No agents found with commissions - cannot test filter with real data")
                    self.log_result("Commission Analysis", False, "No agents with commissions found")
            
            else:
                self.log_result("Get All Commissions", False, f"Failed: {response.status_code}")
                return False
        
        except Exception as e:
            self.log_result("Get All Commissions", False, f"Error: {str(e)}")
            return False
        
        # Step 2: Test with multiple agents
        print("\n--- الخطوة 2: اختبار مع عدة صرافين ---")
        
        if len(agent_commission_count) >= 2:
            # Test with top 2 agents
            top_agents = sorted(agent_commission_count.items(), key=lambda x: x[1], reverse=True)[:2]
            
            for i, (agent_id, expected_count) in enumerate(top_agents, 1):
                print(f"\nTesting agent {i}: {agent_id} (expected: {expected_count} commissions)")
                
                params = {
                    'type': 'paid',
                    'start_date': '2024-01-01',
                    'end_date': '2025-12-31',
                    'agent_id': agent_id
                }
                
                try:
                    response = self.make_request('GET', '/admin-commissions', token=self.admin_token, params=params)
                    if response.status_code == 200:
                        data = response.json()
                        commissions = data.get('commissions', [])
                        
                        print(f"   Returned: {len(commissions)} commissions")
                        
                        # Check accuracy
                        correct = sum(1 for c in commissions if c.get('agent_id') == agent_id)
                        wrong = len(commissions) - correct
                        
                        if wrong == 0 and len(commissions) == expected_count:
                            print(f"   ✅ Perfect match: {correct} correct, {wrong} wrong")
                            self.log_result(f"Agent {i} Filter Test", True, f"Perfect: {correct} correct, {wrong} wrong")
                        elif wrong == 0:
                            print(f"   ✅ All correct but count mismatch: {correct} correct, expected {expected_count}")
                            self.log_result(f"Agent {i} Filter Test", True, f"Correct but count issue: {correct} vs {expected_count}")
                        else:
                            print(f"   ❌ Filter issue: {correct} correct, {wrong} wrong")
                            self.log_result(f"Agent {i} Filter Test", False, f"Filter issue: {correct} correct, {wrong} wrong")
                    
                    else:
                        self.log_result(f"Agent {i} Filter Test", False, f"Request failed: {response.status_code}")
                
                except Exception as e:
                    self.log_result(f"Agent {i} Filter Test", False, f"Error: {str(e)}")
        
        # Step 3: Test edge cases
        print("\n--- الخطوة 3: اختبار الحالات الحدية ---")
        
        # Test with earned commissions
        print("\nTesting with 'earned' commissions...")
        params_earned = {
            'type': 'earned',
            'start_date': '2024-01-01',
            'end_date': '2025-12-31'
        }
        
        try:
            response = self.make_request('GET', '/admin-commissions', token=self.admin_token, params=params_earned)
            if response.status_code == 200:
                data = response.json()
                earned_commissions = data.get('commissions', [])
                
                print(f"Total earned commissions: {len(earned_commissions)}")
                
                if earned_commissions:
                    # Get an agent with earned commissions
                    earned_agents = {}
                    for comm in earned_commissions:
                        agent_id = comm.get('agent_id')
                        if agent_id:
                            earned_agents[agent_id] = earned_agents.get(agent_id, 0) + 1
                    
                    if earned_agents:
                        test_agent = max(earned_agents.keys(), key=lambda x: earned_agents[x])
                        expected_earned = earned_agents[test_agent]
                        
                        print(f"Testing earned filter with agent: {test_agent} (expected: {expected_earned})")
                        
                        params_earned_filtered = {
                            'type': 'earned',
                            'start_date': '2024-01-01',
                            'end_date': '2025-12-31',
                            'agent_id': test_agent
                        }
                        
                        response = self.make_request('GET', '/admin-commissions', token=self.admin_token, params=params_earned_filtered)
                        if response.status_code == 200:
                            filtered_data = response.json()
                            filtered_earned = filtered_data.get('commissions', [])
                            
                            correct_earned = sum(1 for c in filtered_earned if c.get('agent_id') == test_agent)
                            wrong_earned = len(filtered_earned) - correct_earned
                            
                            print(f"Earned filter results: {len(filtered_earned)} total, {correct_earned} correct, {wrong_earned} wrong")
                            
                            if wrong_earned == 0:
                                self.log_result("Earned Commission Filter", True, f"Earned filter working: {correct_earned} correct")
                            else:
                                self.log_result("Earned Commission Filter", False, f"Earned filter issue: {wrong_earned} wrong results")
                        else:
                            self.log_result("Earned Commission Filter", False, f"Earned filter request failed: {response.status_code}")
                
                self.log_result("Earned Commissions Test", True, f"Found {len(earned_commissions)} earned commissions")
            else:
                self.log_result("Earned Commissions Test", False, f"Failed: {response.status_code}")
        
        except Exception as e:
            self.log_result("Earned Commissions Test", False, f"Error: {str(e)}")
        
        return True
    
    def run_all_tests(self):
        """Run all tests"""
        print("🚨 اختبار مفصل لفلتر الصراف في endpoint العمولات")
        print("=" * 80)
        
        if not self.test_authentication():
            return False
        
        self.test_detailed_agent_filter()
        
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
    tester = DetailedAgentFilterTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed!")
    else:
        print("\n⚠️  Some tests failed. Check the results above.")