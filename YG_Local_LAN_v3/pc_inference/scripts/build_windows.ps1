# Run on Windows x64, Python 3.11 in a fresh venv. EXE cannot be cross-built here.
python -m pip install -r requirements.txt pyinstaller
pyinstaller --noconfirm --clean --onedir --name YGLocalInference `
  --hidden-import=uvicorn.logging --hidden-import=uvicorn.loops.auto `
  --hidden-import=uvicorn.protocols.http.auto --hidden-import=uvicorn.lifespan.on `
  --collect-all=onnxruntime --collect-all=cv2 --collect-all=scipy run.py
Write-Host 'EXE: dist/YGLocalInference/YGLocalInference.exe'
Write-Host 'Models and environment variables are intentionally external.'
