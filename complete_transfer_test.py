#!/usr/bin/env python3
"""
Additional test for complete transfer reception flow
"""

import requests
import json
import time
from io import BytesIO

# Configuration
BASE_URL = "https://financetrack-16.preview.emergentagent.com/api"
AGENT_CREDENTIALS = {"username": "agent_baghdad", "password": "agent123"}

def test_complete_transfer_flow():
    """Test complete transfer reception with correct data"""
    print("🔄 Testing Complete Transfer Reception Flow")
    
    # Login
    response = requests.post(f"{BASE_URL}/login", json=AGENT_CREDENTIALS)
    if response.status_code != 200:
        print("❌ Login failed")
        return
    
    token = response.json()['access_token']
    headers = {'Authorization': f'Bearer {token}'}
    
    # Create transfer
    transfer_data = {
        "sender_name": "محمد أحمد علي",
        "amount": 2000,
        "currency": "IQD",
        "to_governorate": "بغداد",
        "note": "اختبار استلام كامل"
    }
    
    response = requests.post(f"{BASE_URL}/transfers", json=transfer_data, headers=headers)
    if response.status_code != 200:
        print("❌ Transfer creation failed")
        return
    
    transfer_info = response.json()
    transfer_id = transfer_info['id']
    pin = transfer_info['pin']
    transfer_code = transfer_info['transfer_code']
    
    print(f"✅ Transfer created: {transfer_code}")
    
    # Get initial balance
    response = requests.get(f"{BASE_URL}/wallet/balance", headers=headers)
    initial_balance = response.json()['wallet_balance_iqd']
    
    # Try to receive with correct data
    form_data = {
        'pin': pin,
        'receiver_fullname': 'محمد أحمد علي'  # Same as sender_name
    }
    
    # Create a simple test image
    files = {'id_image': ('test.jpg', b'fake_image_data_for_testing', 'image/jpeg')}
    
    response = requests.post(f"{BASE_URL}/transfers/{transfer_id}/receive", 
                           data=form_data, files=files, headers=headers)
    
    if response.status_code == 200:
        print("✅ Transfer received successfully")
        
        # Check balance increase
        time.sleep(1)
        response = requests.get(f"{BASE_URL}/wallet/balance", headers=headers)
        new_balance = response.json()['wallet_balance_iqd']
        
        if new_balance == initial_balance + 2000:
            print(f"✅ Wallet balance correctly increased by 2000 (from {initial_balance} to {new_balance})")
        else:
            print(f"❌ Wallet balance not correctly updated. Expected: {initial_balance + 2000}, Got: {new_balance}")
        
        # Check transaction history
        response = requests.get(f"{BASE_URL}/wallet/transactions", headers=headers)
        transactions = response.json()
        
        received_transaction = next((t for t in transactions if t.get('transaction_type') == 'transfer_received' 
                                   and t.get('reference_id') == transfer_id), None)
        
        if received_transaction:
            print("✅ Transfer received transaction logged correctly")
        else:
            print("❌ Transfer received transaction not found in history")
            
    else:
        print(f"❌ Transfer reception failed: {response.status_code} - {response.text}")

if __name__ == "__main__":
    test_complete_transfer_flow()