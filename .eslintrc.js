module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  rules: {
    // TypeScript-specific rules
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'warn',
    '@typescript-eslint/no-unsafe-call': 'warn',
    '@typescript-eslint/no-unsafe-return': 'warn',
    '@typescript-eslint/require-await': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'warn',
    '@typescript-eslint/prefer-optional-chain': 'warn',
    '@typescript-eslint/ban-types': 'error',
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    '@typescript-eslint/restrict-template-expressions': 'warn',
    
    // General code quality rules
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'eqeqeq': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-arrow-callback': 'warn',
    'no-throw-literal': 'error',
  },
  env: {
    node: true,
    es6: true,
  },
  ignorePatterns: ['dist', 'node_modules', '**/*.js', '.eslintrc.js'],
  overrides: [
    {
      files: ['*.spec.ts', '*.test.ts'],
      rules: {
        // Relaxed rules for test files
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
      },
      env: {
        jest: true,
      },
    },
  ],
}; 