const typescript = require('@rollup/plugin-typescript');
const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const terser = require('@rollup/plugin-terser');
const pkg = require('./package.json');

const isProduction = process.env.NODE_ENV === 'production';

module.exports = [
  // CommonJS 构建（Node.js）
  {
    input: 'src/index.ts',
    output: {
      file: pkg.main,
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    external: [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.peerDependencies || {}),
    ],
    plugins: [
      resolve({
        preferBuiltins: true,
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: './dist',
        rootDir: './src',
      }),
      isProduction && terser(),
    ],
  },
  // ES Module 构建（现代浏览器和打包工具）
  {
    input: 'src/index.ts',
    output: {
      file: pkg.module,
      format: 'es',
      sourcemap: true,
    },
    external: [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.peerDependencies || {}),
    ],
    plugins: [
      resolve({
        preferBuiltins: true,
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        rootDir: './src',
      }),
      isProduction && terser(),
    ],
  },
  // UMD 构建（浏览器全局变量）
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.umd.js',
      format: 'umd',
      name: 'WESClientSDK',
      sourcemap: true,
      globals: {
        axios: 'axios',
        ws: 'WebSocket',
      },
    },
    external: ['axios', 'ws'],
    plugins: [
      resolve({
        browser: true,
        preferBuiltins: false,
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        rootDir: './src',
      }),
      isProduction && terser(),
    ],
  },
  // Mock 包 - CommonJS
  {
    input: 'mock/index.ts',
    output: {
      file: 'dist/mock/index.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    external: [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.peerDependencies || {}),
      // 注意：不将内部模块设为 external，让 rollup 打包它们
    ],
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: './dist/mock',
        isolatedModules: false,
        filterRoot: process.cwd(),
      }),
      resolve({
        preferBuiltins: true,
      }),
      commonjs(),
      isProduction && terser(),
    ],
  },
  // Mock 包 - ES Module
  {
    input: 'mock/index.ts',
    output: {
      file: 'dist/mock/index.esm.js',
      format: 'es',
      sourcemap: true,
    },
    external: [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.peerDependencies || {}),
      // 注意：不将内部模块设为 external，让 rollup 打包它们
    ],
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: './dist/mock',
        isolatedModules: false,
        filterRoot: process.cwd(),
      }),
      resolve({
        preferBuiltins: true,
      }),
      commonjs(),
      isProduction && terser(),
    ],
  },
];

