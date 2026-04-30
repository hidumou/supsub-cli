import { Hono } from "hono";
import { cors } from "hono/cors";
import { onError } from "./middleware/error.js";
import { authMiddleware } from "./middleware/auth.js";
import oauthRoutes from "./routes/oauth.js";
import deviceRoutes from "./routes/device.js";
import userRoutes from "./routes/user.js";
import subscriptionsRoutes from "./routes/subscriptions.js";
import searchRoutes from "./routes/search.js";
import mpsRoutes from "./routes/mps.js";

const app = new Hono();

// Global middleware
app.use("*", cors());

// Error handler
app.onError(onError);

// Public routes (no auth required)
app.route("/open/api/v1/oauth", oauthRoutes);
app.route("/device", deviceRoutes);

// Root stub
app.get("/", (c) => c.text("supsub mock server — ready"));

// Protected routes (/api/*)
const api = new Hono();
api.use("*", authMiddleware);
api.route("/user", userRoutes);
api.route("/subscriptions", subscriptionsRoutes);
api.route("/search", searchRoutes);
api.route("/mps", mpsRoutes);

app.route("/api", api);

export default app;
