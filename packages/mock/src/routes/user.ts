import { Hono } from "hono";
import { demoUser } from "../fixtures/user.js";

const user = new Hono();

/** GET /api/user/info */
user.get("/info", (c) => {
  return c.json(demoUser);
});

export default user;
