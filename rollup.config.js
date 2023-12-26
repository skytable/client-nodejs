// rollup.config.js
const typescript = require('@rollup/plugin-typescript');

module.exports = {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/esm/index.mjs',
      format: 'es',
      sourcemap: false,
    },
  ],
  plugins: [
    typescript({
      tsconfig: 'tsconfig-esm.json',
      sourceMap: false,
      outputToFilesystem: true,
    }),
  ],
}
