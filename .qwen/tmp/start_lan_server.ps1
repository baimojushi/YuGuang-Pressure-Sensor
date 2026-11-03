$env:YG_DEVICE_TOKEN = "smoketest"
$env:YG_PORT = "8000"
Start-Process "python.exe" -ArgumentList "run.py" -WorkingDirectory "D:\yuguang_review\YG_Local_LAN_v3\pc_inference" -WindowStyle Hidden -PassThru | ForEach-Object { $_.Id }
