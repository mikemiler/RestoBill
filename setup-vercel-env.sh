#!/bin/bash

# Setup Vercel Environment Variables from .env file
# This script helps you configure Vercel environment variables automatically

echo "🚀 RestoBill - Vercel Environment Setup"
echo "========================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create .env file first (see .env.example)"
    exit 1
fi

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Vercel CLI not found. Installing..."
    npm install -g vercel
fi

echo "📋 Reading environment variables from .env..."
echo ""

# Load .env and set Vercel environment variables
source .env

echo "Setting up Vercel environment variables..."
echo ""

# Set each environment variable in Vercel
vercel env add DATABASE_URL production <<< "$DATABASE_URL"
vercel env add ANTHROPIC_API_KEY production <<< "$ANTHROPIC_API_KEY"
vercel env add NEXT_PUBLIC_SUPABASE_URL production <<< "$NEXT_PUBLIC_SUPABASE_URL"
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production <<< "$NEXT_PUBLIC_SUPABASE_ANON_KEY"
vercel env add SUPABASE_SERVICE_ROLE_KEY production <<< "$SUPABASE_SERVICE_ROLE_KEY"

echo ""
echo "✅ Environment variables configured for production!"
echo ""
echo "Optional: Also set for preview and development environments?"
read -p "Configure for preview? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    vercel env add DATABASE_URL preview <<< "$DATABASE_URL"
    vercel env add ANTHROPIC_API_KEY preview <<< "$ANTHROPIC_API_KEY"
    vercel env add NEXT_PUBLIC_SUPABASE_URL preview <<< "$NEXT_PUBLIC_SUPABASE_URL"
    vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview <<< "$NEXT_PUBLIC_SUPABASE_ANON_KEY"
    vercel env add SUPABASE_SERVICE_ROLE_KEY preview <<< "$SUPABASE_SERVICE_ROLE_KEY"
    echo "✅ Preview environment configured!"
fi

echo ""
echo "🎉 Setup complete! You can now deploy with: vercel --prod"
