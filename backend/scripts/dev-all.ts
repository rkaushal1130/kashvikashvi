import { spawn, ChildProcess } from 'child_process';
import net from 'net';
import path from 'path';

function checkPort(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(400);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function waitForPort(port: number, timeoutMs = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await checkPort(port)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function main() {
  let dbProcess: ChildProcess | null = null;
  let serverProcess: ChildProcess | null = null;

  const cleanup = () => {
    if (serverProcess) {
      serverProcess.kill('SIGINT');
      serverProcess = null;
    }
    if (dbProcess) {
      dbProcess.kill('SIGINT');
      dbProcess = null;
    }
  };

  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });

  const isDbRunning = await checkPort(5432);

  if (isDbRunning) {
    console.log('✅ PostgreSQL is already running on port 5432.');
  } else {
    console.log('📦 Starting embedded PostgreSQL on port 5432...');
    dbProcess = spawn('npx', ['tsx', path.resolve(__dirname, 'test-pg.ts')], {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..'),
    });

    const ready = await waitForPort(5432);
    if (!ready) {
      console.error('❌ Embedded PostgreSQL failed to start within 15 seconds.');
      cleanup();
      process.exit(1);
    }
    console.log('✅ PostgreSQL is ready and accepting connections.');
  }

  console.log('🚀 Starting backend server with tsx watch...');
  serverProcess = spawn('npx', ['tsx', 'watch', 'src/server.ts'], {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
  });

  serverProcess.on('exit', (code) => {
    cleanup();
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error('Error in dev:all runner:', err);
  process.exit(1);
});
