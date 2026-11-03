#!/usr/bin/env python3
"""Package versioned source only. Never include runtime data or local credentials."""
import datetime
import hashlib
import json
from pathlib import Path, PurePosixPath
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parent.parent
def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT).decode().strip()

if git('status', '--porcelain'):
    raise SystemExit('请先提交本次交接文件，再生成带准确 commit 的交接包。')
commit = git('rev-parse', 'HEAD')
files = git('ls-files', '-z').split('\0')
payload = {}
for name in files:
    if not name:
        continue
    parts = PurePosixPath(name).parts
    if any(p in {'.git', 'node_modules', 'data', 'data-v2', '__pycache__'} for p in parts):
        raise SystemExit(f'拒绝打包运行目录：{name}')
    if any(p.startswith('.env') and p != '.env.example' for p in parts):
        raise SystemExit(f'拒绝打包凭据：{name}')
    file = ROOT / name
    if file.is_symlink() or not file.is_file():
        raise SystemExit(f'拒绝打包特殊文件：{name}')
    payload['yuguang/' + name] = file.read_bytes()
html = (ROOT / 'handoff/index.html').read_text()
html = html.replace('href="../docs/', 'href="yuguang/docs/')
html = html.replace('href="余光设备接口.postman_collection.json"',
                    'href="yuguang/handoff/余光设备接口.postman_collection.json"')
payload['打开交接.html'] = html.encode()
payload['先读我.txt'] = ('余光队友交接包\n\n'
    '1. 解压后双击“打开交接.html”，这是可填写、勾选和导出进度的交接面板。\n'
    '2. 源码在 yuguang/，完整说明在 yuguang/docs/队友交接与灵机接入.md。\n'
    '3. 安装 Node.js 22.13+，进入 yuguang 文件夹执行 npm ci，再执行 npm start。\n'
    '4. 打开 http://localhost:3100/，默认本地 SQLite，无真实数据；正式云端地址在面板中。\n'
    '5. 交接包未完成灵机平台或真机接入。面板用于共同确认进度，不会检测硬件。\n'
    '6. 本包不带 .env、真实账号、数据库、录音或密钥。请勿回传包含秘密的环境文件。\n'
    f'\n源码 commit：{commit}\n仓库：https://github.com/Mon24123/yuguang-mvp0（私有，协作需邀请）\n'
    'ZIP 是固定快照，后续持续开发请同步 GitHub 仓库。\n').encode()
payload['版本.json'] = json.dumps({
    'project': '余光', 'sourceCommit': commit,
    'createdAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'repository': 'https://github.com/Mon24123/yuguang-mvp0',
    'hardwareStatus': '灵机平台适配与真机联调待完成',
    'defaultLocalStorage': 'SQLite; empty live space; no .env included',
}, ensure_ascii=False, indent=2).encode()
payload['文件校验SHA256.json'] = json.dumps(
    {name: hashlib.sha256(data).hexdigest() for name, data in sorted(payload.items())},
    ensure_ascii=False, indent=2).encode()
dest = ROOT.parent / '余光-队友交接包-20261030.zip'
with zipfile.ZipFile(dest, 'w', zipfile.ZIP_DEFLATED) as archive:
    for name, data in payload.items():
        archive.writestr('余光队友交接/' + name, data)
with zipfile.ZipFile(dest) as archive:
    assert archive.testzip() is None
print(json.dumps({'path': str(dest), 'commit': commit, 'files': len(payload),
                  'bytes': dest.stat().st_size}, ensure_ascii=False))
