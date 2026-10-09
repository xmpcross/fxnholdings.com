// FXN Holdings — small progressive enhancements. The site works without JS.
(function () {
  "use strict";
  document.documentElement.classList.remove("no-js");

  // Live Perth time (AWST, UTC+8, no daylight saving)
  var clocks = document.querySelectorAll("[data-clock]");
  if (clocks.length) {
    var fmt = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Perth", hour: "2-digit", minute: "2-digit", hour12: false });
    var tick = function () {
      var t = fmt.format(new Date());
      clocks.forEach(function (el) { el.textContent = t; });
    };
    tick();
    setInterval(tick, 15000);
  }

  // Header border on scroll
  var header = document.querySelector(".site-header");
  var onScroll = function () { header && header.classList.toggle("scrolled", window.scrollY > 8); };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Mobile menu
  var menuBtn = document.querySelector(".menu-btn");
  if (menuBtn) {
    var setMenu = function (open) {
      document.body.classList.toggle("menu-open", open);
      menuBtn.setAttribute("aria-expanded", String(open));
      menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    menuBtn.addEventListener("click", function () { setMenu(!document.body.classList.contains("menu-open")); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });
    document.querySelectorAll(".mobile-nav a").forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
  }

  // Reveal on scroll
  var revealables = document.querySelectorAll(".reveal, .step");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    revealables.forEach(function (el) { io.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add("in"); });
  }

  // Home hero: cycle the highlight through the launch steps
  var launch = document.querySelector(".launch");
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (launch && !reduceMotion) {
    var steps = launch.querySelectorAll("li");
    var stepMs = parseFloat(getComputedStyle(launch).getPropertyValue("--launch-step")) || 3000;
    var current = 0, timer = null, paused = false;
    var show = function (i) {
      steps.forEach(function (li, j) { li.classList.toggle("on", j === i); });
      current = i;
    };
    var schedule = function () {
      clearTimeout(timer);
      timer = setTimeout(function () { if (!paused) { show((current + 1) % steps.length); schedule(); } }, stepMs);
    };
    var setPaused = function (p) {
      paused = p;
      launch.classList.toggle("is-paused", p);
      if (!p) {
        var li = steps[current];
        li.classList.remove("on");
        void li.offsetWidth; // restart the progress bar together with the timer
        li.classList.add("on");
        schedule();
      }
    };
    launch.classList.add("is-cycling");
    show(0);
    schedule();
    launch.addEventListener("mouseenter", function () { setPaused(true); clearTimeout(timer); });
    launch.addEventListener("mouseleave", function () { setPaused(false); });
    document.addEventListener("visibilitychange", function () { if (document.hidden) { clearTimeout(timer); } else if (!paused) { schedule(); } });
  }

  // Cookie notice: informational (the site sets no non-essential cookies); dismissal is remembered
  var banner = document.querySelector(".cookie-banner");
  if (banner) {
    var KEY = "fxn-cookie-notice";
    var seen = false;
    try { seen = localStorage.getItem(KEY) === "1"; } catch (e) {}
    if (!seen) banner.hidden = false;
    banner.querySelector(".cookie-ok").addEventListener("click", function () {
      banner.hidden = true;
      try { localStorage.setItem(KEY, "1"); } catch (e) {}
    });
  }

  // Website assistant: chat panel that talks to /api/chat (Netlify Function)
  var chat = document.querySelector("[data-chat]");
  if (chat) {
    var fab = chat.querySelector(".chat-fab");
    var panel = chat.querySelector(".chat-panel");
    var log = chat.querySelector(".chat-log");
    var chatForm = chat.querySelector(".chat-form");
    var input = chat.querySelector("#chat-input");
    var sendBtn = chatForm.querySelector("button[type=submit]");
    var suggest = chat.querySelector(".chat-suggest");
    var wa = chat.getAttribute("data-whatsapp");
    var STORE = "fxn-chat-v1";
    var WELCOME = "Hi! I'm the FXN Holdings assistant. Ask me about our websites, how we build them, or working with us. If you'd like the team to follow up, I can pass your details on.";
    var history = [];
    var busy = false;
    try { history = JSON.parse(sessionStorage.getItem(STORE) || "[]"); } catch (e) { history = []; }
    if (!Array.isArray(history)) history = [];
    var save = function () { try { sessionStorage.setItem(STORE, JSON.stringify(history.slice(-30))); } catch (e) {} };

    if (wa) {
      var waLink = chat.querySelector(".chat-wa");
      waLink.href = "https://wa.me/" + wa.replace(/\D/g, "");
      waLink.hidden = false;
    }

    // Render text safely: plain text, with site paths, URLs and emails turned into links
    var addText = function (el, text) {
      var re = /(https?:\/\/[^\s)]+|[\w.+-]+@[\w-]+\.[\w.-]+|(?:^|(?<=\s))\/[a-z0-9-]+\/(?:#[a-z0-9-]+)?)/gi;
      var last = 0, m;
      while ((m = re.exec(text))) {
        el.appendChild(document.createTextNode(text.slice(last, m.index)));
        var a = document.createElement("a");
        var v = m[0].replace(/[.,]$/, "");
        a.textContent = v;
        a.href = v.indexOf("@") > 0 && v.indexOf("/") < 0 ? "mailto:" + v : v;
        if (/^https?:/.test(v)) { a.target = "_blank"; a.rel = "noopener"; }
        el.appendChild(a);
        last = m.index + v.length;
        re.lastIndex = last;
      }
      el.appendChild(document.createTextNode(text.slice(last)));
    };
    var bubble = function (role, text) {
      var div = document.createElement("div");
      div.className = "msg " + (role === "user" ? "msg-user" : role === "error" ? "msg-error" : "msg-bot");
      addText(div, text);
      log.appendChild(div);
      log.scrollTop = log.scrollHeight;
      return div;
    };
    var render = function () {
      log.textContent = "";
      bubble("assistant", WELCOME);
      history.forEach(function (m) { bubble(m.role, m.content); });
      suggest.hidden = history.length > 0;
    };
    var setOpen = function (open) {
      panel.hidden = !open;
      chat.classList.toggle("open", open);
      fab.setAttribute("aria-expanded", String(open));
      if (open) { render(); input.focus(); } else { fab.focus(); }
    };
    var send = function (text) {
      text = text.trim();
      if (!text || busy) return;
      busy = true;
      sendBtn.disabled = true;
      suggest.hidden = true;
      history.push({ role: "user", content: text.slice(0, 1500) });
      save();
      bubble("user", text);
      var typing = document.createElement("div");
      typing.className = "msg msg-bot msg-typing";
      typing.setAttribute("aria-label", "The assistant is typing");
      typing.innerHTML = "<i></i><i></i><i></i>";
      log.appendChild(typing);
      log.scrollTop = log.scrollHeight;
      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history })
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) { return { ok: res.ok, data: data }; });
      }).then(function (r) {
        typing.remove();
        if (r.ok && r.data.reply) {
          history.push({ role: "assistant", content: r.data.reply });
          save();
          bubble("assistant", r.data.reply);
        } else {
          history.pop();
          save();
          bubble("error", (r.data && r.data.reply) || "The assistant is unavailable right now. Please use the contact form at /contact/ or email contact@fxnholdings.com.");
        }
      }).catch(function () {
        typing.remove();
        history.pop();
        save();
        bubble("error", "I couldn't reach the server. Check your connection, or use the contact form at /contact/.");
      }).then(function () {
        busy = false;
        sendBtn.disabled = false;
        input.focus();
      });
    };

    fab.addEventListener("click", function () { setOpen(true); });
    chat.querySelector(".chat-close").addEventListener("click", function () { setOpen(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) setOpen(false); });
    chatForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (busy || !input.value.trim()) return; // keep the text until the assistant can take it
      var v = input.value; input.value = ""; input.style.height = ""; send(v);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); chatForm.requestSubmit ? chatForm.requestSubmit() : chatForm.dispatchEvent(new Event("submit")); }
    });
    input.addEventListener("input", function () { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 120) + "px"; });
    suggest.querySelectorAll("button").forEach(function (b) { b.addEventListener("click", function () { send(b.textContent); }); });
  }

  // Legal pages: highlight the current section in the table of contents
  var tocLinks = document.querySelectorAll(".toc a");
  if (tocLinks.length && "IntersectionObserver" in window) {
    var byId = {};
    tocLinks.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
    var tocIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        tocLinks.forEach(function (a) { a.classList.remove("active"); });
        var link = byId[e.target.id];
        if (link) link.classList.add("active");
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    document.querySelectorAll(".legal section[id]").forEach(function (s) { tocIo.observe(s); });
  }

  // Contact form → Netlify Forms (detected via /netlify-forms.html)
  var form = document.getElementById("contact-form");
  if (form) {
    var status = form.querySelector(".form-status");
    var button = form.querySelector("button[type=submit]");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var required = ["name", "email", "message"];
      var firstBad = null, missing = false;
      required.forEach(function (n) {
        var el = form.elements[n];
        var empty = !el.value.trim();
        var bad = empty || (n === "email" && !el.checkValidity());
        if (empty) missing = true;
        el.setAttribute("aria-invalid", bad ? "true" : "false");
        if (bad && !firstBad) firstBad = el;
      });
      if (firstBad) {
        status.className = "form-status err";
        status.textContent = missing ? "Please add your name, email and message." : "Please enter a valid email address.";
        firstBad.focus();
        return;
      }
      button.disabled = true;
      status.className = "form-status";
      status.textContent = "Sending…";
      fetch("/netlify-forms.html", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(new FormData(form)).toString()
      }).then(function (res) {
        if (!res.ok) throw new Error("bad status");
        form.innerHTML =
          '<div class="sent" role="status"><div class="tick"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
          '<h2 class="h-md">Thanks, your message is in.</h2>' +
          '<p class="muted">We\'ll be in touch soon.</p></div>';
      }).catch(function () {
        status.className = "form-status err";
        status.textContent = "Something went wrong sending your message. Please try again.";
        button.disabled = false;
      });
    });
  }
})();
