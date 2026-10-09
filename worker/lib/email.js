// Sends notification emails through Google Workspace SMTP.
//
// Runs in two places:
//   - Node (server/api.mjs on this host): nodemailer. With SMTP_USER/SMTP_PASS it logs in;
//     without them it uses the Workspace SMTP relay, which authenticates this server by IP.
//   - Cloudflare Worker: a TCP socket (cloudflare:sockets) with SMTP AUTH (port 25 is
//     blocked there and outbound IPs aren't fixed, so the relay can't be used).
//
// Environment:
//   SMTP_HOST   default smtp.gmail.com (use smtp-relay.gmail.com for the relay)
//   SMTP_PORT   default 465 with login, 587 for the relay (587 uses STARTTLS)
//   SMTP_USER   Workspace mailbox to log in as (optional on Node with the relay)
//   SMTP_PASS   App Password for that mailbox
//   CONTACT_TO  default contact@fxnholdings.com
//   MAIL_FROM   default SMTP_USER, or contact@fxnholdings.com with the relay

const EHLO_NAME = "fxnholdings.com"; // Google closes the session if the greeting name is bogus
const TIMEOUT_MS = 15_000;

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (str) => {
  let bin = "";
  for (const byte of enc.encode(str)) bin += String.fromCharCode(byte);
  return btoa(bin);
};
const oneLine = (s) => String(s || "").replace(/[\r\n]+/g, " ").trim();
const encodeHeader = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);

function buildMessage({ from, to, replyTo, subject, text }) {
  const body = b64(text.replace(/\r?\n/g, "\r\n")).replace(/.{1,76}/g, "$&\r\n");
  const headers = [
    `From: ${encodeHeader("FXN Holdings website")} <${from}>`,
    `To: <${to}>`,
    replyTo ? `Reply-To: <${replyTo}>` : null,
    `Subject: ${encodeHeader(oneLine(subject))}`,
    `Date: ${new Date().toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: <${crypto.randomUUID()}@${EHLO_NAME}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ].filter(Boolean);
  return headers.join("\r\n") + "\r\n\r\n" + body; // base64 body: no line starts with "."
}

// Minimal SMTP conversation over a Cloudflare socket.
class SmtpSession {
  constructor(socket) {
    this.attach(socket);
  }
  attach(socket) {
    this.socket = socket;
    this.reader = socket.readable.getReader();
    this.writer = socket.writable.getWriter();
    this.buffer = "";
  }
  async reply() {
    // A reply ends with a line "NNN text" (multi-line replies use "NNN-text").
    for (;;) {
      const lines = this.buffer.split("\r\n");
      for (let i = 0; i < lines.length - 1; i++) {
        if (/^\d{3} /.test(lines[i])) {
          this.buffer = lines.slice(i + 1).join("\r\n");
          return { code: Number(lines[i].slice(0, 3)), text: lines.slice(0, i + 1).join("\n") };
        }
      }
      const { value, done } = await this.reader.read();
      if (done) throw new Error("SMTP connection closed");
      this.buffer += dec.decode(value, { stream: true });
    }
  }
  async cmd(line, expect) {
    if (line !== null) await this.writer.write(enc.encode(line + "\r\n"));
    const r = await this.reply();
    if (!expect.includes(r.code)) {
      const shown = line && line.startsWith("AUTH") ? "AUTH ..." : line;
      throw new Error(`SMTP ${shown ?? "greeting"} -> ${r.text}`);
    }
    return r;
  }
  async upgradeTls() {
    this.reader.releaseLock();
    this.writer.releaseLock();
    this.attach(this.socket.startTls());
  }
}

async function smtpSend(cfg, message, connect) {
  const starttls = cfg.port !== 465;
  const socket = connect({ hostname: cfg.host, port: cfg.port }, { secureTransport: starttls ? "starttls" : "on", allowHalfOpen: false });
  const s = new SmtpSession(socket);
  try {
    await s.cmd(null, [220]);
    await s.cmd(`EHLO ${EHLO_NAME}`, [250]);
    if (starttls) {
      await s.cmd("STARTTLS", [220]);
      await s.upgradeTls();
      await s.cmd(`EHLO ${EHLO_NAME}`, [250]);
    }
    await s.cmd(`AUTH PLAIN ${b64(`\u0000${cfg.user}\u0000${cfg.pass}`)}`, [235]);
    await s.cmd(`MAIL FROM:<${cfg.from}>`, [250]);
    await s.cmd(`RCPT TO:<${cfg.to}>`, [250, 251]);
    await s.cmd("DATA", [354]);
    await s.cmd(message + "\r\n.", [250]);
    await s.cmd("QUIT", [221]).catch(() => {});
  } finally {
    try { socket.close(); } catch {}
  }
}

const isNode = typeof process !== "undefined" && process.release?.name === "node" && typeof WebSocketPair === "undefined";

async function sendWithNodemailer(env, { subject, text, replyTo }) {
  const pkg = "nodemailer"; // not a literal, so the Worker bundler leaves it alone
  const { default: nodemailer } = await import(pkg);
  const login = env.SMTP_USER && env.SMTP_PASS;
  const port = Number(env.SMTP_PORT || (login ? 465 : 587));
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST || (login ? "smtp.gmail.com" : "smtp-relay.gmail.com"),
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    name: EHLO_NAME, // Google rejects the greeting if this is the machine's host name
    auth: login ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  });
  const from = oneLine(env.MAIL_FROM || env.SMTP_USER || "contact@fxnholdings.com");
  await transport.sendMail({
    from: { name: "FXN Holdings website", address: from },
    to: oneLine(env.CONTACT_TO || "contact@fxnholdings.com"),
    replyTo: replyTo && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(replyTo) ? replyTo : undefined,
    subject: oneLine(subject),
    text,
  });
}

export async function sendEmail(env, message, connect) {
  if (isNode && !connect) {
    if (!env.SMTP_HOST && !(env.SMTP_USER && env.SMTP_PASS)) return { ok: false, reason: "not_configured" };
    try {
      await sendWithNodemailer(env, message);
      return { ok: true };
    } catch (error) {
      console.error(`email: ${error.message}`);
      return { ok: false, reason: "send_failed" };
    }
  }
  return sendWithSocket(env, message, connect);
}

async function sendWithSocket(env, { subject, text, replyTo }, connect) {
  if (!env.SMTP_USER || !env.SMTP_PASS) return { ok: false, reason: "not_configured" };
  const cfg = {
    host: env.SMTP_HOST || "smtp.gmail.com",
    port: Number(env.SMTP_PORT || 465),
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: oneLine(env.MAIL_FROM || env.SMTP_USER),
    to: oneLine(env.CONTACT_TO || "contact@fxnholdings.com"),
  };
  const safeReplyTo = replyTo && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(replyTo) ? replyTo : undefined;
  const message = buildMessage({ from: cfg.from, to: cfg.to, replyTo: safeReplyTo, subject, text });
  try {
    if (!connect) ({ connect } = await import("cloudflare:sockets"));
    let timer;
    await Promise.race([
      smtpSend(cfg, message, connect),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("SMTP timed out")), TIMEOUT_MS); }),
    ]).finally(() => clearTimeout(timer));
    return { ok: true };
  } catch (error) {
    console.error(`email: ${error.message}`);
    return { ok: false, reason: "send_failed" };
  }
}
