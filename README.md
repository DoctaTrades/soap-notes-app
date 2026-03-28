# Restored Chiropractic — SOAP Notes App

Species-aware SOAP note system for chiropractic practice. Supports equine, canine, feline, swine, avian, caprine, and human patients. Built for GoHighLevel integration.

## Quick Start

```bash
npm install
npm run dev
```

## Deploy to Vercel

```bash
npx vercel --prod
```

## Adding Body Chart Images

Drop your skeletal/body chart images into `/public/images/` using these exact filenames:

| File | Description |
|------|-------------|
| `equine-lateral.jpg` | Equine lateral skeleton |
| `equine-dorsal.jpg` | Equine dorsal skeleton |
| `canine-lateral.jpg` | Canine lateral skeleton |
| `canine-dorsal.jpg` | Canine dorsal skeleton |
| `feline-lateral.jpg` | Feline lateral skeleton |
| `swine-lateral.jpg` | Swine lateral skeleton |
| `avian-lateral.jpg` | Avian lateral skeleton |
| `caprine-lateral.jpg` | Caprine lateral skeleton |
| `human-chart.jpg` | Human spine chart |

Images are served as static assets by Vercel for free. If a file is missing, a placeholder SVG shows instead.

## GoHighLevel Integration

### Step 1: Deploy to Vercel
Get your app URL (e.g., `https://soap-notes-app.vercel.app`)

### Step 2: Create GHL Private Integration
1. In GHL: Settings > Integrations > Private Integrations
2. Click Create New, name it "SOAP Notes"
3. Enable scopes: contacts.readonly, contacts.write
4. Copy the generated token

### Step 3: Configure the App
1. Open your deployed app
2. Go to Settings > GHL Integration
3. Paste your Private Integration Token and Location ID
4. Save

### Step 4: Add Custom Menu Link in GHL
1. In GHL: Settings > Custom Menu Links > Create New
2. Title: "SOAP Notes"
3. URL: `https://your-app.vercel.app/?contactId={{contact.id}}`
4. Open As: Embedded Page (iFrame)
5. Assign to your sub-account(s)

### Step 5 (Optional): Set Up GHL Custom Objects
Create "Patients", "SOAP Notes", and "Barns" custom objects for full directory sync.

## Tech Stack

- React 18 + Vite
- localStorage + GHL API v2
- Vercel hosting (free tier)
