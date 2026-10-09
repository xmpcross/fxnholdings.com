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

  // Home: site slider (scroll-snap track with prev/next buttons and dots)
  document.querySelectorAll("[data-slider]").forEach(function (slider) {
    var track = slider.querySelector(".slider-track");
    var slides = track.querySelectorAll(".slide");
    var dotsEl = slider.querySelector(".slider-dots");
    var prev = slider.querySelector('[data-dir="-1"]');
    var next = slider.querySelector('[data-dir="1"]');
    var dots = [];
    slides.forEach(function () { var i = document.createElement("i"); dotsEl.appendChild(i); dots.push(i); });
    var current = function () {
      var start = track.getBoundingClientRect().left + parseFloat(getComputedStyle(track).paddingLeft);
      var best = 0, bestDist = Infinity;
      slides.forEach(function (s, i) {
        var d = Math.abs(s.getBoundingClientRect().left - start);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      return best;
    };
    var update = function () {
      var i = current();
      dots.forEach(function (d, j) { d.classList.toggle("on", j === i); });
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
    };
    var go = function (dir) {
      var i = Math.max(0, Math.min(slides.length - 1, current() + dir));
      track.scrollTo({ left: track.scrollLeft + slides[i].getBoundingClientRect().left - slides[current()].getBoundingClientRect().left });
    };
    prev.addEventListener("click", function () { go(-1); });
    next.addEventListener("click", function () { go(1); });
    track.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    });
    track.addEventListener("scroll", function () { window.requestAnimationFrame(update); }, { passive: true });
    window.addEventListener("resize", update);
    update();
  });

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
