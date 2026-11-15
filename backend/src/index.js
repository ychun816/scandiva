const app = require('./app');
const { port, enableScheduler } = require('./config/env');
const { startScheduler } = require('./scrapers/scheduler');

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
  if (enableScheduler) startScheduler();
});
