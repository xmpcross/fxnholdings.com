// FXN Holdings — small progressive enhancements. The site works without JS.
(function () {
  "use strict";
  document.documentElement.classList.remove("no-js");

  // Smooth scrolling (Lenis, self-hosted). Off for reduced motion; touch keeps native scrolling.
  var lenis = null;
  var prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (window.Lenis && !prefersReduced) {
    lenis = new window.Lenis({ autoRaf: true, lerp: 0.1 });
    // In-page links: glide to an exact pixel position just below the sticky header.
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href*="#"]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      var url = new URL(a.href, location.href);
      if (url.pathname !== location.pathname || url.origin !== location.origin || url.hash.length < 2) return;
      var target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target) return;
      e.preventDefault();
      var header = document.querySelector(".site-header");
      var offset = (header ? header.offsetHeight : 0) + 16;
      var y = target.getBoundingClientRect().top + window.scrollY - offset;
      lenis.scrollTo(Math.max(0, y), { duration: 1.1 });
      window.history.pushState(null, "", url.hash);
    });
  }

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
    var menu = document.getElementById("mobile-nav");
    var menuMedia = window.matchMedia("(max-width: 960px)");
    var background = document.querySelectorAll("main, .site-footer, .chat, .cookie-banner");
    var setMenu = function (open) {
      open = open && menuMedia.matches;
      document.body.classList.toggle("menu-open", open);
      background.forEach(function (el) { el.inert = open; });
      if (lenis) { if (open) lenis.stop(); else lenis.start(); }
      menuBtn.setAttribute("aria-expanded", String(open));
      menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    menuBtn.addEventListener("click", function () { setMenu(!document.body.classList.contains("menu-open")); });
    document.addEventListener("keydown", function (e) {
      if (!document.body.classList.contains("menu-open")) return;
      if (e.key === "Escape") { setMenu(false); menuBtn.focus(); }
      if (e.key === "Tab") {
        var last = menu.querySelector("a:last-child");
        if (e.shiftKey && document.activeElement === menuBtn) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); menuBtn.focus(); }
      }
    });
    menuMedia.addEventListener("change", function () { if (!menuMedia.matches) setMenu(false); });
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

  // Website assistant: chat panel that talks to /api/chat (shared API handler)
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
    var chatHistory = [];
    var busy = false;
    try { chatHistory = JSON.parse(sessionStorage.getItem(STORE) || "[]"); } catch (e) { chatHistory = []; }
    if (!Array.isArray(chatHistory)) chatHistory = [];
    chatHistory = chatHistory.filter(function (m) {
      return m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string";
    }).slice(-30);
    var requestBody = function () {
      var messages = chatHistory.slice(-20).map(function (m) {
        return { role: m.role, content: m.content.slice(0, 1500) };
      });
      var body;
      // Leave room below the 64 KiB proxy/API cap, including JSON escaping and UTF-8.
      while (messages.length) {
        while (messages.length > 1 && messages[0].role !== "user") messages.shift();
        body = JSON.stringify({ messages: messages });
        if (new TextEncoder().encode(body).length <= 60 * 1024) return body;
        messages.shift();
      }
      return JSON.stringify({ messages: [] });
    };
    var save = function () { chatHistory = chatHistory.slice(-30); try { sessionStorage.setItem(STORE, JSON.stringify(chatHistory)); } catch (e) {} };

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
      chatHistory.forEach(function (m) { bubble(m.role, m.content); });
      suggest.hidden = chatHistory.length > 0;
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
      chatHistory.push({ role: "user", content: text.slice(0, 1500) });
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
        body: requestBody()
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) { return { ok: res.ok, data: data }; });
      }).then(function (r) {
        typing.remove();
        if (r.ok && r.data.reply) {
          chatHistory.push({ role: "assistant", content: r.data.reply });
          save();
          bubble("assistant", r.data.reply);
        } else {
          chatHistory.pop();
          save();
          bubble("error", (r.data && r.data.reply) || "The assistant is unavailable right now. Please use the contact form at /contact/ or email contact@fxnholdings.com.");
        }
      }).catch(function () {
        typing.remove();
        chatHistory.pop();
        save();
        bubble("error", "I couldn't reach the server. Check your connection, or use the contact form at /contact/.");
      }).then(function () {
        busy = false;
        sendBtn.disabled = false;
        if (!panel.hidden) input.focus();
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

  // Blog posts: highlight the section being read in the Table of Contents
  var postToc = document.querySelectorAll(".post-toc a[href^='#']");
  if (postToc.length) {
    var heads = Array.prototype.map.call(postToc, function (a) { return document.getElementById(a.getAttribute("href").slice(1)); });
    var tocTick = false;
    var markToc = function () {
      tocTick = false;
      var line = window.innerHeight * 0.3, current = 0;
      heads.forEach(function (h, i) { if (h && h.getBoundingClientRect().top <= line) current = i; });
      postToc.forEach(function (a, i) { a.classList.toggle("is-active", i === current); });
    };
    window.addEventListener("scroll", function () { if (!tocTick) { tocTick = true; requestAnimationFrame(markToc); } }, { passive: true });
    markToc();
  }

  // Blog posts: latest posts slider (swipe/scroll-snap without JS; dots + autoplay with it)
  document.querySelectorAll(".feat").forEach(function (feat) {
    var track = feat.querySelector(".feat-track");
    var dots = feat.querySelectorAll(".feat-dot");
    if (!track || dots.length < 2) return;
    var index = 0, timer = null;
    var show = function (i) { index = (i + dots.length) % dots.length; track.scrollTo({ left: index * (track.scrollWidth / dots.length), behavior: prefersReduced ? "auto" : "smooth" }); };
    dots.forEach(function (d, i) { d.addEventListener("click", function () { show(i); restart(); }); });
    track.addEventListener("scroll", function () {
      var i = Math.round(track.scrollLeft / (track.scrollWidth / dots.length));
      if (i === index && dots[i].getAttribute("aria-current")) return;
      index = i;
      dots.forEach(function (d, j) { if (j === i) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current"); });
    }, { passive: true });
    var stop = function () { clearInterval(timer); timer = null; };
    var restart = function () { stop(); if (!prefersReduced) timer = setInterval(function () { show(index + 1); }, 5000); };
    feat.addEventListener("mouseenter", stop); feat.addEventListener("mouseleave", restart);
    feat.addEventListener("focusin", stop); feat.addEventListener("focusout", restart);
    restart();
  });

  // Blog posts: copy link button
  document.querySelectorAll(".share-copy").forEach(function (b) {
    b.addEventListener("click", function () {
      var done = function () { b.classList.add("copied"); b.setAttribute("aria-label", "Link copied"); setTimeout(function () { b.classList.remove("copied"); b.setAttribute("aria-label", "Copy link to this post"); }, 2000); };
      if (navigator.clipboard) navigator.clipboard.writeText(b.dataset.url).then(done, function () {});
    });
  });

  // Contact form → /api/contact (shared API handler, emails the team)
  var form = document.getElementById("contact-form");
  if (form) {
    form.noValidate = true; // Custom validation with JS; native validation without it.
    var status = form.querySelector(".form-status");
    var button = form.querySelector("button[type=submit]");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (button.disabled) return;
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
      var fields = ["name", "email", "company", "message"];
      var tooLong = fields.find(function (n) { var el = form.elements[n]; return el.maxLength > 0 && el.value.length > el.maxLength; });
      if (tooLong) {
        var field = form.elements[tooLong];
        field.setAttribute("aria-invalid", "true");
        status.className = "form-status err";
        status.textContent = "Please keep " + tooLong + " to " + field.maxLength + " characters or fewer.";
        field.focus();
        return;
      }
      button.disabled = true;
      status.className = "form-status";
      status.textContent = "Sending…";
      fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok) throw new Error(data.error || "");
        });
      }).then(function () {
        form.innerHTML =
          '<div class="sent" role="status"><div class="tick"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
          '<h2 class="h-md">Thanks, your message is in.</h2>' +
          '<p class="muted">We\'ll be in touch soon.</p></div>';
      }).catch(function (err) {
        status.className = "form-status err";
        status.textContent = (err && err.message) || "Something went wrong sending your message. Please try again.";
        button.disabled = false;
      });
    });
  }
})();
