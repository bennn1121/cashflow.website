(function () {
  'use strict';

  var html = document.documentElement;
  var reducedMotion = html.classList.contains('reduced-motion');
  var isFallbackTier = html.classList.contains('tier-fallback');

  if (!reducedMotion) html.classList.add('js-smooth-scroll');

  /* ----------------------------------------------------------
     Mobile nav toggle
     ---------------------------------------------------------- */
  var navToggle = document.getElementById('navToggle');
  var siteNav = document.getElementById('siteNav');

  if (navToggle && siteNav) {
    navToggle.addEventListener('click', function () {
      var isOpen = siteNav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    siteNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        siteNav.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ----------------------------------------------------------
     Header solid background on scroll
     ---------------------------------------------------------- */
  var header = document.getElementById('siteHeader');
  function updateHeader() {
    if (!header) return;
    if (window.scrollY > 40) header.classList.add('is-scrolled');
    else header.classList.remove('is-scrolled');
  }
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  /* ----------------------------------------------------------
     FAQ accordion — one open at a time
     ---------------------------------------------------------- */
  var faqList = document.getElementById('faqList');
  if (faqList) {
    var questions = faqList.querySelectorAll('.faq-question');
    questions.forEach(function (button) {
      button.addEventListener('click', function () {
        var expanded = button.getAttribute('aria-expanded') === 'true';
        var answer = document.getElementById(button.getAttribute('aria-controls'));

        questions.forEach(function (other) {
          if (other === button) return;
          other.setAttribute('aria-expanded', 'false');
          var otherAnswer = document.getElementById(other.getAttribute('aria-controls'));
          if (otherAnswer) otherAnswer.hidden = true;
        });

        button.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        if (answer) answer.hidden = expanded;
      });
    });
  }

  /* ----------------------------------------------------------
     Section reveals
     ---------------------------------------------------------- */
  if (reducedMotion) {
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(
        function (entries, obs) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              obs.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15 }
      );
      document.querySelectorAll('.reveal').forEach(function (el) {
        io.observe(el);
      });
    } else {
      document.querySelectorAll('.reveal').forEach(function (el) {
        el.classList.add('is-visible');
      });
    }
  } else if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    ScrollTrigger.batch('.reveal', {
      start: 'top 88%',
      once: true,
      onEnter: function (batch) {
        gsap.to(batch, {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: 'power2.out',
          stagger: 0.12,
        });
      },
    });

    if (!isFallbackTier) {
      ScrollTrigger.create({
        trigger: document.body,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        onUpdate: function (self) {
          if (window.LedgerlineScene) {
            window.LedgerlineScene.setScrollProgress(self.progress);
          }
        },
      });
    }
  }

  /* ----------------------------------------------------------
     Hero text reveal
     ---------------------------------------------------------- */
  function animateHeroTextIn(delay) {
    if (!window.gsap) return;
    gsap
      .timeline({ delay: delay || 0 })
      .to('.hero-headline', { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out' })
      .to('.hero-sub', { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, '-=0.55')
      .to('.hero-ctas', { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }, '-=0.5');
  }

  /* ----------------------------------------------------------
     Fallback dark SVG chart (no WebGL / reduced-motion / low-power)
     ---------------------------------------------------------- */
  function formatCurrency(value) {
    var negative = value < 0;
    var abs = Math.round(Math.abs(value));
    var formatted = '$' + abs.toLocaleString('en-US');
    return negative ? '-' + formatted : formatted;
  }

  function setupFallbackChart() {
    var line = document.getElementById('fallbackLine');
    var dot = document.getElementById('fallbackDot');
    var callout = document.getElementById('fallbackCallout');
    var valueEl = document.getElementById('fallbackValue');
    if (!line) return;

    var LOW_VALUE = -4200;

    if (reducedMotion || !window.gsap) {
      dot.style.opacity = 1;
      if (callout) callout.classList.add('is-visible');
      if (valueEl) valueEl.textContent = formatCurrency(LOW_VALUE);
      return;
    }

    var length = line.getTotalLength();
    line.style.strokeDasharray = length;
    line.style.strokeDashoffset = length;
    dot.style.opacity = 0;

    var state = { draw: 0, counter: 0 };
    gsap
      .timeline({ delay: 0.3 })
      .to(
        state,
        {
          draw: 1,
          duration: 1.8,
          ease: 'power1.inOut',
          onUpdate: function () {
            line.style.strokeDashoffset = length * (1 - state.draw);
          },
        },
        0
      )
      .call(
        function () {
          if (callout) callout.classList.add('is-visible');
          dot.style.opacity = 1;
        },
        null,
        0.9
      )
      .to(
        state,
        {
          counter: 1,
          duration: 0.9,
          ease: 'power1.out',
          onUpdate: function () {
            if (valueEl) valueEl.textContent = formatCurrency(LOW_VALUE * state.counter);
          },
        },
        0.9
      );

    animateHeroTextIn(0.2);
  }

  if (isFallbackTier) {
    setupFallbackChart();
  } else {
    document.addEventListener('ledgerline:scene-ready', function () {
      animateHeroTextIn(0);
    });
  }
})();
