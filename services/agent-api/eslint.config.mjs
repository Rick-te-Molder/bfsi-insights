export default [
  {
    files: ['src/**/*.js'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env'][property.name='PUBLIC_SUPABASE_URL']",
          message:
            'Do not read process.env.PUBLIC_SUPABASE_URL directly. Use the canonical env module (src/config/env.js).',
        },
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env'][property.name='PUBLIC_SUPABASE_ANON_KEY']",
          message:
            'Do not read process.env.PUBLIC_SUPABASE_ANON_KEY directly. Use the canonical env module (src/config/env.js).',
        },
      ],
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
    // Temporary allowlist: existing legacy reads will be removed in follow-up PRs.
    files: [
      'src/config/env.js',
      'src/env-shim.js',
      'src/index.js',
      'src/agents/discover-classics-db.js',
      'src/agents/discoverer.js',
      'src/agents/improver-config.js',
      'src/agents/orchestrator.js',
      'src/agents/scorer-prompt.js',
      'src/agents/summarizer.js',
      'src/agents/tagger-config.js',
      'src/cli/commands/eval.js',
      'src/cli/commands/fetch.js',
      'src/cli/commands/filter.js',
      'src/cli/commands/health.js',
      'src/cli/commands/summarize.js',
      'src/cli/commands/tag.js',
      'src/cli/commands/thumbnail.js',
      'src/lib/discovery-config.js',
      'src/lib/discovery-queue.js',
      'src/lib/embeddings.js',
      'src/lib/evals-config.js',
      'src/lib/pdf-extractor.js',
      'src/lib/pipeline-tracking.js',
      'src/lib/prompt-eval.js',
      'src/lib/queue-update.js',
      'src/lib/replay-helpers.js',
      'src/lib/runner.js',
      'src/lib/state-machine.js',
      'src/lib/status-codes.js',
      'src/lib/supabase.js',
      'src/lib/taxonomy-loader.js',
      'src/lib/vendor-loader.js',
      'src/lib/wip-limits.js',
      'src/routes/agent-jobs.js',
      'src/routes/agents/discovery.js',
      'src/routes/agents/filter.js',
      'src/routes/agents/summarize.js',
      'src/routes/agents/tag.js',
      'src/routes/agents/thumbnail.js',
      'src/routes/discovery-control.js',
      'src/routes/evals.js',
      'src/scripts/utils.js',
      'src/scripts/validate-agent-registry.js',
    ],
    rules: {
      'no-restricted-syntax': 'off',
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
