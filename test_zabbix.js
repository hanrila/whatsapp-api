const axios = require('axios');

// Konfigurasi Zabbix
const zabbixConfig = {
    url: 'http://192.168.75.24/zabbix/api_jsonrpc.php',
    user: 'bjs.admin',
    password: 'P@ssw0rd.1'
};

// Item keys yang akan diambil
const itemKeys = [
    'system.model[upsBasicIdentModel]',
    'system.location[sysLocation.0]',
    'battery.runtime_remaining[upsAdvBatteryRunTimeRemaining]',
    'input.voltage[upsHighPrecInputLineVoltage]',
    'input.frequency[upsHighPrecInputFrequency]',
    'output.voltage[upsHighPrecOutputVoltage]',
    'output.current[upsHighPrecOutputCurrent]',
    'battery.capacity[upsHighPrecBatteryCapacity]'
];

// Fungsi untuk login ke Zabbix
async function loginToZabbix() {
    try {
        const response = await axios.post(zabbixConfig.url, {
            jsonrpc: '2.0',
            method: 'user.login',
            params: {
                username: zabbixConfig.user,
                password: zabbixConfig.password
            },
            id: 1,
            auth: null
        });
        console.log('✅ Berhasil login ke Zabbix API');
        return response.data.result;
    } catch (error) {
        console.error('❌ Gagal login ke Zabbix API:', error.message);
        return null;
    }
}

// Fungsi untuk memformat nilai dengan unit yang sesuai
function formatValue(key, value) {
    const numValue = parseFloat(value);
    switch(key) {
        case 'battery.runtime_remaining[upsAdvBatteryRunTimeRemaining]':
            const minutes = Math.floor(numValue / 60);
            const seconds = numValue % 60;
            return `${minutes} menit ${seconds} detik`;
        case 'input.voltage[upsHighPrecInputLineVoltage]':
        case 'output.voltage[upsHighPrecOutputVoltage]':
            return `${numValue.toFixed(1)} V`;
        case 'input.frequency[upsHighPrecInputFrequency]':
            return `${numValue.toFixed(1)} Hz`;
        case 'output.current[upsHighPrecOutputCurrent]':
            return `${numValue.toFixed(1)} A`;
        case 'battery.capacity[upsHighPrecBatteryCapacity]':
            return `${numValue}%`;
        default:
            return value;
    }
}

// Fungsi untuk mendapatkan status UPS
function getUPSStatus(batteryCapacity, inputVoltage, outputVoltage) {
    const status = {
        battery: {
            emoji: '🔴',
            text: 'CRITICAL'
        },
        power: {
            emoji: '🔴',
            text: 'CRITICAL'
        }
    };

    // Cek status baterai
    const numCapacity = parseFloat(batteryCapacity);
    if (numCapacity >= 90) {
        status.battery.emoji = '🟢';
        status.battery.text = 'NORMAL';
    } else if (numCapacity >= 50) {
        status.battery.emoji = '🟡';
        status.battery.text = 'WARNING';
    }

    // Cek status power
    const numInputVoltage = parseFloat(inputVoltage);
    const numOutputVoltage = parseFloat(outputVoltage);
    if (numInputVoltage >= 200 && numInputVoltage <= 240 && 
        numOutputVoltage >= 200 && numOutputVoltage <= 240) {
        status.power.emoji = '🟢';
        status.power.text = 'NORMAL';
    } else if (numInputVoltage >= 180 && numInputVoltage <= 260 && 
               numOutputVoltage >= 180 && numOutputVoltage <= 260) {
        status.power.emoji = '🟡';
        status.power.text = 'WARNING';
    }

    return status;
}

// Fungsi untuk mendapatkan emoji status baterai
function getBatteryEmoji(capacity) {
    const numCapacity = parseFloat(capacity);
    if (numCapacity >= 90) return '🟢';
    if (numCapacity >= 50) return '🟡';
    return '🔴';
}

// Fungsi untuk mendapatkan informasi UPS
async function getUPSInfo(authToken, hostName) {
    // Object untuk menyimpan informasi UPS
    const upsInfo = {
        batteryCapacity: null,
        inputVoltage: null,
        outputVoltage: null
    };
    try {
        // Mendapatkan host ID
        const hostResponse = await axios.post(zabbixConfig.url, {
            jsonrpc: '2.0',
            method: 'host.get',
            params: {
                output: ['hostid'],
                filter: {
                    host: [hostName]
                }
            },
            auth: authToken,
            id: 3
        });

        if (hostResponse.data.result.length === 0) {
            console.error(`❌ Host '${hostName}' tidak ditemukan`);
            return;
        }

        const hostId = hostResponse.data.result[0].hostid;
        console.log(`✅ Host ditemukan dengan ID: ${hostId}`);

        // Mengambil informasi untuk setiap item key
        for (const itemKey of itemKeys) {
            const itemResponse = await axios.post(zabbixConfig.url, {
                jsonrpc: '2.0',
                method: 'item.get',
                params: {
                    output: ['hostid', 'name', 'lastvalue'],
                    hostids: [hostId],
                    search: {
                        key_: itemKey
                    }
                },
                auth: authToken,
                id: 4
            });

            if (itemResponse.data.result.length > 0) {
                const item = itemResponse.data.result[0];
                const formattedValue = formatValue(itemKey, item.lastvalue);
                
                // Simpan nilai untuk status
                if (itemKey.includes('battery.capacity')) {
                    upsInfo.batteryCapacity = item.lastvalue;
                } else if (itemKey.includes('input.voltage')) {
                    upsInfo.inputVoltage = item.lastvalue;
                } else if (itemKey.includes('output.voltage')) {
                    upsInfo.outputVoltage = item.lastvalue;
                }
                
                // Tampilkan dengan format yang lebih baik
                if (itemKey.includes('model')) {
                    console.log(`📦 Model: ${formattedValue}`);
                } else if (itemKey.includes('location')) {
                    console.log(`📍 Lokasi: ${formattedValue}`);
                } else if (itemKey.includes('battery.runtime')) {
                    console.log(`⏱️ Estimasi Runtime: ${formattedValue}`);
                } else if (itemKey.includes('input')) {
                    console.log(`⚡ Input ${itemKey.includes('voltage') ? 'Voltage' : 'Frequency'}: ${formattedValue}`);
                } else if (itemKey.includes('output')) {
                    console.log(`🔌 Output ${itemKey.includes('voltage') ? 'Voltage' : 'Current'}: ${formattedValue}`);
                } else if (itemKey.includes('battery.capacity')) {
                    const emoji = getBatteryEmoji(item.lastvalue);
                    console.log(`${emoji} Status Baterai: ${formattedValue}`);
                }
            } else {
                console.log(`⚠️ Tidak dapat menemukan data untuk ${itemKey}`);
            }
        }

        // Tampilkan ringkasan status
        if (upsInfo.batteryCapacity && upsInfo.inputVoltage && upsInfo.outputVoltage) {
            const status = getUPSStatus(upsInfo.batteryCapacity, upsInfo.inputVoltage, upsInfo.outputVoltage);
            console.log('\n📊 Ringkasan Status:');
            console.log(`${status.battery.emoji} Status Baterai: ${status.battery.text}`);
            console.log(`${status.power.emoji} Status Power: ${status.power.text}`);
        }
    } catch (error) {
        console.error('❌ Error saat mengambil informasi UPS:', error.message);
    }
}

// Fungsi untuk mendapatkan daftar host UPS
async function listUPSHosts(authToken) {
    try {
        const response = await axios.post(zabbixConfig.url, {
            jsonrpc: '2.0',
            method: 'host.get',
            params: {
                output: ['host', 'name'],
                search: {
                    host: 'UPS'
                },
                searchByAny: true
            },
            auth: authToken,
            id: 5
        });

        if (response.data.result.length > 0) {
            console.log('📋 Daftar UPS yang tersedia:');
            response.data.result.forEach((host, index) => {
                console.log(`${index + 1}. ${host.host} (${host.name})`);
            });
        } else {
            console.log('❌ Tidak ditemukan host UPS');
        }
        return response.data.result;
    } catch (error) {
        console.error('❌ Error saat mengambil daftar UPS:', error.message);
        return [];
    }
}

// Main script
async function main() {
    console.log('🔌 Test Koneksi Zabbix dan UPS Info');
    console.log('=====================================');

    const authToken = await loginToZabbix();
    if (authToken) {
        console.log('');
        // Tampilkan daftar UPS yang tersedia
        const upsList = await listUPSHosts(authToken);
        
        if (upsList.length > 0) {
            console.log('');
            for (const ups of upsList) {
                console.log(`🔍 Mengecek UPS: ${ups.host}...`);
                await getUPSInfo(authToken, ups.host);
                console.log('');
            }
        }
    }
}

main().catch(console.error);