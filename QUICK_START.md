# 🚀 RestoBill - Quick Start

## Vom Handy deployen (8 Minuten)

### 1. Vercel öffnen
https://vercel.com/new

### 2. Repository importieren
- Repo: `mikemiler/RestoBill`
- Branch: `claude/fix-invoice-creation-error-cFH36`

### 3. Environment Variables (alle mit ✓ Production, Preview, Development)

```
DATABASE_URL
postgresql://postgres:restobill0815@db.iddnvilcnmaswxrlbhoo.supabase.co:5432/postgres

ANTHROPIC_API_KEY
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

NEXT_PUBLIC_SUPABASE_URL
https://iddnvilcnmaswxrlbhoo.supabase.co

NEXT_PUBLIC_SUPABASE_ANON_KEY
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkZG52aWxjbm1hc3d4cmxiaG9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MDYwODIsImV4cCI6MjA4MzM4MjA4Mn0.y-jVZs9McdP2WIPqSOQzA1rrfRJhEVJZuQwAbgGSj0c

SUPABASE_SERVICE_ROLE_KEY
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkZG52aWxjbm1hc3d4cmxiaG9vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzgwNjA4MiwiZXhwIjoyMDgzMzgyMDgyfQ.lnh3pa0QV_ngksVO9E4S6hCHhVOk3ly5xw5_m1e9EGc
```

### 4. Deploy klicken ✅

### 5. Datenbank-Schema erstellen
https://supabase.com/dashboard → SQL Editor

Siehe: `prisma/init-schema.sql` oder `MOBILE_DEPLOYMENT.md`

### 6. Fertig! 🎉

---

## Detaillierte Anleitung
Siehe: **MOBILE_DEPLOYMENT.md**

## Sicherheit
⚠️ **Danach Keys rotieren!** Siehe: **SECURITY_NOTICE.md**
