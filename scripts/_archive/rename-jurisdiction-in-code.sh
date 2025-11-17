#!/bin/bash
# Rename all jurisdiction references to geography in client code

FILES=(
  "src/pages/updates.json.ts"
  "src/features/resources/resource-modal.ts"
  "src/client-init.ts"
  "src/features/resources/resource-filters.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    sed -i '' 's/jurisdiction/geography/g' "$file"
    echo "✓ Updated $file"
  fi
done

echo "✅ All files updated"
