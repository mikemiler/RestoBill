#!/bin/bash

echo "🚀 RestoBill Setup Script"
echo "=========================="
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ Error: .env.local not found!"
    echo "Please copy .env.example to .env.local and fill in your credentials."
    exit 1
fi

echo "✅ .env.local found"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo ""

# Generate Prisma Client
echo "🔧 Generating Prisma Client..."
npx prisma generate
echo ""

# Push database schema
echo "🗄️  Pushing database schema to Supabase..."
npx prisma db push
echo ""

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Create Supabase Storage bucket (see SUPABASE_SETUP.md)"
echo "2. Run: npm run dev"
echo "3. Open: http://localhost:3000"
echo ""
