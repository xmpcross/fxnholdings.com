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
      var firstBad = null;
      required.forEach(function (n) {
        var el = form.elements[n];
        var bad = !el.value.trim() || (n === "email" && !el.checkValidity());
        el.setAttribute("aria-invalid", bad ? "true" : "false");
        if (bad && !firstBad) firstBad = el;
      });
      if (firstBad) {
        status.className = "form-status err";
        status.textContent = "Please complete your name, a valid email address and a message.";
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
          '<h2 class="h-md">Thanks, your message is on its way.</h2>' +
          '<p class="muted">We reply within two business days, Perth time.</p></div>';
      }).catch(function () {
        status.className = "form-status err";
        status.innerHTML = 'Your message could not be sent. Please email us at <a href="mailto:kritin@fxnholdings.com">kritin@fxnholdings.com</a>.';
        button.disabled = false;
      });
    });
  }
})();
