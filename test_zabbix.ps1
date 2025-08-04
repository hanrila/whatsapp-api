# Konfigurasi Zabbix
$zabbixUrl = "http://192.168.75.24/zabbix/api_jsonrpc.php"
$username = "bjs.admin"
$password = "P@ssw0rd.1"

# Fungsi untuk login ke Zabbix
function Get-ZabbixAuthToken {
    $body = @{
        jsonrpc = "2.0"
        method = "user.login"
        params = @{
            username = $username
            password = $password
        }
        id = 1
        auth = $null
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri $zabbixUrl -Method Post -Body $body -ContentType "application/json-rpc"
        Write-Host "✅ Berhasil login ke Zabbix API" -ForegroundColor Green
        return $response.result
    }
    catch {
        Write-Host "❌ Gagal login ke Zabbix API: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Fungsi untuk mendapatkan informasi UPS
function Get-UPSInfo {
    param(
        [string]$authToken,
        [string]$hostName
    )

    # Mendapatkan host ID
    $hostBody = @{
        jsonrpc = "2.0"
        method = "host.get"
        params = @{
            output = @("hostid")
            filter = @{
                host = @($hostName)
            }
        }
        auth = $authToken
        id = 3
    } | ConvertTo-Json

    try {
        $hostResponse = Invoke-RestMethod -Uri $zabbixUrl -Method Post -Body $hostBody -ContentType "application/json-rpc"
        
        if ($hostResponse.result.Count -eq 0) {
            Write-Host "❌ Host '$hostName' tidak ditemukan" -ForegroundColor Red
            return
        }

        $hostId = $hostResponse.result[0].hostid
        Write-Host "✅ Host ditemukan dengan ID: $hostId" -ForegroundColor Green

        # Item keys yang akan diambil
        $itemKeys = @(
            "system.model[upsBasicIdentModel]",
            "system.location[sysLocation.0]",
            "battery.runtime_remaining[upsAdvBatteryRunTimeRemaining]",
            "input.voltage[upsHighPrecInputLineVoltage]",
            "input.frequency[upsHighPrecInputFrequency]",
            "output.voltage[upsHighPrecOutputVoltage]",
            "output.current[upsHighPrecOutputCurrent]",
            "battery.capacity[upsHighPrecBatteryCapacity]"
        )

        foreach ($itemKey in $itemKeys) {
            $itemBody = @{
                jsonrpc = "2.0"
                method = "item.get"
                params = @{
                    output = @("hostid", "name", "lastvalue")
                    hostids = @($hostId)
                    search = @{
                        key_ = $itemKey
                    }
                }
                auth = $authToken
                id = 4
            } | ConvertTo-Json

            $itemResponse = Invoke-RestMethod -Uri $zabbixUrl -Method Post -Body $itemBody -ContentType "application/json-rpc"
            
            if ($itemResponse.result.Count -gt 0) {
                $item = $itemResponse.result[0]
                Write-Host "$($item.name): $($item.lastvalue)" -ForegroundColor Cyan
            }
            else {
                Write-Host "⚠️ Tidak dapat menemukan data untuk $itemKey" -ForegroundColor Yellow
            }
        }
    }
    catch {
        Write-Host "❌ Error saat mengambil informasi UPS: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Main script
Write-Host "🔌 Test Koneksi Zabbix dan UPS Info" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

$authToken = Get-ZabbixAuthToken
if ($authToken) {
    Write-Host ""
    Write-Host "🔍 Mengecek UPS di Site DC (jkt)..." -ForegroundColor Cyan
    Get-UPSInfo -authToken $authToken -hostName "jkt"
    
    Write-Host ""
    Write-Host "🔍 Mengecek UPS di Site Mini DC (UPS AB 10Kva)..." -ForegroundColor Cyan
    Get-UPSInfo -authToken $authToken -hostName "UPS AB 10Kva"
}