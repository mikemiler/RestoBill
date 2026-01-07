#!/bin/bash

# Non-interactive Vercel Environment Setup Script
# Automatically sets all environment variables for production, preview, and development

set -e  # Exit on error

echo "🚀 RestoBill - Vercel Environment Setup (Non-Interactive)"
echo "============================================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create .env file first (see .env.example)"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

echo "📋 Environment variables loaded from .env"
echo ""

# Check required variables
REQUIRED_VARS=("DATABASE_URL" "ANTHROPIC_API_KEY" "NEXT_PUBLIC_SUPABASE_URL" "NEXT_PUBLIC_SUPABASE_ANON_KEY" "SUPABASE_SERVICE_ROLE_KEY")

for VAR in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!VAR}" ]; then
        echo "❌ Error: $VAR is not set in .env"
        exit 1
    fi
done

echo "✅ All required environment variables found"
echo ""

# Function to set env var for all environments
set_env_var() {
    local name=$1
    local value=$2

    echo "Setting $name..."

    # Production
    echo "$value" | vercel env add "$name" production --yes 2>/dev/null || \
    vercel env rm "$name" production --yes 2>/dev/null && \
    echo "$value" | vercel env add "$name" production --yes

    # Preview
    echo "$value" | vercel env add "$name" preview --yes 2>/dev/null || \
    vercel env rm "$name" preview --yes 2>/dev/null && \
    echo "$value" | vercel env add "$name" preview --yes

    # Development
    echo "$value" | vercel env add "$name" development --yes 2>/dev/null || \
    vercel env rm "$name" development --yes 2>/dev/null && \
    echo "$value" | vercel env add "$name" development --yes
}

echo "🔧 Setting environment variables in Vercel..."
echo ""

# Set all variables
set_env_var "DATABASE_URL" "$DATABASE_URL"
set_env_var "ANTHROPIC_API_KEY" "$ANTHROPIC_API_KEY"
set_env_var "NEXT_PUBLIC_SUPABASE_URL" "$NEXT_PUBLIC_SUPABASE_URL"
set_env_var "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$NEXT_PUBLIC_SUPABASE_ANON_KEY"
set_env_var "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY"

echo ""
echo "✅ All environment variables configured!"
echo ""
echo "📝 Summary:"
echo "  - DATABASE_URL: Set"
echo "  - ANTHROPIC_API_KEY: Set"
echo "  - NEXT_PUBLIC_SUPABASE_URL: Set"
echo "  - NEXT_PUBLIC_SUPABASE_ANON_KEY: Set"
echo "  - SUPABASE_SERVICE_ROLE_KEY: Set"
echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Deploy to Vercel: vercel --prod"
echo "  2. Or redeploy from dashboard if already deployed"
echo ""
echo "⚠️  Remember to rotate your API keys (see SECURITY_NOTICE.md)"
