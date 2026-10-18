/* =========================================================
   Aurel Estates — interactions
   ========================================================= */
(() => {
  "use strict";

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const body = document.body;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = () => window.matchMedia("(max-width: 768px)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);

  // If the animation libraries failed to load, show the plain site.
  if (!window.gsap || !window.ScrollTrigger) {
    $(".preloader")?.remove();
    $(".intro")?.remove();
    body.classList.remove("is-locked");
    $(".nav").style.transform = "none";
    initStaticBits();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* ---------------------------------------------------------
     Smooth scroll (Lenis) wired into ScrollTrigger
     --------------------------------------------------------- */
  let lenis = null;
  if (window.Lenis && !reduceMotion) {
    lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  const scrollY = () => (lenis ? lenis.scroll : window.scrollY);

  /* ---------------------------------------------------------
     Word splitter (keeps nested <em>, <br>, etc.)
     --------------------------------------------------------- */
  function splitWords(el) {
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const parts = child.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((p) => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(" ")); return; }
            const mask = document.createElement("span");
            mask.className = "wm";
            mask.style.cssText = "display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:0.08em;margin-bottom:-0.08em";
            const inner = document.createElement("span");
            inner.className = "wi";
            inner.style.display = "inline-block";
            inner.textContent = p;
            mask.appendChild(inner);
            frag.appendChild(mask);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== "BR") {
          walk(child);
        }
      });
    };
    walk(el);
    return $$(".wi", el);
  }

  /* ---------------------------------------------------------
     PRELOADER → INTRO ENTRANCE
     --------------------------------------------------------- */
  const intro = $(".intro");
  const introMedia = $(".intro__media");
  const introImg = $(".intro__img");
  const introWords = $$(".intro__title .w");
  const introUnderlines = $$(".intro__title .u");
  const hint = $(".intro__hint");
  const nav = $(".nav");
  const heroMedia = $(".hero__media");
  const heroBits = [".hero__eyebrow", ".hero__title span", ".hero__text", ".hero__cta"];

  gsap.set(introWords, { yPercent: 110, opacity: 0 });
  gsap.set(introMedia, { filter: "blur(0px) brightness(1)" });
  gsap.set([".intro__logo", hint], { opacity: 0 });
  gsap.set(heroBits, { y: 40, opacity: 0 });

  function waitForImage(img) {
    return new Promise((res) => {
      if (!img) return res();
      if (img.complete && img.naturalWidth) return res();
      img.addEventListener("load", res, { once: true });
      img.addEventListener("error", res, { once: true });
    }).then(() => (img && img.decode ? img.decode().catch(() => {}) : null));
  }

  const loadBar = $(".preloader__bar span");
  gsap.to(loadBar, { scaleX: 0.75, duration: 1.6, ease: "power2.out" });

  Promise.race([
    Promise.all([waitForImage(introImg), waitForImage($(".hero__media img")), document.fonts ? document.fonts.ready : null]),
    new Promise((r) => setTimeout(r, 7000)),
  ]).then(() => {
    gsap.timeline()
      .to(loadBar, { scaleX: 1, duration: 0.4, ease: "power2.out" })
      .to(".preloader", { yPercent: -100, duration: 1.1, ease: "expo.inOut" }, "+=0.1")
      .add(() => $(".preloader").remove())
      .add(playIntroEntrance, "-=0.55");
  });

  function playIntroEntrance() {
    setDoorOrigin();
    gsap.timeline({ onComplete: armIntro })
      .fromTo(introMedia, { scale: 1.18 }, { scale: 1, duration: 2.4, ease: "expo.out" }, 0)
      .to(introWords, { yPercent: 0, opacity: 1, duration: 1.2, ease: "expo.out", stagger: 0.06 }, 0.35)
      .to(introUnderlines, { "--u": 1, duration: 1, ease: "expo.inOut", stagger: 0.08 }, 1.0)
      .to([".intro__logo", hint], { opacity: 1, duration: 1, ease: "power2.out" }, 1.1);
  }

  /* Put the zoom's transform-origin exactly on the doorway, accounting for object-fit: cover. */
  function setDoorOrigin() {
    const src = isMobile() ? $(".intro source") : introImg;
    const dx = parseFloat(src.dataset.doorX) || 0.5;
    const dy = parseFloat(src.dataset.doorY) || 0.7;
    const vw = introMedia.clientWidth, vh = introMedia.clientHeight;
    const nw = introImg.naturalWidth || 1672, nh = introImg.naturalHeight || 941;
    const s = Math.max(vw / nw, vh / nh);
    const w = nw * s, h = nh * s;
    const x = (vw - w) / 2 + dx * w;
    const y = (vh - h) / 2 + dy * h;
    gsap.set(introMedia, { transformOrigin: `${x}px ${y}px` });
  }
  window.addEventListener("resize", () => { if (state !== "open") setDoorOrigin(); });

  /* ---------------------------------------------------------
     THE GATE — high speed zoom through the doorway
     --------------------------------------------------------- */
  let state = "idle"; // idle → closed → playing → open
  const enterTl = gsap.timeline({
    paused: true,
    onComplete() {
      state = "open";
      intro.style.pointerEvents = "none";
      body.classList.remove("is-locked");
      lenis && lenis.start();
      ScrollTrigger.refresh();
      atTopSince = performance.now();
    },
    onReverseComplete() {
      state = "closed";
      enterTl.pause(0);
    },
  });

  enterTl
    .to(introWords, { yPercent: -120, opacity: 0, duration: 0.45, ease: "power3.in", stagger: 0.015 }, 0)
    .to([".intro__logo", hint, ".intro__fog"], { opacity: 0, duration: 0.35, ease: "power2.in" }, 0)
    .to(introMedia, { scale: 22, duration: 1.45, ease: "expo.in" }, 0.08)
    .to(introMedia, { filter: "blur(6px) brightness(1.15)", duration: 0.45, ease: "power2.in" }, 1.05)
    .to(".intro__glow", { opacity: 1, duration: 0.4, ease: "power2.in" }, 1.18)
    .to(intro, { autoAlpha: 0, duration: 0.7, ease: "power2.out" }, 1.55)
    .fromTo(heroMedia, { scale: 1.45 }, { scale: 1, duration: 1.8, ease: "expo.out", immediateRender: false }, 1.5)
    .to(heroBits, { y: 0, opacity: 1, duration: 1.1, ease: "expo.out", stagger: 0.08 }, 1.85)
    .to(nav, { y: 0, duration: 1.1, ease: "expo.out" }, 2.0);

  function enter() {
    if (state !== "closed") return;
    state = "playing";
    enterTl.timeScale(1).play();
  }
  function exit() {
    if (state !== "open") return;
    state = "playing";
    intro.style.pointerEvents = "";
    body.classList.add("is-locked");
    lenis && lenis.stop();
    window.scrollTo(0, 0);
    setDoorOrigin();
    enterTl.timeScale(1.5).reverse();
  }
  function armIntro() { state = "closed"; }

  // Input that triggers entering / leaving
  let atTopSince = 0;
  if (lenis) lenis.on("scroll", ({ scroll }) => { if (scroll > 2) atTopSince = 0; else if (!atTopSince) atTopSince = performance.now(); });
  window.addEventListener("scroll", () => { if (!lenis) { if (window.scrollY > 2) atTopSince = 0; else if (!atTopSince) atTopSince = performance.now(); } }, { passive: true });

  const readyToExit = () => state === "open" && scrollY() <= 2 && atTopSince && performance.now() - atTopSince > 450;

  window.addEventListener("wheel", (e) => {
    if (e.deltaY > 4) enter();
    else if (e.deltaY < -4 && readyToExit()) exit();
  }, { passive: true });

  let touchY = null;
  window.addEventListener("touchstart", (e) => { touchY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener("touchmove", (e) => {
    if (touchY == null) return;
    const d = touchY - e.touches[0].clientY;
    if (d > 30) { enter(); touchY = null; }
    else if (d < -70 && readyToExit()) { exit(); touchY = null; }
  }, { passive: true });

  window.addEventListener("keydown", (e) => {
    if (["ArrowDown", "PageDown", " ", "Enter"].includes(e.key) && state === "closed") { e.preventDefault(); enter(); }
    if (["ArrowUp", "PageUp", "Home"].includes(e.key) && readyToExit()) exit();
  });
  hint.addEventListener("click", enter);

  /* ---------------------------------------------------------
     Anchor links
     --------------------------------------------------------- */
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2 && id !== "#top") return;
      const target = id === "#top" ? 0 : $(id);
      if (target === null) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { duration: 1.4 });
      else window.scrollTo({ top: target === 0 ? 0 : target.getBoundingClientRect().top + window.scrollY, behavior: "smooth" });
    });
  });

  /* ---------------------------------------------------------
     HERO parallax + nav colour
     --------------------------------------------------------- */
  gsap.to(".hero__media img", {
    yPercent: 14, ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
  });
  gsap.to(".hero__content", {
    y: -90, opacity: 0, ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "70% top", scrub: true },
  });
  ScrollTrigger.create({
    trigger: ".hero", start: "bottom top+=90",
    onEnter: () => nav.classList.add("nav--light"),
    onLeaveBack: () => nav.classList.remove("nav--light"),
  });

  /* ---------------------------------------------------------
     Generic reveals
     --------------------------------------------------------- */
  $$(".h-display, .visit__title").forEach((h) => {
    const words = splitWords(h);
    gsap.from(words, {
      yPercent: 115, duration: 1.2, ease: "expo.out", stagger: 0.05,
      scrollTrigger: { trigger: h, start: "top 88%" },
    });
    h.classList.remove("reveal-up");
  });
  // Trigger on whichever comes first: the element nearing view, or its section filling the screen
  // (elements at the very bottom of a one-screen section would otherwise never cross the start line).
  $$(".reveal-up").forEach((el) => {
    const tween = gsap.from(el, { y: 40, opacity: 0, duration: 1.2, ease: "expo.out", paused: true });
    const play = () => tween.play();
    ScrollTrigger.create({ trigger: el, start: "top 92%", once: true, onEnter: play });
    const section = el.closest("section");
    if (section) ScrollTrigger.create({ trigger: section, start: "top 35%", once: true, onEnter: play });
  });

  /* ---------------------------------------------------------
     RESIDENCES — tabs with image wipe + autoplay
     --------------------------------------------------------- */
  const residences = [
    {
      title: "Luxury Residential Homes",
      desc: "Discover exceptional residences defined by timeless architecture, refined interiors, and thoughtfully chosen locations, where luxury meets everyday comfort.",
      tag: "Available for Buying and Renting", price: "₹ 1 Cr.", area: "1000 - 4500 sq. ft.", bhk: "2- 5 BHK", n: 1,
    },
    {
      title: "Modern Apartments",
      desc: "Well-planned apartments in connected neighbourhoods, with shared green spaces, security and amenities that make city living feel effortless.",
      tag: "Available for Buying and Renting", price: "₹ 45 L", area: "650 - 2200 sq. ft.", bhk: "1- 4 BHK", n: 2,
    },
    {
      title: "Independent Villas",
      desc: "Private villas with gardens, terraces and room to breathe, designed for families who want space, privacy and a quieter pace of life.",
      tag: "Available for Buying", price: "₹ 3.5 Cr.", area: "3500 - 8000 sq. ft.", bhk: "4- 6 BHK", n: 3,
    },
    {
      title: "Builder Floors",
      desc: "Low-rise independent floors in established residential colonies, offering the privacy of a home with the convenience of a city address.",
      tag: "Available for Buying and Renting", price: "₹ 1.8 Cr.", area: "1800 - 3600 sq. ft.", bhk: "3- 4 BHK", n: 4,
    },
  ];
  // Preload all residence images
  residences.forEach((r) => ["main", "a", "b", "c"].forEach((k) => { const i = new Image(); i.src = `assets/img/res-${r.n}-${k}.webp`; }));

  const resMain = $(".res__main");
  const tabs = $$(".res__tabs button");
  const infoText = [".res__title", ".res__desc", ".res__tag", ".res__stats > div"].map((s) => $$(s)).flat();
  const thumbs = $$(".res__thumb");
  const progressBar = $(".res__progress span");
  let current = 0, busy = false, queued = null;

  // entrance (containers only — never tween elements that also have CSS transform transitions)
  gsap.timeline({ scrollTrigger: { trigger: ".res__body", start: "top 80%" } })
    .from(".res__main-img", { clipPath: "inset(100% 0 0 0)", duration: 1.4, ease: "expo.inOut" })
    .from(".res__main-img img", { scale: 1.35, duration: 1.8, ease: "expo.out" }, 0.3)
    .from(".res__tabs li", { x: -30, opacity: 0, duration: 0.9, ease: "expo.out", stagger: 0.08 }, 0.2)
    .from(infoText, { y: 30, opacity: 0, duration: 1, ease: "expo.out", stagger: 0.07 }, 0.4)
    .from(thumbs, { y: 70, opacity: 0, duration: 1.2, ease: "expo.out", stagger: 0.1 }, 0.6)
    .from(".res__more", { scale: 0, duration: 1, ease: "back.out(1.6)" }, 0.9);

  function showResidence(i) {
    if (busy) { queued = i; return; }
    if (i === current) return;
    busy = true;
    const dir = i > current ? 1 : -1;
    const d = residences[i];
    tabs.forEach((t, k) => t.setAttribute("aria-selected", String(k === i)));

    // main image: new layer wipes in over the old one
    const layer = document.createElement("div");
    layer.className = "res__main-img";
    layer.innerHTML = `<img src="assets/img/res-${d.n}-main.webp" alt="" />`;
    resMain.appendChild(layer);
    const old = $$(".res__main-img", resMain).slice(0, -1);
    gsap.timeline({ onComplete: () => old.forEach((o) => o.remove()) })
      .fromTo(layer, { clipPath: dir > 0 ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0%)", duration: 0.9, ease: "expo.inOut" }, 0)
      .fromTo(layer.firstChild, { scale: 1.2, xPercent: 6 * dir }, { scale: 1, xPercent: 0, duration: 1.3, ease: "expo.out" }, 0.05)
      .to(old.map((o) => o.firstChild), { xPercent: -10 * dir, duration: 0.9, ease: "expo.inOut" }, 0)
      .call(() => {
        busy = false;
        if (queued !== null) { const q = queued; queued = null; showResidence(q); }
      }, null, 0.75);

    // text out → swap → in
    gsap.timeline()
      .to(infoText, { y: -16, opacity: 0, duration: 0.3, ease: "power2.in", stagger: 0.025, overwrite: true })
      .add(() => {
        $(".res__title").textContent = d.title;
        $(".res__desc").textContent = d.desc;
        $(".res__tag").textContent = d.tag;
        $(".res__price").textContent = d.price;
        $(".res__area").textContent = d.area;
        $(".res__bhk").textContent = d.bhk;
      })
      .fromTo(infoText, { y: 20 }, { y: 0, opacity: 1, duration: 0.8, ease: "expo.out", stagger: 0.04 });

    // thumbs: clip-path wipe (no transforms, so the CSS hover zoom never fights it)
    const hide = dir > 0 ? "inset(0% 0% 100% 0%)" : "inset(100% 0% 0% 0%)";
    const from = dir > 0 ? "inset(100% 0% 0% 0%)" : "inset(0% 0% 100% 0%)";
    thumbs.forEach((t, k) => {
      const img = $("img", t);
      gsap.timeline({ delay: 0.06 * k })
        .to(img, { clipPath: hide, duration: 0.4, ease: "power3.in", overwrite: true })
        .add(() => { img.src = `assets/img/res-${d.n}-${"abc"[k]}.webp`; })
        .fromTo(img, { clipPath: from }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.75, ease: "expo.out" });
    });

    current = i;
  }

  let goToResidence = (k) => showResidence(k);
  tabs.forEach((t, k) => t.addEventListener("click", () => goToResidence(k)));

  const resMM = gsap.matchMedia();
  // Pin the section and step through 01 → 04 as the user scrolls, then release (desktop and phones).
  resMM.add("(min-width: 901px) and (min-height: 620px), (max-width: 900px) and (min-height: 560px)", () => {
    const steps = residences.length;
    const st = ScrollTrigger.create({
      trigger: ".res",
      start: "top top",
      end: () => "+=" + Math.round(window.innerHeight * 0.75 * (steps - 1)),
      pin: true,
      anticipatePin: 1,
      refreshPriority: 1,
      onUpdate: (self) => {
        gsap.set(progressBar, { scaleX: self.progress });
        showResidence(Math.min(steps - 1, Math.floor(self.progress * steps)));
      },
    });
    goToResidence = (k) => {
      const y = st.start + (st.end - st.start) * ((k + 0.5) / steps);
      if (lenis) lenis.scrollTo(y, { duration: 1 }); else window.scrollTo({ top: y, behavior: "smooth" });
    };
    return () => { goToResidence = (k) => showResidence(k); };
  });
  // Very short screens (e.g. phones in landscape), where one screen can't hold the section: tabs + autoplay
  resMM.add("(min-width: 901px) and (max-height: 619px), (max-width: 900px) and (max-height: 559px)", () => {
    let auto = null;
    const restart = () => {
      auto && auto.kill();
      gsap.set(progressBar, { scaleX: 0 });
      if (reduceMotion) return;
      auto = gsap.to(progressBar, { scaleX: 1, duration: 6.5, ease: "none", onComplete: () => { showResidence((current + 1) % residences.length); restart(); } });
    };
    const st = ScrollTrigger.create({
      trigger: ".res", start: "top 40%", end: "bottom 30%",
      onToggle: (self) => { if (self.isActive) restart(); else { auto && auto.kill(); } },
    });
    const onClick = () => st.isActive && restart();
    tabs.forEach((t) => t.addEventListener("click", onClick));
    return () => { auto && auto.kill(); st.kill(); tabs.forEach((t) => t.removeEventListener("click", onClick)); };
  });

  // magnetic "And many more"
  if (finePointer) {
    $$(".magnetic").forEach((m) => {
      const xTo = gsap.quickTo(m, "x", { duration: 0.6, ease: "power3" });
      const yTo = gsap.quickTo(m, "y", { duration: 0.6, ease: "power3" });
      m.addEventListener("mousemove", (e) => {
        const r = m.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.35);
        yTo((e.clientY - r.top - r.height / 2) * 0.35);
      });
      m.addEventListener("mouseleave", () => { xTo(0); yTo(0); });
    });
  }

  /* ---------------------------------------------------------
     FIND — cards rise in (2D only, no tilt: keeps it smooth)
     --------------------------------------------------------- */
  const cardTl = gsap.timeline({ scrollTrigger: { trigger: ".find__grid", start: "top 85%" } });
  cardTl
    .from(".card", { y: 80, opacity: 0, duration: 1.2, ease: "expo.out", stagger: 0.12 })
    .from(".card__body", { y: 24, opacity: 0, duration: 1, ease: "expo.out", stagger: 0.12 }, 0.3);

  /* ---------------------------------------------------------
     STATS — count up (width reserved so neighbouring text never shifts)
     --------------------------------------------------------- */
  $$(".count").forEach((el) => {
    const to = +el.dataset.to;
    const o = { v: 0 };
    gsap.to(o, {
      v: to, duration: 2.2, ease: "power3.out",
      onStart: () => {
        el.textContent = to;
        el.style.minWidth = Math.ceil(el.getBoundingClientRect().width) + "px";
        el.textContent = 0;
      },
      onUpdate: () => { el.textContent = Math.round(o.v); },
      scrollTrigger: { trigger: ".stats", start: "top 85%" },
    });
  });
  gsap.from(".stat", {
    y: 30, opacity: 0, duration: 1.1, ease: "expo.out", stagger: 0.12,
    scrollTrigger: { trigger: ".stats", start: "top 85%" },
  });

  /* ---------------------------------------------------------
     EXPERIENCE — infinite marquee that reacts to scroll speed
     --------------------------------------------------------- */
  const track = $(".marquee__track");
  const set = $(".marquee__set");
  const clone = set.cloneNode(true);
  clone.setAttribute("aria-hidden", "true");
  $$("img", clone).forEach((i) => (i.alt = ""));
  track.appendChild(clone);

  const marquee = gsap.to(track, { xPercent: -50, duration: isMobile() ? 45 : 60, ease: "none", repeat: -1 });
  // Stop completely while a review card is hovered; ease back in when the pointer leaves it.
  let hovering = false;
  $$(".tile", track).forEach((tile) => {
    tile.addEventListener("mouseenter", () => { hovering = true; gsap.to(marquee, { timeScale: 0, duration: 0.35, ease: "power2.out", overwrite: true }); });
    tile.addEventListener("mouseleave", () => { hovering = false; gsap.to(marquee, { timeScale: 1, duration: 0.8, ease: "power2.in", overwrite: true }); });
  });
  ScrollTrigger.create({
    trigger: ".exp", start: "top bottom", end: "bottom top",
    onUpdate: (self) => {
      if (hovering) return;
      const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 400, 5);
      gsap.to(marquee, { timeScale: boost, duration: 0.2, overwrite: true, onComplete: () => { if (!hovering) gsap.to(marquee, { timeScale: 1, duration: 1.2, overwrite: true }); } });
    },
  });
  gsap.from(".mcol", {
    y: 80, opacity: 0, duration: 1.3, ease: "expo.out", stagger: 0.06,
    scrollTrigger: { trigger: ".marquee", start: "top 85%" },
  });

  /* ---------------------------------------------------------
     FAQ accordion
     --------------------------------------------------------- */
  const items = $$(".faq__item");
  function toggle(item, open) {
    const a = $(".faq__a", item);
    item.classList.toggle("is-open", open);
    $(".faq__q", item).setAttribute("aria-expanded", String(open));
    gsap.killTweensOf(a);
    if (open) gsap.fromTo(a, { height: a.offsetHeight }, { height: "auto", duration: 0.7, ease: "expo.out" });
    else gsap.fromTo(a, { height: a.offsetHeight }, { height: 0, duration: 0.5, ease: "expo.out" });
    gsap.fromTo($("p", a), { y: open ? 12 : 0, opacity: open ? 0 : 1 }, { y: 0, opacity: open ? 1 : 0, duration: open ? 0.7 : 0.3, ease: "power2.out", delay: open ? 0.08 : 0 });
  }
  items.forEach((item) => {
    $(".faq__q", item).addEventListener("click", () => {
      const willOpen = !item.classList.contains("is-open");
      items.forEach((o) => { if (o !== item && o.classList.contains("is-open")) toggle(o, false); });
      toggle(item, willOpen);
    });
  });
  gsap.from(".faq__item", {
    x: 60, opacity: 0, duration: 1.1, ease: "expo.out", stagger: 0.09,
    scrollTrigger: { trigger: ".faq__list", start: "top 82%" },
  });

  /* ---------------------------------------------------------
     VISIT — the house rises, fields settle in
     --------------------------------------------------------- */
  gsap.fromTo(".visit__bg img", { scale: 1.15, yPercent: -6 }, {
    scale: 1, yPercent: 0, ease: "none",
    scrollTrigger: { trigger: ".visit", start: "top bottom", end: "bottom bottom", scrub: true },
  });
  gsap.timeline({ scrollTrigger: { trigger: ".house", start: "top 80%" } })
    .from(".house", { y: 160, opacity: 0, duration: 1.5, ease: "expo.out" })
    .from(".step", { y: 30, opacity: 0, duration: 1, ease: "expo.out", stagger: 0.12 }, 0.45);

  /* ---------------------------------------------------------
     FOOTER — skyline lifts as you arrive
     --------------------------------------------------------- */
  gsap.from(".footer__skyline", {
    yPercent: 35, ease: "none",
    scrollTrigger: { trigger: ".footer", start: "top bottom", end: "bottom bottom", scrub: true },
  });
  gsap.from(".footer__brand, .footer__col", {
    y: 40, opacity: 0, duration: 1.1, ease: "expo.out", stagger: 0.08,
    scrollTrigger: { trigger: ".footer", start: "top 85%" },
  });

  initStaticBits();

  /* ---------------------------------------------------------
     Bits that work without GSAP
     --------------------------------------------------------- */
  function initStaticBits() {
    const form = document.querySelector(".house__form");
    if (!form || form.dataset.ready) return;
    form.dataset.ready = "1";
    const date = form.querySelector('input[type="date"]');
    if (date) date.min = new Date().toISOString().slice(0, 10);

    const done = form.querySelector(".house__done");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = form.elements.name, email = form.elements.email;
      let ok = true;
      [name, email].forEach((f) => {
        const valid = f.value.trim() && (f.type !== "email" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value));
        f.classList.toggle("is-invalid", !valid);
        if (!valid) ok = false;
      });
      if (!ok) { done.textContent = "Please add your name and a valid email so we can reach you."; return; }
      const first = name.value.trim().split(" ")[0];
      done.textContent = `Thank you, ${first}. Our team will be in touch shortly to confirm your visit.`;
      form.reset();
      if (date) date.min = new Date().toISOString().slice(0, 10);
    });
    form.addEventListener("input", (e) => e.target.classList.remove("is-invalid"));
  }
})();
