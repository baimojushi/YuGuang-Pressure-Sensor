$p = Start-Process "D:\yuguang_review\YG_Local_LAN_v3\pc_inference\.venv\Scripts\python.exe" -ArgumentList "scripts/mock_sensor.py --url http://127.0.0.1:8000/v1/ingest --token smoketest" -WorkingDirectory "D:\yuguang_review\YG_Local_LAN_v3\pc_inference" -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 12
Stop-Process -Id $p.Id -Force
Get-Content "D:\yuguang_review\YG_Local_LAN_v3\pc_inference\reports\sensor01_latest.json" -ErrorAction SilentlyContinue
