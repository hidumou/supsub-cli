import app from "./app.js";
import { DEMO_API_KEY } from "./middleware/auth.js";

console.log("mock server listening on http://localhost:8787");
console.log(`demo api key: ${DEMO_API_KEY}`);

export default {
  port: 8787,
  hostname: "127.0.0.1",
  fetch: app.fetch,
};
