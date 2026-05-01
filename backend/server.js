require('dotenv').config();
require('./src/utils/firebase'); // init Firebase Admin

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

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

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString(), features: 30 }));

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

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Social Media API running on port ${PORT} — Features 1-30 active`);
  initScheduler();
});
