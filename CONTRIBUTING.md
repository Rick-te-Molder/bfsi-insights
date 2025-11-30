# Contributing to BFSI Insights

Thank you for your interest in contributing to BFSI Insights!

## Maintainer

**Rick te Molder** — [@Rick-te-Molder](https://github.com/Rick-te-Molder)

## How to Contribute

### Reporting Issues

- Use [GitHub Issues](https://github.com/Rick-te-Molder/bfsi-insights/issues) to report bugs or suggest features
- Check existing issues before creating a new one
- Provide clear reproduction steps for bugs

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes following the code style below
4. Run tests and linting (`npm run test && npm run lint`)
5. Commit with a descriptive message
6. Open a Pull Request against `main`

### Code Style

- **Linting:** ESLint + Prettier (auto-enforced via pre-commit hook)
- **Formatting:** Run `npm run lint` before committing
- **Tests:** Add tests for new functionality; don't reduce coverage

### Development Setup

```bash
# Clone and install
git clone https://github.com/Rick-te-Molder/bfsi-insights.git
cd bfsi-insights
npm install

# Start development server
npm run dev

# Run tests
npm run test
```

## Code of Conduct

Be respectful and constructive. We're here to build something useful together.

## Questions?

Open an issue or reach out to the maintainer.
