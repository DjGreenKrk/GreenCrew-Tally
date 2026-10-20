# Standalone smoke test for the Windows Hub, no ESP8266 required.
# Stop/disable any other Companion module sending a heartbeat before running.
$ErrorActionPreference = 'Stop'
$uri = 'http://127.0.0.1:3000/api/companion/tally'
$initial = Invoke-RestMethod -Uri $uri
if (-not $initial.active) { throw 'Choose Companion (HTTP) in Hub Settings first.' }

function Send-State([string[]]$programs, [string[]]$previews) {
    $payload = @{ programs = @($programs); previews = @($previews) } | ConvertTo-Json -Compress
    return Invoke-RestMethod -Uri $uri -Method Post -ContentType 'application/json' -Body $payload
}

Write-Host 'PGM CAM1, PVW CAM2'
$response = Send-State @('1') @('2')
if (-not $response.receiving -or $response.programs[0] -ne '1' -or $response.previews[0] -ne '2') {
    throw 'First HTTP snapshot was not acknowledged.'
}

Write-Host 'PGM CAM2, PVW CAM3'
$response = Send-State @('2') @('3')
if ($response.programs[0] -ne '2' -or $response.previews[0] -ne '3') {
    throw 'Second HTTP snapshot was not acknowledged.'
}

Write-Host 'Waiting 5 seconds without heartbeats...'
Start-Sleep -Seconds 5
$stale = Invoke-RestMethod -Uri $uri
if ($stale.receiving) { throw 'Hub still reports receiving (is another sender running?)' }
Write-Host 'OK: Hub reports disconnected/UNKNOWN after heartbeat timeout.'

$response = Send-State @() @()
if (-not $response.receiving -or $response.programs.Count -ne 0 -or $response.previews.Count -ne 0) {
    throw 'Blackout/recovery failed.'
}
Write-Host 'OK: recovered after a fresh snapshot; all cameras OFF.'
