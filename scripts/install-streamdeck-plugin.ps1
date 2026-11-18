# Installs or updates the fawtboard Stream Deck plugin from the latest GitHub release. In PowerShell:
#   irm https://raw.githubusercontent.com/Nick2191/fawtboard/main/scripts/install-streamdeck-plugin.ps1 | iex
# Needs the Stream Deck app 7.1 or newer. Later plugin updates are offered by the fawtboard app.
& {
    $ErrorActionPreference = 'Stop'
    $ProgressPreference = 'SilentlyContinue'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    $name = 'com.nick2191.fawtboard.streamDeckPlugin'
    # Left in TEMP: Stream Deck reads it after this script has returned.
    $plugin = Join-Path $env:TEMP $name
    Write-Host 'Downloading the fawtboard Stream Deck plugin...'
    Invoke-WebRequest "https://github.com/Nick2191/fawtboard/releases/latest/download/$name" -OutFile $plugin

    # Opening the file hands it to Stream Deck, which installs it over any older copy.
    Start-Process $plugin
    Write-Host 'Handed to Stream Deck. Look for the fawtboard category in its action list.'
}
