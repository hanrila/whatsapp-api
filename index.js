// Load environment variables from .env file
require('dotenv').config();

// Configure Puppeteer cache directory to use project directory
const path = require('path');

process.env.PUPPETEER_CACHE_DIR = 'C:\\Users\\hanri\\.cache\\puppeteer';


const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason, Browsers, downloadContentFromMessage, downloadMediaMessage } = require('@whiskeysockets/baileys');
//const {default: makeWASocket,AnyMessageContent, BinaryInfo, delay, DisconnectReason, encodeWAM, fetchLatestBaileysVersion, getAggregateVotesInPollMessage, makeCacheableSignalKeyStore, makeInMemoryStore, PHONENUMBER_MCC, proto, useMultiFileAuthState, WAMessageContent, WAMessageKey}= require('@whiskeysockets/baileys');
//import { WAMessageKey, WAMessageContent, proto } from '@whiskeysockets/baileys';

const express = require('express');
const { body, validationResult } = require('express-validator');
const nodeHtmlToImage = require('node-html-to-image');
const puppeteer = require('puppeteer');
//const qrcode = require('qrcode-terminal');
const qrcode = require('qrcode');
const Pino = require('pino');
const { Boom } = require('@hapi/boom');
const randomstring = require('randomstring');


//Active Directory Integration
const { exec } = require('child_process');
const util = require('util');
const ActiveDirectory = require('activedirectory2');
const execPromise = util.promisify(exec);
//import { MessageType, MessageOptions, Mimetype } from '@whiskeysockets/baileys'
//Zabbix integration
const axios = require('axios');

//Chatgpt
const OpenAI = require("openai");
const keyopenai = process.env.OPENAI_API_KEY || "your-openai-api-key-here";
const openai = new OpenAI({ apiKey: keyopenai });

//Router OS
const { RouterOSAPI } = require('node-routeros');

const app = express();
app.use(express.json()); // Middleware to parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Middleware to parse x-www-form-urlencoded bodies

//Implement Socket IO
const server = require('http').createServer(app);
const io = require('socket.io')(server);

//Excel file handling
const ExcelJS = require('exceljs');
const fs = require('fs');
const mime = require('mime-types');
const https = require('https');


// Serve the index.html file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});


const PORT = process.env.PORT || 8003;

// Initialize logger
const logger = Pino({ level: 'silent' });



let sock;
let currentStatus = 'Connecting...';
let currentQr = null;
// Track processed message IDs per chat to prevent duplicate handling
const processedMessages = new Map(); // Map<chatId, Set<messageId>>

io.on('connection', (socket) => {
  console.log('A user connected');
  
  // Emit the current status and QR code (if available) to the new client
  socket.emit('message', currentStatus);
  if (currentQr) {
    socket.emit('qr', currentQr);
  }

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });

  socket.on('log', (msg) => {
    console.log('Log: ', msg);
    io.emit('message', msg);
  });
});



async function answerAI(prompt) {
  try {
    const input = prompt;
    const chatCompletion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: input }],
      model: 'gpt-4o-mini', // Update with the appropriate OpenAI model version
    });
    
    return chatCompletion.choices[0].message.content;
  } catch (error) {
    console.error(error);
    throw new Error("Error processing AI chat completion: " + error.message);
  }
}

// Zerto API Client Class
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
      console.log('Zerto authentication successful');
      return true;
    } catch (error) {
      console.error('Zerto authentication failed:', error.message);
      if (error.response) {
        console.error(`Response status: ${error.response.status}`);
        console.error(`Response data: ${JSON.stringify(error.response.data)}`);
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

      return response.data;
    } catch (error) {
      console.error('Failed to get VMs:', error.message);
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

      return response.data;
    } catch (error) {
      console.error('Failed to get VPGs:', error.message);
      throw error;
    }
  }
}

// Helper function to get Chrome executable path dynamically
function getChromeExecutablePath() {
  const projectRoot = __dirname;
  console.log(`Project root directory: ${projectRoot}`);
  
  // Try to find Chrome in puppeteer-cache directory
  const cacheDir = path.join(projectRoot, 'puppeteer-cache', 'chrome');
  console.log(`Looking for Chrome in cache directory: ${cacheDir}`);
  
  if (fs.existsSync(cacheDir)) {
    try {
      // Find the Chrome version directory dynamically
      const versionDirs = fs.readdirSync(cacheDir).filter(dir => dir.startsWith('win64-'));
      console.log(`Found Chrome version directories: ${versionDirs.join(', ')}`);
      
      if (versionDirs.length > 0) {
        // Use the first (or latest) version found
        const versionDir = versionDirs[0];
        const chromePath = path.join(cacheDir, versionDir, 'chrome-win64', 'chrome.exe');
        console.log(`Checking Chrome executable at: ${chromePath}`);
        
        if (fs.existsSync(chromePath)) {
          console.log(`✅ Using Chrome executable at: ${chromePath}`);
          return chromePath;
        } else {
          console.log(`❌ Chrome executable not found at: ${chromePath}`);
        }
      } else {
        console.log('❌ No Chrome version directories found in cache');
      }
    } catch (error) {
      console.error('Error reading Chrome cache directory:', error);
    }
  } else {
    console.log(`❌ Chrome cache directory not found: ${cacheDir}`);
  }
  
  console.log('⚠️ Chrome executable not found in puppeteer-cache, Puppeteer will try to use system Chrome');
  return null; // Let Puppeteer use its default Chrome
}

// Helper function to get current date and time in Indonesian format
function getCurrentDateTime() {
  const now = new Date();
  
  // Convert to Jakarta timezone
  const jakartaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Jakarta"}));
  
  const day = jakartaTime.getDate().toString().padStart(2, '0');
  const month = jakartaTime.getMonth() + 1; // getMonth() returns 0-11
  const year = jakartaTime.getFullYear();
  const hours = jakartaTime.getHours().toString().padStart(2, '0');
  const minutes = jakartaTime.getMinutes().toString().padStart(2, '0');
  
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  
  const dayNames = [
    'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'
  ];
  
  const dayName = dayNames[jakartaTime.getDay()];
  
  return {
    formattedDate: `${dayName}, ${day} ${monthNames[month - 1]} ${year}`,
    formattedTime: `${hours}:${minutes}`
  };
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

// Function to generate RPO report exactly like Python script
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
      
      // Use ActualRPO directly from the API response (like Python script)
      const actualRpo = vm.ActualRPO || 0;
      
      rpoData.push({
        vmName: vm.VmName,
        vpgName: vpg.VpgName,
        rpoInSeconds: actualRpo,  // Keep for backward compatibility
        status: statusDescription,
        statusCode: statusCode,
        lastTest: vm.LastTest || 'N/A',
        actualRpo: actualRpo     // This is the correct field name from API
      });
    }
  });

  return rpoData;
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
      const actualRpo = vm.actualRpo || 0;  // This should now have the correct value
      const statusCode = vm.statusCode;
      
      // Track maximum RPO (ensure it's a number)
      if (typeof actualRpo === 'number' && actualRpo > maxRpo) {
        maxRpo = actualRpo;
      }
      
      // Check for RPO issues (> 15 minutes = 900 seconds)
      if (typeof actualRpo === 'number' && actualRpo > 900) {
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
  
  // Check if this is a single location test
  const isSingleLocation = (jeparaVms.length === 0 && jakartaVms.length > 0) || 
                          (jakartaVms.length === 0 && jeparaVms.length > 0);
  
  // Combined totals
  const totalVms = jeparaData.totalVms + jakartaData.totalVms;
  const totalRpoIssues = jeparaData.rpoIssues + jakartaData.rpoIssues;
  const totalStatusIssues = jeparaData.statusIssues + jakartaData.statusIssues;
  const allErrorDetails = [...jeparaData.errorDetails, ...jakartaData.errorDetails];
  const maxRpo = Math.max(jeparaData.maxRpo, jakartaData.maxRpo);
  
  // Build WhatsApp message
  let message = `${greeting}, berikut adalah laporan hasil replikasi Zerto pada hari ${formattedDate} pukul ${formattedTime}.\n\n`;
  
  // Main status message - adjust text based on single vs combined location
  if (totalRpoIssues === 0 && totalStatusIssues === 0) {
    if (isSingleLocation) {
      const locationName = jeparaVms.length > 0 ? "MINI DC Jepara" : "DC Jakarta";
      message += `✅ Semua ${totalVms} server dari ${locationName} memenuhi SLA dengan RPO time kurang dari 15 menit (maksimal: ${maxRpo} detik).`;
    } else {
      message += `✅ Semua ${totalVms} server dari kedua data center memenuhi SLA dengan RPO time kurang dari 15 menit (maksimal: ${maxRpo} detik).`;
    }
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
  
  // Add detailed breakdown per DC - only show active DCs
  message += `\n\n📊 Ringkasan per Data Center:`;
  
  if (jeparaData.totalVms > 0) {
    message += `\n🏢 MINI DC Jepara: ${jeparaData.totalVms} server`;
    if (jeparaData.rpoIssues + jeparaData.statusIssues === 0) {
      message += ` - ✅ Semua OK`;
    } else {
      message += ` - ⚠️ ${jeparaData.rpoIssues + jeparaData.statusIssues} masalah`;
    }
  }
  
  if (jakartaData.totalVms > 0) {
    message += `\n🏢 DC Jakarta: ${jakartaData.totalVms} server`;
    if (jakartaData.rpoIssues + jakartaData.statusIssues === 0) {
      message += ` - ✅ Semua OK`;
    } else {
      message += ` - ⚠️ ${jakartaData.rpoIssues + jakartaData.statusIssues} masalah`;
    }
  }
  
  // Add overall summary
  message += `\n\n📈 Total Keseluruhan:`;
  message += `\n• Total Server: ${totalVms}`;
  message += `\n• RPO Maksimal: ${maxRpo} detik`;
  message += `\n• Server Bermasalah: ${totalRpoIssues + totalStatusIssues}`;
  
  return message;
}

// Function to process Zerto data for a single location
async function processZertoLocation(location) {
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
      console.log(`[Zerto] Debugging Jakarta Credentials: Username = ${process.env.ZERTO_JAKARTA_USERNAME}, Password = ${process.env.ZERTO_JAKARTA_PASSWORD}`);
    } else {
      throw new Error(`Unknown location: ${location}`);
    }

    // Validate configuration
    console.log(`[Zerto] Configuration for ${location}:`, {
      baseUrl: config.baseUrl,
      clientId: config.clientId,
      username: config.username ? 'SET' : 'NOT SET',
      password: config.password ? 'SET' : 'NOT SET'
    });

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

    // Authenticate
    const authSuccess = await zertoClient.authenticate();
    console.log(`[Zerto] Authentication for ${location} successful: ${authSuccess}`);
    if (!authSuccess) {
      throw new Error(`Authentication failed for ${location}`);
    }

    // Get VMs and VPGs data
    const [vms, vpgs] = await Promise.all([
      zertoClient.getVMs(),
      zertoClient.getVpgs()
    ]);

    // Generate RPO report
    const rpoData = generateRpoReport(vms, vpgs);
    console.log(`[Zerto] RPO Data for ${location}:`, rpoData);
    
    // Generate WhatsApp message for single location
    const whatsappMessage = generateZertoWhatsAppMessage(
      location === 'jepara' ? rpoData : [],
      location === 'jakarta' ? rpoData : []
    );
    
    return {
      success: true,
      location: location,
      message: whatsappMessage,
      vmData: rpoData, // Add vmData for table generation
      data: {
        vms: vms.length,
        vpgs: vpgs.length,
        rpoData: rpoData
      }
    };

  } catch (error) {
    console.error(`Error processing Zerto location ${location}:`, error.message);
    return {
      success: false,
      location: location,
      error: error.message,
      message: `❌ *Error Zerto Report - ${location.toUpperCase()}*\n\n⚠️ ${error.message}\n\n💡 Silakan coba lagi atau hubungi administrator.`,
      vmData: [], // Add empty vmData for error case
      data: {
        vms: 0,
        vpgs: 0,
        rpoData: []
      }
    };
  }
}

// Function to process both Zerto locations and generate combined WhatsApp message
async function processZertoBothLocations() {
  try {
    console.log('Processing both Zerto locations...');
    
    // Process both locations in parallel
    const [jeparaResult, jakartaResult] = await Promise.all([
      processZertoLocation('jepara'),
      processZertoLocation('jakarta')
    ]);
    
    // Prepare data for WhatsApp message generation
    const jeparaVms = jeparaResult.success ? jeparaResult.data.rpoData : [];
    const jakartaVms = jakartaResult.success ? jakartaResult.data.rpoData : [];
    
    // Generate combined WhatsApp message
    const whatsappMessage = generateZertoWhatsAppMessage(jeparaVms, jakartaVms);
    
    return {
      success: true,
      message: whatsappMessage,
      data: {
        jepara: jeparaResult,
        jakarta: jakartaResult,
        totalVms: jeparaVms.length + jakartaVms.length
      }
    };
    
  } catch (error) {
    console.error('Error processing both Zerto locations:', error.message);
    return {
      success: false,
      error: error.message,
      message: `❌ *Error mengambil data Zerto*\n\n⚠️ ${error.message}\n\n💡 Silakan coba lagi atau hubungi administrator.`
    };
  }
}


const allowedPhoneNumbers = [
  '6285712612218', // Widji
  '628995549933', // Hanri
  '6285888228893', //NOA
  // Add more allowed numbers as needed
];

const phoneNumberFormatter = (number) => {
    let formatted = number.replace(/\D/g, '');
    if (formatted.startsWith('0')) {
        formatted = '62' + formatted.substr(1);
    }
    if (!formatted.endsWith('@c.us')) {
        formatted += '@c.us';
    }
    return formatted;
};

const checkRegisteredNumber = async (number) => {
  if (!sock) {
      console.error('WhatsApp socket is not initialized.');
      return false;
  }
  try {
      const [result] = await sock.onWhatsApp(number);
      return result.exists;
  } catch (error) {
      console.error('Error checking registered number:', error);
      return false;
  }
};

const findGroupByName = async (name) => {
  if (!sock) {
      console.error('WhatsApp socket is not initialized.');
      return null;
  }

  console.log('Fetching all groups...');
  let groups;
  try {
      groups = Object.values(await sock.groupFetchAllParticipating());
  } catch (error) {
      console.error('Error fetching groups:', error);
      return null;
  }

  if (groups.length === 0) {
      console.log('No groups found.');
      return null;
  } else {
      const group = groups.find(group => group.subject.toLowerCase() === name.toLowerCase());
      if (group) {
          console.log(`Found group: id_group: ${group.id} || Nama Group: ${group.subject}`);
          return group;
      } else {
          console.log(`No group found with name: ${name}`);
          return null;
      }
  }
};

const listGroups = async () => {
    console.log('Fetching all groups...');
    let groups = Object.values(await sock.groupFetchAllParticipating());
    if (groups.length === 0) {
        console.log('No groups found.');
    } else {
        groups.forEach(group => {
            console.log(`id_group: ${group.id} || Nama Group: ${group.subject}`);
        });
    }
};

const bjpCompConfig = {
    url: 'ldaps://192.168.75.10:636',
    baseDN: 'dc=pt-bjp,dc=co,dc=id',
    username: 'pt-bjp\\administrator',
    password: process.env.BJP_AD_PASSWORD || 'your-bjp-ad-password-here',
    tlsOptions: {
      rejectUnauthorized: false
    },
    attributes: {
      computer: [
        'dn',
        'distinguishedName',
        'cn',
        'name',
        'operatingSystem',
        'operatingSystemServicePack',
        'operatingSystemVersion',
        'description'
      ]
    }
  };
  
  const bjsCompConfig = {
    url: 'ldaps://192.168.75.100:636',
    baseDN: 'dc=pt-bjs,dc=co,dc=id',
    username: 'pt-bjs\\administrator',
    password: process.env.BJS_AD_PASSWORD || 'your-bjs-ad-password-here',
    tlsOptions: {
      rejectUnauthorized: false
    },
    attributes: {
      computer: [
        'dn',
        'distinguishedName',
        'cn',
        'name',
        'operatingSystem',
        'operatingSystemServicePack',
        'operatingSystemVersion',
        'description'
      ]
    }
  };
  
  const bjpConfig = {
    url: 'ldaps://192.168.75.10:636',
    baseDN: 'dc=pt-bjp,dc=co,dc=id',
    username: 'pt-bjp\\administrator',
    password: process.env.BJP_AD_PASSWORD || 'your-bjp-ad-password-here',
    tlsOptions: {
      rejectUnauthorized: false
    },
    attributes: {
      user: [
        'dn',
        'distinguishedName',
        'userPrincipalName',
        'sAMAccountName',
        'mail',
        'whenCreated',
        'pwdLastSet',
        'userAccountControl',
        'sn',
        'givenName',
        'cn',
        'displayName',
        'title',
        'department',
        'telephoneNumber',
        'mobile',
        'mobileNumber',
        'streetAddress',
        'city',
        'state',
        'physicalDeliveryOfficeName',
        'office',
        'l',
        'msDS-UserPasswordExpiryTimeComputed',
        'postalCode'
      ]
    }
  };
  
  const bjsConfig = {
    url: 'ldaps://192.168.75.100:636',
    baseDN: 'dc=pt-bjs,dc=co,dc=id',
    username: 'pt-bjs\\administrator',
    password: process.env.BJS_AD_PASSWORD || 'your-bjs-ad-password-here',
    tlsOptions: {
      rejectUnauthorized: false
    },
    attributes: {
      user: [
        'dn',
        'distinguishedName',
        'userPrincipalName',
        'sAMAccountName',
        'mail',
        'whenCreated',
        'pwdLastSet',
        'userAccountControl',
        'sn',
        'givenName',
        'cn',
        'displayName',
        'title',
        'department',
        'telephoneNumber',
        'mobile',
        'mobileNumber',
        'streetAddress',
        'city',
        'state',
        'physicalDeliveryOfficeName',
        'office',
        'l',
        'msDS-UserPasswordExpiryTimeComputed',
        'postalCode'
      ]
    }
  };
  
const folders = [
  'OFFICE ALL',
  'OFFICE LIMITED',
  'OPERATION',
  'BJP BDL LOG',
  'BJP BJS HRGA',
  'BJP FAC',
  'BJP SITE',
  'BJP CSR',
  'BJS OPR',
  'BJS JTM',
  'BJS HSE',
  'BJS MMT',
  'BJS EMT',
  'BJS ENG',
  'BJS PRC',
  'BJS ACT',
  'HOUSING FACILITY',
  'RECRUITMENT'
];

const ACL_BJP = [
  'ACL_OFFICE ALL',
  'ACL_MANAGERIAL-STAFF',
  'ACL_OPERATION',
  'ACL_BJP BIZ LOG',
  'ACL_HR & GA',
  'ACL_FINANCE',
  'ACL_BJP SITE',
  'ACL_BJP CSR',
  'ACL_BJP OPS',
  'ACL_BJP JET MTL',
  'ACL_BJP HSE',
  'ACL_BJP MECH MNT',
  'ACL_BJP ELEC MNT',
  'ACL_BJP ENG',
  'ACL_BJP PROC CDN',
  'ACL_FINANCE',
  'ACL_BJP Housing Facility for BJS',
  'ACL_RECRUITMENT'
];


const ACL_BJS = [
  'ACL_BJS OFFICE ALL',
  'ACL_BJS MANAGERIAL-STAFF',
  'ACL_BJS OPERATION',
  'ACL_BJS BIZ LOG',
  'ACL_BJS HR & GA',
  'ACL_BJS ACT',
  'ACL_BJS SITE',
  'ACL_BJS CSR',
  'ACL_BJS OPS',
  'ACL_BJS JET MTL',
  'ACL_BJS HSE',
  'ACL_BJS MECH MNT',
  'ACL_BJS ELEC MNT',
  'ACL_BJS ENG',
  'ACL_BJS PROC CDN',
  'ACL_BJS ACT',
  'ACL_BJS HOUSING FACILITY',
  'ACL_BJS RECRUITMENT'
];

const sharepointPath = {
  'legal': 'https://ptbjs.sharepoint.com/sites/BJP-LEGAL',
  'bdlog': 'https://ptbjs.sharepoint.com/sites/BJP-BDLOG',
  'bjphrga': 'https://ptbjs.sharepoint.com/sites/BJP-HRGA',
  'bjshrga': 'https://ptbjs.sharepoint.com/sites/BJS-HRGA',
  'facc': 'https://ptbjs.sharepoint.com/sites/BJP-FACC',
  'csr': 'https://ptbjs.sharepoint.com/sites/BJP-CSR',
  'site': 'https://ptbjs.sharepoint.com/sites/BJP-SITE',
  'opr': 'https://ptbjs.sharepoint.com/sites/BJS-OPR',
  'jtm': 'https://ptbjs.sharepoint.com/sites/BJS-JTM',
  'hse': 'https://ptbjs.sharepoint.com/sites/BJS-HSE',
  'mmt': 'https://ptbjs.sharepoint.com/sites/BJS-MMT',
  'emt': 'https://ptbjs.sharepoint.com/sites/BJS-EMT',
  'eng': 'https://ptbjs.sharepoint.com/sites/BJS-ENG',
  'prc': 'https://ptbjs.sharepoint.com/sites/BJS-PRC',
  'act': 'https://ptbjs.sharepoint.com/sites/BJS-ACT',
  'officelimited': 'https://ptbjs.sharepoint.com/sites/OFFICELIMITED',
  'officeall': 'https://ptbjs.sharepoint.com/sites/OFFICEALL'
};

const drive = ['L', 'M', 'R', 'T', 'Q', 'Q', 'W', 'X', 'Y', 'Z', 'N', 'O', 'K', 'J', 'I', 'V', 'H', 'U'];

const folder_path = [
  "\\shared\\OFFICE ALL\\",
  "\\shared\\OFFICE LIMITED\\",
  "\\shared\\OPERATION\\",
  "\\shared\\BJP BDL LOG\\",
  "\\shared\\BJP BJS HRGA\\",
  "\\shared\\BJP FAC\\",
  "\\shared\\BJP SITE\\",
  "\\shared\\BJP CSR\\",
  "\\shared\\BJS OPR\\",
  "\\shared\\BJS JTM\\",
  "\\shared\\BJS HSE\\",
  "\\shared\\BJS MMT\\",
  "\\shared\\BJS EMT\\",
  "\\shared\\BJS ENG\\",
  "\\shared\\BJS PRC\\",
  "\\shared\\BJS ACT\\",
  "\\shared\\HOUSING FACILITY\\",
  "\\shared\\RECRUITMENT\\"
];

// Create ActiveDirectory objects for each configuration
const adbjp = new ActiveDirectory(bjpConfig);
const adbjs = new ActiveDirectory(bjsConfig);
const adCompbjp = new ActiveDirectory(bjpCompConfig);
const adCompbjs = new ActiveDirectory(bjsCompConfig);

//Digunakan untuk mendeteksi domain. bisa digunakan untuk create new user, reset dan cek password expiracy
function detectUpn(email) {
  // Determine the domain based on the email
  const domain = email.split('@')[1];

  // Check the domain and return the corresponding Active Directory configuration
  if (domain === 'pt-bjp.co.id') {
    return {
      domain: domain,
      ad: new ActiveDirectory(adbjp)
    };
  } else if (domain === 'pt-bjs.co.id') {
    return {
      domain: domain,
      ad: new ActiveDirectory(adbjs)
    };
  } else {
    console.error(`Error: Invalid email domain ${domain}`);
    return { domain: null, ad: null };
  }
}

function convertFileTimeToDateString(fileTime) {
    const EPOCH_DIFFERENCE = 11644473600000;
    const timeInMilliseconds = (fileTime / 10000) - EPOCH_DIFFERENCE;
    return new Date(timeInMilliseconds).toLocaleString();
}

function convertFileTimeToDateStringDDMMYYYY(fileTime) {
    const EPOCH_DIFFERENCE = 11644473600000;
    const timeInMilliseconds = (fileTime / 10000) - EPOCH_DIFFERENCE;
    const date = new Date(timeInMilliseconds);
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function isExceptionallyLongDate(dateString) {
    const [datePart, timePart] = dateString.split(', ');
    const year = new Date(datePart).getFullYear();
    const thresholdYear = 2100;
    return year > thresholdYear;
}

//Zabbix configuration
const zabbixConfig = {
    url: 'http://192.168.75.24/zabbix/api_jsonrpc.php',
    user: 'bjs.admin',
    password: 'P@ssw0rd.1',
  };

  async function loginToZabbix() {
    try {
      const response = await axios.post(zabbixConfig.url, {
        jsonrpc: '2.0',
        method: 'user.login',
        params: {
          username: zabbixConfig.user,
          password: zabbixConfig.password,
        },
        id: 1,
        auth: null
      }, {
        headers: {
          'Content-Type': 'application/json-rpc'
        }
      });
  
      if (response.data.result) {
        console.log('Login successful. Auth token:', response.data.result);
        return response.data.result;
      } else {
        console.error('Login Failed. API Response:', response.data);
        throw new Error('Login failed');
      }
    } catch (error) {
      if (error.response) {
        console.error(`Error ${error.response.status}:`, error.response.data);
        if (error.response.status === 412) {
          console.error('Error 412: Precondition Failed. Please check your request payload and headers.');
        }
      } else {
        console.error('Login Error:', error.message);
      }
    }
  }

  async function getUPSInfoForHost(authToken, hostName, itemKeys) {
    try {
      const hostResponse = await axios.post(zabbixConfig.url, {
        jsonrpc: '2.0',
        method: 'host.get',
        params: {
          output: ['hostid'],
          filter: {
            host: [hostName],
          },
        },
        auth: authToken,
        id: 3,
      });
  
      if (hostResponse.data.result.length === 0) {
        console.error(`Host '${hostName}' not found.`);
        return;
      }
  
      const hostId = hostResponse.data.result[0].hostid;
  
      const upsInfo = {};
  
      for (const itemKey of itemKeys) {
        const itemResponse = await axios.post(zabbixConfig.url, {
          jsonrpc: '2.0',
          method: 'item.get',
          params: {
            output: ['hostid', 'name', 'lastvalue'],
            hostids: [hostId],
            search: {
              key_: itemKey,
            },
          },
          auth: authToken,
          id: 4,
        });
  
        if (itemResponse.data.result.length > 0) {
          const item = itemResponse.data.result[0];
          upsInfo[itemKey] = item.lastvalue;
        }
      }
  
      return upsInfo;
    } catch (error) {
      console.error('UPS Information Error:', error.message);
    }
  }
  
function addUnits(key, value) {
    const unitMap = {
      'voltage': 'V',
      'current': 'A',
      'capacity': '%',
      'frequency': 'Hz',
    };
  
    const unit = unitMap[Object.keys(unitMap).find(keyword => key.toLowerCase().includes(keyword))] || '';
    return `${value} ${unit}`;
}
  
function roundToDecimal(value) {
    if (typeof value === 'string') {
      const floatValue = parseFloat(value);
      if (!isNaN(floatValue)) {
        return floatValue.toFixed(1);
      }
    }
    return value;
}
  
function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}h ${mins}m ${secs}s`;
}
  

const hostnameMapping = {
    'jpr': 'UPS AB 10Kva',
    'jkt': '-',
    // Add more mappings as needed
};

async function getCredentialsAndDC(input) {
  const domains = [
    { key: 'bjp', domain: 'pt-bjp.co.id', credential: { adUsername: 'pt-bjp\\administrator', adPassword: 'K4r1munUt@r4J@w4' }, dc: '192.168.120.10' },
    { key: 'bjs', domain: 'pt-bjs.co.id', credential: { adUsername: 'pt-bjs\\administrator', adPassword: 'R@tuK4l!Ny4m@t' }, dc: '192.168.120.100' },
    // Add more domains and their credentials and DCs here as needed
  ];

  let user;
  let domainKey;
  let domain;

  if (input.includes('@')) {
    // Input is a UPN
    [user, domain] = input.split('@');
    domainKey = domain.match(/pt-(.*?)\.co\.id/)[1]; // Assuming domain format is "pt-<key>.co.id"
  } else {
    // Input is a domain key
    domainKey = input;
    user = null;
  }

  const domainConfig = domains.find(d => d.key === domainKey);

  if (!domainConfig) {
    throw new Error(`Domain key '${domainKey}' not supported`);
  }

  const { adUsername, adPassword } = domainConfig.credential;
  const dc = domainConfig.dc;


  return { adUsername, adPassword, dc, user};
}

//Original Reset Password Code

async function resetPassword(upn, newPassword, changePasswordAtNextLogon) {
  try {
    const { adUsername, adPassword, dc, user } = await getCredentialsAndDC(upn);

    //console.log(adUsername);
    //console.log(adPassword);
    //console.log(user);

    // Construct PowerShell command to reset user password
    let command = `Set-ADAccountPassword -Server '${dc}' -Credential (New-Object System.Management.Automation.PSCredential ('${adUsername}', (ConvertTo-SecureString '${adPassword}' -AsPlainText -Force))) -Identity '${user}' -Reset -NewPassword (ConvertTo-SecureString '${newPassword}' -AsPlainText -Force)`;

    // Append command to change password at next logon if requested
    if (changePasswordAtNextLogon) {
      command += `; Set-ADUser -Server '${dc}' -Credential (New-Object System.Management.Automation.PSCredential ('${adUsername}', (ConvertTo-SecureString '${adPassword}' -AsPlainText -Force))) -Identity '${user}' -ChangePasswordAtLogon $true`;
    }

    // Execute PowerShell command
    const { stderr } = await execPromise(`powershell.exe -Command "${command}"`);
    if (stderr) {
      const errorMessage = stderr.match(/CategoryInfo\s+:\s+(.*)/)?.[1];
      console.error(`Error resetting password: ${errorMessage}`);
      //console.error(`Error resetting password: ${stderr}`);
      return { success: false, error: errorMessage };
    }
    console.log(`Password reset for ${upn} successful`);
    return { success: true };
  } catch (error) {
    const errorMessage = error.message.match(/CategoryInfo\s+:\s+(.*)/)?.[1];
    console.error(`Error resetting password: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

async function get_highest_number(input, pcType, prefix) {
  try {
    const { adUsername, adPassword, dc, user } = await getCredentialsAndDC(input);
  
    // Construct PowerShell command to import ActiveDirectory module and find computers
    let command = `Import-Module ActiveDirectory; `;
    command += `Get-ADComputer -Server '${dc}' -Credential (New-Object System.Management.Automation.PSCredential ('${adUsername}', (ConvertTo-SecureString '${adPassword}' -AsPlainText -Force))) -Filter '*' | Select-Object -Property Name`;
  
    // Execute PowerShell command
    const { stdout, stderr } = await execPromise(`powershell.exe -Command "${command}"`);
    
    if (stderr) {
      const errorMessage = stderr.match(/CategoryInfo\s+:\s+(.*)/)?.[1];
      console.error(`Error getting computers: ${errorMessage}`);
      throw new Error(errorMessage);
    } else if (stdout) {
      //console.log(stdout);
      const computers = stdout.split('\n'); // Assuming each computer name is on a new line
      let maxNumber = 0;
      const numberRegex = /\d{3}/;
      computers.forEach(computerName => {
        
        if ((pcType === 'workstation' || pcType === 'laptop') && computerName.includes(prefix)) {
          const number = computerName.match(numberRegex);
          if (number) {
            
            const numberInt = parseInt(number[0]);
            
            if (numberInt > maxNumber) {
              maxNumber = numberInt;
            }
          }
        }
      });
      return maxNumber;
    } else {
      console.log('No computers found.');
      return 0;
    }
  } catch (error) {
    console.error(`Error getting highest number: ${error}`);
    throw new Error(error);
  }
}


function generate_suggested_name(prefix, max_number) {
  const new_number = max_number + 1;
  return `${prefix}${new_number.toString().padStart(3, '0')}`;
}

async function getUserDrives(upn) {
  try {
    const { adUsername, adPassword, dc, user } = await getCredentialsAndDC(upn);

    // Extract domain from the upn
    const domain = upn.split('@')[1].toLowerCase();

    // Construct PowerShell command to get group membership of the user
    const command = `Get-ADPrincipalGroupMembership -Server '${dc}' -Credential (New-Object System.Management.Automation.PSCredential ('${adUsername}', (ConvertTo-SecureString '${adPassword}' -AsPlainText -Force))) -Identity '${user}' | Select-Object @{Name='GroupName';Expression={$_.Name}}`;

    // Execute PowerShell command
    const { stdout, stderr } = await execPromise(`powershell.exe -Command "${command}"`, {
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 10, // Increase max buffer to handle large results
    });

    if (stderr) {
      errorMessage = stderr.match(/CategoryInfo\s+:\s+(.*)/)?.[1];
      console.error(`Error getting user groups: ${stderr}`);
      return { success: false, error: errorMessage };
    }

    // Parse PowerShell output and extract the group names
    const groups = stdout
      .trim() // Remove trailing whitespace
      .split('\r\n') // Split output into lines
      .slice(2) // Remove the first line (which contains "GroupName")
      .map((line) => line.replace(/^.*?: /, '').trim()); // Trim the group name

    const userDrives = [];

    let availableDrives = [];

    if (domain === 'pt-bjs.co.id') {
      // Check if the user is a member of ACL_BJS
      const indices = ACL_BJS.reduce((acc, group, index) => {
        if (groups.includes(group)) {
          acc.push(index);
        }
        return acc;
      }, []);
      
      availableDrives = indices.map((index) => ({
        driveLetter: drive[index],
        path: folder_path[index]
      }));
      
      // Add G: drive for ACL_BJS OFFICE ALL members
      if (groups.includes('ACL_BJS OFFICE ALL')) {
        availableDrives.push({
          driveLetter: 'G',
          path: '\\192.168.77.15\\Shared (Multimedia)'
        });
      }
    } else if (domain === 'pt-bjp.co.id') {
      // Check if the user is a member of ACL_BJP
      const indices = ACL_BJP.reduce((acc, group, index) => {
        if (groups.includes(group)) {
          acc.push(index);
        }
        return acc;
      }, []);
      
      availableDrives = indices.map((index) => ({
        driveLetter: drive[index],
        path: folder_path[index]
      }));
      
      // Add G: drive for ACL_OFFICE ALL members
      if (groups.includes('ACL_OFFICE ALL')) {
        availableDrives.push({
          driveLetter: 'G',
          path: "\\192.168.77.15\\Shared (Multimedia)"
        });
      }
    }

    console.log(`Drives for user ${upn}:`);
    console.log(availableDrives); // Log the user drives

    return { success: true, drives: availableDrives };
  } catch (error) {
    const errorMessage = error.message.match(/CategoryInfo\s+:\s+(.*)/)?.[1];
    console.error(`Error getting user drives: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

// Retrieve BitLocker recovery information from Active Directory
async function getBitLockerRecoveryInfo(hostname, domainKey) {
  try {
    const domain = domainKey && domainKey.toLowerCase();
    const ad = domain === 'bjp' ? adCompbjp : domain === 'bjs' ? adCompbjs : null;

    const tryDomains = ad ? [ { key: domain, ad } ] : [ { key: 'bjp', ad: adCompbjp }, { key: 'bjs', ad: adCompbjs } ];

    for (const d of tryDomains) {
      const currentAd = d.ad;
      // Find the computer DN by CN/hostname with robust fallbacks
      const sAM = `${hostname}$`;
      const filters = [
        `(&(objectClass=computer)(cn=${hostname}))`,
        `(&(objectClass=computer)(|(sAMAccountName=${sAM})(sAMAccountName=${hostname})))`,
        `(&(objectClass=computer)(|(cn=*${hostname}*)(name=*${hostname}*)))`
      ];

      let computerObj = null;
      for (const computerFilter of filters) {
        const computerQuery = {
          baseDN: currentAd.opts.baseDN,
          filter: computerFilter,
          scope: 'sub',
          attributes: [ 'distinguishedName', 'dn', 'cn', 'name', 'sAMAccountName' ]
        };

        const computerResult = await new Promise((resolve, reject) => {
          currentAd.find(computerQuery, (err, result) => {
            if (err) return reject(err);
            resolve(result);
          });
        });

        const candidate = computerResult && (computerResult.other || []).find(obj => obj.dn || obj.distinguishedName);
        if (candidate) { computerObj = candidate; break; }
      }

      const computerDN = computerObj ? (computerObj.dn || computerObj.distinguishedName) : null;

      if (!computerDN) {
        // Try next domain
        continue;
      }

      // Search for BitLocker recovery info under the computer DN
      const recoveryQuery = {
        baseDN: computerDN,
        filter: '(objectClass=msFVE-RecoveryInformation)',
        scope: 'sub',
        attributes: [ 'msFVE-RecoveryPassword', 'msFVE-RecoveryGuid', 'whenCreated', 'distinguishedName', 'dn' ]
      };

      const recoveryResult = await new Promise((resolve, reject) => {
        currentAd.find(recoveryQuery, (err, result) => {
          if (err) return reject(err);
          resolve(result);
        });
      });

      const entriesRaw = (recoveryResult && recoveryResult.other) ? recoveryResult.other : [];
      const entries = entriesRaw
        .map(o => ({
          domain: d.key,
          password: o['msFVE-RecoveryPassword'],
          guid: o['msFVE-RecoveryGuid'],
          whenCreated: o['whenCreated'],
          dn: o['dn'] || o['distinguishedName'] || computerDN
        }))
        .filter(e => !!e.password);

      if (entries.length === 0) {
        // Try next domain
        continue;
      }

      // Sort by whenCreated descending (AD Generalized Time format YYYYMMDDHHmmSS.0Z)
      const parseGenTime = (s) => {
        try {
          const m = s && s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
          if (!m) return null;
          return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
        } catch { return null; }
      };

      const sorted = entries.sort((a, b) => {
        const da = parseGenTime(a.whenCreated);
        const db = parseGenTime(b.whenCreated);
        if (da && db) return db - da; // latest first
        // Fallback: lexicographic compare if parsing fails
        if (a.whenCreated && b.whenCreated) return b.whenCreated.localeCompare(a.whenCreated);
        return 0;
      });

      return {
        success: true,
        domain: d.key,
        computerDN,
        entries: sorted,
        latest: sorted[0]
      };
    }

    return { success: false, error: 'Computer atau BitLocker Recovery tidak ditemukan di kedua domain.' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Note: getCurrentDateTime function is defined earlier in the file (line 244)

// Function to generate HTML table for Zerto VM data
function generateZertoTableHTML(vmData, location) {
  const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Zerto VM Report - ${location}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            overflow: hidden;
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
            color: white;
            padding: 30px;
        }
        .header h1 {
            margin: 0;
            font-size: 32px;
            font-weight: 700;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .header p {
            margin: 10px 0 0 0;
            font-size: 18px;
            opacity: 0.9;
        }
        .table-container {
            padding: 0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
        }
        th {
            background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
            color: white;
            padding: 18px 15px;
            text-align: center;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-size: 13px;
            border-bottom: 3px solid #2980b9;
        }
        td {
            padding: 15px;
            border-bottom: 1px solid #ecf0f1;
            vertical-align: middle;
            text-align: center;
        }
        tr:nth-child(even) {
            background-color: #f8f9fa;
        }
        tr:hover {
            background-color: #e8f4fd;
            transition: background-color 0.3s ease;
        }
        .status-meet {
            background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
            color: white;
            padding: 8px 16px;
            border-radius: 25px;
            font-weight: 700;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            box-shadow: 0 2px 4px rgba(39, 174, 96, 0.3);
        }
        .status-not-meet {
            background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
            color: white;
            padding: 8px 16px;
            border-radius: 25px;
            font-weight: 700;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            box-shadow: 0 2px 4px rgba(231, 76, 60, 0.3);
        }
        .rpo-good {
            color: #27ae60;
            font-weight: 700;
            font-size: 16px;
        }
        .rpo-warning {
            color: #f39c12;
            font-weight: 700;
            font-size: 16px;
        }
        .rpo-critical {
            color: #e74c3c;
            font-weight: 700;
            font-size: 16px;
        }
        .vm-name {
            font-weight: 700;
            color: #2c3e50;
            font-size: 15px;
        }
        .vm-location {
            background: linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%);
            color: white;
            padding: 6px 12px;
            border-radius: 15px;
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .footer {
            text-align: center;
            padding: 25px;
            background: linear-gradient(135deg, #34495e 0%, #2c3e50 100%);
            color: white;
            font-size: 14px;
            font-weight: 500;
        }
        .summary {
            display: flex;
            justify-content: space-around;
            padding: 20px;
            background: #ecf0f1;
            margin: 0;
        }
        .summary-item {
            text-align: center;
        }
        .summary-number {
            font-size: 24px;
            font-weight: 700;
            color: #2c3e50;
        }
        .summary-label {
            font-size: 12px;
            color: #7f8c8d;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🛡️ Zerto VM Protection Report</h1>
            <p>📍 ${location} • 📅 ${new Date().toLocaleString('id-ID', { 
              timeZone: 'Asia/Jakarta',
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
        </div>
        
        <div class="summary">
            <div class="summary-item">
                <div class="summary-number">${vmData.length}</div>
                <div class="summary-label">Total VMs</div>
            </div>
            <div class="summary-item">
                <div class="summary-number" style="color: #27ae60;">${vmData.filter(vm => (vm.actualRpo || 0) < 900).length}</div>
                <div class="summary-label">SLA Met</div>
            </div>
            <div class="summary-item">
                <div class="summary-number" style="color: #e74c3c;">${vmData.filter(vm => (vm.actualRpo || 0) >= 900).length}</div>
                <div class="summary-label">SLA Not Met</div>
            </div>
        </div>
        
        <div class="table-container">
            <table>
                 <thead>
                     <tr>
                         <th>VM Name</th>
                         <th>VM Location</th>
                         <th>RPO Time</th>
                         <th>SLA Status</th>
                     </tr>
                 </thead>
                 <tbody>
                     ${vmData.map(vm => {
                       const rpoSeconds = vm.actualRpo || 0;
                       const meetsSLA = rpoSeconds < 900; // 15 minutes = 900 seconds
                       const rpoClass = rpoSeconds < 300 ? 'rpo-good' : rpoSeconds < 600 ? 'rpo-warning' : 'rpo-critical';
                       
                       // Determine VM location from VM data or fallback to location parameter
                       let vmLocation = vm.location || 'Unknown';
                       
                       // Fallback logic if location is not in VM data
                       if (vmLocation === 'Unknown') {
                         if (location.includes('Jakarta') || location.includes('DC Jakarta')) {
                           vmLocation = 'DC Jakarta';
                         } else if (location.includes('Jepara') || location.includes('MINI DC Jepara')) {
                           vmLocation = 'MINI DC Jepara';
                         } else if (location.includes('&')) {
                           // For combined reports, try to determine from VM name
                           vmLocation = vm.vmName && vm.vmName.toLowerCase().includes('jpr') ? 'MINI DC Jepara' : 'DC Jakarta';
                         }
                       }
                       
                       return `
                         <tr>
                             <td class="vm-name">${vm.vmName || 'N/A'}</td>
                             <td><span class="vm-location">${vmLocation}</span></td>
                             <td class="${rpoClass}">${rpoSeconds}s</td>
                             <td>
                                 <span class="${meetsSLA ? 'status-meet' : 'status-not-meet'}">
                                     ${meetsSLA ? '✅ MEET SLA' : '❌ NOT MEET'}
                                 </span>
                             </td>
                         </tr>
                       `;
                     }).join('')}
                 </tbody>
             </table>
        </div>
        
        <div class="footer">
            🤖 Generated by Systex Asia WhatsApp API • Zerto Protection Report System
        </div>
    </div>
</body>
</html>`;
  
  return html;
}

// Function to generate WhatsApp caption for table image
function generateTableCaption(vmData, locationName) {
  const { formattedDate, formattedTime } = getCurrentDateTime();
  const now = new Date();
  
  // Smart greeting based on time windows
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
  
  // Analyze VM data
  const totalVms = vmData.length;
  let rpoIssues = 0;
  let maxRpo = 0;
  
  vmData.forEach(vm => {
    const actualRpo = vm.actualRpo || 0;
    if (typeof actualRpo === 'number' && actualRpo > maxRpo) {
      maxRpo = actualRpo;
    }
    if (typeof actualRpo === 'number' && actualRpo > 900) {
      rpoIssues++;
    }
  });
  
  // Determine if this is combined locations
  const isCombined = locationName.includes('&') || locationName.includes('All Locations');
  
  // Build caption message
  let message = `${greeting}, berikut adalah laporan hasil replikasi Zerto pada hari ${formattedDate} pukul ${formattedTime}.\n\n`;
  
  // Main status message
  if (rpoIssues === 0) {
    if (isCombined) {
      message += `✅ Semua ${totalVms} server dari kedua data center memenuhi SLA dengan RPO time kurang dari 15 menit (maksimal: ${maxRpo} detik).\n\n`;
    } else {
      message += `✅ Semua ${totalVms} server dari ${locationName} memenuhi SLA dengan RPO time kurang dari 15 menit (maksimal: ${maxRpo} detik).\n\n`;
    }
  } else {
    message += `⚠️ Ditemukan ${rpoIssues} server dengan RPO > 15 menit dari total ${totalVms} server.\n\n`;
  }
  
  // Add breakdown per data center for combined reports
  if (isCombined) {
    // Count VMs per location using the location property
    const jeparaVms = vmData.filter(vm => vm.location && vm.location.includes('MINI DC Jepara')).length;
    const jakartaVms = vmData.filter(vm => vm.location && vm.location.includes('DC Jakarta')).length;
    
    message += `📊 Ringkasan per Data Center:\n`;
    if (jeparaVms > 0) {
      message += `🏢 MINI DC Jepara: ${jeparaVms} server - ✅ Semua OK\n`;
    }
    if (jakartaVms > 0) {
      message += `🏢 DC Jakarta: ${jakartaVms} server - ✅ Semua OK\n`;
    }
    message += `\n`;
  }
  
  // Add overall summary
  message += `📈 Total Keseluruhan:\n`;
  message += `• Total Server: ${totalVms}\n`;
  message += `• RPO Maksimal: ${maxRpo} detik\n`;
  message += `• Server Bermasalah: ${rpoIssues}`;
  
  return message;
}

// Function to capture HTML table as image using node-html-to-image
async function captureTableAsImage(htmlContent) {
  try {
    console.log('Generating table image...');
    
    const chromePath = getChromeExecutablePath();
    const puppeteerConfig = {
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    };
    
    // Only add executablePath if Chrome is found in puppeteer-cache
    if (chromePath) {
      puppeteerConfig.executablePath = chromePath;
    }
    
    const image = await nodeHtmlToImage({
      html: htmlContent,
      quality: 100,
      type: 'png',
      puppeteerArgs: puppeteerConfig,
      encoding: 'buffer'
    });

    console.log('Table image generated successfully');
    return image;
    
  } catch (error) {
    console.error('Error generating table image:', error);
    throw error;
  }
}

async function captureZertoWithLogin(zertoUrl) {
  try {
      console.log(`Launching browser...`);
      const chromePath = getChromeExecutablePath();
      const launchConfig = {
          headless: false,
          ignoreHTTPSErrors: true,
          args: ['--disable-gpu', '--disable-software-rasterizer'],
      };
      
      // Only add executablePath if Chrome is found in puppeteer-cache
      if (chromePath) {
          launchConfig.executablePath = chromePath;
      }
      
      const browser = await puppeteer.launch(launchConfig);

      const page = await browser.newPage();

      console.log(`Setting navigation timeout to 60 seconds...`);
      await page.setDefaultNavigationTimeout(60000); // 60 seconds

      console.log(`Navigating to Zerto login page at ${zertoUrl}...`);
      await page.goto(zertoUrl, { waitUntil: 'domcontentloaded' });

      console.log(`Waiting for login elements to be present...`);
      console.log('Waiting for username selector: #username');
      await page.waitForSelector('#username', { timeout: 30000 }); // 30 seconds
      console.log('Waiting for password selector: #password'); 
      await page.waitForSelector('#password', { timeout: 30000 }); // 30 seconds
      console.log('Waiting for login button selector: span.MuiButton-label');
      await page.waitForSelector('#kc-login', { timeout: 30000 });

      //await page.waitForSelector('span.MuiButton-label', { timeout: 30000 }); // 30 seconds

      console.log(`Performing login...`);
      await page.type('#username', 'administrator@vsphere.local');
      if (zertoUrl === 'https://192.168.77.250/main/vms') {
          await page.type('#password', 'sYsbjpsn0@!!*');
      } else {
          await page.type('#password', 'NOAid#2023');
      }
      await page.click('#kc-login');

      console.log(`Waiting for the page to load after login...`);
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }); // 60 seconds

      console.log(`Clicking on VMs icon after login...`);
      await page.waitForSelector('svg[viewBox="0 0 15 16.988"]', { timeout: 30000 }); // 30 seconds
      await page.click('svg[viewBox="0 0 15 16.988"]');

      console.log(`Maximizing window and setting zoom level...`);
      await page.setViewport({ width: 1200, height: 800 });
      await page.evaluate(() => {
          document.body.style.zoom = '75%';
      });

      console.log(`Adding delay to wait for the page to be fully loaded...`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5000 milliseconds (5 seconds)

      console.log(`Capturing screenshot...`);
      const screenshotBuffer = await page.screenshot();

      console.log('Screenshot saved successfully at buffer');

      console.log(`Selecting and copying the content...`);
      const copiedContent = await page.evaluate(() => {
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(document.body);
          selection.removeAllRanges();
          selection.addRange(range);
          document.execCommand('copy');
          return selection.toString();
      });

      console.log('Content copied successfully');
      console.log('Content:', copiedContent);

      console.log(`Closing browser...`);
      await browser.close();

      console.log('Browser closed successfully');

      return { screenshotBuffer, copiedContent };
  } catch (error) {
      console.error('Error capturing Zerto screenshot:', error);
      throw error;
  }
}


// Function to generate a summary prompt
function generateSummaryPrompt(dateTimeInfo) {
  const { formattedDate, formattedTime } = dateTimeInfo;

  // Using a multiline template string
  const prompt = `
  buatkan summary singkat laporan hasil replikasi Zerto. awali dengan Selamat pagi team, sebutkan hari ${formattedDate} pukul ${formattedTime}.
  Urutan data adalah: Server Name, VPG Name, Undefined, Peer Site, SLA Status dan RPO Time.
  Sebutkan Zerto Site.
  Rule: 
  Meet SLA jika RPO time < 15 menit. 
  Jika semua server meet SLA, Laporkan semua server (tidak perlu sebutkan list servernya) berjalan dengan baik.
  Jika ada yang tidak meet SLA, Laporkan hanya server yang tidak Meet SLA.
  Tidak lebih dari 3 kalimat.
  akhiri dengan terimakasih 🙏
  gunakan data berikut:\n\n`;

  return prompt;
}

//Message Command Handling
const handleMessage = async (message) => {
  if (!message.message) return;

  // const commandDetails = {
  //   finduser: `*Usage:* /finduser <username>\n*Description:* Finds a user in Active Directory by name.\n\n*Example:* /finduser peggy`,
  //   getups: `*Penggunaan:* /getups <hostname>\n*Deskripsi:* Menampilkan informasi status UPS dari Zabbix secara real-time, termasuk:\n• Model dan lokasi UPS\n• Status baterai (kapasitas dan estimasi runtime)\n• Input power (tegangan dan frekuensi)\n• Output power (tegangan dan arus)\n• Ringkasan status dengan indikator warna\n\n*Hostname Tersedia:*\n• jpr (UPS AB 10Kva di Admin Building)\n\n*Contoh:* /getups jpr`,
  //   getasset: `*Usage:* /getasset <category>\n*Description:* Retrieves asset information from Snipe-IT for the specified category.\n\n*Available Categories:*\n- mouse\n- switch\n- tablet\n- pc\n- ht\n- phone\n- monitor\n- sim\n- notebook\n- license\n\n*Example:* /getasset notebook`,
  //   addwifi: `*Usage:* /addwifi <pool> <macAddress> <comment>\n*Description:* Adds a WiFi user to MikroTik RouterOS.\n\n*Pools:*\n- /staff\n- /nonstaff\n- /contractor\n- /management\n- /employeefull\n- /employeelimited\n\n*Example:* /addwifi /staff 00:1A:2B:3C:4D:5E New staff member`,
  //   checkwifi: `*Usage:* /checkwifi <macAddress>\n*Description:* Checks the WiFi status of the specified MAC address in MikroTik RouterOS.\n\n*Example:* /checkwifi 00:1A:2B:3C:4D:5E`,
  //   movewifi: `*Usage:* /movewifi <macAddress> <newPool>\n*Description:* Moves a WiFi user to a new pool in MikroTik RouterOS.\n\n*Example:* /movewifi 00:1A:2B:3C:4D:5E /management`,
  // };
  const commandCategories = {
    'General': ['help', 'hai'],
    'User Management': ['finduser'],
    'System Information': ['getups', 'zertoreport'],
    'Resource Management': ['finddrive', 'userdrive', 'sp'],
    'Device Management': ['suggestname']
  };

  const commandDetails = {
    help: {
      usage: '/help [command]',
      description: 'Display command list or detailed help for specific command',
      example: '/help finduser',
      category: 'General'
    },
    hai: {
      usage: '/hai',
      description: 'Simple bot test command',
      example: '/hai',
      category: 'General'
    },
    resetpassword: {
      usage: '/resetpassword <username> <newPassword> [/change]',
      description: 'Restricted command',
      example: '/resetpassword aryo.pratama newpassword123 /change',
      category: 'User Management'
    },
    finduser: {
      usage: '/finduser <username> [/domain:<domain>]',
      description: 'Search user in Active Directory',
      example: '/finduser aryo /domain:bjp',
      category: 'User Management'
    },
    getups: {
      usage: '/getups <hostname>',
      description: 'Display UPS status from Zabbix. Hostname: jkt (DC) or jpr (Mini DC)',
      example: '/getups jkt',
      category: 'System Information'
    },
    suggestname: {
      usage: '/suggestname /domain:<domain> /type:<type>',
      description: 'Suggest device name (lt=laptop, ws=workstation)',
      example: '/suggestname /domain:bjp /type:ws',
      category: 'Device Management'
    },
    finddrive: {
      usage: '/finddrive <drive letter>',
      description: 'Find folder for specific drive letter',
      example: '/finddrive L',
      category: 'Resource Management'
    },
    userdrive: {
      usage: '/userdrive <UPN>',
      description: 'Show user network drives (format: username@domain)',
      example: '/userdrive user@pt-bjs.co.id',
      category: 'Resource Management'
    },
    zertoreport: {
      usage: '/zertoreport [location] [/txt]',
      description: 'Generate Zerto report (jakarta=DC, jepara=Mini DC). Default: professional table image. Add /txt for text report',
      example: '/zertoreport jakarta',
      category: 'System Information'
    },
    sp: {
      usage: '/sp <site name>',
      description: 'Show SharePoint path for specific site',
      sites: 'legal, bdlog, bjphrga, bjshrga, facc, csr, site, opr, jtm, hse, mmt, emt, eng, prc, act, officelimited, officeall',
      example: '/sp legal',
      category: 'Resource Management'
    },
    bitlocker: {
      usage: '/bitlocker <hostname> [/domain:bjp|bjs] [/latest]\natau\n/bitlocker [/domain:bjp|bjs] <hostname> [/latest]',
      description: 'Ambil BitLocker Recovery Key dari Active Directory berdasarkan hostname. Default menampilkan semua key, gunakan /latest untuk hanya key terbaru. Domain dapat ditulis di depan atau di belakang hostname.',
      example: '/bitlocker /domain:bjs BJSPRLD066\natau\n/bitlocker BJSPRLD066 /domain:bjs',
      category: 'Security'
    }
  };




  const from = message.key.remoteJid;
  const text = extractMessageContent(message);
  const hasDocument = message.message.documentMessage;
  const isFromMe = message.key.fromMe;
  if (text === '/hai') {
      const response = { text: 'hai aku sore, tak jalani sak mampuku' };
      try {
          await sock.sendMessage(from, response);
          console.log('Reply sent:', response);
      } catch (error) {
          console.error('Error sending reply:', error);
      }
  }
  // List all available commands
  else if (text.startsWith('/help')) {
    const parts = text.split(' ');
    if (parts.length > 1) {
      const specificCommand = parts[1].toLowerCase();
      const commandDetail = commandDetails[specificCommand];
      if (commandDetail) {
        try {
          const detailedHelp = `📌 *Command: /${specificCommand}*\n\n`
            + `📝 *Usage:*\n${commandDetail.usage}\n\n`
            + `ℹ️ *Description:*\n${commandDetail.description}\n\n`
            + (commandDetail.sites ? `📂 *Available Sites:*\n${commandDetail.sites}\n\n` : '')
            + `💡 *Example:*\n${commandDetail.example}`;

          await sock.sendMessage(from, { text: detailedHelp });
          console.log(`Detailed help for ${specificCommand} sent`);
        } catch (error) {
          console.error(`Error sending detailed help for ${specificCommand}:`, error);
        }
      } else {
        try {
          await sock.sendMessage(from, { text: '❌ *Unknown command.* Use /help to see the list of available commands.' });
          console.log(`Unknown command help requested: ${specificCommand}`);
        } catch (error) {
          console.error('Error sending unknown command message:', error);
        }
      }
    } else {
      let commandList = '🤖 *WhatsApp Bot Command List*\n\n';

      // List all commands without categories
      Object.entries(commandDetails).forEach(([cmd, details]) => {
        if (cmd !== 'resetpassword') { // Skip resetpassword command
          commandList += `🔹 /${cmd}\n`;
        }
      });

      commandList += '\n*Need more details about a command?*\n'
        + '💡 Type */help <command>* to see detailed information\n'
        + '📝 Example: */help finduser*\n\n'
        + '*Note:* Each command has specific usage instructions and examples that you can access using the help command.';

      try {
        await sock.sendMessage(from, { text: commandList });
        console.log('Command list sent');
      } catch (error) {
        console.error('Error sending command list:', error);
      }
    }
  }
  else if (text.startsWith('/resetpassword')) {
    const parts = text.split(/ |\u00A0|'/);
    const username = parts[1];
    const newPassword = parts[2];
    const changePasswordAtNextLogon = parts.length > 3 && parts[3] === '/change';

    // Extract the phone number of the user who sent the message
    const phoneNumberMatch = from.match(/(\d+)@s\.whatsapp\.net/);
    console.log(phoneNumberMatch);

    if (!phoneNumberMatch) {
        // Respond with an error message for invalid phone number format
        sock.sendMessage(from, { text: 'Invalid phone number format.' });
        return;
    }

    const phoneNumber = phoneNumberMatch[1]; // Extracted phone number
    console.log(phoneNumber);

    // Check if the requesting phone number is in the list of allowed numbers
    if (!allowedPhoneNumbers.includes(phoneNumber)) {
        // Respond with an "Access denied" message for unauthorized access
        sock.sendMessage(from, { text: 'Access denied. You are not authorized to perform this action.' });
        return;
    }

    resetPassword(username, newPassword, changePasswordAtNextLogon)
        .then((result) => {
            if (!result.success) {
                sock.sendMessage(from, { text: `Error resetting password for ${username}: ${result.error}` });
            } else {
                console.log(`Password reset for ${username} successful`);
                sock.sendMessage(from, { text: `Password reset for ${username} successful` });
            }
        })
        .catch((error) => {
            console.error(`Error resetting password: ${error.message}`);
            sock.sendMessage(from, { text: `Error resetting password: ${error.message}` });
        });
  }

  //Find user in AD
  else if (text.startsWith('/finduser')) {
    const params = text.split(/ |\u00A0|'/);
    let domain;
    let partialName;

    params.forEach((param) => {
        if (param.startsWith("/domain:")) {
            domain = param.split(':')[1];
        } else {
            partialName = param;
        }
    });

    if (!domain) {
        console.error(`Error: Domain not specified`);
        await sock.sendMessage(from, { text: '❌ Please specify a domain using /domain:[bjp|bjs]\n\n*Example:*\n/finduser /domain:bjp John' });
        return;
    }

    let ad = null;
    if (domain === 'bjp') {
        ad = adbjp;
    } else if (domain === 'bjs') {
        ad = adbjs;
    } else {
        console.error(`Error: Invalid domain ${domain}`);
        await sock.sendMessage(from, { text: `❌ Invalid domain: ${domain}\n\n*Available domains:*\n• bjp\n• bjs` });
        return;
    }

    try {
        const query = `cn=*${partialName}*`;
        ad.findUsers(query, false, (err, users) => {
            if (err) {
                console.error('Error finding user:', err);
                if (!err.message.includes('ECONNRESET')) {
                    sock.sendMessage(from, { text: `Error finding user: ${err.message}` });
                }
                return;
            }

            if (!users || users.length === 0) {
                console.log('User not found.');
                sock.sendMessage(from, { text: 'User not found.' });
            } else {
                users.forEach((user) => {
                    const dateString = convertFileTimeToDateStringDDMMYYYY(user.pwdLastSet);
                    let message = `👤 *User Information for ${user.displayName}*\n\n`;
                    message += `📧 *Email:* ${user.userPrincipalName || 'N/A'}\n`;
                    message += `🎯 *Title:* ${user.title || 'N/A'}\n`;
                    message += `🏢 *Department:* ${user.department || 'N/A'}\n`;
                    message += `📍 *Office:* ${user.physicalDeliveryOfficeName || user.office || user.l || 'N/A'}\n`;
                    message += `📱 *Mobile:* ${user.mobile || user.mobileNumber || 'N/A'}\n`;
                    message += `☎️ *Phone:* ${user.telephoneNumber || 'N/A'}\n`;
                    message += `🔄 *Last Password Change:* ${dateString || 'N/A'}\n`;
                    message += `👥 *Manager:* ${user.manager || 'N/A'}\n`;
                    message += `🏷️ *Employee ID:* ${user.employeeID || 'N/A'}\n`;
                    const pwdExpiryDate = convertFileTimeToDateStringDDMMYYYY(user['msDS-UserPasswordExpiryTimeComputed']);
                    // Fix: Properly parse DD/MM/YYYY format instead of relying on Date constructor
                    // which interprets it as MM/DD/YYYY (US format)
                    const isExpired = (() => {
                        if (!pwdExpiryDate || pwdExpiryDate === 'N/A') return false;
                        
                        const [datePart, timePart] = pwdExpiryDate.split(' ');
                        const [day, month, year] = datePart.split('/');
                        const [hours, minutes] = timePart ? timePart.split(':') : ['0', '0'];
                        
                        // Create date with correct DD/MM/YYYY interpretation
                        const expiryDate = new Date(year, month - 1, day, hours || 0, minutes || 0);
                        const currentDate = new Date();
                        
                        return expiryDate < currentDate;
                    })();
                    message += `🔐 *Password Status:* ${isExpired ? '❌ Expired' : '✅ Active'}\n`;
                    message += `📅 *Password Expiry:* ${pwdExpiryDate || 'N/A'}\n`;
                    console.log(user);
                    sock.sendMessage(from, { text: message });
                });
            }
        });
    } catch (err) {
        console.error('Error finding user:', err);
        sock.sendMessage(from, { text: `Error finding user: ${err.message}` });
    }
  }

  // BitLocker recovery key lookup
  else if (text.startsWith('/bitlocker')) {
    try {
      const parts = text.split(/ |\u00A0|'/).filter(Boolean);
      let domainKey = null;
      let latestOnly = false;
      let hostname = null;

      parts.forEach((param) => {
        if (param.startsWith('/domain:')) {
          domainKey = param.split(':')[1];
        } else if (param.toLowerCase() === '/latest') {
          latestOnly = true;
        } else if (param && !param.startsWith('/bitlocker') && !param.startsWith('/')) {
          hostname = param;
        }
      });

      if (!hostname) {
        await sock.sendMessage(from, { text: '❌ Hostname tidak diberikan.\n\nPenggunaan: /bitlocker <hostname> [/domain:bjp|bjs] [/latest] atau /bitlocker [/domain:bjp|bjs] <hostname>\nContoh: /bitlocker PC-BJP-001 /domain:bjp /latest atau /bitlocker /domain:bjp PC-BJP-001' });
        return;
      }

      // Kirim acknowledgement agar user tahu proses sedang berjalan
      await sock.sendMessage(from, { text: `🔎 Mencari BitLocker Recovery Key untuk host: ${hostname}${domainKey ? ` (domain: ${domainKey.toLowerCase()})` : ''}...` });

      // Authorization: BitLocker lookup is allowed for all users as requested.
      // Previously restricted via allowedPhoneNumbers; now removed for /bitlocker only.

      // Tambahkan timeout agar bot tidak diam jika koneksi LDAP lambat/terblokir
      const timeoutMs = 15000; // 15 detik per percobaan
      const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve({ success: false, error: `Timeout mencari data BitLocker (>${timeoutMs/1000}s). Pastikan koneksi ke LDAP terbuka.` }), timeoutMs));
      const result = await Promise.race([
        getBitLockerRecoveryInfo(hostname, domainKey),
        timeoutPromise
      ]);

      const { success, domain, computerDN, entries, latest, error } = result;

      if (!success) {
        await sock.sendMessage(from, { text: `❌ Gagal mengambil BitLocker Recovery Key untuk host: ${hostname}\n\nAlasan: ${error || 'Tidak diketahui'}` });
        return;
      }

      const toLocal = (gt) => {
        try {
          const m = gt && gt.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
          if (!m) return gt || '-';
          const d = new Date(Date.UTC(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +m[6]));
          const pad = (n) => String(n).padStart(2, '0');
          return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        } catch { return gt || '-'; }
      };

      const formatGuid = (val) => {
        try {
          if (!val) return '-';
          if (Buffer.isBuffer(val)) {
            const b = Uint8Array.from(val);
            const hex = (arr) => Array.from(arr).map(x => x.toString(16).padStart(2, '0')).join('');
            const tl = hex(b.slice(0,4).reverse());
            const tm = hex(b.slice(4,6).reverse());
            const th = hex(b.slice(6,8).reverse());
            const a = hex(b.slice(8,10));
            const rest = hex(b.slice(10,16));
            return `${tl}-${tm}-${th}-${a}-${rest}`.toUpperCase();
          }
          const s = Array.isArray(val) ? val[0] : val;
          if (typeof s === 'string') {
            if (/^[0-9a-fA-F-]{32,36}$/.test(s)) return s.toUpperCase();
            return Buffer.from(s, 'binary').toString('hex').toUpperCase();
          }
          return String(s);
        } catch { return '-'; }
      };

      const list = (latestOnly ? [latest] : entries).map((e, idx) => {
        const guidRaw = Array.isArray(e.guid) ? e.guid[0] : e.guid;
        const password = Array.isArray(e.password) ? e.password[0] : e.password;
        const createdRaw = Array.isArray(e.whenCreated) ? e.whenCreated[0] : e.whenCreated;
        const created = toLocal(createdRaw);
        const guid = formatGuid(guidRaw);
        return `#${idx + 1} \n• Tanggal: ${created} \n• GUID: ${guid} \n• Recovery Password: ${password}`;
      }).join('\n\n');

      const header = `🔐 *BitLocker Recovery Key*\n\n🖥️ Hostname: ${hostname}\n🏢 Domain: ${domain.toUpperCase()}\n📂 Computer DN: ${computerDN}`;
      const hint = latestOnly ? '' : '\n\n💡 Gunakan kunci terbaru terlebih dahulu (#1).';

      // Avoid logging sensitive data
      console.log(`BitLocker: fetched ${latestOnly ? 1 : entries.length} key(s) for ${hostname} in domain ${domain}.`);

      await sock.sendMessage(from, { text: `${header}\n\n${list}${hint}` });
    } catch (err) {
      console.error(`Error processing /bitlocker command: ${err.message}`);
      await sock.sendMessage(from, { text: `❌ Terjadi kesalahan saat memproses perintah: ${err.message}` });
    }
  }
  //Get UPS status from Zabbix
  else if (text.startsWith('/getups')) {
      const params = text.split(' ');
      if (params.length < 2) {
        await sock.sendMessage(from, { text: '❌ *Parameter Tidak Lengkap*\n\n⚠️ Hostname UPS tidak diberikan\n\n💡 _Format yang benar:_\n/getups <hostname>\n\n📝 _Contoh penggunaan:_\n/getups jpr\n\n📍 _Hostname yang tersedia:_\n• jpr (untuk UPS AB 10Kva di Admin Building)\n\n❗ Pastikan menggunakan hostname yang benar.' });
        return;
      }
  
      const identifier = params[1];
      const hostName = hostnameMapping[identifier] || identifier; // Map identifier to hostname, fallback to identifier if not mapped
  
      const itemKeys = [
        'upsBasicIdentModel',
        'sysLocation.0',
        'upsAdvBatteryRunTimeRemaining',
        'upsHighPrecInputLineVoltage',
        'upsHighPrecInputFrequency',
        'upsHighPrecOutputVoltage',
        'upsHighPrecOutputCurrent',
        'upsHighPrecBatteryCapacity',
      ];

      const itemKeyMapping = {
        'upsBasicIdentModel': 'Model',
        'sysLocation.0': 'Location',
        'upsAdvBatteryRunTimeRemaining': 'Runtime',
        'upsHighPrecInputLineVoltage': 'Input voltage',
        'upsHighPrecInputFrequency': 'Input frequency',
        'upsHighPrecOutputVoltage': 'Output voltage',
        'upsHighPrecOutputCurrent': 'Output current',
        'upsHighPrecBatteryCapacity': 'Battery capacity',
      };

      function getUPSStatus(upsInfo) {
        const batteryCapacity = parseFloat(upsInfo['upsHighPrecBatteryCapacity']);
        const inputVoltage = parseFloat(upsInfo['upsHighPrecInputLineVoltage']);
        const outputVoltage = parseFloat(upsInfo['upsHighPrecOutputVoltage']);

        let batteryStatus = '🔴 CRITICAL';
        if (batteryCapacity >= 80) batteryStatus = '🟢 NORMAL';
        else if (batteryCapacity >= 50) batteryStatus = '🟡 WARNING';
        else if (batteryCapacity >= 20) batteryStatus = '🟠 LOW';

        let powerStatus = '🔴 CRITICAL';
        if (inputVoltage >= 200 && inputVoltage <= 240 && 
            outputVoltage >= 200 && outputVoltage <= 240) {
          powerStatus = '🟢 NORMAL';
        } else if (inputVoltage >= 180 && inputVoltage <= 260 && 
                   outputVoltage >= 180 && outputVoltage <= 260) {
          powerStatus = '🟡 WARNING';
        }

        return { batteryStatus, powerStatus };
      }
  
      try {
        const authToken = await loginToZabbix();
        const upsInfo = await getUPSInfoForHost(authToken, hostName, itemKeys);
  
        if (!upsInfo || Object.keys(upsInfo).length === 0) {
          await sock.sendMessage(from, { text: `❌ *UPS Tidak Ditemukan*\n\n⚠️ Tidak dapat menemukan informasi UPS untuk host: ${hostName}\n\n💡 _Silakan gunakan hostname yang tersedia:_\n• jpr (untuk UPS AB 10Kva di Admin Building)\n\n📝 _Format:_\n/getups <hostname>\n\n❗ Jika masalah berlanjut, silakan hubungi administrator.` });
          return;
        }
  
        const { batteryStatus, powerStatus } = getUPSStatus(upsInfo);

        let response = `⚡ *UPS Status Report*\n\n`;
        
        // Model dan Lokasi
        response += `📍 *Informasi UPS*\n`;
        response += `├ Model: ${upsInfo['upsBasicIdentModel'] || 'N/A'}
`;
        response += `└ Lokasi: ${upsInfo['sysLocation.0'] || 'N/A'}

`;
        
        // Status Baterai
        const batteryCapacity = parseFloat(upsInfo['upsHighPrecBatteryCapacity']);
        const runtime = parseInt(upsInfo['upsAdvBatteryRunTimeRemaining']);
        response += `🔋 *Status Baterai*
`;
        response += `├ Kapasitas: ${batteryCapacity || 0}%
`;
        response += `└ Runtime: ${formatTime(runtime || 0)}

`;
        
        // Input Power
        const inputVoltage = parseFloat(upsInfo['upsHighPrecInputLineVoltage']);
        const inputFrequency = parseFloat(upsInfo['upsHighPrecInputFrequency']);
        response += `⚡ *Input Power*
`;
        response += `├ Tegangan: ${roundToDecimal(inputVoltage) || 0} V
`;
        response += `└ Frekuensi: ${roundToDecimal(inputFrequency) || 0} Hz

`;
        
        // Output Power
        const outputVoltage = parseFloat(upsInfo['upsHighPrecOutputVoltage']);
        const outputCurrent = parseFloat(upsInfo['upsHighPrecOutputCurrent']);
        response += `🔌 *Output Power*
`;
        response += `├ Tegangan: ${roundToDecimal(outputVoltage) || 0} V
`;
        response += `└ Arus: ${roundToDecimal(outputCurrent) || 0} A

`;
        
        // Status Summary
        response += `📊 *Ringkasan Status*
`;
        response += `├ Status Baterai: ${batteryStatus}
`;
        response += `└ Status Power: ${powerStatus}
`;

        await sock.sendMessage(from, { text: response });
      } catch (error) {
        console.error('Error retrieving UPS information:', error);
        await sock.sendMessage(from, { text: `❌ *Sistem Error*\n\n⚠️ Gagal mengambil informasi UPS\n🔍 Error: ${error.message}\n\n💡 _Silakan coba beberapa saat lagi_\n❗ _Jika masalah berlanjut, silakan hubungi administrator._` });
      }
  }
  else if (text.startsWith('/suggestname')) {
    const parts = text.split(/ |\u00A0|'/);
    const domainPart = parts.find(part => part.startsWith('/domain:'));
    const typePart = parts.find(part => part.startsWith('/type:'));

    //console.log(domainPart);
    //console.log(typePart);
    sock.sendMessage(from,{text:`Please wait, your request is being processed...`});
    if (!domainPart || !typePart) {
      sock.sendMessage(from, `Command not correctly formatted. Please provide both /domain: and /type: in the command.`);
      return;
    }
    
    const domain = domainPart.split(':')[1];
    const type = typePart.split(':')[1];
    console.log(domain);
    console.log(type);
    
    if (!domain || !type) {
      sock.sendMessage(from, `Domain or type not provided. Please ensure the command is correctly formatted with /domain:<domain> and /type:<type>.`);
      return;
    }

    let prefix;
    let pcType;
    if (domain === 'bjp') {
        if (type === 'ws') {
            prefix = 'BJPPRDH';
            pcType = 'workstation';
        } else if (type === 'lt') {
            prefix = 'BJPPRLD';
            pcType = 'laptop';
        } else {
            sock.sendMessage(from, `Type not valid: ${type}`);
            return;
        }
    } else if (domain === 'bjs') {
        if (type === 'ws') {
            prefix = 'BJSPRDH';
            pcType = 'workstation';
        } else if (type === 'lt') {
            prefix = 'BJSPRLD';
            pcType = 'laptop';
        } else {
            sock.sendMessage(from, `Type not valid: ${type}`);
            return;
        }
    } else {
        sock.sendMessage(from, `Domain not valid: ${domain}`);
        return;
    }

    get_highest_number(domain, pcType, prefix)
    .then((maxNumber) => {
        const suggestedName = generate_suggested_name(prefix, maxNumber);
        sock.sendMessage(from, {text: `Suggested name: ${suggestedName}`});
    })
    .catch((error) => {
        console.error(`Error suggesting name: ${error}`);
        sock.sendMessage(from, {text:`Error suggesting name: Please check the logs on the server`});
        //client.sendMessage(msg.from, `Error suggesting name: ${error}`);
    });
  }
  else if (text.startsWith('/finddrive')) {
    try {
        const parts = text.split(/ |\u00A0|'/);
        if (parts.length < 2) {
            throw new Error("Drive letter not provided.");
        }
        
        const driveLetter = parts[1].toUpperCase();
        if (!drive.includes(driveLetter)) {
            throw new Error(`Drive ${driveLetter} not found.`);
        }

        const matchingFolders = folders.filter((folder, index) => drive[index] === driveLetter);

        if (matchingFolders.length > 0) {
            const response = `The corresponding folders for drive ${driveLetter} are:\n${matchingFolders
                .map((folder) => `* ${folder}\n   PATH: ${folder_path[folders.indexOf(folder)]}`)
                .join('\n')}`;
            await sock.sendMessage(from, { text: response });
        } else {
            throw new Error(`No folders found for drive ${driveLetter}.`);
        }
    } catch (error) {
        const response = `Error: ${error.message}`;
        await sock.sendMessage(from, { text: response });
    }
  }
  else if (text.startsWith('/sp')) {
    try {
        const parts = text.split(/ |\u00A0|'/);
        if (parts.length < 2) {
            throw new Error("Site name not provided.");
        }
        
        const siteName = parts[1].toLowerCase();
        if (!sharepointPath[siteName]) {
            throw new Error(`Site ${siteName} not found.`);
        }

        const response = `SharePoint path for ${siteName}:\n${sharepointPath[siteName]}`;
        await sock.sendMessage(from, { text: response });

    } catch (error) {
        const response = `Error: ${error.message}`;
        await sock.sendMessage(from, { text: response });
    }
  }



  else if (text.startsWith('/userdrive')) {
    try {
        const parts = text.split(/ |\u00A0|'/);
        if (parts.length < 2) {
            throw new Error("User Principal Name (UPN) not provided.");
        }

        const upn = parts[1];
        const { success, drives, error } = await getUserDrives(upn);

        if (success) {
            const response = `📂 *Drive Access Report*\n\n👤 *User:* ${upn}\n\n*Available Network Drives:*\n${drives.map(drive => `🔹 *${drive.driveLetter}:* ${drive.path}`).join('\n')}\n\n💡 _Total Drives: ${drives.length}_`;
            await sock.sendMessage(from, { text: response });
        } else {
            console.error(`Error getting user drives for ${upn}: ${error}`);
            await sock.sendMessage(from, { text: `❌ *Error Getting Drive Access*\n\n👤 User: ${upn}\n⚠️ Error: ${error}\n\n💡 _Please check if the username is correct and try again._` });
        }
    } catch (error) {
        console.error(`Error processing /userdrive command: ${error.message}`);
        await sock.sendMessage(from, { text: `❌ *Command Error*\n\n⚠️ ${error.message}\n\n💡 _Usage: /userdrive user@domain.com_` });
    }
}
if (text.startsWith('/zertoreport')) {
  try {
      const params = text.split(' ');
      const locationParam = params[1];
      const txtParam = params.find(param => param === '/txt');

      await sock.sendMessage(from, {text: `🔄 Collecting Zerto data... Please wait...`});
      
      if (txtParam) {
          // Generate text report only
          if (locationParam === 'jakarta') {
              // Jakarta only
              const result = await processZertoLocation('jakarta');
              await sock.sendMessage(from, { text: result.message });
          } else if (locationParam === 'jepara') {
              // Jepara only
              const result = await processZertoLocation('jepara');
              await sock.sendMessage(from, { text: result.message });
          } else {
              // Combined report for both locations
              const result = await processZertoBothLocations();
              await sock.sendMessage(from, { text: result.message });
          }
      } else {
          // Default: Generate professional table image
          let vmData = [];
          let locationName = '';
          
          if (locationParam === 'jakarta') {
              const result = await processZertoLocation('jakarta');
              vmData = (result.vmData || []).map(vm => ({...vm, location: 'DC Jakarta'}));
              locationName = 'DC Jakarta';
          } else if (locationParam === 'jepara') {
              const result = await processZertoLocation('jepara');
              vmData = (result.vmData || []).map(vm => ({...vm, location: 'MINI DC Jepara'}));
              locationName = 'MINI DC Jepara';
          } else {
              // Combined data from both locations
              const jakartaResult = await processZertoLocation('jakarta');
              const jeparaResult = await processZertoLocation('jepara');
              
              // Add location information to each VM
              const jakartaVMs = (jakartaResult.vmData || []).map(vm => ({...vm, location: 'DC Jakarta'}));
              const jeparaVMs = (jeparaResult.vmData || []).map(vm => ({...vm, location: 'MINI DC Jepara'}));
              
              vmData = [...jakartaVMs, ...jeparaVMs];
              locationName = 'DC Jakarta & MINI DC Jepara';
          }

          if (vmData.length === 0) {
              await sock.sendMessage(from, { text: `❌ *No VM Data Found*\n\nTidak ada data VM yang ditemukan untuk lokasi yang diminta.` });
              return;
          }

          // Generate HTML table and capture as image
          const htmlTable = generateZertoTableHTML(vmData, locationName);
          const imageBuffer = await captureTableAsImage(htmlTable);
          
          // Generate proper WhatsApp message caption
          const caption = generateTableCaption(vmData, locationName);
          
          // Send image with WhatsApp message format caption
          await sock.sendMessage(from, {
            image: imageBuffer,
            caption: caption
          });
      }
  } catch (error) {
      console.error('Error in Zerto report:', error);
      await sock.sendMessage(from, { 
          text: `❌ *Error Zerto Report*\n\n⚠️ ${error.message}\n\n💡 Silakan coba lagi atau hubungi administrator.` 
      });
  }
}


//  else if (text.startsWith('/zertoreport')) {
//     try {
//       // Capture Zerto data
//       // Get current date and time
//       const currentDateTimeInfo = getCurrentDateTime();
//       // Extract location from the command
//       const locationParam = text.split(' ')[1];

//       // Send the images with captions based on the location parameter
//       if (locationParam === 'jkt') {
//         const zertoDC = await captureZertoWithLogin('https://192.168.120.250:9669/main/vms');
//         // Generate prompt with the captured content
//         const summaryPrompt = generateSummaryPrompt(currentDateTimeInfo)+'Zerto Site DC: \n'+zertoDC.copiedContent;
//         const aiResponse = await answerAI(summaryPrompt);
//         const media = new MessageMedia('image/png', zertoDC.screenshotBuffer.toString('base64'));
//         //const media = MessageMedia.fromFilePath(screenshotPath);
//         await sock.sendMessage(from, media, { caption: aiResponse });
//       } else if (locationParam === 'jpr') {
//         const zertoMiniDC = await captureZertoWithLogin('https://192.168.77.250:9669/main/vms');
//         // Generate prompt with the captured content
//         const summaryPrompt = generateSummaryPrompt(currentDateTimeInfo)+'Zerto Site Mini DC: \n'+zertoMiniDC.copiedContent;
//         const aiResponse = await answerAI(summaryPrompt);
//         const media = new MessageMedia('image/png', zertoMiniDC.screenshotBuffer.toString('base64'));
//         //const media = MessageMedia.fromFilePath(screenshotPath);
//         await sock.sendMessage(from, media, { caption: aiResponse });
//       } else {
//         const zertoDC = await captureZertoWithLogin('https://192.168.120.250:9669/main/vms');
//         const zertoMiniDC = await captureZertoWithLogin('https://192.168.77.250:9669/main/vms');
//         // Generate prompt with the captured content
//         const summaryPrompt = generateSummaryPrompt(currentDateTimeInfo)+'Zerto DC: \n'+zertoDC.copiedContent +'\n'+'Zerto MINI DC: \n'+ zertoMiniDC.copiedContent;
//         const aiResponse = await answerAI(summaryPrompt);
//         const media1 = new MessageMedia('image/png', zertoDC.screenshotBuffer.toString('base64'));
//         //const media = MessageMedia.fromFilePath(screenshotPath);
//         await sock.sendMessage(from, media1, { caption: aiResponse });

//         const media2 = new MessageMedia('image/png', zertoMiniDC.screenshotBuffer.toString('base64'));
//         //const media = MessageMedia.fromFilePath(screenshotPath);
//         await sock.sendMessage(from, media2, { caption: 'Zerto Mini DC' });
//       }


//       //const { screenshotBuffer, copiedContent } = await captureZertoWithLogin();
//       //const zertoDC = await captureZertoWithLogin('https://192.168.120.250:9669/main/vms');


//       // Generate prompt with the captured content
//       //const summaryPrompt = generateSummaryPrompt(currentDateTimeInfo)+zertoDC.copiedContent;
//       //const summaryPrompt = generateSummaryPrompt(currentDateTimeInfo)+copiedContent;
      
//       //console.log(summaryPrompt);
//       // Log the copied content to the console
//       //console.log(`Copied Content: ${zertoDC.copiedContent}`);
//       // Get AI response
//       //const aiResponse = await answerAI(summaryPrompt);
//       //console.log(aiResponse)
//       // Send the captured screenshot as an image media with AI response as caption
//       //const media = new MessageMedia('image/png', zertoDC.screenshotBuffer.toString('base64'));
//       //const media = MessageMedia.fromFilePath(screenshotPath);
//       //await client.sendMessage(msg.from, media, { caption: aiResponse });


//     } catch (error) {
//       // Handle the error when capturing Zerto screenshot
//       await client.sendMessage(msg.from, 'Error capturing Zerto screenshot. Please try again later.');
//     }
//   }
  
};

const extractFileName = (message) => {
  return message.message.documentMessage ? message.message.documentMessage.fileName :
    message.message.documentWithCaptionMessage ? message.message.documentWithCaptionMessage.message.documentMessage.fileName : null;
};

const extractMessageContent = (message) => {
  if (message.message) {
      if (message.message.conversation) return message.message.conversation;
      if (message.message.imageMessage) return message.message.imageMessage.caption || '';
      if (message.message.videoMessage) return message.message.videoMessage.caption || '';
      if (message.message.documentMessage) return message.message.documentMessage.caption || '';
      if (message.message.extendedTextMessage) return message.message.extendedTextMessage.text;
      if (message.message.buttonsResponseMessage) return message.message.buttonsResponseMessage.selectedButtonId;
      if (message.message.listResponseMessage) return message.message.listResponseMessage.singleSelectReply.selectedRowId;
      if (message.message.templateButtonReplyMessage) return message.message.templateButtonReplyMessage.selectedId;
  }
  return '';
};

const startSock = async () => {
    try {
        console.log('Fetching latest Baileys version...');
        const { version } = await fetchLatestBaileysVersion();
        console.log('Using Baileys version:', version);

        console.log('Initializing auth state...');
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_wsapi');
        console.log('Auth state initialized');

        console.log('Creating WhatsApp socket...');
        sock = makeWASocket({
            version,
            auth: state,
            logger: Pino({ level: 'silent' }),
            browser: Browsers.windows('Desktop'),
            syncFullHistory: false,
            printQRInTerminal: true

        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            console.log('Connection update:', update);
            if (connection === 'close') {
              const shouldReconnect = (lastDisconnect.error = new Boom(lastDisconnect?.error))?.output?.statusCode !== DisconnectReason.loggedOut;
              console.log('Connection closed, should reconnect:', shouldReconnect);
              if (shouldReconnect) {
                  startSock();
              }
            } else if (connection === 'open') {
                console.log('Connected to WhatsApp');
                console.log('Connection opened');
                currentStatus = 'WhatsApp is ready!';
                currentQr = null;
                io.emit('ready', currentStatus);
                io.emit('message', currentStatus);
                // Fetch and log all groups
                await listGroups();
        
                // Test sending a message after connection is established
                const testNumber = phoneNumberFormatter('08995549933');
                const testMessage = 'Systex Asia Whatsapp API Started!';
                console.log('Testing sendMessage with number:', testNumber);
                try {
                    const response = await sock.sendMessage(testNumber, { text: testMessage });
                    console.log('Test message sent:', response);
                } catch (err) {
                    console.error('Error sending test message:', err);
                }
            }
            if (qr) {
              console.log('QR received:', qr);
              qrcode.toDataURL(qr, (err, url) => {
                if (err) {
                  console.error('Error generating QR code:', err);
                } else {
                  console.log('Emitting QR code');
                  currentQr = url;
                  io.emit('qr', url);
                  currentStatus = 'QR Code received, scan please!';
                  io.emit('message', currentStatus);
                }
              });
            }
        });
        
        // Add this event listener to handle incoming messages
        sock.ev.on('messages.upsert', async (m) => {
          if (m.type !== 'notify') return;
          const message = m.messages[0];
          if (!message?.message) return;
          // unwrap ephemeral messages
          message.message = Object.keys(message.message)[0] === "ephemeralMessage" ? message.message.ephemeralMessage.message : message.message;

          // Deduplication guard: ignore messages that have already been processed for this chat
          const chatId = message?.key?.remoteJid;
          const msgId = message?.key?.id;
          const fromMe = message?.key?.fromMe;
          if (fromMe) {
            console.log('Ignoring message from self:', msgId);
            return;
          }
          if (!chatId || !msgId) {
            console.log('Skipping message without chatId/msgId');
            return;
          }
          const set = processedMessages.get(chatId) || new Set();
          if (set.has(msgId)) {
            console.log('Duplicate message ignored:', chatId, msgId);
            return;
          }
          set.add(msgId);
          // Prevent unbounded growth (simple cap)
          if (set.size > 500) {
            // reset the set when it becomes too large
            processedMessages.set(chatId, new Set([msgId]));
          } else {
            processedMessages.set(chatId, set);
          }

          console.log('Received a new message:', message);

          // Differentiating message content
          const body = extractMessageContent(message);
          
          if (body) {
              console.log(body);
              await handleMessage(message);
          } else {
              console.log('Received a message without text content:', message);
          }
        });
        sock.ev.on('auth_failure', (session) => {
            console.log('Authentication failed');
            currentStatus = 'Auth failure, restarting...';
            io.emit('message', currentStatus);
        });
        sock.ev.on('disconnected', (reason) => {
            console.log('Disconnected:', reason);
            currentStatus = 'WhatsApp is disconnected!';
            io.emit('message', currentStatus);
            sock.destroy();
            startSock();
        });
        console.log('Socket created, waiting for connection updates...');

  } 
  catch (error) {
        console.error('Error in startSock:', error);
  }
};

console.log('Starting WhatsApp socket...');
startSock();


// Zerto API Endpoints

// Get Zerto report for a specific location
app.get('/zerto/:location', async (req, res) => {
    try {
        const location = req.params.location;
        
        if (!['jepara', 'jakarta', 'jpr', 'jkt'].includes(location.toLowerCase())) {
            return res.status(400).json({
                success: false,
                error: 'Invalid location. Use: jepara, jakarta, jpr, or jkt'
            });
        }
        
        console.log(`Processing Zerto data for location: ${location}`);
        const result = await processZertoLocation(location);
        
        if (result.success) {
            // Generate single location WhatsApp message
            const jeparaVms = location.toLowerCase().includes('jep') ? result.data.rpoData : [];
            const jakartaVms = location.toLowerCase().includes('jak') ? result.data.rpoData : [];
            const whatsappMessage = generateZertoWhatsAppMessage(jeparaVms, jakartaVms);
            
            res.json({
                success: true,
                location: result.location,
                message: whatsappMessage,
                data: result.data
            });
        } else {
            res.status(500).json({
                success: false,
                location: result.location,
                error: result.error,
                message: `❌ *Error mengambil data Zerto ${location.toUpperCase()}*\n\n⚠️ ${result.error}\n\n💡 Silakan coba lagi atau hubungi administrator.`
            });
        }
        
    } catch (error) {
        console.error('Error in /zerto/:location endpoint:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get Zerto report for both locations
app.get('/zerto', async (req, res) => {
    try {
        console.log('Processing Zerto data for both locations');
        const result = await processZertoBothLocations();
        
        res.json(result);
        
    } catch (error) {
        console.error('Error in /zerto endpoint:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: `❌ *Error mengambil data Zerto*\n\n⚠️ ${error.message}\n\n💡 Silakan coba lagi atau hubungi administrator.`
        });
    }
});

// Send Zerto WhatsApp message for a specific location
app.post('/zerto/:location/send', [
    body('number').optional().trim(),
    body('group').optional().trim()
], async (req, res) => {
    try {
        const location = req.params.location;
        const { number, group } = req.body;
        
        if (!['jepara', 'jakarta', 'jpr', 'jkt'].includes(location.toLowerCase())) {
            return res.status(400).json({
                success: false,
                error: 'Invalid location. Use: jepara, jakarta, jpr, or jkt'
            });
        }
        
        if (!number && !group) {
            return res.status(400).json({
                success: false,
                error: 'Either number or group must be provided'
            });
        }
        
        console.log(`Processing and sending Zerto data for location: ${location}`);
        const result = await processZertoLocation(location);
        
        if (!result.success) {
            return res.status(500).json({
                success: false,
                location: result.location,
                error: result.error
            });
        }
        
        // Generate single location WhatsApp message
        const jeparaVms = location.toLowerCase().includes('jep') ? result.data.rpoData : [];
        const jakartaVms = location.toLowerCase().includes('jak') ? result.data.rpoData : [];
        const whatsappMessage = generateZertoWhatsAppMessage(jeparaVms, jakartaVms);
        
        // Send WhatsApp message
        let sendResult;
        if (number) {
            const formattedNumber = phoneNumberFormatter(number);
            const isRegistered = await checkRegisteredNumber(formattedNumber);
            
            if (!isRegistered) {
                return res.status(422).json({
                    success: false,
                    error: 'The number is not registered'
                });
            }
            
            sendResult = await sock.sendMessage(formattedNumber, { text: whatsappMessage });
        } else if (group) {
            const groupObj = await findGroupByName(group);
            if (!groupObj) {
                return res.status(422).json({
                    success: false,
                    error: `No group found with name: ${group}`
                });
            }
            
            sendResult = await sock.sendMessage(groupObj.id, { text: whatsappMessage });
        }
        
        res.json({
            success: true,
            location: result.location,
            message: whatsappMessage,
            data: result.data,
            sendResult: sendResult
        });
        
    } catch (error) {
        console.error(`Error in /zerto/${req.params.location}/send endpoint:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Send Zerto WhatsApp message for both locations
app.post('/zerto/send', [
    body('number').optional().trim(),
    body('group').optional().trim()
], async (req, res) => {
    try {
        const { number, group } = req.body;
        
        if (!number && !group) {
            return res.status(400).json({
                success: false,
                error: 'Either number or group must be provided'
            });
        }
        
        console.log('Processing and sending Zerto data for both locations');
        const result = await processZertoBothLocations();
        
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }
        
        // Send WhatsApp message
        let sendResult;
        if (number) {
            const formattedNumber = phoneNumberFormatter(number);
            const isRegistered = await checkRegisteredNumber(formattedNumber);
            
            if (!isRegistered) {
                return res.status(422).json({
                    success: false,
                    error: 'The number is not registered'
                });
            }
            
            sendResult = await sock.sendMessage(formattedNumber, { text: result.message });
        } else if (group) {
            const groupObj = await findGroupByName(group);
            if (!groupObj) {
                return res.status(422).json({
                    success: false,
                    error: `No group found with name: ${group}`
                });
            }
            
            sendResult = await sock.sendMessage(groupObj.id, { text: result.message });
        }
        
        res.json({
            success: true,
            message: result.message,
            data: result.data,
            sendResult: sendResult
        });
        
    } catch (error) {
        console.error('Error in /zerto/send endpoint:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/send-message', [
    body('number').trim().notEmpty().withMessage('Number cannot be empty'),
    body('message').trim().notEmpty().withMessage('Message cannot be empty')
], async (req, res) => {
    console.log('Received request data:', req.body);

    const errors = validationResult(req).formatWith(({ msg }) => msg);
    if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.mapped());
        return res.status(422).json({
            status: false,
            message: errors.mapped()
        });
    }

    const number = phoneNumberFormatter(req.body.number);
    const message = req.body.message;

    console.log('Formatted number:', number);

    const isRegisteredNumber = await checkRegisteredNumber(number);

    if (!isRegisteredNumber) {
        return res.status(422).json({
            status: false,
            message: 'The number is not registered'
        });
    }

    try {
        const response = await sock.sendMessage(number, { text: message });
        console.log('Message sent:', response);
        res.status(200).json({
            status: true,
            response: response
        });
    } catch (err) {
        console.error('Error sending message:', err);
        res.status(500).json({
            status: false,
            response: err.toString()
        });
    }
});

app.post('/send-group-message', [
    body('id').custom((value, { req }) => {
        if (!value && !req.body.name) {
            throw new Error('Invalid value, you can use `id` or `name`');
        }
        return true;
    }),
    body('message').notEmpty().withMessage('Message cannot be empty')
], async (req, res) => {
    console.log('Received group message request data:', req.body);

    const errors = validationResult(req).formatWith(({ msg }) => msg);
    if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.mapped());
        return res.status(422).json({
            status: false,
            message: errors.mapped()
        });
    }

    let chatId = req.body.id;
    const groupName = req.body.name;
    const message = req.body.message;

    if (!chatId) {
        const group = await findGroupByName(groupName);
        if (!group) {
            return res.status(422).json({
                status: false,
                message: 'No group found with name: ' + groupName
            });
        }
        chatId = group.id;
    }

    try {
        sock.sendMessage(chatId, { text: message }).then(response => {
            console.log('Group message sent:', response);
            res.status(200).json({
                status: true,
                response: response
            });
        }).catch(err => {
            console.error('Error sending group message:', err);
            res.status(500).json({
                status: false,
                response: err.toString()
            });
        });
    } catch (err) {
        console.error('Error sending group message:', err);
        res.status(500).json({
            status: false,
            response: err.toString()
        });
    }
});

app.get('/pair-code', async (req, res) => {
  try {
    if (!sock) {
      return res.status(503).json({ success: false, error: 'Socket not initialized' });
    }
    const raw = String(req.query.number || '').trim();
    if (!raw) {
      return res.status(400).json({ success: false, error: 'Missing number query param' });
    }
    const formatted = phoneNumberFormatter(raw).replace('@c.us', '');
    const code = await sock.requestPairingCode(formatted);
    res.json({ success: true, number: formatted, code });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Reset session to force QR re-pairing
app.post('/reset-session', async (req, res) => {
  try {
    if (sock) {
      try {
        await sock.logout();
      } catch (e) {}
    }
    currentQr = null;
    currentStatus = 'Resetting session...';
    io.emit('message', currentStatus);
    const authDirs = ['auth_info_wsapi', 'auth_info'];
    for (const dir of authDirs) {
      const dirPath = path.join(__dirname, dir);
      if (fs.existsSync(dirPath)) {
        try {
          fs.rmSync(dirPath, { recursive: true, force: true });
        } catch (e) {}
      }
    }
    await new Promise(r => setTimeout(r, 500));
    startSock();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get current QR image (Data URL)
app.get('/qr', async (req, res) => {
  try {
    if (!currentQr) {
      return res.status(404).json({ success: false, error: 'QR not available' });
    }
    res.json({ success: true, dataUrl: currentQr });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
// });

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
