const Service = require('node-windows').Service;
const path = require('path');

// Create a new service object
const svc = new Service({
  name: 'Systex Asia Whatsapp API',
  description: 'Systex Asia Whatsapp API Service',
  script: path.join(__dirname, 'index.js')
});

// Get command line argument
const action = process.argv[2];

// Listen for the "install" event, which indicates the service is installed
svc.on('install', function () {
  console.log('Service installed successfully!');
  svc.start();
});

// Listen for the "uninstall" event
svc.on('uninstall', function () {
  console.log('Service uninstalled successfully!');
});

// Listen for the "start" event
svc.on('start', function () {
  console.log('Service started successfully!');
});

// Listen for the "stop" event
svc.on('stop', function () {
  console.log('Service stopped successfully!');
});

// Handle different actions based on command line argument
if (action === 'install') {
  console.log('Installing Systex Asia Whatsapp API service...');
  svc.install();
} else if (action === 'uninstall') {
  console.log('Uninstalling Systex Asia Whatsapp API service...');
  svc.uninstall();
} else {
  console.log('Usage: node service.js [install|uninstall]');
  console.log('');
  console.log('Commands:');
  console.log('  install   - Install the Systex Asia Whatsapp API service');
  console.log('  uninstall - Uninstall the Systex Asia Whatsapp API service');
  process.exit(1);
}