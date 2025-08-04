#!/usr/bin/env node

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Setting up Chrome for Puppeteer...');

// Create puppeteer-cache directory if it doesn't exist
const cacheDir = path.join(__dirname, 'puppeteer-cache');

// Set Puppeteer cache directory environment variable
process.env.PUPPETEER_CACHE_DIR = cacheDir;
console.log(`Setting PUPPETEER_CACHE_DIR to: ${cacheDir}`);
if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
    console.log('✅ Created puppeteer-cache directory');
}

// Install Chrome using Puppeteer
const installCommand = `npx puppeteer browsers install chrome --path "${cacheDir}"`;

console.log('📦 Installing Chrome...');
console.log(`Command: ${installCommand}`);

exec(installCommand, (error, stdout, stderr) => {
    if (error) {
        console.error('❌ Error installing Chrome:', error);
        return;
    }
    
    if (stderr) {
        console.log('⚠️  Warnings:', stderr);
    }
    
    console.log('📋 Installation output:');
    console.log(stdout);
    
    // Check if Chrome was installed successfully
    const chromePattern = /chrome@[\d.]+\s+(.+chrome\.exe)/;
    const match = stdout.match(chromePattern);
    
    if (match) {
        const chromePath = match[1];
        console.log('✅ Chrome installed successfully!');
        console.log(`📍 Chrome executable path: ${chromePath}`);
        
        // Verify the file exists
        if (fs.existsSync(chromePath)) {
            console.log('✅ Chrome executable verified');
            console.log('🎉 Setup complete! You can now run the WhatsApp API server.');
        } else {
            console.log('⚠️  Chrome executable not found at expected path');
        }
    } else {
        console.log('⚠️  Could not determine Chrome installation path from output');
    }
});