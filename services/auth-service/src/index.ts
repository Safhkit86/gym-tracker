import { createApp } from "./app.js";

const PORT = Number(process.env.PORT ?? 4001);

const app = createApp();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[auth-service] listening on port ${PORT}`);
});
