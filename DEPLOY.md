# Deployment Guide — Social Media Automation Platform

## STEP 1 — Railway (Backend + PostgreSQL)

1. Go to https://railway.app → New Project → Deploy from GitHub
2. Select the `backend/` folder (or use Railway monorepo settings)
3. Add a PostgreSQL plugin: + New → Database → PostgreSQL
4. Copy the DATABASE_URL from the PostgreSQL plugin

### Set all environment variables in Railway:
```
DATABASE_URL=<from PostgreSQL plugin>
JWT_SECRET=<generate a strong random string>
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=YourStrongPassword123
GEMINI_API_KEY=<from Google AI Studio>
OPENAI_API_KEY=<from OpenAI platform>
REPLICATE_API_TOKEN=<from replicate.com>
CLOUDINARY_CLOUD_NAME=<from cloudinary.com>
CLOUDINARY_API_KEY=<from cloudinary.com>
CLOUDINARY_API_SECRET=<from cloudinary.com>
WHATSAPP_API_TOKEN=<from Meta Business>
WHATSAPP_PHONE_NUMBER_ID=<from Meta Business>
WHATSAPP_VERIFY_TOKEN=myverifytoken123
FACEBOOK_APP_ID=<from Meta Developers>
FACEBOOK_APP_SECRET=<from Meta Developers>
FRONTEND_URL=https://your-app.vercel.app
NODE_ENV=production
```

5. The `railway.toml` will auto-run: `prisma migrate deploy && node server.js`
6. After first deploy, run the seed: Connect via Railway shell → `npm run db:seed`
7. Copy your Railway backend URL (e.g., https://your-api.railway.app)

---

## STEP 2 — Vercel (Frontend)

1. Go to https://vercel.com → New Project → Import GitHub repo
2. Set root directory to `frontend/`
3. Framework: Vite
4. Add environment variable:
   ```
   VITE_API_URL=https://your-api.railway.app
   ```
5. Deploy → Copy your Vercel URL

---

## STEP 3 — Meta WhatsApp Webhook Setup

1. Go to Meta Developers → Your App → WhatsApp → Configuration
2. Set Webhook URL: `https://your-api.railway.app/webhook/whatsapp`
3. Set Verify Token: the same value as WHATSAPP_VERIFY_TOKEN env var
4. Subscribe to: `messages` webhook field
5. Click Verify and Save

---

## STEP 4 — API Keys Setup

### Gemini (Free)
- Go to https://aistudio.google.com/app/apikey
- Create API key → add to GEMINI_API_KEY

### OpenAI (DALL-E 3)
- Go to https://platform.openai.com/api-keys
- Create API key → add to OPENAI_API_KEY

### Replicate
- Go to https://replicate.com/account/api-tokens
- Create token → add to REPLICATE_API_TOKEN

### Cloudinary (Free tier available)
- Go to https://cloudinary.com → Dashboard
- Copy Cloud Name, API Key, API Secret

### WhatsApp Business Cloud API
1. Go to https://developers.facebook.com
2. Create App → Business type → Add WhatsApp product
3. Get WHATSAPP_PHONE_NUMBER_ID and temporary token from WhatsApp setup
4. For production: generate permanent System User Token via Meta Business Suite

---

## STEP 5 — Test End-to-End

1. Login at your Vercel URL with ADMIN_EMAIL/ADMIN_PASSWORD
2. Add a client (fill all fields)
3. Go to Calendar → Generate Calendar (takes ~30 seconds)
4. Click any day → Generate post (image + caption + hashtags)
5. Click "Send for Approval" → WhatsApp message sent to client
6. Client clicks ✅ Approve → auto-posts to Instagram

---

## Local Development

### Backend
```bash
cd backend
cp .env.example .env
# Fill in your .env values
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

### Frontend
```bash
cd frontend
cp .env.example .env.local
# Set VITE_API_URL=http://localhost:5000
npm install
npm run dev
```
