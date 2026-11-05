module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: {
    es2022: true,
    node: true,
  },
  rules: {
    'no-inline-comments': 'error',
    'spaced-comment': ['error', 'never'],
    '@typescript-eslint/no-unused-vars': [
      'error',
      {argsIgnorePattern: '^_', varsIgnorePattern: '^_'},
    ],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'error',
  },
  overrides: [
    {
      files: ['src/**/*.tsx'],
      rules: {
        'max-lines': [
          'error',
          {max: 200, skipBlankLines: false, skipComments: false},
        ],
      },
    },
    {
      files: ['src/**/ui/*.tsx'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: "CallExpression[callee.name='useEffect']",
            message: 'useEffect is forbidden inside declarative ui/ components.',
          },
        ],
      },
    },
    {
      files: ['src/shared/**/*'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              '@entities/*',
              '@features/*',
              '@widgets/*',
              '@pages/*',
              '@app/*',
            ],
          },
        ],
      },
    },
    {
      files: ['src/entities/**/*'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: ['@features/*', '@widgets/*', '@pages/*', '@app/*'],
          },
        ],
      },
    },
    {
      files: ['src/features/**/*'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: ['@widgets/*', '@pages/*', '@app/*'],
          },
        ],
      },
    },
    {
      files: ['src/widgets/**/*'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: ['@pages/*', '@app/*'],
          },
        ],
      },
    },
    {
      files: ['src/pages/**/*'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: ['@app/*'],
          },
        ],
      },
    },
  ],
};

