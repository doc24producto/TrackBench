import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import competitorRoutes from './routes/competitors';
import alertRoutes from './routes/alerts';
import analyticsRoutes from './routes/analytics';
import subscriptionRoutes from './routes/subscription';
import webhookRoutes from './routes/webhooks';

import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';
import logger from './lib/logger';
import { initJobs } from './jobs/scrapeJob';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Raw body para Stripe webhooks — debe ir antes de express.json()
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(apiLimiter);

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api', competitorRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/dashboard', analyticsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/webhooks', webhookRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Servidor corriendo en puerto ${PORT}`);
  initJobs();
});

export default app;
