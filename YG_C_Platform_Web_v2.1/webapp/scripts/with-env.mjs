// Start the child after .env is loaded, so Node's proxy support sees startup env.
import {spawn} from 'node:child_process';
if (process.env.NODE_USE_ENV_PROXY === '1') {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 24 || (major === 24 && minor < 5)) {
    console.error('本机代理模式需要 Node.js 24.5 或以上；无代理环境仍支持 Node.js 22.13。');
    process.exit(1);
  }
}
const child = spawn(process.execPath, process.argv.slice(2), {stdio: 'inherit', env: process.env});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', () => {console.error('未能启动余光服务，请检查 Node.js 安装'); process.exitCode = 1;});
child.on('exit', (code, signal) => {process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 143);});
