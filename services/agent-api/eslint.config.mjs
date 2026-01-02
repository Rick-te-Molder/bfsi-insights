export default [
  {
    files: ['src/**/*.js'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message:
            'Use randomInt() from lib/random.js instead. Math.random() is not cryptographically secure.',
        },
      ],
    },
  },
  {
    // Allow Math.random in tests
    files: ['**/*.test.js', '**/*.spec.js', 'tests/**/*.js'],
    rules: {
      'no-restricted-properties': 'off',
    },
  },
];
