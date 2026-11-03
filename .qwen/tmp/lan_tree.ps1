Get-ChildItem 'D:\yuguang_review\YG_Local_LAN_v3' -Recurse -Depth 3 | ForEach-Object {
    $pad = "  " * $_.Depth
    if ($_.PSIsContainer) { "[DIR] " + $pad + $_.Name } else { "     " + $pad + $_.Name }
}
