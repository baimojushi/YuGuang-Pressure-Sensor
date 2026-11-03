import serial
import time
from pathlib import Path

port = "COM12"
baud = 115200
duration_s = 30
out = Path(r"D:\yuguang_review\captures\com12_b_after_flash_30s.log")
out.parent.mkdir(parents=True, exist_ok=True)

ser = serial.Serial()
ser.port = port
ser.baudrate = baud
ser.timeout = 0.2
ser.dtr = False
ser.rts = False
ser.open()

end = time.monotonic() + duration_s
chunks = []
while time.monotonic() < end:
    data = ser.read(4096)
    if data:
        chunks.append(data)
ser.close()
raw = b"".join(chunks)
out.write_bytes(raw)
text = raw.decode("utf-8", errors="replace")
lines = [line for line in text.splitlines() if line.strip()]
keywords = ["yg_b_sensing_v21", "yg-b", "yg-b-ble", "YG-Sense", "radar", "ready=", "br=", "error", "assert", "guru"]
print(f"bytes={len(raw)} lines={len(lines)}")
for key in keywords:
    print(f"{key}={sum(key.lower() in line.lower() for line in lines)}")
print(f"out={out}")
