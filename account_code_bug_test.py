#!/usr/bin/env python3
"""
🚨 CRITICAL BUG TEST - AGENT ACCOUNT LINKING COMPLETELY BROKEN

**Problem:** When adding a new agent via `/admin/dashboard` green button, the account_code is NOT saved to database.

**Test Flow:**
1. Admin adds new agent via POST /api/register with:
   - username: auto-generated
   - password: auto-generated  
   - display_name: "Test Agent"
   - phone: "+9647801234567"
   - governorate: "BG"
   - address: "Test Address"
   - **account_code: "1002"** (THIS IS THE KEY FIELD!)
   - role: "agent"

2. Verify in database:
   - Agent is created
   - **account_id field should be "1002"**
   - **account_code field should be "1002"**

**Expected:** Both account_id and account_code = "1002"
**Actual:** account_id = MISSING or null

**Critical Files:**
- Backend: /app/backend/server.py (register_user endpoint around line 856-975)
- The backend should save account_code to both account_id and account_code fields

**Test specifically:**
- Does POST /api/register accept account_code parameter?
- Does the backend save it to database?
- Check the actual database record after creation

Test this and report EXACTLY what account_id value is saved in database!
"""

import requests
import json
import time
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://agent-ui-revamp.preview.emergentagent.com/api"
ADMIN_CREDENTIALS = {"username": "admin", "password": "admin123"}

class AccountCodeBugTester:
    def __init__(self):
        self.admin_token = None
        self.admin_user_id = None
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
        print("\n=== Testing Authentication ===")
        
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
    
    def test_critical_account_code_bug(self):
        """Test the critical account_code bug as described in review request"""
        print("\n=== 🚨 CRITICAL BUG TEST: ACCOUNT_CODE NOT BEING SAVED ===")
        
        # Step 1: Create a test account in chart_of_accounts first (account_code "1003")
        test_account_code = "1003"
        
        # Check if account 1002 exists, if not create it
        try:
            response = self.make_request('GET', f'/accounting/accounts/{test_account_code}', token=self.admin_token)
            if response.status_code == 404:
                # Create the account first
                account_data = {
                    "code": test_account_code,
                    "name_ar": "صيرفة اور",
                    "name_en": "Aur Exchange",
                    "category": "شركات الصرافة",
                    "currencies": ["IQD", "USD"]
                }
                
                create_response = self.make_request('POST', '/accounting/accounts', token=self.admin_token, json=account_data)
                if create_response.status_code in [200, 201]:
                    self.log_result("Test Account Creation", True, f"Created test account {test_account_code}")
                else:
                    self.log_result("Test Account Creation", False, f"Failed to create test account: {create_response.status_code} - {create_response.text}")
                    return False
            else:
                self.log_result("Test Account Exists", True, f"Account {test_account_code} already exists")
        except Exception as e:
            self.log_result("Test Account Setup", False, f"Error setting up test account: {str(e)}")
            return False
        
        # Step 2: Register new agent with account_code "1002" as per review request
        timestamp = int(time.time())
        test_agent_data = {
            "username": f"test_agent_{timestamp}",  # auto-generated
            "password": "test123456",  # auto-generated
            "display_name": "Test Agent",
            "phone": "+9647801234567",
            "governorate": "BG",
            "address": "Test Address",
            "account_code": "1003",  # THIS IS THE KEY FIELD!
            "role": "agent"
        }
        
        print(f"\n📋 REGISTERING AGENT WITH ACCOUNT_CODE: {test_agent_data['account_code']}")
        print(f"Agent data: {json.dumps(test_agent_data, indent=2)}")
        
        created_agent_id = None
        
        try:
            response = self.make_request('POST', '/register', token=self.admin_token, json=test_agent_data)
            print(f"\n📡 POST /api/register Response:")
            print(f"Status Code: {response.status_code}")
            print(f"Response Text: {response.text}")
            
            if response.status_code in [200, 201]:
                agent_data = response.json()
                created_agent_id = agent_data.get('id')
                returned_account_code = agent_data.get('account_code')
                returned_account_id = agent_data.get('account_id')
                
                print(f"\n📊 AGENT CREATION RESPONSE:")
                print(f"Agent ID: {created_agent_id}")
                print(f"Returned account_code: {returned_account_code}")
                print(f"Returned account_id: {returned_account_id}")
                
                # Check if account_code was returned correctly
                if returned_account_code == "1003":
                    self.log_result("Agent Registration - account_code returned", True, 
                                  f"Agent created with correct account_code: {returned_account_code}")
                else:
                    self.log_result("Agent Registration - account_code returned", False, 
                                  f"Agent account_code mismatch: expected 1003, got {returned_account_code}")
                
                # Check if account_id was returned correctly
                if returned_account_id == "1003":
                    self.log_result("Agent Registration - account_id returned", True, 
                                  f"Agent created with correct account_id: {returned_account_id}")
                else:
                    self.log_result("Agent Registration - account_id returned", False, 
                                  f"Agent account_id mismatch: expected 1003, got {returned_account_id}")
                
            else:
                self.log_result("Agent Registration", False, 
                              f"Failed to register agent: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            self.log_result("Agent Registration", False, f"Error: {str(e)}")
            return False
        
        # Step 3: CRITICAL TEST - Verify in database by getting the agent details
        if created_agent_id:
            print(f"\n🔍 VERIFYING DATABASE RECORD FOR AGENT: {created_agent_id}")
            
            try:
                # Get agent details from database
                response = self.make_request('GET', f'/users/{created_agent_id}', token=self.admin_token)
                print(f"\n📡 GET /api/users/{created_agent_id} Response:")
                print(f"Status Code: {response.status_code}")
                print(f"Response Text: {response.text}")
                
                if response.status_code == 200:
                    agent_db_data = response.json()
                    
                    db_account_code = agent_db_data.get('account_code')
                    db_account_id = agent_db_data.get('account_id')
                    
                    print(f"\n🗄️ DATABASE RECORD VERIFICATION:")
                    print(f"Agent ID: {agent_db_data.get('id')}")
                    print(f"Username: {agent_db_data.get('username')}")
                    print(f"Display Name: {agent_db_data.get('display_name')}")
                    print(f"Role: {agent_db_data.get('role')}")
                    print(f"🔑 account_code in DB: {db_account_code}")
                    print(f"🔑 account_id in DB: {db_account_id}")
                    
                    # CRITICAL VERIFICATION: Check account_code field
                    if db_account_code == "1003":
                        self.log_result("🔑 DATABASE - account_code field", True, 
                                      f"✅ account_code correctly saved as: {db_account_code}")
                    else:
                        self.log_result("🔑 DATABASE - account_code field", False, 
                                      f"❌ account_code NOT saved correctly: expected '1003', got '{db_account_code}'")
                    
                    # CRITICAL VERIFICATION: Check account_id field
                    if db_account_id == "1003":
                        self.log_result("🔑 DATABASE - account_id field", True, 
                                      f"✅ account_id correctly saved as: {db_account_id}")
                    else:
                        self.log_result("🔑 DATABASE - account_id field", False, 
                                      f"❌ account_id NOT saved correctly: expected '1003', got '{db_account_id}'")
                    
                    # Print all fields for debugging
                    print(f"\n📋 COMPLETE AGENT RECORD:")
                    for key, value in agent_db_data.items():
                        print(f"   {key}: {value}")
                    
                else:
                    self.log_result("Database Verification", False, 
                                  f"Failed to get agent from database: {response.status_code} - {response.text}")
                    
            except Exception as e:
                self.log_result("Database Verification", False, f"Error verifying database: {str(e)}")
        
        # Step 4: Also verify via agents list endpoint
        if created_agent_id:
            print(f"\n📋 VERIFYING VIA AGENTS LIST ENDPOINT")
            
            try:
                response = self.make_request('GET', '/agents', token=self.admin_token)
                if response.status_code == 200:
                    agents = response.json()
                    created_agent = next((a for a in agents if a.get('id') == created_agent_id), None)
                    
                    if created_agent:
                        list_account_code = created_agent.get('account_code')
                        list_account_id = created_agent.get('account_id')
                        
                        print(f"\n📋 AGENTS LIST VERIFICATION:")
                        print(f"🔑 account_code in list: {list_account_code}")
                        print(f"🔑 account_id in list: {list_account_id}")
                        
                        if list_account_code == "1003":
                            self.log_result("AGENTS LIST - account_code field", True, 
                                          f"✅ account_code in agents list: {list_account_code}")
                        else:
                            self.log_result("AGENTS LIST - account_code field", False, 
                                          f"❌ account_code in agents list incorrect: {list_account_code}")
                        
                        if list_account_id == "1003":
                            self.log_result("AGENTS LIST - account_id field", True, 
                                          f"✅ account_id in agents list: {list_account_id}")
                        else:
                            self.log_result("AGENTS LIST - account_id field", False, 
                                          f"❌ account_id in agents list incorrect: {list_account_id}")
                    else:
                        self.log_result("Agents List Verification", False, 
                                      f"Agent not found in agents list")
                else:
                    self.log_result("Agents List Verification", False, 
                                  f"Failed to get agents list: {response.status_code}")
            except Exception as e:
                self.log_result("Agents List Verification", False, f"Error: {str(e)}")
        
        return True
    
    def run_critical_bug_test(self):
        """Run the critical account_code bug test"""
        print("🚨 STARTING CRITICAL BUG TEST - AGENT ACCOUNT LINKING")
        print("=" * 80)
        print("Testing if account_code is properly saved to database during agent registration")
        print("=" * 80)
        
        # Step 1: Authentication
        if not self.test_authentication():
            print("❌ Authentication failed - cannot continue")
            return False
        
        # Step 2: Run critical bug test
        self.test_critical_account_code_bug()
        
        # Step 3: Print summary
        self.print_test_summary()
        
        return True
    
    def print_test_summary(self):
        """Print test summary focusing on the critical bug"""
        print("\n" + "=" * 80)
        print("🚨 CRITICAL BUG TEST SUMMARY - AGENT ACCOUNT LINKING")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r['success']])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        # Focus on critical fields
        account_code_tests = [r for r in self.test_results if 'account_code' in r['test']]
        account_id_tests = [r for r in self.test_results if 'account_id' in r['test']]
        
        print(f"\n🔑 CRITICAL FIELD VERIFICATION:")
        
        account_code_passed = len([r for r in account_code_tests if r['success']])
        print(f"   account_code field: {account_code_passed}/{len(account_code_tests)} tests passed")
        
        account_id_passed = len([r for r in account_id_tests if r['success']])
        print(f"   account_id field: {account_id_passed}/{len(account_id_tests)} tests passed")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS ({failed_tests}):")
            for result in self.test_results:
                if not result['success']:
                    print(f"   - {result['test']}: {result['message']}")
        
        print(f"\n✅ PASSED TESTS ({passed_tests}):")
        for result in self.test_results:
            if result['success']:
                print(f"   - {result['test']}: {result['message']}")
        
        # Critical assessment
        critical_failures = [r for r in self.test_results if not r['success'] and ('account_code' in r['test'] or 'account_id' in r['test'])]
        
        print(f"\n🎯 CRITICAL BUG ASSESSMENT:")
        
        if len(critical_failures) == 0:
            print("✅ BUG FIXED - Both account_code and account_id are being saved correctly!")
            print("✅ Agent registration properly links accounts")
            print("✅ Database records contain correct account information")
        else:
            print("🚨 BUG CONFIRMED - Account linking is broken!")
            print("❌ The account_code parameter is NOT being saved to database")
            print("❌ This prevents proper agent-account linking")
            print("\n🔧 REQUIRED FIXES:")
            print("   1. Backend POST /api/register must save account_code to user.account_code field")
            print("   2. Backend POST /api/register must save account_code to user.account_id field")
            print("   3. Verify both fields are properly stored in MongoDB")
            
            for failure in critical_failures:
                print(f"   ❌ {failure['test']}: {failure['message']}")
        
        print("=" * 80)

def main():
    """Main execution function"""
    tester = AccountCodeBugTester()
    
    try:
        success = tester.run_critical_bug_test()
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