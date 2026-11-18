# Installs or updates fawtboard from the latest GitHub release, then starts it. In PowerShell:
#   irm https://raw.githubusercontent.com/Nick2191/fawtboard/main/scripts/install.ps1 | iex
# The app updates itself after that.
& {
    $ErrorActionPreference = 'Stop'
    # Invoke-WebRequest downloads far slower in Windows PowerShell 5 with its progress bar drawn.
    $ProgressPreference = 'SilentlyContinue'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    $release = Invoke-RestMethod 'https://api.github.com/repos/Nick2191/fawtboard/releases/latest'
    $asset = $release.assets | Where-Object name -Like '*-setup.exe' | Select-Object -First 1
    if (-not $asset) { throw "Release $($release.tag_name) has no installer." }

    $installer = Join-Path $env:TEMP $asset.name
    Write-Host "Downloading fawtboard $($release.tag_name)..."
    Invoke-WebRequest $asset.browser_download_url -OutFile $installer

    # Silent per-user install; closes a running fawtboard first and upgrades an existing install
    # wherever it is.
    Write-Host 'Installing...'
    Start-Process $installer -ArgumentList '/S' -Wait
    Remove-Item $installer

    # The install folder is named by electron-builder (%LOCALAPPDATA%\Programs\@fawtboarddesktop
    # today), so ask the uninstall entry the installer writes; its DisplayIcon is "<exe>,0".
    $entry = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' |
        Where-Object DisplayName -Like 'fawtboard*' | Select-Object -First 1
    if (-not $entry) { throw 'The installer finished but fawtboard is not registered as installed.' }
    Start-Process ($entry.DisplayIcon -replace ',\d+$', '')
    Write-Host "fawtboard $($release.tag_name) is installed and running in the tray."
}
