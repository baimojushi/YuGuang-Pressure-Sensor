#!/bin/zsh
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null; then
  echo '请先安装 Node.js 22.13 或更高版本，再重新打开本文件。'
  read -k 1
  exit 1
fi
if curl -fsS http://localhost:3100/api/health 2>/dev/null | /usr/bin/grep -q 'MVP 0'; then
  open 'http://localhost:3100'
  exit 0
fi
if [ ! -d node_modules ]; then
  npm install || exit 1
fi
(sleep 2; open 'http://localhost:3100') &
echo '余光正在运行。关闭服务请在本窗口按 Control+C。'
npm start
