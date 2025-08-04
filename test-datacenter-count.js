// Test script to verify data center counting logic

// Mock VM data with location property (as it would be in the actual zertoreport command)
const mockVmData = [
  { vmName: 'server1', location: 'DC Jakarta', rpoSeconds: 5 },
  { vmName: 'server2', location: 'DC Jakarta', rpoSeconds: 3 },
  { vmName: 'server3', location: 'DC Jakarta', rpoSeconds: 7 },
  { vmName: 'server4', location: 'MINI DC Jepara', rpoSeconds: 4 },
  { vmName: 'server5', location: 'MINI DC Jepara', rpoSeconds: 6 },
  { vmName: 'server6', location: 'DC Jakarta', rpoSeconds: 2 },
  { vmName: 'server7', location: 'MINI DC Jepara', rpoSeconds: 5 },
  { vmName: 'server8', location: 'DC Jakarta', rpoSeconds: 4 },
  { vmName: 'server9', location: 'MINI DC Jepara', rpoSeconds: 3 },
  { vmName: 'server10', location: 'DC Jakarta', rpoSeconds: 6 }
];

// Test the counting logic
const jeparaVms = mockVmData.filter(vm => vm.location && vm.location.includes('MINI DC Jepara')).length;
const jakartaVms = mockVmData.filter(vm => vm.location && vm.location.includes('DC Jakarta')).length;
const totalVms = mockVmData.length;

console.log('=== Data Center Counting Test ===');
console.log(`Total VMs: ${totalVms}`);
console.log(`MINI DC Jepara VMs: ${jeparaVms}`);
console.log(`DC Jakarta VMs: ${jakartaVms}`);
console.log(`Sum check: ${jeparaVms + jakartaVms} (should equal ${totalVms})`);

// Test the message generation
let message = `📊 Ringkasan per Data Center:\n`;
if (jeparaVms > 0) {
  message += `🏢 MINI DC Jepara: ${jeparaVms} server - ✅ Semua OK\n`;
}
if (jakartaVms > 0) {
  message += `🏢 DC Jakarta: ${jakartaVms} server - ✅ Semua OK\n`;
}

console.log('\n=== Generated Message ===');
console.log(message);