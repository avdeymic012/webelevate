(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Active nav link ---------- */
  var path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a, .mobile-menu a").forEach(function (a) {
    var href = a.getAttribute("href");
    if (href === path || (path === "" && href === "index.html")) {
      a.classList.add("active");
      a.setAttribute("aria-current", "page");
    }
  });

  /* ---------- Mobile menu ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var menu = document.querySelector(".mobile-menu");
  if (toggle && menu) {
    var closeMenu = function () {
      menu.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("menu-open");
    };
    toggle.addEventListener("click", function () {
      var isOpen = menu.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
      document.body.classList.toggle("menu-open", isOpen);
    });
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", closeMenu);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
  }

  /* ---------- Nav hide on scroll down / show on scroll up ---------- */
  var navWrap = document.querySelector(".nav-wrap");
  var navEl = document.querySelector(".nav");
  var lastScroll = window.scrollY;
  var ticking = false;
  function onScroll() {
    var current = window.scrollY;
    if (navEl) navEl.classList.toggle("is-scrolled", current > 8);
    if (navWrap && !document.body.classList.contains("menu-open")) {
      var macHero = document.querySelector("[data-mac-hero]");
      var inHero = macHero && current < macHero.offsetHeight;
      if (!inHero && current > lastScroll && current > 160) {
        navWrap.classList.add("nav-hidden");
      } else {
        navWrap.classList.remove("nav-hidden");
      }
    }
    lastScroll = current;

    var backToTop = document.querySelector(".back-to-top");
    if (backToTop) backToTop.classList.toggle("is-visible", current > 480);

    ticking = false;
  }
  window.addEventListener("scroll", function () {
    if (!ticking) {
      window.requestAnimationFrame(onScroll);
      ticking = true;
    }
  });

  /* ---------- Scroll reveal ---------- */
  var revealEls = document.querySelectorAll("[data-reveal]");
  if (revealEls.length) {
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      revealEls.forEach(function (el) { el.classList.add("is-visible"); });
    } else {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              var el = entry.target;
              var delay = el.getAttribute("data-reveal-delay") || 0;
              setTimeout(function () { el.classList.add("is-visible"); }, Number(delay));
              observer.unobserve(el);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
      );
      revealEls.forEach(function (el) { observer.observe(el); });
    }
  }

  /* Auto-stagger groups */
  document.querySelectorAll("[data-reveal-group]").forEach(function (group) {
    Array.prototype.forEach.call(group.children, function (child, i) {
      if (child.hasAttribute("data-reveal")) {
        child.setAttribute("data-reveal-delay", i * 60);
      }
    });
  });

  /* ---------- Back to top ---------- */
  var backToTop = document.querySelector(".back-to-top");
  if (backToTop) {
    backToTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
    });
  }

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll(".accordion-trigger").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var expanded = btn.getAttribute("aria-expanded") === "true";
      var panel = document.getElementById(btn.getAttribute("aria-controls"));
      btn.setAttribute("aria-expanded", String(!expanded));
      if (panel) panel.classList.toggle("is-open", !expanded);
    });
  });

  /* ---------- Portfolio filter ---------- */
  var filterTabs = document.querySelectorAll(".filter-tab");
  var projectCards = document.querySelectorAll("[data-category]");
  if (filterTabs.length && projectCards.length) {
    filterTabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        filterTabs.forEach(function (t) { t.setAttribute("aria-pressed", "false"); });
        tab.setAttribute("aria-pressed", "true");
        var filter = tab.getAttribute("data-filter");
        projectCards.forEach(function (card) {
          var show = filter === "all" || card.getAttribute("data-category") === filter;
          card.style.display = show ? "" : "none";
        });
      });
    });
  }

  /* ---------- Contact form validation (client-side demo, no backend) ---------- */
  var form = document.querySelector("#contact-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var valid = true;
      form.querySelectorAll("[required]").forEach(function (field) {
        var wrap = field.closest(".field");
        var value = field.value.trim();
        var ok = value.length > 0;
        if (field.type === "email" && ok) {
          ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        }
        if (wrap) wrap.classList.toggle("has-error", !ok);
        if (!ok) valid = false;
      });
      if (!valid) return;

      var submitBtn = form.querySelector('button[type="submit"]');
      var status = document.querySelector(".form-status");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending…";
      }
      setTimeout(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Send Message";
        }
        if (status) status.classList.add("is-visible");
        form.reset();
      }, 900);
    });

    form.querySelectorAll("[required]").forEach(function (field) {
      field.addEventListener("blur", function () {
        var wrap = field.closest(".field");
        if (wrap && wrap.classList.contains("has-error") && field.value.trim().length > 0) {
          wrap.classList.remove("has-error");
        }
      });
    });
  }
})();
