# Run in PowerShell in pc_inference directory. Edit your own private values.
# .env.example is for reference only: this script intentionally does not source it.
if (-not $env:YG_DEVICE_TOKEN) { Write-Error 'Set $env:YG_DEVICE_TOKEN first'; exit 1 }
if (-not $env:YG_POSE_ONNX) { Write-Error 'Set $env:YG_POSE_ONNX to your licensed ONNX file'; exit 1 }
python run.py
