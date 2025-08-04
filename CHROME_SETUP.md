# Chrome Setup for WhatsApp API

This guide helps you set up Chrome for Puppeteer on any server for the Zerto report functionality.

## Quick Setup

Run the automated setup script:

```bash
node setup-chrome.js
```

## Manual Setup

If you prefer to set up Chrome manually:

1. Create the puppeteer-cache directory:
   ```bash
   mkdir puppeteer-cache
   ```

2. Install Chrome for Puppeteer:
   ```bash
   npx puppeteer browsers install chrome --path "./puppeteer-cache"
   ```

## How It Works

The application automatically detects Chrome using the `getChromeExecutablePath()` function:

1. **Environment Variable**: Sets `PUPPETEER_CACHE_DIR` to force Puppeteer to use the project directory
2. **Dynamic Path Detection**: Searches for Chrome in the `puppeteer-cache` directory
3. **Version Flexibility**: Automatically finds any Chrome version installed (not hardcoded to specific version)
4. **Fallback Mechanism**: If Chrome is not found in cache, Puppeteer will attempt to use system Chrome
5. **Logging**: Provides detailed logs to help troubleshoot Chrome detection issues

## Cross-Server Compatibility

The Chrome path is now dynamically determined using:
- `__dirname` to get the current project directory
- `path.join()` for cross-platform path handling
- `fs.existsSync()` to check if Chrome exists before using it

This ensures the application works on:
- Different drive letters (C:, D:, E:, etc.)
- Different server paths
- Windows and Linux systems
- Development and production environments

## Testing Chrome Configuration

Run the test script to verify Chrome setup:
```bash
node test-chrome.js
```

This script will:
- Test Puppeteer with the configured Chrome
- Test nodeHtmlToImage with the configured Chrome
- Show detailed logs of the Chrome detection process
- Verify both tools can successfully launch Chrome

## Troubleshooting

### Chrome Not Found Error
If you see "Chrome not found" errors:

1. Run the setup script: `node setup-chrome.js`
2. Check if Chrome was installed: Look for `puppeteer-cache/chrome/` directory
3. Restart the application after Chrome installation

### Permission Issues
If you encounter permission errors:

1. Run the command prompt as Administrator
2. Or install Chrome in a user-accessible directory
3. Ensure the application has read access to the Chrome executable

### Service Installation
When running as a Windows service:

1. Install Chrome before installing the service
2. The service will use the Chrome installation in the project directory
3. No additional configuration needed

### Common Issues

1. **Permission Errors**: Make sure the application has write permissions to the project directory
2. **Network Issues**: Ensure internet connection for downloading Chrome
3. **Antivirus Blocking**: Some antivirus software may block Chrome download
4. **Disk Space**: Ensure sufficient disk space (Chrome requires ~200MB)
5. **Service Environment**: When running as Windows service, ensure the service account has access to the project directory

### Verification

Check if Chrome is properly installed:
```bash
# Check if Chrome directory exists
dir puppeteer-cache\chrome

# Look for chrome.exe
dir puppeteer-cache\chrome\win64-*\chrome-win64\chrome.exe

# Run the test script
node test-chrome.js
```

## File Structure

After setup, your directory should look like:
```
whatsapp-api/
├── puppeteer-cache/
│   └── chrome/
│       └── win64-[version]/
│           └── chrome-win64/
│               └── chrome.exe
├── setup-chrome.js
├── index.js
└── ...
```