import { Hono } from "hono";
import {
  createSearch,
  getSearch,
  cancelSearch,
  evaluateSearch,
} from "../store/searches.js";
import { httpError } from "../lib/error.js";

const mps = new Hono();

/** POST /api/mps/search-tasks */
mps.post("/search-tasks", async (c) => {
  const body = await c.req.json<{ name: string }>();
  if (!body.name) {
    throw httpError(400, "INVALID_REQUEST", "Missing name");
  }

  const record = createSearch(body.name);
  return c.json({ searchId: record.searchId }, 201);
});

/** GET /api/mps/search-tasks/:searchId */
mps.get("/search-tasks/:searchId", (c) => {
  const id = c.req.param("searchId");
  const record = getSearch(id);

  if (!record) {
    throw httpError(404, "NotFound", "Search task not found");
  }

  const result = evaluateSearch(record);
  return c.json(result);
});

/** DELETE /api/mps/search-tasks/:searchId */
mps.delete("/search-tasks/:searchId", (c) => {
  const id = c.req.param("searchId");
  const deleted = cancelSearch(id);

  if (!deleted) {
    throw httpError(404, "NotFound", "Search task not found");
  }

  return new Response(null, { status: 204 });
});

export default mps;
