@echo off
echo ========================================
echo Network Connectivity Test for BJP Domain
echo ========================================
echo.

echo Testing BJP Domain Controller IPs:
echo.

echo 1. Testing 192.168.75.10 (bjpCompConfig)
ping -n 2 192.168.75.10
echo.

echo 2. Testing 192.168.75.100 (bjpConfig)  
ping -n 2 192.168.75.100
echo.

echo 3. Testing 192.168.120.10 (getCredentialsAndDC)
ping -n 2 192.168.120.10
echo.

echo ========================================
echo Port 636 (LDAPS) Connectivity Test
echo ========================================
echo.

echo Testing LDAPS port 636 on each IP:
echo.

echo 1. Testing 192.168.75.10:636
powershell -Command "try { $tcp = New-Object System.Net.Sockets.TcpClient; $tcp.Connect('192.168.75.10', 636); $tcp.Close(); Write-Host 'SUCCESS: Port 636 is open' -ForegroundColor Green } catch { Write-Host 'FAILED: Port 636 is closed or unreachable' -ForegroundColor Red }"
echo.

echo 2. Testing 192.168.75.100:636
powershell -Command "try { $tcp = New-Object System.Net.Sockets.TcpClient; $tcp.Connect('192.168.75.100', 636); $tcp.Close(); Write-Host 'SUCCESS: Port 636 is open' -ForegroundColor Green } catch { Write-Host 'FAILED: Port 636 is closed or unreachable' -ForegroundColor Red }"
echo.

echo 3. Testing 192.168.120.10:636
powershell -Command "try { $tcp = New-Object System.Net.Sockets.TcpClient; $tcp.Connect('192.168.120.10', 636); $tcp.Close(); Write-Host 'SUCCESS: Port 636 is open' -ForegroundColor Green } catch { Write-Host 'FAILED: Port 636 is closed or unreachable' -ForegroundColor Red }"
echo.

echo ========================================
echo DNS Resolution Test
echo ========================================
echo.

echo Testing if domain controller has DNS name:
nslookup 192.168.75.10
echo.
nslookup 192.168.75.100  
echo.
nslookup 192.168.120.10
echo.

echo ========================================
echo SUMMARY
echo ========================================
echo Check the results above to identify:
echo 1. Which IP addresses are reachable
echo 2. Which LDAPS ports (636) are accessible
echo 3. Any DNS resolution issues
echo.
echo Next step: Use the working IP in your LDAP configuration
echo.

pause