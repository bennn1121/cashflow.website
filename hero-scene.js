/* Ledgerline — "the ledger at night"
   A perspective ledger-grid floor with a single glowing cash-balance tube
   that draws itself in, dips into a shortfall zone, and recovers.
   Only runs on the "tier-full" capability tier — see the inline detection
   script in index.html. Everything else gets the CSS/SVG fallback chart.
   Loaded as a classic script (not type="module") because module scripts
   cannot fetch anything — not even a sibling local file — when the page
   is opened via file://, which this site must support. */

(function () {
  const html = document.documentElement;
  if (!html.classList.contains('tier-full')) return;

  try {
    init();
  } catch (err) {
    console.error('Ledgerline 3D scene failed, falling back to static chart.', err);
    html.classList.remove('tier-full');
    html.classList.add('tier-fallback');
  }

  function init() {
    const canvas = document.getElementById('heroCanvas');
    const calloutEl = document.getElementById('chartCallout');
    const valueEl = document.getElementById('lowPointValue');
    if (!canvas) return;

    const BG_COLOR = 0x0a0e0c;
    const GRID_COLOR = 0x2f9e6e;
    const SHORTFALL_COLOR = 0xff5c4a;

    /* ---------------------------------------------------------
       Scene / camera / renderer
       --------------------------------------------------------- */
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(BG_COLOR, 16, 56);

    const camera = new THREE.PerspectiveCamera(
      52,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    const camState = { z: 11, y: 3.6 };
    camera.position.set(0, camState.y, camState.z);
    camera.lookAt(0, 0.4, -25);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.setClearColor(BG_COLOR, 1);

    /* ---------------------------------------------------------
       Ledger grid floor
       --------------------------------------------------------- */
    const gridMaterial = new THREE.LineBasicMaterial({
      color: GRID_COLOR,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const floorY = -1.6;
    const zNear = 2;
    const zFar = -60;
    const xExtent = 26;
    const gridPositions = [];

    for (let x = -xExtent; x <= xExtent; x += 2) {
      gridPositions.push(x, floorY, zNear, x, floorY, zFar);
    }
    for (let z = zNear; z >= zFar; z -= 3) {
      gridPositions.push(-xExtent, floorY, z, xExtent, floorY, z);
    }

    const gridGeometry = new THREE.BufferGeometry();
    gridGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(gridPositions, 3)
    );
    const gridLines = new THREE.LineSegments(gridGeometry, gridMaterial);
    scene.add(gridLines);

    /* ---------------------------------------------------------
       The balance line — a glowing tube that draws itself in
       --------------------------------------------------------- */
    const weekValues = [
      8000, 7200, 6500, 5800, 4600, 3000, 1200, -1800, -4200, -1500, 1800,
      4200, 6800,
    ];
    const DIP_INDEX = 8;
    const LOW_VALUE = weekValues[DIP_INDEX];
    const BASELINE_Y = 1.2;
    const SCALE_Y = 0.00055;
    /* Offset right of camera-forward so the line reads as a distinct
       element beside the (left-aligned) headline instead of behind it. */
    const LINE_X = 11.5;

    const points = weekValues.map((value, i) => {
      const z = zNear - i * 4;
      const y = BASELINE_Y + value * SCALE_Y;
      return new THREE.Vector3(LINE_X, y, z);
    });

    const dipWorldPos = points[DIP_INDEX].clone();
    const dipT = DIP_INDEX / (weekValues.length - 1);

    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
    const TUBULAR_SEGMENTS = 140;
    const RADIAL_SEGMENTS = 8;

    const greenColor = new THREE.Color(GRID_COLOR);
    const orangeColor = new THREE.Color(SHORTFALL_COLOR);

    function buildTube(radius) {
      const geo = new THREE.TubeGeometry(
        curve,
        TUBULAR_SEGMENTS,
        radius,
        RADIAL_SEGMENTS,
        false
      );
      const posCount = geo.attributes.position.count;
      const colors = new Float32Array(posCount * 3);
      const ringSize = RADIAL_SEGMENTS + 1;

      for (let i = 0; i < posCount; i++) {
        const ring = Math.floor(i / ringSize);
        const t = ring / TUBULAR_SEGMENTS;
        const dist = Math.abs(t - dipT);
        const influence = Math.max(0, 1 - dist / 0.12);
        const c = greenColor.clone().lerp(orangeColor, influence);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }

      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.setDrawRange(0, 0);
      return geo;
    }

    const coreGeometry = buildTube(0.055);
    const haloGeometry = buildTube(0.17);

    const coreMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const haloMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const coreTube = new THREE.Mesh(coreGeometry, coreMaterial);
    const haloTube = new THREE.Mesh(haloGeometry, haloMaterial);
    scene.add(haloTube, coreTube);

    const coreIndicesPerSegment = coreGeometry.index.count / TUBULAR_SEGMENTS;
    const haloIndicesPerSegment = haloGeometry.index.count / TUBULAR_SEGMENTS;

    /* ---------------------------------------------------------
       Dip glow sprite
       --------------------------------------------------------- */
    function makeGlowTexture() {
      const size = 128;
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      const gradient = ctx.createRadialGradient(
        size / 2, size / 2, 0,
        size / 2, size / 2, size / 2
      );
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.35, 'rgba(255,92,74,0.85)');
      gradient.addColorStop(1, 'rgba(255,92,74,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      return new THREE.CanvasTexture(c);
    }

    const glowSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture(),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    glowSprite.position.copy(dipWorldPos);
    glowSprite.scale.set(0.001, 0.001, 1);
    scene.add(glowSprite);

    /* ---------------------------------------------------------
       Intro timeline (GSAP)
       --------------------------------------------------------- */
    let introComplete = false;
    let dipRevealed = false;

    function updateDraw(t) {
      const ring = Math.min(TUBULAR_SEGMENTS, Math.floor(t * TUBULAR_SEGMENTS));
      coreGeometry.setDrawRange(0, ring * coreIndicesPerSegment);
      haloGeometry.setDrawRange(0, ring * haloIndicesPerSegment);

      if (!dipRevealed && ring / TUBULAR_SEGMENTS >= dipT) {
        dipRevealed = true;
        window.gsap.to(glowSprite.scale, {
          x: 2.6, y: 2.6, z: 1, duration: 0.7, ease: 'power2.out',
        });
        window.gsap.to(glowSprite.material, { opacity: 0.85, duration: 0.7 });
        if (calloutEl) calloutEl.classList.add('is-visible');
      }
    }

    function formatCurrency(value) {
      const negative = value < 0;
      const abs = Math.round(Math.abs(value));
      const formatted = '$' + abs.toLocaleString('en-US');
      return negative ? '-' + formatted : formatted;
    }

    function updateCounter(progress) {
      if (valueEl) valueEl.textContent = formatCurrency(LOW_VALUE * progress);
    }

    const gsap = window.gsap;
    const introState = { camZ: camState.z, camY: camState.y, drawT: 0, counter: 0 };

    const tl = gsap.timeline({
      defaults: { ease: 'power2.out' },
      onComplete: () => {
        introComplete = true;
        document.dispatchEvent(new CustomEvent('ledgerline:scene-ready'));
      },
    });

    tl.to(
      introState,
      {
        camZ: 4.4,
        camY: 2.1,
        duration: 3.2,
        ease: 'power2.out',
        onUpdate: () => {
          camera.position.z = introState.camZ;
          camera.position.y = introState.camY;
          camera.lookAt(0, 0.4, -25);
        },
      },
      0
    );

    tl.to(
      introState,
      {
        drawT: 1,
        duration: 2.6,
        ease: 'power1.inOut',
        onUpdate: () => updateDraw(introState.drawT),
      },
      0.15
    );

    tl.to(
      introState,
      {
        counter: 1,
        duration: 1.0,
        ease: 'power1.out',
        onUpdate: () => updateCounter(introState.counter),
      },
      1.55
    );

    /* ---------------------------------------------------------
       Scroll-linked camera (post-intro), grid fade
       --------------------------------------------------------- */
    window.LedgerlineScene = {
      setScrollProgress(progress) {
        if (!introComplete) return;
        camera.position.z = introState.camZ - progress * 34;
        camera.lookAt(0, 0.4, -25);
        const fade = Math.max(0.05, 1 - progress * 0.85);
        gridMaterial.opacity = 0.22 * fade;
      },
    };

    /* ---------------------------------------------------------
       Render loop — paused when tab hidden or scrolled far down
       --------------------------------------------------------- */
    const dipVec = new THREE.Vector3();

    function updateCalloutScreenPosition() {
      if (!calloutEl) return;
      dipVec.copy(dipWorldPos).project(camera);
      const x = (dipVec.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-dipVec.y * 0.5 + 0.5) * window.innerHeight;
      calloutEl.style.left = x + 'px';
      calloutEl.style.top = y + 46 + 'px';
    }

    let rafId = null;
    let isRunning = false;

    function frame() {
      rafId = requestAnimationFrame(frame);
      renderer.render(scene, camera);
      if (dipRevealed) updateCalloutScreenPosition();
    }

    function startLoop() {
      if (isRunning) return;
      isRunning = true;
      frame();
    }
    function stopLoop() {
      isRunning = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    }

    startLoop();

    /* The callout is position:fixed so it can track the dip point's
       screen-space position; hide it once the hero itself has scrolled
       out of view so it doesn't float over later sections. */
    const heroSection = document.getElementById('top');
    if (heroSection && calloutEl) {
      const heroObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!dipRevealed) return;
            calloutEl.classList.toggle('is-visible', entry.isIntersecting);
          });
        },
        { threshold: 0.2 }
      );
      heroObserver.observe(heroSection);
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopLoop();
      else startLoop();
    });

    let scrollTicking = false;
    window.addEventListener(
      'scroll',
      () => {
        if (scrollTicking) return;
        scrollTicking = true;
        requestAnimationFrame(() => {
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          const nearBottom = maxScroll > 0 && window.scrollY / maxScroll > 0.94;
          if (nearBottom) stopLoop();
          else if (!document.hidden) startLoop();
          scrollTicking = false;
        });
      },
      { passive: true }
    );

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight, false);
    });
  }
})();
