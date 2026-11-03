Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory('D:\BaiduNetdiskDownload\YG_Local_LAN_v3_complete.zip','D:\yuguang_review\YG_Local_LAN_v3')
Get-ChildItem 'D:\yuguang_review\YG_Local_LAN_v3' | ForEach-Object {
    if ($_.PSIsContainer) { "[DIR]  " + $_.Name } else { "FILE " + $_.Name }
}
