import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { allowedOrigin, MAX_BODY, readLimitedBody } from "../worker/lib/http.js";
import { onRequestPost as contact } from "../worker/contact.js";
import { onRequestPost as chat } from "../worker/chat.js";
import worker from "../worker/index.js";

const request = (body, type = "application/json", url = "https://fxnholdings.com/api/contact") => new Request(url, {
  method: "POST", headers: { "content-type": type, "cf-connecting-ip": crypto.randomUUID() }, body,
});

test("origins allow owned sites and same-origin previews, not unrelated tenants", () => {
  for (const [target, source, expected] of [
    ["https://fxnholdings.com", "https://fxnholdings.com", true],
    ["https://fxnholdings.com", "https://preview.fxnholdings.com", true],
    ["https://fxnholdings.com", "https://attacker.workers.dev", false],
    ["https://fxnholdings.com", "https://attacker.pages.dev", false],
    ["https://fxnholdings.com", "http://localhost:8000", false],
    ["https://fxnholdings.com", "https://fxnholdings.com.evil.example", false],
    ["https://fxnholdings.com", "null", false],
    ["https://ours.workers.dev", "https://ours.workers.dev", true],
    ["https://ours.pages.dev", "https://ours.pages.dev", true],
    ["http://localhost:8787", "http://localhost:8787", true],
  ]) assert.equal(allowedOrigin(new Request(target, { headers: { origin: source } })), expected, source);
});

test("contact rejects overlong fields without sending a truncated enquiry", async () => {
  for (const [key, max] of Object.entries({ name: 200, email: 200, company: 200, reason: 100, message: 5000 })) {
    const body = { name: "Visitor", email: "visitor@example.com", message: "Hello", [key]: "x".repeat(max + 1) };
    const response = await contact({ request: request(JSON.stringify(body)), env: {} });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, new RegExp(`${key}.*${max}`));
  }
  const invalid = await contact({ request: request(JSON.stringify({ name: {}, email: "a@b.com", message: "Hello" })), env: {} });
  assert.equal(invalid.status, 400);
});

test("no-JS form completion redirects to the standalone confirmation page", async () => {
  // The honeypot follows the same completion branch, without contacting SMTP.
  const response = await contact({ request: request("bot-field=bot", "application/x-www-form-urlencoded"), env: {} });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "https://fxnholdings.com/contact/thanks/");
});

test("Worker handlers enforce request byte limits before parsing or external calls", async () => {
  assert.equal((await readLimitedBody(request("x".repeat(MAX_BODY)))).length, MAX_BODY);
  const oversized = JSON.stringify({ messages: [{ role: "user", content: "界".repeat(MAX_BODY / 2) }] });
  assert.equal((await contact({ request: request(oversized), env: {} })).status, 413);
  assert.equal((await chat({ request: request(oversized), env: { ANTHROPIC_API_KEY: "test-only" } })).status, 413);
  assert.equal((await chat({ request: request("{"), env: { ANTHROPIC_API_KEY: "test-only" } })).status, 400);
});

test("Worker health checks do not require email or AI credentials", async () => {
  assert.equal((await worker.fetch(new Request("https://fxnholdings.com/api/health"), {})).status, 200);
});

test("Node API survives malformed forwarding headers and oversized requests", async (t) => {
  const child = spawn(process.execPath, ["server/api.mjs"], {
    cwd: new URL("../", import.meta.url), env: { PATH: process.env.PATH, API_PORT: "0" }, stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => { if (child.exitCode === null) { child.kill(); await once(child, "exit"); } });
  const base = await new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error("API startup timed out")), 5000);
    child.stdout.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/127\.0\.0\.1:(\d+)/);
      if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); }
    });
    child.on("error", reject);
    child.on("exit", () => { clearTimeout(timer); reject(new Error("API exited before startup")); });
  });
  for (const headers of [{ "x-forwarded-host": "[" }, { "x-forwarded-proto": "garbage" }]) {
    const response = await fetch(base + "/api/contact", { method: "POST", headers, body: "{}" });
    assert.equal(response.status, 400);
  }
  const large = await fetch(base + "/api/contact", { method: "POST", body: "x".repeat(MAX_BODY + 1) });
  assert.equal(large.status, 413);
  for (let i = 0; i < 8; i++) assert.equal((await fetch(base + "/api/health")).status, 200);
  assert.equal((await fetch(base + "/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status, 400);
});
