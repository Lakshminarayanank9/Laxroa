import app from './app.js';
import { env } from './config/env.js';

app.listen(env.PORT, () => {
  console.log(`Laxroa API running on port ${env.PORT} (${env.NODE_ENV})`);
});
