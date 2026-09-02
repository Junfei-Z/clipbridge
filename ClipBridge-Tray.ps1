$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    [System.Windows.Forms.MessageBox]::Show(
        "ClipBridge requires Node.js 20 or later.",
        "ClipBridge",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
    exit 1
}

Set-Location -LiteralPath $PSScriptRoot

$stateDirectory = Join-Path $PSScriptRoot ".clipbridge"
$configPath = Join-Path $stateDirectory "config.json"
$serverPath = Join-Path $PSScriptRoot "src\server.mjs"
$serverProcess = Start-Process -FilePath "node" -ArgumentList @($serverPath) -WindowStyle Hidden -PassThru

try {
    $deadline = [DateTime]::UtcNow.AddSeconds(8)
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
    [System.Windows.Forms.Application]::Run()
}
catch {
    [System.Windows.Forms.MessageBox]::Show(
        $_.Exception.Message,
        "ClipBridge",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
}
finally {
    if ($notifyIcon) {
        $notifyIcon.Visible = $false
        $notifyIcon.Dispose()
    }
    if ($serverProcess -and -not $serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id
    }
}
