const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONFIG = {
  serverHost: process.env.DEPLOY_HOST || 'your-server-ip',
  serverUser: process.env.DEPLOY_USER || 'root',
  serverPath: process.env.DEPLOY_PATH || '/opt/lexi-strike',
  sshKey: process.env.DEPLOY_SSH_KEY || '~/.ssh/id_rsa',
};

function run(command) {
  console.log(`\n> ${command}`);
  execSync(command, { stdio: 'inherit' });
}

async function deploy() {
  console.log('=== LexiStrike Global 部署 ===');

  console.log('\n[1/5] 构建项目...');
  run('npm run build:all');

  console.log('\n[2/5] 打包文件...');
  run('tar -czf release.tar.gz server/dist client/dist server/package.json package.json Dockerfile docker-compose.yml');

  console.log('\n[3/5] 上传到服务器...');
  run(`scp -i ${CONFIG.sshKey} release.tar.gz ${CONFIG.serverUser}@${CONFIG.serverHost}:${CONFIG.serverPath}/`);

  console.log('\n[4/5] 远程部署...');
  run(`ssh -i ${CONFIG.sshKey} ${CONFIG.serverUser}@${CONFIG.serverHost} "cd ${CONFIG.serverPath} && tar -xzf release.tar.gz && docker-compose down && docker-compose up -d --build"`);

  console.log('\n[5/5] 清理...');
  fs.unlinkSync('release.tar.gz');

  console.log('\n✓ 部署完成!');
  console.log(`访问: http://${CONFIG.serverHost}`);
}

deploy().catch(err => {
  console.error('部署失败:', err.message);
  process.exit(1);
});