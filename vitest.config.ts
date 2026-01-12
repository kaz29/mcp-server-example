import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['reflect-metadata'],
    include: ['**/*.{spec,test}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'build', 'test/integration/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.spec.ts',
        '**/*.test.ts',
        'test/**',
        'vitest.config.ts',
        'src/main.ts',
        'src/app.module.ts',
        'src/mcp/mcp.module.ts',
        '**/*.mjs',
      ],
    },
  },
});
