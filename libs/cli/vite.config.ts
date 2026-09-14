import { defineConfig } from 'vite';

import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/cli',

  plugins: [tsconfigPaths()],

  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ tsconfigPaths() ],
  // },

  test: {
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: { reportsDirectory: '../../coverage/libs/cli', provider: 'v8' },
  },
});
