#!/bin/bash
#
# Reorganize scripts into production-grade structure
# Run from project root: bash scripts/reorganize-scripts.sh
#

set -e

echo "🧹 Reorganizing scripts directory..."
echo ""

# Create new directory structure
echo "Creating new directory structure..."
mkdir -p scripts/agents
mkdir -p scripts/publishing
mkdir -p scripts/utilities
mkdir -p scripts/testing
mkdir -p scripts/_archive/lib

# Move AGENTS
echo "🤖 Moving agents..."
if [ -f scripts/discover.mjs ]; then
  mv scripts/discover.mjs scripts/agents/
  echo "  ✓ discover.mjs -> agents/"
fi

if [ -f scripts/enrich.mjs ]; then
  mv scripts/enrich.mjs scripts/agents/
  echo "  ✓ enrich.mjs -> agents/"
fi

# Move PUBLISHING
echo ""
echo "📦 Moving publishing scripts..."
if [ -f scripts/build-resources.mjs ]; then
  mv scripts/build-resources.mjs scripts/publishing/
  echo "  ✓ build-resources.mjs -> publishing/"
fi

if [ -f scripts/validate-resources.mjs ]; then
  mv scripts/validate-resources.mjs scripts/publishing/
  echo "  ✓ validate-resources.mjs -> publishing/"
fi

# Move UTILITIES
echo ""
echo "🔧 Moving utilities..."
if [ -f scripts/generate-thumbnails.mjs ]; then
  mv scripts/generate-thumbnails.mjs scripts/utilities/
  echo "  ✓ generate-thumbnails.mjs -> utilities/"
fi

if [ -f scripts/check-links.mjs ]; then
  mv scripts/check-links.mjs scripts/utilities/
  echo "  ✓ check-links.mjs -> utilities/"
fi

if [ -f scripts/generate-notes.mjs ]; then
  mv scripts/generate-notes.mjs scripts/utilities/
  echo "  ✓ generate-notes.mjs -> utilities/"
fi

if [ -f scripts/lint-items-no-time.mjs ]; then
  mv scripts/lint-items-no-time.mjs scripts/utilities/
  echo "  ✓ lint-items-no-time.mjs -> utilities/"
fi

if [ -f scripts/filename-helper.mjs ]; then
  mv scripts/filename-helper.mjs scripts/utilities/
  echo "  ✓ filename-helper.mjs -> utilities/"
fi

if [ -f scripts/extract-pdf.py ]; then
  mv scripts/extract-pdf.py scripts/utilities/
  echo "  ✓ extract-pdf.py -> utilities/"
fi

# Move TESTING
echo ""
echo "🧪 Moving testing scripts..."
if [ -f scripts/test-pipeline.mjs ]; then
  mv scripts/test-pipeline.mjs scripts/testing/
  echo "  ✓ test-pipeline.mjs -> testing/"
fi

# Archive OBSOLETE scripts
echo ""
echo "🗄️  Archiving obsolete scripts..."
if [ -f scripts/autonomous-resource-enricher.mjs ]; then
  mv scripts/autonomous-resource-enricher.mjs scripts/_archive/
  echo "  ✓ autonomous-resource-enricher.mjs -> _archive/ (replaced by enrich.mjs)"
fi

if [ -f scripts/add-thumbnails.mjs ]; then
  mv scripts/add-thumbnails.mjs scripts/_archive/
  echo "  ✓ add-thumbnails.mjs -> _archive/ (obsolete: used thum.io)"
fi

if [ -f scripts/fix-mckinsey-thumbnail.mjs ]; then
  mv scripts/fix-mckinsey-thumbnail.mjs scripts/_archive/
  echo "  ✓ fix-mckinsey-thumbnail.mjs -> _archive/ (one-off fix)"
fi

if [ -f scripts/fix-two-thumbnails.mjs ]; then
  mv scripts/fix-two-thumbnails.mjs scripts/_archive/
  echo "  ✓ fix-two-thumbnails.mjs -> _archive/ (one-off fix)"
fi

if [ -f scripts/migrate-thumbnails-to-local.mjs ]; then
  mv scripts/migrate-thumbnails-to-local.mjs scripts/_archive/
  echo "  ✓ migrate-thumbnails-to-local.mjs -> _archive/ (migration complete)"
fi

if [ -f scripts/generate-summaries.mjs ]; then
  mv scripts/generate-summaries.mjs scripts/_archive/
  echo "  ✓ generate-summaries.mjs -> _archive/ (replaced by enrich.mjs)"
fi

if [ -f scripts/apply-summaries.mjs ]; then
  mv scripts/apply-summaries.mjs scripts/_archive/
  echo "  ✓ apply-summaries.mjs -> _archive/ (replaced by enrich.mjs)"
fi

if [ -f scripts/migrate-jurisdiction-to-geography.mjs ]; then
  mv scripts/migrate-jurisdiction-to-geography.mjs scripts/_archive/
  echo "  ✓ migrate-jurisdiction-to-geography.mjs -> _archive/ (migration complete)"
fi

if [ -f scripts/rename-jurisdiction-in-code.sh ]; then
  mv scripts/rename-jurisdiction-in-code.sh scripts/_archive/
  echo "  ✓ rename-jurisdiction-in-code.sh -> _archive/ (migration complete)"
fi

# Archive lib directory
if [ -d scripts/lib ]; then
  mv scripts/lib/* scripts/_archive/lib/ 2>/dev/null || true
  rmdir scripts/lib 2>/dev/null || true
  echo "  ✓ lib/* -> _archive/lib/ (old utilities)"
fi

# Delete EMPTY files
echo ""
echo "🗑️  Removing empty/temporary files..."
if [ -f scripts/discover-sources-expanded.mjs ]; then
  rm -f scripts/discover-sources-expanded.mjs
  echo "  ✓ Deleted: discover-sources-expanded.mjs (empty file)"
fi

echo ""
echo "✅ Reorganization complete!"
echo ""
echo "New structure:"
echo ""
echo "scripts/"
echo "├── agents/"
echo "│   ├── discover.mjs"
echo "│   └── enrich.mjs"
echo "├── publishing/"
echo "│   ├── build-resources.mjs"
echo "│   └── validate-resources.mjs"
echo "├── utilities/"
echo "│   ├── generate-thumbnails.mjs"
echo "│   ├── check-links.mjs"
echo "│   ├── generate-notes.mjs"
echo "│   ├── lint-items-no-time.mjs"
echo "│   ├── filename-helper.mjs"
echo "│   └── extract-pdf.py"
echo "├── testing/"
echo "│   └── test-pipeline.mjs"
echo "├── _archive/"
echo "│   ├── (9 archived scripts)"
echo "│   └── lib/"
echo "├── README.md"
echo "└── reorganize-scripts.sh"
echo ""
echo "📝 Next steps:"
echo "1. Review the new structure above"
echo "2. Update package.json scripts (paths changed)"
echo "3. Run: npm run format"
echo "4. Commit: git add scripts/ && git commit -m 'Reorganize scripts into production structure'"
echo ""
echo "⚠️  IMPORTANT: Update these npm scripts in package.json:"
echo ""
echo '  "build:resources": "node scripts/publishing/build-resources.mjs",'
echo '  "validate:resources": "node scripts/publishing/validate-resources.mjs",'
echo '  "generate:thumbnails": "node scripts/utilities/generate-thumbnails.mjs",'
echo '  "check:links": "node scripts/utilities/check-links.mjs",'
echo '  "notes": "node scripts/utilities/generate-notes.mjs",'
echo '  "lint:items": "node scripts/utilities/lint-items-no-time.mjs",'
echo ""
