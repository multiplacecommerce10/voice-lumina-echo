import { strict as assert } from "node:assert";
import { createClient } from "@supabase/supabase-js";
import { pendingEnrollmentsQuery } from "../src/lib/pending-enrollments";

let requestedUrl: URL | undefined;
const client = createClient("https://database.example.test", "public-test-key", {
  auth: { persistSession: false },
  global: {
    fetch: async (input) => {
      requestedUrl = new URL(String(input));
      return new Response("[]", { headers: { "Content-Type": "application/json" } });
    },
  },
});
await pendingEnrollmentsQuery(client);
assert.ok(requestedUrl, "Query must reach the database");
assert.equal(requestedUrl.searchParams.get("or"), "(source.is.null,source.neq.scholarship_application)", "Include source-less checkout leads while excluding scholarship applications");
assert.equal(requestedUrl.searchParams.get("status"), "in.(captured,checkout_started,abandoned)", "Include abandoned carts, exclude completed payments");
assert.equal(requestedUrl.searchParams.has("source"), false, "Do not also apply a NULL-excluding source filter");
console.log("PASS: pending enrollments include source-less abandoned carts and exclude scholarship applications and completed payments.");