module.exports = {
  root: true,
  env: { node: true, es2023: true, jest: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2023, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['dist', 'node_modules', 'postman'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    // `ignoreRestSiblings` allows the omit-a-field idiom — `const { secret,
    // ...rest } = row` — which is how entities are narrowed to DTOs here.
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
    ],
    'no-console': 'off',
  },
};
