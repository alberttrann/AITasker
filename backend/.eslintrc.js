module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: { project: 'tsconfig.json', tsconfigRootDir: __dirname, sourceType: 'module' },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: ['plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'],
  root: true,
  env: { node: true, jest: true },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'prettier/prettier': ['error', { endOfLine: 'auto' }],
    // 1. Cho phép khai báo biến nhưng không dùng (Hoặc tự bỏ qua nếu có dấu gạch dưới _)
    '@typescript-eslint/no-unused-vars': ['warn', { 
      'argsIgnorePattern': '^_', 
      'varsIgnorePattern': '^_',
      'ignoreRestSiblings': true 
    }],

    // Nếu bạn muốn TẮT HOÀN TOÀN lỗi biến không sử dụng, hãy dùng dòng này thay thế:
    // '@typescript-eslint/no-unused-vars': 'off',

    // 2. Cho phép sử dụng kiểu dữ liệu `Function` trong file test
    '@typescript-eslint/ban-types': 'off',

    // 3. Cho phép dùng comment // @ts-nocheck để bỏ qua check lỗi nhanh
    '@typescript-eslint/ban-ts-comment': 'off',
  },
};
