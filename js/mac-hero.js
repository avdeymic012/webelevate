(function () {
  "use strict";

  var root = document.querySelector("[data-mac-hero]");
  if (!root) return;

  var mac = root.querySelector("[data-mac]");
  var holder = root.querySelector("[data-mac-holder]");
  var copy = root.querySelector("[data-mac-copy]");
  var chassis = root.querySelectorAll("[data-mac-chassis]");
  var screen = root.querySelector("[data-mac-screen]");
  var cardsEl = root.querySelector("[data-ms-cards]");
  var intro = root.querySelector("[data-ms-intro]");
  var arcCopy = root.querySelector("[data-ms-arc]");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* camera elevation of the closed laptop (deg) and how far a real screen leans back (deg) */
  var TILT_MAX = 42;
  var LEAN_MAX = 26;
  var PERSP_CLOSED = 4200;   // camera distance (px) while looking down on the closed laptop

  var FIT_TOP = 92, FIT_BOTTOM = 16;   // px kept clear for the nav and the bottom edge

  /* ---------- helpers ---------- */
  function clamp(v, a, b) { return Math.min(Math.max(v, a), b); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function seg(p, a, b) { return clamp((p - a) / (b - a), 0, 1); }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function rnd(i, k) { var x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); }

  /* ---------- card imagery ----------
     The screenshots are 3:2 landscape, so the cards are 3:2 rectangles and every
     card shows its whole design. The five images simply repeat (card i uses i % 5). */
  var IMAGES = [
    "images/dune.webp",
    "images/grove.webp",
    "images/ember.webp",
    "images/marea.webp",
    "images/form.webp"
  ];
  var CARD_W = 90, CARD_H = 60;   // design units, 3:2

  /* ---------- cards ---------- */
  var cards = [];
  var isMobile = false;
  var metrics = { W: 900, H: 581, vw: 1440, vh: 900, zoomK: 1, centerShift: 0, startScale: 0.74, startY: 0 };

  function buildCards() {
    var n = isMobile ? 7 : 12;
    cardsEl.innerHTML = "";
    cards = [];
    for (var i = 0; i < n; i++) {
      var el = document.createElement("div");
      el.className = "ms-card";
      el.innerHTML = '<img src="' + IMAGES[i % IMAGES.length] + '" alt="" decoding="async" fetchpriority="low" draggable="false">';
      cardsEl.appendChild(el);
      /* decode now (off the main thread) rather than on first reveal, so a card never appears blank */
      var img = el.firstChild;
      if (img && img.decode) img.decode().catch(function () {});
      cards.push(el);
    }
  }

  /* Top and bottom of the laptop on screen (lid, base top and front edge). */
  var boundEls = null;
  function laptopBounds() {
    if (!boundEls) boundEls = ["mac-lid", "mac-front", "mac-top"].map(function (c) { return mac.querySelector("." + c); });
    var top = Infinity, bottom = -Infinity;
    for (var i = 0; i < boundEls.length; i++) {
      var r = boundEls[i].getBoundingClientRect();
      if (r.top < top) top = r.top;
      if (r.bottom > bottom) bottom = r.bottom;
    }
    return [top, bottom];
  }

  /* Work out where the closed laptop should rest at the very top of the page so the
     whole thing is visible: scale it to the space left under the headline and centre it there. */
  function measureStart() {
    mac.style.setProperty("--tilt", "-" + TILT_MAX + "deg");
    mac.style.setProperty("--lid", "-90deg");
    mac.style.setProperty("--persp", PERSP_CLOSED + "px");
    mac.style.transform = "scale(1)";
    holder.style.transform = "none";

    var top = Infinity, bottom = -Infinity;
    ["mac-lid", "mac-front", "mac-top"].forEach(function (cls) {
      var r = mac.querySelector("." + cls).getBoundingClientRect();
      top = Math.min(top, r.top);
      bottom = Math.max(bottom, r.bottom);
    });
    var h1 = bottom - top;
    var dy1 = (top + bottom) / 2 - metrics.vh / 2;          // bbox centre relative to the viewport centre at scale 1

    var copyBottom = copy.offsetTop + copy.offsetHeight;
    var gapTop = metrics.vw < 640 ? 40 : 52, gapBottom = 28;   // room between the buttons and the laptop
    var avail = metrics.vh - copyBottom - gapTop - gapBottom;
    var s0 = clamp(avail / h1, 0.4, 0.95);
    var target = copyBottom + gapTop + (avail - h1 * s0) / 2 + (h1 * s0) / 2;   // where the bbox centre should land
    metrics.startScale = s0;
    metrics.startY = target - (metrics.vh / 2 + dy1 * s0);
  }

  function measure() {
    metrics.vw = window.innerWidth;
    metrics.vh = window.innerHeight;
    metrics.W = screen.clientWidth;
    metrics.H = screen.clientHeight;
    var mobile = metrics.W < 520;
    var sw = metrics.W, sh = metrics.H;
    /* cover the viewport on landscape windows; on narrow or portrait ones fit the width instead */
    metrics.zoomK = (mobile || metrics.vw < metrics.vh) ? metrics.vw / sw : Math.max(metrics.vw / sw, metrics.vh / sh);
    /* the screen's centre sits a little above the laptop's centre; nudge it to the viewport's */
    metrics.centerShift = (mac.offsetWidth / 612) * 14;
    if (root.classList.contains("is-live")) measureStart();
    if (mobile !== isMobile || !cards.length) {
      isMobile = mobile;
      buildCards();
    }
  }

  /* Lays the cards out: scatter -> line -> circle -> arc, then rotates the arc. */
  function renderScreen(p) {
    var dw = isMobile ? 520 : 900;
    var c = metrics.W / dw;
    var dh = metrics.H / c;
    var n = cards.length;

    /* Timeline (p is whole-hero progress). The zoom and fades in render() start
       at 0.34, the same moment the cards leave the line for the circle. */
    var a = easeInOut(seg(p, 0.2, 0.34));   // scatter -> line
    var b = easeInOut(seg(p, 0.34, 0.48));  // line -> circle
    var m = easeInOut(seg(p, 0.48, 0.66));  // circle -> arc
    var rot = seg(p, 0.66, 0.94);           // arc rotates

    var circleR = Math.min(Math.min(dw, dh) * 0.35, 350);
    var baseR = Math.min(dw, dh * 1.5);
    var arcR = baseR * (isMobile ? 1.4 : 1.1);
    var apexY = dh * (isMobile ? 0.2 : 0.1);
    var arcCY = apexY + arcR;
    var spread = isMobile ? 100 : 130;
    var startAng = -90 - spread / 2;
    var step = spread / (n - 1);
    var boundedRot = -rot * spread * 0.35;

    var cw = CARD_W * c, ch = CARD_H * c;
    cardsEl.style.setProperty("--cw", cw + "px");
    cardsEl.style.setProperty("--ch", ch + "px");

    for (var i = 0; i < n; i++) {
      var sx = (rnd(i, 1) - 0.5) * 1500, sy = (rnd(i, 2) - 0.5) * 1000, sr = (rnd(i, 3) - 0.5) * 180;

      var lx = (i - (n - 1) / 2) * (CARD_W + 10);

      var ca = (i / n) * 360, cr = (ca * Math.PI) / 180;
      var cx = Math.cos(cr) * circleR, cy = Math.sin(cr) * circleR, crot = ca + 90;

      var aa = startAng + i * step + boundedRot, ar = (aa * Math.PI) / 180;
      var ax = Math.cos(ar) * arcR, ay = Math.sin(ar) * arcR + arcCY, arot = aa + 90;
      var asc = isMobile ? 1.4 : 1.8;

      var x = lerp(sx, lx, a), y = lerp(sy, 0, a), r = lerp(sr, 0, a), sc = lerp(0.6, 1, a);
      x = lerp(x, cx, b); y = lerp(y, cy, b); r = lerp(r, crot, b);
      x = lerp(x, ax, m); y = lerp(y, ay, m); r = lerp(r, arot, m); sc = lerp(sc, asc, m);

      var el = cards[i];
      el.style.opacity = String(clamp(a * 2.2, 0, 1));
      el.style.transform = "translate(" + (x * c).toFixed(1) + "px," + (y * c).toFixed(1) + "px) rotate(" + r.toFixed(1) + "deg) scale(" + sc.toFixed(3) + ")";
    }

    intro.style.opacity = String(seg(p, 0.29, 0.36) * (1 - seg(p, 0.5, 0.56)));
    var arcT = seg(p, 0.6, 0.7);
    arcCopy.style.opacity = String(arcT);
    arcCopy.style.transform = "translateY(" + ((1 - arcT) * 12) + "px)";
  }

  /* The gradient bloom reacts to what the cards are doing: it builds as they gather
     into the ring, eases back and sinks as the arc forms, then follows the rotation.
     Values go on :root so the page background and the screen glow stay identical. */
  var rootStyle = document.documentElement.style;
  function updateGlow(p) {
    var gather = easeInOut(seg(p, 0.34, 0.48));
    var relax = easeInOut(seg(p, 0.5, 0.7));
    var core = gather * (1 - 0.55 * relax);
    var gy = lerp(0, 16, easeInOut(seg(p, 0.48, 0.66)));
    var gx = -seg(p, 0.66, 0.94) * 16;
    rootStyle.setProperty("--gcore", core.toFixed(3));
    rootStyle.setProperty("--gx", gx.toFixed(2));
    rootStyle.setProperty("--gy", gy.toFixed(2));
  }

  /* ---------- the whole hero, driven by one number: p (0..1) ---------- */
  function render(p) {
    var copyT = seg(p, 0, 0.09);
    copy.style.opacity = String(1 - copyT);
    copy.style.transform = "translate3d(0," + (-copyT * 48).toFixed(1) + "px,0)";
    copy.style.visibility = copyT >= 1 ? "hidden" : "";

    var r = easeInOut(seg(p, 0, 0.26));
    /* the lid leads: it lifts while the camera is still looking down on it, then the
       camera settles to eye level */
    var lid = easeInOut(seg(p, 0.02, 0.2));
    var cam = easeInOut(seg(p, 0.1, 0.31));
    var tilt = lerp(TILT_MAX, 0, cam);
    mac.style.setProperty("--tilt", -tilt.toFixed(2) + "deg");
    /* Seen from above, an upright screen is heavily foreshortened, which reads as squashed.
       A real screen is opened past vertical, so it leans back toward a high camera. Lean it
       back while the camera is up and straighten it as the camera comes down to eye level. */
    var lean = LEAN_MAX * lid * (tilt / TILT_MAX);
    mac.style.setProperty("--lid", (lerp(-90, 0, lid) + lean).toFixed(2) + "deg");
    /* the base's stacked plates, top face and ground shadow are edge-on at eye level: fade them out
       over the last few degrees so only the clean rounded front face is left */
    mac.style.setProperty("--pl", Math.min(tilt / 9, 1).toFixed(3));
    /* One camera for the whole laptop. It has real perspective while it looks down, and eases to a
       flat (long-lens) view at eye level so lid and base are exactly the same width when open. */
    mac.style.setProperty("--persp", Math.round(60000 / (1 + (60000 / PERSP_CLOSED - 1) * (tilt / TILT_MAX))) + "px");

    /* Zoom into the screen while the silver and then the black dissolve. */
    var zoom = easeInOut(seg(p, 0.34, 0.6));
    var scale = lerp(metrics.startScale, 1, r) * (1 + (metrics.zoomK - 1) * zoom);
    var y = lerp(metrics.startY, 0, r) + zoom * metrics.centerShift;
    holder.style.transform = "translate3d(0," + y.toFixed(1) + "px,0)";
    mac.style.transform = "scale(" + scale.toFixed(4) + ")";

    /* Seen from above, an open laptop is taller than in the flat front view and can spill
       out of a short window. While the camera is up, shrink it to fit and keep it between
       the nav and the bottom edge. */
    if (p < 0.34) {
      var box = laptopBounds();
      var avail = metrics.vh - FIT_TOP - FIT_BOTTOM;
      if (box[1] - box[0] > avail) {
        scale *= avail / (box[1] - box[0]);
        mac.style.transform = "scale(" + scale.toFixed(4) + ")";
        box = laptopBounds();
      }
      var shift = 0;
      if (box[0] < FIT_TOP) shift = FIT_TOP - box[0];
      else if (box[1] > metrics.vh - FIT_BOTTOM) shift = metrics.vh - FIT_BOTTOM - box[1];
      if (shift) holder.style.transform = "translate3d(0," + (y + shift).toFixed(1) + "px,0)";
    }

    var chassisOpacity = String(1 - easeInOut(seg(p, 0.4, 0.56)));
    for (var i = 0; i < chassis.length; i++) chassis[i].style.opacity = chassisOpacity;
    mac.style.setProperty("--co", chassisOpacity);
    mac.style.setProperty("--sa", (1 - easeInOut(seg(p, 0.52, 0.68))).toFixed(3));

    /* Soften the black's edges while the silver is still fading, so by the time the
       frame is gone there is no rectangle left to see. */
    var feather = easeInOut(seg(p, 0.34, 0.56));
    mac.style.setProperty("--f", (feather * metrics.W * 0.16).toFixed(1) + "px");
    mac.style.setProperty("--mb", ((1 - seg(p, 0.34, 0.5)) * metrics.W * 0.09).toFixed(1) + "px");

    renderScreen(p);
    updateGlow(p);
    /* Once the black has mostly dissolved, stop clipping to the screen's box so
       the cards float freely over the page even where the screen is smaller
       than the viewport (narrow windows). */
    screen.classList.toggle("is-free", p > 0.5);
  }

  /* ---------- scroll wiring ---------- */
  function progress() {
    var total = root.offsetHeight - window.innerHeight;
    if (total <= 0) return 0;
    return clamp(-root.getBoundingClientRect().top / total, 0, 1);
  }

  measure();

  if (reduceMotion) {
    /* No pinning or scroll choreography: headline on top, laptop open below,
       screen showing its final frame. */
    var renderStatic = function () {
      render(0.26);
      renderScreen(0.94);
      copy.style.opacity = "";
      copy.style.transform = "";
      copy.style.visibility = "";
    };
    root.classList.add("is-static");
    renderStatic();
    var lastW = window.innerWidth;
    window.addEventListener("resize", function () {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      measure();
      renderStatic();
    });
    return;
  }

  root.classList.add("is-live");
  measure();

  var target = progress();
  var cur = target;
  var raf = 0;
  render(cur);

  function tick() {
    var d = target - cur;
    if (Math.abs(d) < 0.0003) {
      cur = target;
      render(cur);
      raf = 0;
      return;
    }
    cur += d * 0.16;
    render(cur);
    raf = requestAnimationFrame(tick);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(tick); }

  window.addEventListener("scroll", function () { target = progress(); kick(); }, { passive: true });
  window.addEventListener("resize", function () { measure(); target = progress(); kick(); });
})();
