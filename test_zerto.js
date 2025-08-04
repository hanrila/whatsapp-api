#!/usr/bin/env node
/**
 * Zerto API Test Script
 * This script tests the Zerto API integration independently from WhatsApp
 */

require('dotenv').config();
const axios = require('axios');
const https = require('https');

// ZertoAPIClient class (copied from index.js for testing)
class ZertoAPIClient {
  constructor(baseUrl, clientId, username, password) {
    this.baseUrl = baseUrl;
    this.clientId = clientId;
    this.username = username;
    this.password = password;
    this.accessToken = null;
    
    // Create axios instance with SSL verification disabled
    this.axiosInstance = axios.create({
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      }),
      timeout: 30000
    });
  }

  async authenticate() {
    try {
      const authUrl = `${this.baseUrl}/auth/realms/zerto/protocol/openid-connect/token`;
      const authData = new URLSearchParams({
        grant_type: 'password',
        client_id: this.clientId,
        username: this.username,
        password: this.password,
        scope: 'openid'
      });

      const response = await this.axiosInstance.post(authUrl, authData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.accessToken = response.data.access_token;
      console.log('✅ Zerto authentication successful');
      return true;
    } catch (error) {
      console.error('❌ Zerto authentication failed:', error.message);
      if (error.response) {
        console.error(`   Response status: ${error.response.status}`);
        console.error(`   Response data: ${JSON.stringify(error.response.data)}`);
      }
      return false;
    }
  }

  async getVMs() {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    try {
      const vmsUrl = `${this.baseUrl}/v1/vms`;
      const response = await this.axiosInstance.get(vmsUrl, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`✅ Successfully retrieved ${response.data.length} VMs`);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to get VMs:', error.message);
      throw error;
    }
  }

  async getVpgs() {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    try {
      const vpgsUrl = `${this.baseUrl}/v1/vpgs`;
      const response = await this.axiosInstance.get(vpgsUrl, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`✅ Successfully retrieved ${response.data.length} VPGs`);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to get VPGs:', error.message);
      throw error;
    }
  }
}

// Helper function to convert Zerto status code to human-readable description
function getStatusDescription(statusCode) {
  const statusMapping = {
    0: "Initializing",
    1: "MeetingSLA", 
    2: "NotMeetingSLA",
    3: "RpoNotMeetingSLA",
    4: "HistoryNotMeetingSLA",
    5: "FailingOver",
    6: "Moving",
    7: "Deleting",
    8: "Recovered"
  };
  
  if (typeof statusCode === 'number') {
    return statusMapping[statusCode] || `Unknown(${statusCode})`;
  }
  return String(statusCode || 'Unknown');
}

// Function to generate RPO report
function generateRpoReport(vms, vpgs) {
  const vmMap = new Map();
  vms.forEach(vm => {
    vmMap.set(vm.VmIdentifier, vm);
  });

  const vpgMap = new Map();
  vpgs.forEach(vpg => {
    vpgMap.set(vpg.VpgIdentifier, vpg);
  });

  const rpoData = [];
  
  vms.forEach(vm => {
    const vpg = vpgMap.get(vm.VpgIdentifier);
    if (vpg) {
      const statusCode = vm.Status;
      const statusDescription = getStatusDescription(statusCode);
      
      rpoData.push({
        vmName: vm.VmName,
        vpgName: vpg.VpgName,
        rpoInSeconds: vm.RpoInSeconds || 0,
        status: statusDescription,
        statusCode: statusCode,
        lastTest: vm.LastTest || 'N/A',
        actualRpo: vm.ActualRpo || 0
      });
    }
  });

  return rpoData;
}

// Function to get current date time in Indonesian format
function getCurrentDateTime() {
  const now = new Date();
  const jakartaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Jakarta"}));
  
  // Indonesian day names
  const dayNames = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
  
  // Indonesian month names
  const monthNames = [
    "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  
  const dayName = dayNames[jakartaTime.getDay()];
  const monthName = monthNames[jakartaTime.getMonth() + 1];
  const formattedDate = `${dayName}, ${jakartaTime.getDate()} ${monthName} ${jakartaTime.getFullYear()}`;
  const formattedTime = jakartaTime.toTimeString().slice(0, 5);
  
  return { formattedDate, formattedTime };
}

// Function to generate WhatsApp message exactly like Python script
function generateZertoWhatsAppMessage(jeparaVms, jakartaVms) {
  const { formattedDate, formattedTime } = getCurrentDateTime();
  const now = new Date();
  
  // Smart greeting based on time windows (like Python script)
  let greeting;
  if (now.getHours() < 10) {
    greeting = "Selamat pagi Team";
  } else if (now.getHours() >= 10 && now.getHours() < 15) {
    greeting = "Selamat siang Team";
  } else if (now.getHours() >= 15 && now.getHours() < 18) {
    greeting = "Selamat sore Team";
  } else {
    greeting = "Selamat malam Team";
  }
  
  // Function to analyze VM data for a specific DC
  function analyzeDcData(vms, dcName) {
    const totalVms = vms.length;
    let rpoIssues = 0;
    let statusIssues = 0;
    const errorDetails = [];
    let maxRpo = 0;
    const statusCounts = {};
    
    vms.forEach(vm => {
      const vmName = vm.vmName;
      const actualRpo = vm.actualRpo || 0;
      const statusCode = vm.statusCode;
      
      // Track maximum RPO
      maxRpo = Math.max(maxRpo, actualRpo);
      
      // Check for RPO issues (> 15 minutes = 900 seconds)
      if (actualRpo > 900) {
        rpoIssues++;
        const rpoMinutes = Math.round(actualRpo / 60);
        errorDetails.push(`• ${dcName} - ${vmName}: RPO ${actualRpo} detik (>${rpoMinutes} menit)`);
      }
      
      // Count status occurrences
      const statusDesc = vm.status;
      statusCounts[statusDesc] = (statusCounts[statusDesc] || 0) + 1;
      
      // Check for status issues (not MeetingSLA)
      if (statusCode !== 1) { // 1 = MeetingSLA
        statusIssues++;
        errorDetails.push(`• ${dcName} - ${vmName}: Status ${statusDesc}`);
      }
    });
    
    return {
      totalVms,
      rpoIssues,
      statusIssues,
      errorDetails,
      maxRpo,
      statusCounts
    };
  }
  
  // Analyze both data centers
  const jeparaData = analyzeDcData(jeparaVms, "MINI DC Jepara");
  const jakartaData = analyzeDcData(jakartaVms, "DC Jakarta");
  
  // Combined totals
  const totalVms = jeparaData.totalVms + jakartaData.totalVms;
  const totalRpoIssues = jeparaData.rpoIssues + jakartaData.rpoIssues;
  const totalStatusIssues = jeparaData.statusIssues + jakartaData.statusIssues;
  const allErrorDetails = [...jeparaData.errorDetails, ...jakartaData.errorDetails];
  const maxRpo = Math.max(jeparaData.maxRpo, jakartaData.maxRpo);
  
  // Build WhatsApp message
  let message = `${greeting}, berikut adalah laporan hasil replikasi Zerto pada hari ${formattedDate} pukul ${formattedTime}.\n\n`;
  
  // Main status message
  if (totalRpoIssues === 0 && totalStatusIssues === 0) {
    message += `✅ Semua ${totalVms} server dari kedua data center memenuhi SLA dengan RPO time kurang dari 15 menit (maksimal: ${maxRpo} detik).`;
  } else {
    const totalIssues = totalRpoIssues + totalStatusIssues;
    message += `⚠️ Ditemukan ${totalIssues} masalah pada replikasi server:`;
    
    if (totalRpoIssues > 0) {
      message += `\n\n🔴 RPO Issues (${totalRpoIssues} server):`;
      allErrorDetails.filter(d => d.includes("RPO")).forEach(detail => {
        message += `\n${detail}`;
      });
    }
    
    if (totalStatusIssues > 0) {
      message += `\n\n🟡 Status Issues (${totalStatusIssues} server):`;
      allErrorDetails.filter(d => d.includes("Status")).forEach(detail => {
        message += `\n${detail}`;
      });
    }
  }
  
  // Add detailed breakdown per DC
  message += `\n\n📊 Ringkasan per Data Center:`;
  message += `\n🏢 MINI DC Jepara: ${jeparaData.totalVms} server`;
  if (jeparaData.rpoIssues + jeparaData.statusIssues === 0) {
    message += ` - ✅ Semua OK`;
  } else {
    message += ` - ⚠️ ${jeparaData.rpoIssues + jeparaData.statusIssues} masalah`;
  }
  
  message += `\n🏢 DC Jakarta: ${jakartaData.totalVms} server`;
  if (jakartaData.rpoIssues + jakartaData.statusIssues === 0) {
    message += ` - ✅ Semua OK`;
  } else {
    message += ` - ⚠️ ${jakartaData.rpoIssues + jakartaData.statusIssues} masalah`;
  }
  
  // Add overall summary
  message += `\n\n📈 Total Keseluruhan:`;
  message += `\n• Total Server: ${totalVms}`;
  message += `\n• RPO Maksimal: ${maxRpo} detik`;
  message += `\n• Server Bermasalah: ${totalRpoIssues + totalStatusIssues}`;
  
  return message;
}

// Function to simulate WhatsApp message sending
function simulateWhatsAppMessage(rpoData, location) {
  const message = generateZertoWhatsAppMessage(rpoData, location);
  
  console.log('\n' + '📱'.repeat(40));
  console.log('📱 SIMULATED WHATSAPP MESSAGE');
  console.log('📱'.repeat(40));
  console.log('\n' + message);
  console.log('\n' + '📱'.repeat(40));
  console.log('📱 END OF WHATSAPP MESSAGE');
  console.log('📱'.repeat(40));
}

// Function to display detailed report
function displayDetailedReport(rpoData, location) {
  console.log('\n' + '='.repeat(80));
  console.log(`ZERTO VM RPO REPORT - ${location.toUpperCase()}`);
  console.log('='.repeat(80));
  console.log(`${'VM Name'.padEnd(30)} ${'VPG Name'.padEnd(25)} ${'RPO (sec)'.padEnd(10)} ${'Status'.padEnd(18)}`);
  console.log('-'.repeat(80));
  
  // Group by status
  const statusGroups = {
    'Protected': [],
    'Error': [],
    'Warning': [],
    'Other': []
  };

  rpoData.forEach(vm => {
    const status = String(vm.status || 'Unknown');
    if (status === 'MeetingSLA') {
      statusGroups.Protected.push(vm);
    } else if (status.includes('NotMeetingSLA') || status.includes('RpoNotMeetingSLA') || status === 'FailingOver' || status === 'Deleting') {
      statusGroups.Error.push(vm);
    } else if (status.includes('HistoryNotMeetingSLA') || status === 'Initializing' || vm.rpoInSeconds > 300) {
      statusGroups.Warning.push(vm);
    } else {
      statusGroups.Other.push(vm);
    }
  });

  // Display VMs
  rpoData.forEach(vm => {
    const vmName = vm.vmName.length > 29 ? vm.vmName.substring(0, 29) : vm.vmName;
    const vpgName = vm.vpgName.length > 24 ? vm.vpgName.substring(0, 24) : vm.vpgName;
    const status = vm.status.length > 17 ? vm.status.substring(0, 17) : vm.status;
    
    console.log(`${vmName.padEnd(30)} ${vpgName.padEnd(25)} ${vm.rpoInSeconds.toString().padEnd(10)} ${status.padEnd(18)}`);
  });

  console.log('-'.repeat(80));
  console.log(`Total VMs: ${rpoData.length}`);
  console.log('\nStatus Summary:');
  console.log(`  ✅ Protected (MeetingSLA): ${statusGroups.Protected.length}`);
  console.log(`  ❌ Error: ${statusGroups.Error.length}`);
  console.log(`  ⚠️  Warning: ${statusGroups.Warning.length}`);
  console.log(`  ℹ️  Other: ${statusGroups.Other.length}`);
  
  // RPO Analysis
  if (rpoData.length > 0) {
    const avgRpo = rpoData.reduce((sum, vm) => sum + vm.rpoInSeconds, 0) / rpoData.length;
    const avgRpoMinutes = Math.round(avgRpo / 60);
    const highRpoVms = rpoData.filter(vm => vm.rpoInSeconds > 300);
    
    console.log(`\nRPO Analysis:`);
    console.log(`  📈 Average RPO: ${avgRpoMinutes} minutes`);
    console.log(`  ⚠️  VMs with RPO > 5 minutes: ${highRpoVms.length}`);
  }
  
  console.log('='.repeat(80));
}

// Test function for a single location
async function testZertoLocation(location) {
  console.log(`\n🔍 Testing Zerto API for ${location.toUpperCase()}...`);
  console.log('-'.repeat(50));
  
  try {
    let config;
    
    if (location.toLowerCase() === 'jepara' || location.toLowerCase() === 'jpr') {
      config = {
        baseUrl: process.env.ZERTO_JEPARA_BASE_URL,
        clientId: process.env.ZERTO_JEPARA_CLIENT_ID,
        username: process.env.ZERTO_JEPARA_USERNAME,
        password: process.env.ZERTO_JEPARA_PASSWORD
      };
    } else if (location.toLowerCase() === 'jakarta' || location.toLowerCase() === 'jkt') {
      config = {
        baseUrl: process.env.ZERTO_JAKARTA_BASE_URL,
        clientId: process.env.ZERTO_JAKARTA_CLIENT_ID,
        username: process.env.ZERTO_JAKARTA_USERNAME,
        password: process.env.ZERTO_JAKARTA_PASSWORD
      };
    } else {
      throw new Error(`Unknown location: ${location}`);
    }

    // Validate configuration
    console.log(`📋 Configuration for ${location}:`);
    console.log(`   Base URL: ${config.baseUrl}`);
    console.log(`   Client ID: ${config.clientId}`);
    console.log(`   Username: ${config.username}`);
    console.log(`   Password: ${config.password ? '***' + config.password.slice(-3) : 'NOT SET'}`);
    
    if (!config.baseUrl || !config.clientId || !config.username || !config.password) {
      throw new Error(`Missing Zerto configuration for ${location}`);
    }

    // Create Zerto API client
    const zertoClient = new ZertoAPIClient(
      config.baseUrl,
      config.clientId,
      config.username,
      config.password
    );

    // Test authentication
    console.log(`\n🔐 Testing authentication...`);
    const authSuccess = await zertoClient.authenticate();
    if (!authSuccess) {
      throw new Error(`Authentication failed for ${location}`);
    }

    // Test API calls
    console.log(`\n📊 Fetching data...`);
    const [vms, vpgs] = await Promise.all([
      zertoClient.getVMs(),
      zertoClient.getVpgs()
    ]);

    // Generate and display report
    const rpoData = generateRpoReport(vms, vpgs);
    displayDetailedReport(rpoData, location);
    
    // Simulate WhatsApp message
    simulateWhatsAppMessage(rpoData, location);

    return {
      success: true,
      location: location,
      data: {
        vms: vms.length,
        vpgs: vpgs.length,
        rpoData: rpoData.length
      }
    };

  } catch (error) {
    console.error(`❌ Error testing ${location}:`, error.message);
    return {
      success: false,
      location: location,
      error: error.message
    };
  }
}

// Main test function
async function main() {
  console.log('🚀 Zerto API Test Script');
  console.log('========================');
  
  const args = process.argv.slice(2);
  const location = args[0];
  
  if (!location) {
    console.log('Usage: node test_zerto.js <location>');
    console.log('Locations: jepara, jpr, jakarta, jkt, all');
    process.exit(1);
  }
  
  if (location.toLowerCase() === 'all') {
    console.log('🔄 Testing all locations...\n');
    
    const results = [];
    results.push(await testZertoLocation('jepara'));
    results.push(await testZertoLocation('jakarta'));
    
    console.log('\n📋 SUMMARY RESULTS:');
    console.log('='.repeat(50));
    results.forEach(result => {
      const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
      console.log(`${result.location.toUpperCase()}: ${status}`);
      if (result.success) {
        console.log(`   VMs: ${result.data.vms}, VPGs: ${result.data.vpgs}, RPO Data: ${result.data.rpoData}`);
      } else {
        console.log(`   Error: ${result.error}`);
      }
    });
  } else {
    await testZertoLocation(location);
  }
  
  console.log('\n✨ Test completed!');
}

// Run the test
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Test script error:', error);
    process.exit(1);
  });
}