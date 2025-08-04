const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
//const {default: makeWASocket,AnyMessageContent, BinaryInfo, delay, DisconnectReason, encodeWAM, fetchLatestBaileysVersion, getAggregateVotesInPollMessage, makeCacheableSignalKeyStore, makeInMemoryStore, PHONENUMBER_MCC, proto, useMultiFileAuthState, WAMessageContent, WAMessageKey}= require('@whiskeysockets/baileys');
//import { WAMessageKey, WAMessageContent, proto } from '@whiskeysockets/baileys';

const express = require('express');
const { body, validationResult } = require('express-validator');
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
const path = require('path');
const server = require('http').createServer(app);
const io = require('socket.io')(server);

//Excel file handling
const ExcelJS = require('exceljs');
const fs = require('fs');
const { downloadContentFromMessage, downloadMediaMessage } = require('@whiskeysockets/baileys');
const mime = require('mime-types');


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
    url: 'ldaps://192.168.75.100:636',
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
  'RECRUITMENT',
  'DOCUMENT REVIEW'
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
  'ACL_RECRUITMENT',
  'ACL_BJP DOCUMENT REVIEW'
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
  'ACL_BJS RECRUITMENT',
  'ACL_BJS DOCUMENT REVIEW'
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

const drive = ['L', 'M', 'R', 'T', 'Q', 'Q', 'W', 'X', 'Y', 'Z', 'N', 'O', 'K', 'J', 'I', 'V', 'H', 'U', 'G'];

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
  "\\shared\\RECRUITMENT\\",
  "\\shared\\OPERATION\\DOCUMENT CONTROL\\DOCUMENT REVIEW\\"
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

//Zerto report
function getCurrentDateTime() {
  const currentDate = new Date();

  // Format the current date and time
  const formattedDateTime = currentDate.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    weekday: 'long',
  });

  // Get individual components of the date and time
  const year = currentDate.getFullYear();
  const month = currentDate.toLocaleString('id-ID', { month: 'long' });
  const date = currentDate.getDate();
  const day = currentDate.toLocaleString('id-ID', { weekday: 'long' });
  const hours = currentDate.getHours().toString().padStart(2, '0'); // Ensure two digits
  const minutes = currentDate.getMinutes().toString().padStart(2, '0'); // Ensure two digits

  // Greeting based on the hour of the day
  let greeting = '';
  if (hours < 11) {
    greeting = 'pagi';
  } else if (hours >= 11 && hours < 15) {
    greeting = 'siang';
  } else if (hours >= 15 && hours < 18) {
    greeting = 'sore';
  } else {
    greeting = 'malam';
  }

  return {
    formattedDateTime,
    year,
    month,
    date,
    day,
    hours,
    minutes,
    greeting,
  };
}

async function captureZertoWithLogin(zertoUrl) {
  try {
      console.log(`Launching browser...`);
      const browser = await puppeteer.launch({
        executablePath: 'C:\\Users\\administrator.PT-BJP\\.cache\\puppeteer\\chrome\\win64-125.0.6422.78\\chrome-win64\\chrome.exe',
          headless: false,
          ignoreHTTPSErrors: true,
          args: ['--disable-gpu', '--disable-software-rasterizer'],
      });

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
  const { greeting, day, date, month, year, hours, minutes } = dateTimeInfo;

  // Using a multiline template string
  const prompt = `
  buatkan summary singkat laporan hasil replikasi Zerto. awali dengan Selamat ${greeting} team, sebutkan hari ${day}, ${date} ${month} ${year} pukul ${hours}:${minutes}.
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
      usage: '/zertoreport [location]',
      description: 'Generate Zerto report (jkt=DC, jpr=Mini DC)',
      example: '/zertoreport jkt',
      category: 'System Information'
    },
    sp: {
      usage: '/sp <site name>',
      description: 'Show SharePoint path for specific site',
      sites: 'legal, bdlog, bjphrga, bjshrga, facc, csr, site, opr, jtm, hse, mmt, emt, eng, prc, act, officelimited, officeall',
      example: '/sp legal',
      category: 'Resource Management'
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
                    const isExpired = new Date(pwdExpiryDate) < new Date();
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
      // Capture Zerto data
      const currentDateTimeInfo = getCurrentDateTime();
      const locationParam = text.split(' ')[1];

      sock.sendMessage(from,{text: `Please be patient.. we are composting the report for you..`});
      // Function to capture Zerto data and send message
      const sendZertoReport = async (url, captionPrefix) => {
          const zertoData = await captureZertoWithLogin(url);
          const summaryPrompt = generateSummaryPrompt(currentDateTimeInfo) + captionPrefix + zertoData.copiedContent;
          const aiResponse = await answerAI(summaryPrompt);
          await sock.sendMessage(from, {
              image: zertoData.screenshotBuffer,
              caption: aiResponse
          });
      };

      if (locationParam === 'jkt') {
          await sendZertoReport('https://192.168.120.250/main/vms', 'Zerto Site DC: \n');
      } else if (locationParam === 'jpr') {
          await sendZertoReport('https://192.168.77.250/main/vms', 'Zerto Site Mini DC: \n');
      } else {
          const zertoDC = await captureZertoWithLogin('https://192.168.120.250/main/vms');
          const zertoMiniDC = await captureZertoWithLogin('https://192.168.77.250/main/vms');
          const summaryPrompt = generateSummaryPrompt(currentDateTimeInfo) + 'Zerto DC: \n' + zertoDC.copiedContent + '\n' + 'Zerto MINI DC: \n' + zertoMiniDC.copiedContent;
          const aiResponse = await answerAI(summaryPrompt);

          await sock.sendMessage(from, {
              image: zertoDC.screenshotBuffer,
              caption: aiResponse
          });

          await sock.sendMessage(from, {
              image: zertoMiniDC.screenshotBuffer,
              caption: 'Zerto Mini DC'
          });
      }
  } catch (error) {
      console.error('Error capturing Zerto screenshot:', error);
      await sock.sendMessage(from, { text: 'Error capturing Zerto screenshot. Please try again later.' });
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

// const extractMessageContent = (message) => {
//   return message.message.conversation ? message.message.conversation :
//     message.message.imageMessage ? message.message.imageMessage.caption :
//     message.message.documentMessage ? message.message.documentMessage.caption :
//     message.message.documentWithCaptionMessage ? message.message.documentWithCaptionMessage.message.documentMessage.caption :
//     message.message.videoMessage ? message.message.videoMessage.caption :
//     message.message.extendedTextMessage ? message.message.extendedTextMessage.text :
//     message.message.buttonsResponseMessage ? message.message.buttonsResponseMessage.selectedButtonId :
//     message.message.listResponseMessage ? message.message.listResponseMessage.singleSelectReply.selectedRowId :
//     message.message.templateButtonReplyMessage ? message.message.templateButtonReplyMessage.selectedId :
//     message.message.buttonsResponseMessage?.selectedButtonId || message.message.listResponseMessage?.singleSelectReply.selectedRowId || message.text;
// };
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
        const { state, saveCreds } = await useMultiFileAuthState('auth_info');
        console.log('Auth state initialized');

        console.log('Creating WhatsApp socket...');
        sock = makeWASocket({
            version,
            auth: state,
            logger: Pino({ level: 'silent' }),
            //browser: Browsers.macOS('Desktop'),
            syncFullHistory: true,
            printQRInTerminal: false // This ensures the QR code is printed in the terminal

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
                const testMessage = 'NOA Whatsapp API Started!';
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
          if (!message.message) return;
          message.message = Object.keys(message.message)[0] === "ephemeralMessage" ? message.message.ephemeralMessage.message : message.message;
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

// app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
// });

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
