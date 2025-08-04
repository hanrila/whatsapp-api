// Test script to verify Zerto report message generation
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

// Function to generate WhatsApp caption for table image (simplified version)
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
  
  // Build caption message
  let message = `${greeting}, berikut adalah laporan hasil replikasi Zerto pada hari ${formattedDate} pukul ${formattedTime}.\n\n`;
  
  // Main status message
  if (rpoIssues === 0) {
    message += `✅ Semua ${totalVms} server dari ${locationName} memenuhi SLA dengan RPO time kurang dari 15 menit (maksimal: ${maxRpo} detik).\n\n`;
  } else {
    message += `⚠️ Ditemukan ${rpoIssues} server dengan RPO > 15 menit dari total ${totalVms} server.\n\n`;
  }
  
  // Add overall summary
  message += `📈 Total Keseluruhan:\n`;
  message += `• Total Server: ${totalVms}\n`;
  message += `• RPO Maksimal: ${maxRpo} detik\n`;
  message += `• Server Bermasalah: ${rpoIssues}`;
  
  return message;
}

// Test data
const testVmData = [
  { vmName: 'test-vm-1', actualRpo: 5 },
  { vmName: 'test-vm-2', actualRpo: 8 },
  { vmName: 'test-vm-3', actualRpo: 12 }
];

// Test the function
console.log('Testing Zerto report message generation:');
console.log('===========================================');

const result = generateTableCaption(testVmData, 'MINI DC Jepara');
console.log(result);

console.log('\n===========================================');
console.log('Testing getCurrentDateTime separately:');
const dateTime = getCurrentDateTime();
console.log('formattedDate:', dateTime.formattedDate);
console.log('formattedTime:', dateTime.formattedTime);