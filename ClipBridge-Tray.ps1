param(
    [switch]$NoAutoOpen,
    [ValidateRange(0, 300)]
    [int]$ExitAfterSeconds = 0
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function Show-ClipBridgeError {
    param([string]$Message)

    [System.Windows.Forms.MessageBox]::Show(
        $Message,
        "ClipBridge could not start",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
}

function Get-ClipBridgeMutexName {
    param([string]$InstallPath)

    $normalizedPath = [System.IO.Path]::GetFullPath($InstallPath).TrimEnd('\').ToUpperInvariant()
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $pathBytes = [System.Text.Encoding]::UTF8.GetBytes($normalizedPath)
        $pathHash = [System.BitConverter]::ToString($sha256.ComputeHash($pathBytes)).Replace("-", "").Substring(0, 16)
        return "Local\ClipBridge.Tray.$pathHash"
    }
    finally {
        $sha256.Dispose()
    }
}

function Stop-StaleClipBridgeServer {
    param(
        [string]$RecordPath,
        [string]$ExpectedServerPath,
        [string]$ExpectedNodePath
    )

    if (-not (Test-Path -LiteralPath $RecordPath)) {
        return $false
    }

    try {
        $record = Get-Content -LiteralPath $RecordPath -Raw | ConvertFrom-Json
        $recordPid = 0
        if (-not [int]::TryParse([string]$record.pid, [ref]$recordPid) -or $recordPid -le 0) {
            throw "Invalid process ID."
        }

        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$recordPid" -ErrorAction SilentlyContinue
        if (-not $process) {
            Remove-Item -LiteralPath $RecordPath -Force -ErrorAction SilentlyContinue
            return $false
        }

        $expectedExecutable = [System.IO.Path]::GetFullPath($ExpectedNodePath)
        $expectedScript = [System.IO.Path]::GetFullPath($ExpectedServerPath)
        $recordedExecutable = [System.IO.Path]::GetFullPath([string]$record.executablePath)
        $recordedScript = [System.IO.Path]::GetFullPath([string]$record.serverPath)
        $recordedStart = [DateTimeOffset]::Parse([string]$record.startTimeUtc)
        $actualStart = [DateTimeOffset]$process.CreationDate

        $executableMatches =
            $recordedExecutable.Equals($expectedExecutable, [System.StringComparison]::OrdinalIgnoreCase) -and
            ([string]$process.ExecutablePath).Equals($expectedExecutable, [System.StringComparison]::OrdinalIgnoreCase)
        $scriptMatches =
            $recordedScript.Equals($expectedScript, [System.StringComparison]::OrdinalIgnoreCase) -and
            ([string]$process.CommandLine).IndexOf($expectedScript, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
        $startMatches = [Math]::Abs(($actualStart - $recordedStart).TotalSeconds) -le 2
        $instanceMatches = ([string]$record.instanceId) -match '^[a-f0-9]{32}$'

        if (-not ($executableMatches -and $scriptMatches -and $startMatches -and $instanceMatches)) {
            Remove-Item -LiteralPath $RecordPath -Force -ErrorAction SilentlyContinue
            return $false
        }

        Stop-Process -Id $recordPid -Force -ErrorAction Stop
        $stopDeadline = [DateTime]::UtcNow.AddSeconds(5)
        while (Get-Process -Id $recordPid -ErrorAction SilentlyContinue) {
            if ([DateTime]::UtcNow -gt $stopDeadline) {
                throw "The previous ClipBridge service did not stop."
            }
            Start-Sleep -Milliseconds 100
        }
        Remove-Item -LiteralPath $RecordPath -Force -ErrorAction SilentlyContinue
        return $true
    }
    catch {
        # A malformed or unverifiable record is never permission to stop a process.
        Remove-Item -LiteralPath $RecordPath -Force -ErrorAction SilentlyContinue
        return $false
    }
}

Set-Location -LiteralPath $PSScriptRoot

$stateDirectory = Join-Path $PSScriptRoot ".clipbridge"
$configPath = Join-Path $stateDirectory "config.json"
$serverPath = Join-Path $PSScriptRoot "src\server.mjs"
$stdoutLogPath = Join-Path $stateDirectory "server.log"
$stderrLogPath = Join-Path $stateDirectory "server-error.log"
$serverRecordPath = Join-Path $stateDirectory "server-process.json"
$trayIconPath = Join-Path $PSScriptRoot "assets\clipbridge-tray.ico"
$serverProcess = $null
$notifyIcon = $null
$trayIcon = $null
$exitTimer = $null
$mutex = $null
$ownsMutex = $false
$previousLaunchMode = $env:CLIPBRIDGE_LAUNCH_MODE
$previousInstanceId = $env:CLIPBRIDGE_INSTANCE_ID

try {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCommand) {
        throw "ClipBridge requires Node.js 20 or later. Install Node.js, then try again."
    }

    $nodeVersionText = (& $nodeCommand.Source --version 2>$null).Trim()
    $nodeVersion = $null
    if (-not [System.Version]::TryParse($nodeVersionText.TrimStart("v"), [ref]$nodeVersion) -or $nodeVersion.Major -lt 20) {
        throw "ClipBridge requires Node.js 20 or later. Found $nodeVersionText."
    }

    $createdNew = $false
    $mutexName = Get-ClipBridgeMutexName $PSScriptRoot
    $mutex = New-Object System.Threading.Mutex($true, $mutexName, [ref]$createdNew)
    $ownsMutex = $createdNew

    if (-not $createdNew) {
        if (Test-Path -LiteralPath $configPath) {
            $existingConfig = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
            $existingPanelUrl = "http://127.0.0.1:$($existingConfig.port)/ui"
            Start-Process $existingPanelUrl
        }
        [System.Windows.Forms.MessageBox]::Show(
            "ClipBridge is already running. The quick panel has been opened.",
            "ClipBridge",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        ) | Out-Null
        exit 0
    }

    New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
    $staleServerStopped = Stop-StaleClipBridgeServer `
        -RecordPath $serverRecordPath `
        -ExpectedServerPath $serverPath `
        -ExpectedNodePath $nodeCommand.Source

    $quotedServerPath = '"' + $serverPath.Replace('"', '\"') + '"'
    $launchInstanceId = [System.Guid]::NewGuid().ToString("N")
    $env:CLIPBRIDGE_LAUNCH_MODE = "tray"
    $env:CLIPBRIDGE_INSTANCE_ID = $launchInstanceId
    try {
        $serverProcess = Start-Process `
            -FilePath $nodeCommand.Source `
            -ArgumentList @($quotedServerPath) `
            -WorkingDirectory $PSScriptRoot `
            -WindowStyle Hidden `
            -RedirectStandardOutput $stdoutLogPath `
            -RedirectStandardError $stderrLogPath `
            -PassThru

        [ordered]@{
            schemaVersion = 1
            pid = $serverProcess.Id
            startTimeUtc = $serverProcess.StartTime.ToUniversalTime().ToString("o")
            executablePath = [System.IO.Path]::GetFullPath($nodeCommand.Source)
            serverPath = [System.IO.Path]::GetFullPath($serverPath)
            instanceId = $launchInstanceId
        } | ConvertTo-Json | Set-Content -LiteralPath $serverRecordPath -Encoding UTF8
    }
    finally {
        $env:CLIPBRIDGE_LAUNCH_MODE = $previousLaunchMode
        $env:CLIPBRIDGE_INSTANCE_ID = $previousInstanceId
    }

    $deadline = [DateTime]::UtcNow.AddSeconds(12)
    while (-not (Test-Path -LiteralPath $configPath)) {
        if ($serverProcess.HasExited) {
            throw "ClipBridge server stopped during startup."
        }
        if ([DateTime]::UtcNow -gt $deadline) {
            throw "Timed out while creating the ClipBridge configuration."
        }
        Start-Sleep -Milliseconds 150
    }

    $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    $healthUrl = "http://127.0.0.1:$($config.port)/health"
    $ready = $false
    while ([DateTime]::UtcNow -le $deadline) {
        if ($serverProcess.HasExited) {
            break
        }
        try {
            $healthResponse = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 1
            $healthPayload = $healthResponse.Content | ConvertFrom-Json
            if ($healthResponse.StatusCode -eq 200 -and $healthPayload.instanceId -eq $launchInstanceId) {
                $ready = $true
                break
            }
        }
        catch {
            Start-Sleep -Milliseconds 150
        }
    }

    if (-not $ready) {
        $detail = ""
        if (Test-Path -LiteralPath $stderrLogPath) {
            $detail = (Get-Content -LiteralPath $stderrLogPath -Tail 8 -ErrorAction SilentlyContinue) -join [Environment]::NewLine
        }
        if ($detail) {
            if ($detail -match "EADDRINUSE") {
                throw "Port $($config.port) is already in use. ClipBridge only stops a previous service when its ownership record matches this installation. Close any manually started ClipBridge console and try again.`n`nLog: $stderrLogPath"
            }
            throw "The local service did not become ready.`n`n$detail`n`nLog: $stderrLogPath"
        }
        throw "The local service did not become ready. See $stderrLogPath for details."
    }

    $address = $null
    $routeSocket = New-Object System.Net.Sockets.Socket(
        [System.Net.Sockets.AddressFamily]::InterNetwork,
        [System.Net.Sockets.SocketType]::Dgram,
        [System.Net.Sockets.ProtocolType]::Udp
    )
    try {
        # UDP connect selects the default route without sending clipboard data.
        $routeSocket.Connect("8.8.8.8", 53)
        $address = $routeSocket.LocalEndPoint.Address.IPAddressToString
    }
    catch {
        $address = $null
    }
    finally {
        $routeSocket.Dispose()
    }

    if (-not $address) {
        $fallbackAddress = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
            Where-Object {
                $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
                -not [System.Net.IPAddress]::IsLoopback($_)
            } |
            Select-Object -First 1
        if ($fallbackAddress) {
            $address = $fallbackAddress.IPAddressToString
        }
    }

    if (-not $address) {
        throw "No local IPv4 address was found. Connect this PC to a private network and try again."
    }

    $deviceUrl = "http://$($address):$($config.port)/ui"
    $localPanelUrl = "http://127.0.0.1:$($config.port)/ui"

    $menu = New-Object System.Windows.Forms.ContextMenuStrip
    $openItem = $menu.Items.Add("Open Quick Panel")
    $copyItem = $menu.Items.Add("Copy Device URL")
    $menu.Items.Add("-") | Out-Null
    $exitItem = $menu.Items.Add("Exit")

    $notifyIcon = New-Object System.Windows.Forms.NotifyIcon
    if (Test-Path -LiteralPath $trayIconPath) {
        $trayIcon = New-Object System.Drawing.Icon -ArgumentList $trayIconPath
        $notifyIcon.Icon = $trayIcon
    }
    else {
        $notifyIcon.Icon = [System.Drawing.SystemIcons]::Application
    }
    $notifyIcon.Text = "ClipBridge - $($config.deviceName)"
    $notifyIcon.ContextMenuStrip = $menu
    $notifyIcon.Visible = $true

    $openPanel = {
        Start-Process $localPanelUrl
    }
    $openItem.Add_Click($openPanel)
    $notifyIcon.Add_DoubleClick($openPanel)
    $copyItem.Add_Click({
        [System.Windows.Forms.Clipboard]::SetText($deviceUrl)
        $notifyIcon.ShowBalloonTip(2200, "ClipBridge", "Device URL copied. Create a one-time pairing code in the Windows panel.", [System.Windows.Forms.ToolTipIcon]::Info)
    })
    $exitItem.Add_Click({
        $notifyIcon.Visible = $false
        [System.Windows.Forms.Application]::Exit()
    })

    $readyMessage = if ($staleServerStopped) {
        "A previous ClipBridge service was cleaned up. Double-click the tray icon to open the quick panel."
    }
    else {
        "Double-click the tray icon to open the quick panel."
    }
    $notifyIcon.ShowBalloonTip(2600, "ClipBridge is ready", $readyMessage, [System.Windows.Forms.ToolTipIcon]::Info)
    if (-not $NoAutoOpen) {
        Start-Process $localPanelUrl
    }

    if ($ExitAfterSeconds -gt 0) {
        $exitTimer = New-Object System.Windows.Forms.Timer
        $exitTimer.Interval = $ExitAfterSeconds * 1000
        $exitTimer.Add_Tick({
            $exitTimer.Stop()
            [System.Windows.Forms.Application]::Exit()
        })
        $exitTimer.Start()
    }

    [System.Windows.Forms.Application]::Run()
}
catch {
    Show-ClipBridgeError $_.Exception.Message
}
finally {
    if ($exitTimer) {
        $exitTimer.Stop()
        $exitTimer.Dispose()
    }
    if ($notifyIcon) {
        $notifyIcon.Visible = $false
        $notifyIcon.Dispose()
    }
    if ($trayIcon) {
        $trayIcon.Dispose()
    }
    if ($serverProcess -and -not $serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id
    }
    if ($serverProcess -and (Test-Path -LiteralPath $serverRecordPath)) {
        try {
            $currentRecord = Get-Content -LiteralPath $serverRecordPath -Raw | ConvertFrom-Json
            if ([int]$currentRecord.pid -eq $serverProcess.Id) {
                Remove-Item -LiteralPath $serverRecordPath -Force -ErrorAction SilentlyContinue
            }
        }
        catch {
            # Leave an unverifiable record for the next launch to discard safely.
        }
    }
    if ($mutex) {
        if ($ownsMutex) {
            $mutex.ReleaseMutex()
        }
        $mutex.Dispose()
    }
}
