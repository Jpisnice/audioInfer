import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { platform } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const frontendDir = join(__dirname, '..');
const projectRootDir = join(frontendDir, '..');
const outputDir = join(frontendDir, 'src', 'generated');
const protoFile = join(projectRootDir, 'audio_transcription.proto');

// Ensure output directory exists
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

// Check if proto file exists
if (!existsSync(protoFile)) {
  console.error(`Proto file not found: ${protoFile}`);
  process.exit(1);
}

// Determine the plugin path based on platform
const isWindows = platform() === 'win32';
const pluginExt = isWindows ? '.cmd' : '';
const tsProtoPlugin = join(frontendDir, 'node_modules', '.bin', `protoc-gen-ts_proto${pluginExt}`);

// Check if plugin exists
if (!existsSync(tsProtoPlugin)) {
  console.error(`ts-proto plugin not found: ${tsProtoPlugin}`);
  console.error('Make sure ts-proto is installed: pnpm add -D ts-proto');
  process.exit(1);
}

// Generate TypeScript files using ts-proto with grpc-web support
const protocCommand = [
  'protoc',
  `--plugin=protoc-gen-ts_proto="${tsProtoPlugin}"`,
  `--ts_proto_out=${outputDir}`,
  `--ts_proto_opt=outputServices=grpc-web,esModuleInterop=true,useExactTypes=false,env=node,useOptionals=messages,outputTypeRegistry=true`,
  `-I=${projectRootDir}`,
  protoFile,
].join(' ');

console.log('Generating TypeScript files from proto...');
console.log(`Command: ${protocCommand}\n`);

try {
  execSync(protocCommand, { 
    stdio: 'inherit',
    cwd: frontendDir,
    shell: true,
  });
  console.log('\n✅ Proto files generated successfully!');
  console.log(`Output directory: ${outputDir}`);
} catch (error) {
  console.error('\n❌ Failed to generate proto files');
  console.error('\nMake sure protoc is installed and in your PATH.');
  console.error('On Windows, you can install it via:');
  console.error('  - Using Chocolatey: choco install protoc');
  console.error('  - Or download from: https://github.com/protocolbuffers/protobuf/releases');
  console.error('\nVerify installation with: protoc --version');
  process.exit(1);
}

