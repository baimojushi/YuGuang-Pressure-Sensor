$i = "D:\yuguang_review\YG_Local_LAN_v3\YG_Local_LAN_v3"
$o = "D:\yuguang_review\YG_Local_LAN_v3"
Move-Item -Force -Path "$i\*" -Destination "$o" -ErrorAction SilentlyContinue
Remove-Item -Force "$i" -ErrorAction SilentlyContinue
Get-ChildItem $o | ForEach-Object { "{0} [{1}]" -f $_.Name, $_.PSIsContainer }
