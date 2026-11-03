import os
import time as _t

root = r"D:\项目\交互艺术\冥想室\余光开发"
lines = ["== FILES =="]
files = []
dirs = []
for name in os.listdir(root):
    p = os.path.join(root, name)
    try:
        mt = _t.strftime("%m-%d %H:%M", _t.localtime(os.path.getmtime(p)))
    except OSError:
        mt = "?"
    if os.path.isdir(p):
        dirs.append((name, mt))
    else:
        files.append((os.path.getsize(p), mt, name))

files.sort()
for sz, mt, name in files:
    lines.append(f"{sz/1048576:9.3f} MB  {mt}  {name}")
lines.append("")
lines.append("== DIRS ==")
for name, mt in sorted(dirs):
    lines.append(f"{'':12}  {mt}  {name}")

text = "\n".join(lines)
print(text)
os.makedirs(r"D:\yuguang_review\.qwen\tmp", exist_ok=True)
open(r"D:\yuguang_review\.qwen\tmp\ws_root_full.txt", "w", encoding="utf-8").write(text)
