import zipfile
from pathlib import Path

ZIP = Path(r"D:\BaiduNetdiskDownload\YG_Local_LAN_v3_complete.zip")
out = []

with zipfile.ZipFile(ZIP) as z:
    infos = z.infolist()
    out.append(f"zip size: {ZIP.stat().st_size} bytes")
    out.append(f"entries: {len(infos)}")
    total = sum(i.file_size for i in infos)
    out.append(f"uncompressed: {total/1048576:.1f} MB")
    out.append("")
    # top-level structure summary
    tops = {}
    for i in infos:
        parts = i.filename.split("/")
        top = parts[0] if len(parts) > 1 else "(root)"
        d = tops.setdefault(top, [0, 0])
        d[0] += 1
        d[1] += i.file_size
    out.append("--- top-level ---")
    for t, (n, sz) in sorted(tops.items(), key=lambda x: -x[1][1]):
        out.append(f"{sz/1048576:10.1f} MB  {n:6} files  {t}")
    out.append("")
    out.append("--- root-level files ---")
    for i in infos:
        if "/" not in i.filename.rstrip("/"):
            out.append(f"{i.file_size:10,} B  {i.filename}")
    out.append("")
    out.append("--- non-node_modules tree (first 120) ---")
    shown = 0
    for i in infos:
        name = i.filename
        if "node_modules" in name:
            continue
        if shown >= 120:
            out.append("   ...")
            break
        depth = name.rstrip("/").count("/")
        if i.is_dir() or depth <= 2:
            kind = "DIR " if i.is_dir() else "FILE"
            out.append(f"{i.file_size:10,} B  {kind} {name}")
            shown += 1

print("\n".join(out[:200]))
Path(r"D:\yuguang_review\.qwen\tmp\lan_zip_listing.txt").write_text("\n".join(out), encoding="utf-8")
