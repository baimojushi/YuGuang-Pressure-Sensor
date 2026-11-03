import serial
import time
from pathlib import Path

out = Path(r"D:\yuguang_review\captures\com12_b_reset_boot_15s.log")
ser = serial.Serial()
ser.port = "COM12"
ser.baudrate = 115200
ser.timeout = 0.1
ser.dtr = False
ser.rts = False
ser.open()
ser.reset_input_buffer()

# Normal hardware reset: pulse EN low via RTS, keep GPIO0 released via DTR.
ser.dtr = False
ser.rts = True
time.sleep(0.15)
ser.rts = False

end = time.monotonic() + 15
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
print(f"bytes={len(raw)} lines={len(lines)}")
for key in ["yg_b_sensing_v21", "yg-b", "v2.1 B sensor", "radar", "YG-Sense", "error", "assert", "guru"]:
    print(f"{key}={sum(key.lower() in line.lower() for line in lines)}")
print(f"out={out}")
