const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { corsOrigins } = require('./config/env');
const { errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const applicationsRoutes = require('./routes/applications.routes');
const stagesRoutes = require('./routes/stages.routes');
const resumesRoutes = require('./routes/resumes.routes');
const uploadsRoutes = require('./routes/uploads.routes');
const lettersRoutes = require('./routes/letters.routes');
const aiRoutes = require('./routes/ai.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

// Behind nginx in production, so honor X-Forwarded-For for req.ip (rate limiter).
app.set('trust proxy', true);

app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/', (req, res) => {
  res.json({ message: 'Job Tracker API is running' });
});

// Feature routers (all mounted at root; each owns its full paths).
app.use(authRoutes);
app.use(applicationsRoutes);
app.use(stagesRoutes);
app.use(resumesRoutes);
app.use(uploadsRoutes);
app.use(lettersRoutes);
app.use(aiRoutes);
app.use(adminRoutes);

app.use(errorHandler);

module.exports = app;
