#!/bin/bash
# Cleanup migration files (optional - keep for reference)

echo "⚠️  This script removes migration helper files."
echo "   These files are safe to remove after migration is complete."
echo "   However, it's recommended to keep them for future reference."
echo ""
read -p "Continue? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Cancelled."
    exit 1
fi

echo "Removing migration helper files..."
echo ""

# Files to remove (optional)
FILES=(
    "setup-sqlite.js"
    "test-sqlite.js"
    "test-api-endpoints.js"
    "cleanup-migration-files.sh"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "Removing $file"
        rm "$file"
    else
        echo "$file not found (already removed?)"
    fi
done

echo ""
echo "✅ Cleanup complete."
echo ""
echo "📋 Files kept for production:"
echo "   - data/database.sqlite (main database)"
echo "   - models/db-sqlite.js (SQLite implementation)"
echo "   - models/db.js (smart wrapper)"
echo "   - routes/api.js (updated with financial endpoint)"
echo "   - MIGRATION_GUIDE.md (documentation)"
echo "   - MIGRATION_SUMMARY.md (summary)"
echo ""
echo "📋 Files kept for maintenance:"
echo "   - migrate-to-sqlite.js (for future migrations)"
echo "   - data/db.json.backup-* (original data backup)"
echo ""