// Test script to verify getCurrentDateTime function
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

// Test the function
console.log('Testing getCurrentDateTime function:');
const result = getCurrentDateTime();
console.log('Result:', result);
console.log('formattedDate:', result.formattedDate);
console.log('formattedTime:', result.formattedTime);

// Test the message format
const testMessage = `Selamat pagi Team, berikut adalah laporan hasil replikasi Zerto pada hari ${result.formattedDate} pukul ${result.formattedTime}.`;
console.log('\nTest message:');
console.log(testMessage);