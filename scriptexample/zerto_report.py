#!/usr/bin/env python3
"""
Zerto API Report Generator
This script connects to Zerto API to retrieve VM information and their actual RPO values.
"""

import requests
import urllib3
import json
from typing import List, Dict, Any
import sys
import os
import argparse
from dotenv import load_dotenv
from datetime import datetime
import locale

# Disable SSL warnings for self-signed certificates
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class ZertoAPIClient:
    def __init__(self, base_url: str, client_id: str):
        """
        Initialize Zerto API client
        
        Args:
            base_url: Base URL of the Zerto Virtual Manager (e.g., https://192.168.77.250)
            client_id: Client ID for authentication
        """
        self.base_url = base_url.rstrip('/')
        self.client_id = client_id
        self.session = requests.Session()
        self.session.verify = False  # Disable SSL verification for self-signed certs
        self.auth_token = None
        
    def authenticate(self, username: str, password: str) -> bool:
        """
        Authenticate with Zerto API using OAuth2 and get access token
        
        Args:
            username: Zerto username
            password: Zerto password
            
        Returns:
            bool: True if authentication successful, False otherwise
        """
        auth_url = f"{self.base_url}/auth/realms/zerto/protocol/openid-connect/token"
        
        auth_data = {
            "grant_type": "password",
            "client_id": self.client_id,
            "username": username,
            "password": password,
            "scope": "openid"
        }
        
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json"
        }
        
        try:
            response = self.session.post(auth_url, data=auth_data, headers=headers)
            
            if response.status_code == 200:
                token_data = response.json()
                self.auth_token = token_data.get('access_token')
                
                if self.auth_token:
                    # Set the Bearer token for future requests
                    self.session.headers.update({'Authorization': f'Bearer {self.auth_token}'})
                    print("✓ OAuth2 authentication successful")
                    return True
                else:
                    print("✗ Authentication failed: No access token received")
                    return False
            else:
                print(f"✗ Authentication failed: {response.status_code} - {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"✗ Authentication error: {e}")
            return False
        except json.JSONDecodeError as e:
            print(f"✗ Error parsing authentication response: {e}")
            return False
    
    def get_vms(self) -> List[Dict[str, Any]]:
        """
        Retrieve all VMs from Zerto API
        
        Returns:
            List of VM dictionaries
        """
        if not self.auth_token:
            print("✗ Not authenticated. Please authenticate first.")
            return []
        
        vms_url = f"{self.base_url}/v1/vms"
        
        try:
            response = self.session.get(vms_url)
            
            if response.status_code == 200:
                vms_data = response.json()
                print(f"✓ Successfully retrieved {len(vms_data)} VMs")
                return vms_data
            else:
                print(f"✗ Failed to retrieve VMs: {response.status_code} - {response.text}")
                return []
                
        except requests.exceptions.RequestException as e:
            print(f"✗ Error retrieving VMs: {e}")
            return []
        except json.JSONDecodeError as e:
            print(f"✗ Error parsing JSON response: {e}")
            return []
    
    def _get_status_description(self, status_code: int) -> str:
        """
        Convert Zerto status code to human-readable description
        
        Args:
            status_code: Numeric status code from Zerto API
            
        Returns:
            Human-readable status description
        """
        status_mapping = {
            0: "Initializing",
            1: "MeetingSLA", 
            2: "NotMeetingSLA",
            3: "RpoNotMeetingSLA",
            4: "HistoryNotMeetingSLA",
            5: "FailingOver",
            6: "Moving",
            7: "Deleting",
            8: "Recovered"
        }
        return status_mapping.get(status_code, f"Unknown({status_code})")
    
    def generate_rpo_report(self, vms: List[Dict[str, Any]], dc_name: str = "MINI DC") -> None:
        """
        Generate and display RPO report for VMs
        
        Args:
            vms: List of VM data from API
            dc_name: Name of the data center for the report header
        """
        if not vms:
            print(f"No VMs found for {dc_name}.")
            return
        
        print("\n" + "="*100)
        print(f"ZERTO VM RPO REPORT - {dc_name} - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*100)
        print(f"{'VM Name':<30} {'VPG Name':<25} {'RPO (sec)':<10} {'VPG Status':<18} {'RPO Health':<10}")
        print("-"*100)
        
        total_vms = 0
        rpo_issues = 0
        status_summary = {}
        
        for vm in vms:
            vm_name = vm.get('VmName', 'N/A')
            vpg_name = vm.get('VpgName', 'N/A')
            actual_rpo = vm.get('ActualRPO', 'N/A')
            status_code = vm.get('Status', 'N/A')
            
            # Get human-readable status
            if isinstance(status_code, int):
                status_desc = self._get_status_description(status_code)
                # Count status occurrences for summary
                status_summary[status_desc] = status_summary.get(status_desc, 0) + 1
            else:
                status_desc = 'N/A'
            
            # Truncate long names for better formatting
            vm_name_display = vm_name[:29] if len(vm_name) > 29 else vm_name
            vpg_name_display = vpg_name[:24] if len(vpg_name) > 24 else vpg_name
            status_display = status_desc[:17] if len(status_desc) > 17 else status_desc
            
            # Check for RPO issues (assuming > 300 seconds is an issue)
            rpo_health = "OK"
            if isinstance(actual_rpo, (int, float)) and actual_rpo > 300:
                rpo_health = "HIGH"
                rpo_issues += 1
            
            print(f"{vm_name_display:<30} {vpg_name_display:<25} {actual_rpo:<10} {status_display:<18} {rpo_health:<10}")
            total_vms += 1
        
        print("-"*100)
        print(f"Total VMs: {total_vms}")
        print(f"VMs with RPO > 300 seconds: {rpo_issues}")
        print("\nVPG Status Summary:")
        for status, count in sorted(status_summary.items()):
            print(f"  {status}: {count} VMs")
        print("="*100)
    
    def save_detailed_report(self, vms: List[Dict[str, Any]], filename: str = "zerto_vm_report.json") -> None:
        """
        Save detailed VM report to JSON file
        
        Args:
            vms: List of VM data from API
            filename: Output filename
        """
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(vms, f, indent=2, default=str)
            print(f"✓ Detailed report saved to {filename}")
        except Exception as e:
            print(f"✗ Error saving report: {e}")
    
    def generate_whatsapp_message(self, jepara_vms: List[Dict[str, Any]], jakarta_vms: List[Dict[str, Any]]) -> str:
        """
        Generate WhatsApp message in Indonesian for Zerto replication report
        
        Args:
            jepara_vms: List of VM data from MINI DC Jepara
            jakarta_vms: List of VM data from DC Jakarta
            
        Returns:
            Formatted WhatsApp message string
        """
        # Get current date and time
        now = datetime.now()
        
        # Indonesian day names
        day_names = {
            0: "Senin", 1: "Selasa", 2: "Rabu", 3: "Kamis", 
            4: "Jumat", 5: "Sabtu", 6: "Minggu"
        }
        
        # Indonesian month names
        month_names = {
            1: "Januari", 2: "Februari", 3: "Maret", 4: "April",
            5: "Mei", 6: "Juni", 7: "Juli", 8: "Agustus",
            9: "September", 10: "Oktober", 11: "November", 12: "Desember"
        }
        
        day_name = day_names[now.weekday()]
        month_name = month_names[now.month]
        formatted_date = f"{day_name}, {now.day} {month_name} {now.year}"
        formatted_time = now.strftime("%H:%M")
        
        # Function to analyze VM data for a specific DC
        def analyze_dc_data(vms, dc_name):
            total_vms = len(vms)
            rpo_issues = 0
            status_issues = 0
            error_details = []
            max_rpo = 0
            status_counts = {}
            
            for vm in vms:
                vm_name = vm.get('VmName', 'N/A')
                actual_rpo = vm.get('ActualRPO', 0)
                status_code = vm.get('Status', 1)
                
                # Track maximum RPO
                if isinstance(actual_rpo, (int, float)):
                    max_rpo = max(max_rpo, actual_rpo)
                    
                    # Check for RPO issues (> 15 minutes = 900 seconds)
                    if actual_rpo > 900:
                        rpo_issues += 1
                        error_details.append(f"• {dc_name} - {vm_name}: RPO {actual_rpo} detik (>{int(actual_rpo/60)} menit)")
                
                # Count status occurrences
                status_desc = self._get_status_description(status_code) if isinstance(status_code, int) else 'Unknown'
                status_counts[status_desc] = status_counts.get(status_desc, 0) + 1
                
                # Check for status issues (not MeetingSLA)
                if status_code != 1:  # 1 = MeetingSLA
                    status_issues += 1
                    error_details.append(f"• {dc_name} - {vm_name}: Status {status_desc}")
            
            return {
                'total_vms': total_vms,
                'rpo_issues': rpo_issues,
                'status_issues': status_issues,
                'error_details': error_details,
                'max_rpo': max_rpo,
                'status_counts': status_counts
            }
        
        # Analyze both data centers
        jepara_data = analyze_dc_data(jepara_vms, "MINI DC Jepara")
        jakarta_data = analyze_dc_data(jakarta_vms, "DC Jakarta")
        
        # Combined totals
        total_vms = jepara_data['total_vms'] + jakarta_data['total_vms']
        total_rpo_issues = jepara_data['rpo_issues'] + jakarta_data['rpo_issues']
        total_status_issues = jepara_data['status_issues'] + jakarta_data['status_issues']
        all_error_details = jepara_data['error_details'] + jakarta_data['error_details']
        max_rpo = max(jepara_data['max_rpo'], jakarta_data['max_rpo'])
        
        # Keep max RPO in seconds as per API default
        
        # Build WhatsApp message with smart greeting based on time windows
        if now.hour < 10:
            greeting = "Selamat pagi Team"
        elif 10 <= now.hour < 15:
            greeting = "Selamat siang Team"
        elif 15 <= now.hour < 18:
            greeting = "Selamat sore Team"
        else:
            greeting = "Selamat malam Team"
        
        message = f"{greeting}, berikut adalah laporan hasil replikasi Zerto pada hari {formatted_date} pukul {formatted_time}.\n\n"
        
        # Main status message
        if total_rpo_issues == 0 and total_status_issues == 0:
            message += f"✅ Semua {total_vms} server dari kedua data center memenuhi SLA dengan RPO time kurang dari 15 menit (maksimal: {max_rpo} detik)."
        else:
            total_issues = total_rpo_issues + total_status_issues
            message += f"⚠️ Ditemukan {total_issues} masalah pada replikasi server:"
            
            if total_rpo_issues > 0:
                message += f"\n\n🔴 RPO Issues ({total_rpo_issues} server):"
                for detail in [d for d in all_error_details if "RPO" in d]:
                    message += f"\n{detail}"
            
            if total_status_issues > 0:
                message += f"\n\n🟡 Status Issues ({total_status_issues} server):"
                for detail in [d for d in all_error_details if "Status" in d]:
                    message += f"\n{detail}"
        
        # Add detailed breakdown per DC
        message += f"\n\n📊 Ringkasan per Data Center:"
        message += f"\n🏢 MINI DC Jepara: {jepara_data['total_vms']} server"
        if jepara_data['rpo_issues'] + jepara_data['status_issues'] == 0:
            message += f" - ✅ Semua OK"
        else:
            message += f" - ⚠️ {jepara_data['rpo_issues'] + jepara_data['status_issues']} masalah"
        
        message += f"\n🏢 DC Jakarta: {jakarta_data['total_vms']} server"
        if jakarta_data['rpo_issues'] + jakarta_data['status_issues'] == 0:
            message += f" - ✅ Semua OK"
        else:
            message += f" - ⚠️ {jakarta_data['rpo_issues'] + jakarta_data['status_issues']} masalah"
        
        # Add overall summary
        message += f"\n\n📈 Total Keseluruhan:"
        message += f"\n• Total Server: {total_vms}"
        message += f"\n• RPO Maksimal: {max_rpo} detik"
        message += f"\n• Server Bermasalah: {total_rpo_issues + total_status_issues}"
        
        return message

def process_single_location(location: str):
    """Process a single data center location"""
    
    # Load environment variables from .env file
    load_dotenv()
    
    if location.lower() == "jepara":
        config = {
            'base_url': os.getenv("ZERTO_JEPARA_BASE_URL", "https://192.168.77.250"),
            'client_id': os.getenv("ZERTO_JEPARA_CLIENT_ID", "zerto-client"),
            'username': os.getenv("ZERTO_JEPARA_USERNAME"),
            'password': os.getenv("ZERTO_JEPARA_PASSWORD"),
            'name': "MINI DC Jepara",
            'report_file': "zerto_jepara_report.json"
        }
    elif location.lower() == "jakarta":
        config = {
            'base_url': os.getenv("ZERTO_JAKARTA_BASE_URL", "https://192.168.120.250"),
            'client_id': os.getenv("ZERTO_JAKARTA_CLIENT_ID", "zerto-client"),
            'username': os.getenv("ZERTO_JAKARTA_USERNAME"),
            'password': os.getenv("ZERTO_JAKARTA_PASSWORD"),
            'name': "DC Jakarta",
            'report_file': "zerto_jakarta_report.json"
        }
    else:
        print(f"✗ Invalid location: {location}")
        print("Valid locations are: jepara, jakarta")
        sys.exit(1)
    
    # Validate credentials
    if not config['username'] or not config['password']:
        print(f"✗ {config['name']} credentials not found in .env file")
        print(f"Please set the appropriate credentials in your .env file")
        sys.exit(1)
    
    print(f"Zerto VM RPO Report Generator - {config['name']}")
    print("="*50)
    print(f"✓ Using credentials for {config['name']}: {config['username']}")
    
    # Process the specified data center
    print(f"\n✓ Connecting to {config['name']}: {config['base_url']}")
    client = ZertoAPIClient(config['base_url'], config['client_id'])
    
    if client.authenticate(config['username'], config['password']):
        print(f"✓ Authentication successful for {config['name']}")
        vms = client.get_vms()
        if vms:
            print(f"✓ Retrieved {len(vms)} VMs from {config['name']}")
            client.generate_rpo_report(vms, config['name'])
            client.save_detailed_report(vms, config['report_file'])
            
            # Generate single location WhatsApp message
            if location.lower() == "jepara":
                whatsapp_message = client.generate_whatsapp_message(vms, [])
            else:  # jakarta
                whatsapp_message = client.generate_whatsapp_message([], vms)
            
            print("\n" + "="*60)
            print(f"WHATSAPP MESSAGE - {config['name']}")
            print("="*60)
            print(whatsapp_message)
            print("="*60)
            
            # Save WhatsApp message to file
            try:
                filename = f"whatsapp_message_{location.lower()}.txt"
                with open(filename, 'w', encoding='utf-8') as f:
                    f.write(whatsapp_message)
                print(f"✓ WhatsApp message saved to {filename}")
            except Exception as e:
                print(f"✗ Error saving WhatsApp message: {e}")
        else:
            print(f"⚠️ No VMs retrieved from {config['name']}")
    else:
        print(f"✗ Authentication failed for {config['name']}")
    
    print("\nReport generation completed!")

def process_both_locations():
    """Process both data centers (original functionality)"""
    
    # Load environment variables from .env file
    load_dotenv()
    
    print("Zerto VM RPO Report Generator - Multi Data Center")
    print("="*50)
    
    # Configuration for both data centers with separate credentials
    jepara_config = {
        'base_url': os.getenv("ZERTO_JEPARA_BASE_URL", "https://192.168.77.250"),
        'client_id': os.getenv("ZERTO_JEPARA_CLIENT_ID", "zerto-client"),
        'username': os.getenv("ZERTO_JEPARA_USERNAME"),
        'password': os.getenv("ZERTO_JEPARA_PASSWORD"),
        'name': "MINI DC Jepara"
    }
    
    jakarta_config = {
        'base_url': os.getenv("ZERTO_JAKARTA_BASE_URL", "https://192.168.120.250"),
        'client_id': os.getenv("ZERTO_JAKARTA_CLIENT_ID", "zerto-client"),
        'username': os.getenv("ZERTO_JAKARTA_USERNAME"),
        'password': os.getenv("ZERTO_JAKARTA_PASSWORD"),
        'name': "DC Jakarta"
    }
    
    # Validate credentials for both data centers
    if not jepara_config['username'] or not jepara_config['password']:
        print("✗ MINI DC Jepara credentials not found in .env file")
        print("Please set ZERTO_JEPARA_USERNAME and ZERTO_JEPARA_PASSWORD in your .env file")
        sys.exit(1)
    
    if not jakarta_config['username'] or not jakarta_config['password']:
        print("✗ DC Jakarta credentials not found in .env file")
        print("Please set ZERTO_JAKARTA_USERNAME and ZERTO_JAKARTA_PASSWORD in your .env file")
        sys.exit(1)
    
    print(f"✓ Using credentials for MINI DC Jepara: {jepara_config['username']}")
    print(f"✓ Using credentials for DC Jakarta: {jakarta_config['username']}")
    
    jepara_vms = []
    jakarta_vms = []
    
    # Process MINI DC Jepara
    print(f"\n✓ Connecting to {jepara_config['name']}: {jepara_config['base_url']}")
    jepara_client = ZertoAPIClient(jepara_config['base_url'], jepara_config['client_id'])
    
    if jepara_client.authenticate(jepara_config['username'], jepara_config['password']):
        print(f"✓ Authentication successful for {jepara_config['name']}")
        jepara_vms = jepara_client.get_vms()
        if jepara_vms:
            print(f"✓ Retrieved {len(jepara_vms)} VMs from {jepara_config['name']}")
            jepara_client.generate_rpo_report(jepara_vms, jepara_config['name'])
            jepara_client.save_detailed_report(jepara_vms, "zerto_jepara_report.json")
        else:
            print(f"⚠️ No VMs retrieved from {jepara_config['name']}")
    else:
        print(f"✗ Authentication failed for {jepara_config['name']}")
    
    # Process DC Jakarta
    print(f"\n✓ Connecting to {jakarta_config['name']}: {jakarta_config['base_url']}")
    jakarta_client = ZertoAPIClient(jakarta_config['base_url'], jakarta_config['client_id'])
    
    if jakarta_client.authenticate(jakarta_config['username'], jakarta_config['password']):
        print(f"✓ Authentication successful for {jakarta_config['name']}")
        jakarta_vms = jakarta_client.get_vms()
        if jakarta_vms:
            print(f"✓ Retrieved {len(jakarta_vms)} VMs from {jakarta_config['name']}")
            jakarta_client.generate_rpo_report(jakarta_vms, jakarta_config['name'])
            jakarta_client.save_detailed_report(jakarta_vms, "zerto_jakarta_report.json")
        else:
            print(f"⚠️ No VMs retrieved from {jakarta_config['name']}")
    else:
        print(f"✗ Authentication failed for {jakarta_config['name']}")
    
    # Generate combined WhatsApp message
    if jepara_vms or jakarta_vms:
        # Use the first available client for message generation
        client = jepara_client if jepara_vms else jakarta_client
        whatsapp_message = client.generate_whatsapp_message(jepara_vms, jakarta_vms)
        
        print("\n" + "="*60)
        print("COMBINED WHATSAPP MESSAGE")
        print("="*60)
        print(whatsapp_message)
        print("="*60)
        
        # Save WhatsApp message to file
        try:
            with open("whatsapp_message.txt", 'w', encoding='utf-8') as f:
                f.write(whatsapp_message)
            print("✓ WhatsApp message saved to whatsapp_message.txt")
        except Exception as e:
            print(f"✗ Error saving WhatsApp message: {e}")
    else:
        print("✗ No VMs retrieved from any data center. Cannot generate WhatsApp message.")
    
    print("\nReport generation completed!")

def main():
    """Main function with command-line argument support"""
    
    parser = argparse.ArgumentParser(
        description="Zerto VM RPO Report Generator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python zerto_report.py                    # Generate report for both data centers
  python zerto_report.py --location jepara  # Generate report for MINI DC Jepara only
  python zerto_report.py --location jakarta # Generate report for DC Jakarta only
        """
    )
    
    parser.add_argument(
        '--location', 
        choices=['jepara', 'jakarta'], 
        help='Specify data center location (jepara or jakarta). If not specified, both locations will be processed.'
    )
    
    args = parser.parse_args()
    
    if args.location:
        process_single_location(args.location)
    else:
        process_both_locations()

if __name__ == "__main__":
    main()