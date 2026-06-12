/**
 * Node.js SEA (Single Executable Application) 打包脚本
 *
 * 流程：
 * 1. 用 esbuild 将应用打包成单个 JS 文件
 * 2. 用 node --experimental-sea-config 生成 blob
 * 3. 复制 node.exe 并注入 blob
 * 4. 输出到 release/exe/
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const RELEASE = path.join(ROOT, 'release', 'exe');
const BUNDLE = path.join(DIST, 'bundle.js');
const BLOB = path.join(DIST, 'sea-prep.blob');
const EXE = path.join(RELEASE, 'ai-proxy.exe');

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}

function main() {
  // 确保目录存在
  if (!fs.existsSync(DIST)) {
    fs.mkdirSync(DIST, { recursive: true });
  }
  if (!fs.existsSync(RELEASE)) {
    fs.mkdirSync(RELEASE, { recursive: true });
  }

  // 第一步：esbuild 打包成单文件
  console.log('\n[1/6] Bundling with esbuild...');
  run(`npx esbuild src/index.ts --bundle --platform=node --target=node22 --format=cjs --outfile=${BUNDLE}`);

  // 第二步：生成 SEA blob
  console.log('\n[2/6] Generating SEA blob...');
  run(`node --experimental-sea-config sea-config.json`);

  // 第三步：复制 node.exe 到 release/exe/
  console.log('\n[3/6] Copying node.exe...');
  const nodeExe = process.execPath;
  fs.copyFileSync(nodeExe, EXE);

  // 第四步：注入 blob
  console.log('\n[4/6] Injecting blob into exe...');
  run(`npx postject ${EXE} NODE_SEA_BLOB ${BLOB} --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`);

  // 第五步：复制配置文件到 release/exe/
  console.log('\n[5/6] Copying config files...');
  const configSrc = path.join(ROOT, 'config');
  const configDst = path.join(RELEASE, 'config');
  if (fs.existsSync(configDst)) {
    fs.rmSync(configDst, { recursive: true });
  }
  fs.cpSync(configSrc, configDst, { recursive: true });

  // 复制启动/停止脚本和说明文档
  const files = ['scripts/ai-proxy-start.bat', 'scripts/ai-proxy-stop.bat', 'installer/README.txt'];
  for (const f of files) {
    const src = path.join(ROOT, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(RELEASE, path.basename(f)));
    }
  }

  console.log(`\n✅ Done! Output directory: ${RELEASE}`);
  const size = (fs.statSync(EXE).size / 1024 / 1024).toFixed(1);
  console.log(`   ai-proxy.exe: ${size} MB`);
  console.log(`   config/models.yaml copied`);
  console.log(`   .env needs to be created manually`);
}

main();
