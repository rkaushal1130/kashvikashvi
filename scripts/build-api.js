import esbuild from '../backend/node_modules/esbuild/lib/main.js';

try {
  await esbuild.build({
    entryPoints: ['backend/src/app.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    outfile: 'api/index.js',
    packages: 'external',
  });
  console.log('✅ Successfully bundled backend/src/app.ts into api/index.js');
} catch (error) {
  console.error('❌ Failed to bundle API:', error);
  process.exit(1);
}
