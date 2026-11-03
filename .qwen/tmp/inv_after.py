import os
import time as _t

def size_of(p):
    t = 0
    c = 0
    for dp, dns, fns in os.walk(p):
        for f in fns:
            try:
                t += os.path.getsize(os.path.join(dp, f))
                c += 1
            except OSError:
                pass
    return t, c

lines = []
for root in (r"D:\yuguang_review", r"D:\项目\交互艺术\冥想室\余光开发"):
    lines.append("== " + root)
    rows = []
    for name in os.listdir(root):
        p = os.path.join(root, name)
        try:
            mt = _t.strftime("%m-%d %H:%M", _t.localtime(os.path.getmtime(p)))
        except OSError:
            mt = "?"
        if os.path.isdir(p):
            t, c = size_of(p)
            rows.append((t, c, mt, "<DIR> " + name))
        else:
            rows.append((os.path.getsize(p), 0, mt, name))
    rows.sort(reverse=True)
    for t, c, mt, n in rows:
        lines.append(f"{t/1048576:10.1f} MB {c:6}  {mt}  {n}")
    lines.append("")

text = "\n".join(lines)
print(text)
os.makedirs(r"D:\yuguang_review\.qwen\tmp", exist_ok=True)
open(r"D:\yuguang_review\.qwen\tmp\after_cleanup.txt", "w", encoding="utf-8").write(text)
