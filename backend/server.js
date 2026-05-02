require('dotenv').config();
require('./src/utils/firebase'); // init Firebase Admin

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// OAuth routes (Instagram connect)
const oauthRoutes    = require('./src/routes/oauth.routes');

// Existing routes
const clientRoutes   = require('./src/routes/clients.routes');
const calendarRoutes = require('./src/routes/calendar.routes');
const postRoutes     = require('./src/routes/posts.routes');
const accountRoutes  = require('./src/routes/accounts.routes');
const webhookRoutes  = require('./src/routes/webhook.routes');

// New feature routes (Phase 2-6)
const inboxRoutes       = require('./src/routes/inbox.routes');
const crmRoutes         = require('./src/routes/crm.routes');
const predictRoutes     = require('./src/routes/predict.routes');
const hashtagRoutes     = require('./src/routes/hashtags.routes');
const competitorRoutes  = require('./src/routes/competitors.routes');
const campaignRoutes    = require('./src/routes/campaigns.routes');
const ideasRoutes       = require('./src/routes/ideas.routes');
const reportsRoutes     = require('./src/routes/reports.routes');
const linkbioRoutes     = require('./src/routes/linkbio.routes');
const workflowRoutes    = require('./src/routes/workflows.routes');
const agencyRoutes      = require('./src/routes/agency.routes');

// Phase 7-10 routes
const voiceRoutes          = require('./src/routes/voice.routes');
const visualStyleRoutes    = require('./src/routes/visualstyle.routes');
const personaRoutes        = require('./src/routes/persona.routes');
const qualityRoutes        = require('./src/routes/quality.routes');
const repurposeRoutes      = require('./src/routes/repurpose.routes');
const platformCaptionRoutes = require('./src/routes/platformcaption.routes');
const videoScriptRoutes    = require('./src/routes/videoscript.routes');
const festivalRoutes       = require('./src/routes/festival.routes');
const abtestRoutes         = require('./src/routes/abtest.routes');
const schedulerRoutes      = require('./src/routes/scheduler.routes');
const crisisRoutes         = require('./src/routes/crisis.routes');
const commentsRoutes       = require('./src/routes/comments.routes');
const growthRoutes         = require('./src/routes/growth.routes');

const { errorHandler } = require('./src/middleware/error.middleware');
const { initScheduler } = require('./src/utils/scheduler');
const logger = require('./src/utils/logger');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(morgan('dev'));

// Webhook needs raw body
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/social', rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true }));

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString(), features: 45 }));

// ─── OAuth Routes (public — no rate limit) ────────────────────────────────────
app.use('/auth', oauthRoutes);

// ─── Existing Routes ───────────────────────────────────────────────────────────
app.use('/api/social/clients',    clientRoutes);
app.use('/api/social/calendar',   calendarRoutes);
app.use('/api/social/posts',      postRoutes);
app.use('/api/social/accounts',   accountRoutes);
app.use('/webhook',               webhookRoutes);

// ─── New Feature Routes (19-30) ────────────────────────────────────────────────
app.use('/api/social/inbox',       inboxRoutes);
app.use('/api/social/crm',         crmRoutes);
app.use('/api/social/predict',     predictRoutes);
app.use('/api/social/hashtags',    hashtagRoutes);
app.use('/api/social/competitors', competitorRoutes);
app.use('/api/social/campaigns',   campaignRoutes);
app.use('/api/social/ideas',       ideasRoutes);
app.use('/api/social/reports',     reportsRoutes);
app.use('/api/social/linkbio',     linkbioRoutes);
app.use('/api/social/workflows',   workflowRoutes);
app.use('/api/social/agency',      agencyRoutes);

// ─── Phase 7-10 Routes (Features 33-45) ───────────────────────────────────────
app.use('/api/social/voice',            voiceRoutes);
app.use('/api/social/visual-style',     visualStyleRoutes);
app.use('/api/social/persona',          personaRoutes);
app.use('/api/social/quality',          qualityRoutes);
app.use('/api/social/repurpose',        repurposeRoutes);
app.use('/api/social/platform-caption', platformCaptionRoutes);
app.use('/api/social/video-script',     videoScriptRoutes);
app.use('/api/social/festival',         festivalRoutes);
app.use('/api/social/abtest',           abtestRoutes);
app.use('/api/social/scheduler',        schedulerRoutes);
app.use('/api/social/crisis',           crisisRoutes);
app.use('/api/social/comments',         commentsRoutes);
app.use('/api/social/growth',           growthRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Social Media API running on port ${PORT} — Features 1-45 active`);
  initScheduler();
});
