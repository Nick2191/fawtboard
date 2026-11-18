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

    # Silent per-user install into %LOCALAPPDATA%\Programs; closes a running fawtboard first.
    Write-Host 'Installing...'
    Start-Process $installer -ArgumentList '/S' -Wait
    Remove-Item $installer

    Start-Process (Join-Path $env:LOCALAPPDATA 'Programs\fawtboard\fawtboard.exe')
    Write-Host "fawtboard $($release.tag_name) is installed and running in the tray."
}
