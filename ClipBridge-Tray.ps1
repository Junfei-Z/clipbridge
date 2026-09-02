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

Set-Location -LiteralPath $PSScriptRoot

$stateDirectory = Join-Path $PSScriptRoot ".clipbridge"
$configPath = Join-Path $stateDirectory "config.json"
$serverPath = Join-Path $PSScriptRoot "src\server.mjs"
$stdoutLogPath = Join-Path $stateDirectory "server.log"
$stderrLogPath = Join-Path $stateDirectory "server-error.log"
$serverProcess = $null
$notifyIcon = $null
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
    $mutex = New-Object System.Threading.Mutex($true, "Local\ClipBridge.Tray", [ref]$createdNew)
    $ownsMutex = $createdNew

    if (-not $createdNew) {
        if (Test-Path -LiteralPath $configPath) {
            $existingConfig = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
            $existingToken = [System.Uri]::EscapeDataString([string]$existingConfig.token)
            $existingPanelUrl = "http://127.0.0.1:$($existingConfig.port)/ui?token=$existingToken"
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

    $encodedToken = [System.Uri]::EscapeDataString([string]$config.token)
    $pairingUrl = "http://$($address):$($config.port)/ui?token=$encodedToken"
    $localPanelUrl = "http://127.0.0.1:$($config.port)/ui?token=$encodedToken"

    $menu = New-Object System.Windows.Forms.ContextMenuStrip
    $openItem = $menu.Items.Add("Open Quick Panel")
    $copyItem = $menu.Items.Add("Copy Pairing URL")
    $menu.Items.Add("-") | Out-Null
    $exitItem = $menu.Items.Add("Exit")

    $notifyIcon = New-Object System.Windows.Forms.NotifyIcon
    $notifyIcon.Icon = [System.Drawing.SystemIcons]::Application
    $notifyIcon.Text = "ClipBridge - $($config.deviceName)"
    $notifyIcon.ContextMenuStrip = $menu
    $notifyIcon.Visible = $true

    $openPanel = {
        Start-Process $localPanelUrl
    }
    $openItem.Add_Click($openPanel)
    $notifyIcon.Add_DoubleClick($openPanel)
    $copyItem.Add_Click({
        [System.Windows.Forms.Clipboard]::SetText($pairingUrl)
        $notifyIcon.ShowBalloonTip(1800, "ClipBridge", "Pairing URL copied.", [System.Windows.Forms.ToolTipIcon]::Info)
    })
    $exitItem.Add_Click({
        $notifyIcon.Visible = $false
        [System.Windows.Forms.Application]::Exit()
    })

    $notifyIcon.ShowBalloonTip(2200, "ClipBridge is ready", "Double-click the tray icon to open the quick panel.", [System.Windows.Forms.ToolTipIcon]::Info)
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
    if ($serverProcess -and -not $serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id
    }
    if ($mutex) {
        if ($ownsMutex) {
            $mutex.ReleaseMutex()
        }
        $mutex.Dispose()
    }
}
