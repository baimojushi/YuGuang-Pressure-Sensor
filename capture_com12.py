import serial, time, os, json

PORT = 'COM12'
BAUD = 115200
SECONDS = 60
OUT_DIR = r'D:\yuguang_review\captures'
os.makedirs(OUT_DIR, exist_ok=True)
OUT = os.path.join(OUT_DIR, 'com12_115200_60s.log')
SUMMARY = os.path.join(OUT_DIR, 'com12_115200_60s.summary.txt')

ser = serial.Serial(PORT, BAUD, timeout=0.2)
ser.dtr = False
ser.rts = False
t0 = time.time()
chunks = []
total = 0
while time.time() - t0 < SECONDS:
    data = ser.read(4096)
    if data:
        chunks.append(data)
        total += len(data)
ser.close()

raw = b''.join(chunks)
with open(OUT, 'wb') as f:
    f.write(raw)

text = raw.decode('utf-8', 'replace')
rows = [l.rstrip('\r') for l in text.split('\n') if l.strip()]

kw = {'yg-b': 0, 'yg-b-ble': 0, 'radar': 0, 'br=': 0, 'e (': 0, 'w (': 0,
      'boot': 0, 'assert': 0, 'rst:': 0, 'guru': 0}
for l in rows:
    low = l.lower()
    for k in kw:
        if k in low:
            kw[k] += 1

with open(SUMMARY, 'w', encoding='utf-8') as f:
    f.write('PORT=%s BAUD=%d seconds=%.0f\n' % (PORT, BAUD, SECONDS))
    f.write('bytes=%d nonempty_lines=%d\n' % (total, len(rows)))
    f.write('keywords=%s\n' % json.dumps(kw))
    f.write('--- first 25 lines ---\n')
    for l in rows[:25]:
        f.write(l[:200] + '\n')
    f.write('--- last 20 lines ---\n')
    for l in rows[-20:]:
        f.write(l[:200] + '\n')

print('DONE bytes=%d lines=%d' % (total, len(rows)))
print('kw=' + json.dumps(kw))
print('OUT=' + OUT)
print('SUMMARY=' + SUMMARY)
