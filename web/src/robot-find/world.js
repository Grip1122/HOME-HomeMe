/* global THREE, RF */
(function () {
  const RF = window.RF;
  const T = THREE;

  const PALETTE = {
    floor: "#9a6b49",
    wall: "#e6dbcb",
    wallWarm: "#d9c9b4",
    wood: "#8a5a3a",
    woodDark: "#5b3a25",
    sofa: "#5f7d6e",
    sofaLight: "#728f7f",
    terracotta: "#b96550",
    mustard: "#c69752",
    cream: "#d8c8b2",
    metal: "#c5ab7f",
    black: "#1c2024",
    screen: "#0d1b26",
    green: "#4e8b63",
    cyan: "#5fe3cf",
    amber: "#f3b76b",
  };

  function srgbCanvasTexture(w, h, draw, repeatX, repeatY) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    draw(ctx, w, h);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(repeatX || 1, repeatY || 1);
    tex.anisotropy = 4;
    return tex;
  }

  function makeWoodTexture() {
    return srgbCanvasTexture(
      512,
      512,
      (ctx, w, h) => {
        const rng = RF.mulberry32(91);
        ctx.fillStyle = "#9a6b49";
        ctx.fillRect(0, 0, w, h);
        const plankH = 64;
        for (let y = 0; y < h; y += plankH) {
          const tone = 0.86 + rng() * 0.24;
          const r = Math.round(154 * tone);
          const g = Math.round(107 * tone);
          const b = Math.round(73 * tone);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(0, y, w, plankH - 2);
          ctx.fillStyle = "rgba(50,30,18,.28)";
          ctx.fillRect(0, y + plankH - 2, w, 2);
          for (let i = 0; i < 28; i++) {
            ctx.strokeStyle = `rgba(60,36,20,${0.03 + rng() * 0.06})`;
            ctx.lineWidth = 0.7 + rng() * 1.1;
            ctx.beginPath();
            const yy = y + rng() * plankH;
            ctx.moveTo(0, yy);
            ctx.bezierCurveTo(w * 0.3, yy + (rng() - 0.5) * 8, w * 0.7, yy + (rng() - 0.5) * 8, w, yy);
            ctx.stroke();
          }
          const seam = Math.floor(rng() * w);
          ctx.fillStyle = "rgba(45,28,16,.22)";
          ctx.fillRect(seam, y, 1.3, plankH);
        }
      },
      3.2,
      2.2
    );
  }

  function makeWallTexture() {
    return srgbCanvasTexture(
      256,
      256,
      (ctx, w, h) => {
        const rng = RF.mulberry32(17);
        ctx.fillStyle = "#e6dbcb";
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 4200; i++) {
          const a = 0.015 + rng() * 0.035;
          ctx.fillStyle = rng() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(120,100,80,${a})`;
          ctx.fillRect(rng() * w, rng() * h, 1, 1);
        }
      },
      4,
      2
    );
  }

  function makeFabricTexture() {
    return srgbCanvasTexture(
      128,
      128,
      (ctx, w, h) => {
        const rng = RF.mulberry32(33);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 2600; i++) {
          ctx.fillStyle = rng() > 0.5 ? "rgba(0,0,0,.04)" : "rgba(255,255,255,.05)";
          ctx.fillRect(rng() * w, rng() * h, 1, 1);
        }
      },
      3,
      3
    );
  }

  function makeRugTexture(seed, base, accent, accent2) {
    return srgbCanvasTexture(
      512,
      512,
      (ctx, w, h) => {
        const rng = RF.mulberry32(seed);
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 14;
        ctx.strokeRect(30, 30, w - 60, h - 60);
        ctx.strokeStyle = accent2;
        ctx.lineWidth = 3;
        ctx.strokeRect(52, 52, w - 104, h - 104);
        for (let i = 0; i < 5; i++) {
          const cx = 70 + i * 93;
          const cy = h / 2 + (i % 2 === 0 ? -46 : 46);
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = i % 2 === 0 ? accent : accent2;
          ctx.globalAlpha = 0.65;
          ctx.fillRect(-26, -26, 52, 52);
          ctx.globalAlpha = 0.35;
          ctx.strokeStyle = base;
          ctx.lineWidth = 4;
          ctx.strokeRect(-18, -18, 36, 36);
          ctx.restore();
        }
        for (let i = 0; i < 3200; i++) {
          ctx.fillStyle = rng() > 0.5 ? "rgba(255,255,255,.04)" : "rgba(60,35,20,.035)";
          ctx.fillRect(rng() * w, rng() * h, 1, 1);
        }
      },
      1,
      1
    );
  }

  function makeArtTexture(seed) {
    return srgbCanvasTexture(
      320,
      220,
      (ctx, w, h) => {
        const rng = RF.mulberry32(seed);
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, "#e9dcc7");
        g.addColorStop(1, "#cbb49b");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        const colors = ["#b96550", "#5f7d6e", "#c69752", "#3c4a52", "#8a5a3a"];
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
          ctx.globalAlpha = 0.35 + rng() * 0.4;
          ctx.beginPath();
          ctx.ellipse(rng() * w, rng() * h, 30 + rng() * 80, 20 + rng() * 60, rng() * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = "#2d3438";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(w * 0.12, h * 0.7);
        ctx.bezierCurveTo(w * 0.35, h * 0.2, w * 0.65, h * 0.9, w * 0.9, h * 0.3);
        ctx.stroke();
      },
      1,
      1
    );
  }

  function makeSkyTexture() {
    return srgbCanvasTexture(
      512,
      256,
      (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, "#7ba7c9");
        g.addColorStop(0.45, "#c9d9df");
        g.addColorStop(0.72, "#f0cfa5");
        g.addColorStop(1, "#e3a37a");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "rgba(255,244,214,.9)";
        ctx.beginPath();
        ctx.arc(w * 0.72, h * 0.56, 24, 0, Math.PI * 2);
        ctx.fill();
        const rng = RF.mulberry32(5);
        for (let i = 0; i < 22; i++) {
          ctx.fillStyle = `rgba(255,255,255,${0.12 + rng() * 0.22})`;
          ctx.beginPath();
          ctx.ellipse(rng() * w, h * (0.1 + rng() * 0.45), 30 + rng() * 60, 6 + rng() * 12, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = "rgba(58,72,74,.55)";
        for (let i = 0; i < 9; i++) {
          const x = i * 68 - 20;
          const hh = 30 + rng() * 55;
          ctx.fillRect(x, h - hh, 52, hh);
        }
      },
      1,
      1
    );
  }

  function makeScreenTexture() {
    return srgbCanvasTexture(
      512,
      288,
      (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, "#12303a");
        g.addColorStop(1, "#071218");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "rgba(95,227,207,.25)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const x = 40 + i * 74;
          const bh = 40 + Math.random() * 90;
          ctx.strokeRect(x, h - 50 - bh, 42, bh);
          ctx.fillStyle = "rgba(95,227,207,.12)";
          ctx.fillRect(x + 3, h - 47 - bh, 36, bh - 6);
        }
        ctx.strokeStyle = "rgba(95,227,207,.45)";
        ctx.beginPath();
        for (let x = 30; x < w - 20; x += 12) {
          const y = h * 0.38 + Math.sin(x * 0.03) * 18 + Math.sin(x * 0.011) * 26;
          if (x === 30) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.fillStyle = "rgba(243,183,107,.8)";
        ctx.font = "600 17px sans-serif";
        ctx.fillText("HOME MAP · A", 30, 42);
        ctx.fillStyle = "rgba(255,255,255,.35)";
        ctx.font = "12px monospace";
        ctx.fillText("3 ROOMS / 8 OBJECTS / LOCAL", 30, 64);
      },
      1,
      1
    );
  }

  function std(color, roughness, metalness) {
    return new T.MeshStandardMaterial({
      color: new T.Color(color),
      roughness: roughness === undefined ? 0.85 : roughness,
      metalness: metalness || 0,
    });
  }

  class Robot {
    constructor() {
      this.group = new T.Group();
      this.group.name = "robot";
      this.bodyGroup = new T.Group();
      this.group.add(this.bodyGroup);
      this.headGroup = new T.Group();
      this.parts = {};
      this.speed = 0;
      this.state = "idle";
      this.blink = 0;
      this.blinkTimer = 2.4;
      this.scanPhase = 0;
      this.build();
    }

    build() {
      const white = std("#dbe5e6", 0.42, 0.05);
      const white2 = std("#c3d1d3", 0.5, 0.05);
      const dark = std("#20272b", 0.42, 0.2);
      const rubber = std("#15191c", 0.95, 0);
      const cyanMat = new T.MeshStandardMaterial({
        color: "#5fe3cf",
        emissive: "#3dd6bf",
        emissiveIntensity: 2.2,
        roughness: 0.35,
      });
      const screenMat = new T.MeshStandardMaterial({
        color: "#0b1418",
        emissive: "#12333a",
        emissiveIntensity: 0.8,
        roughness: 0.18,
        metalness: 0.2,
      });
      this.parts.cyan = cyanMat;

      // wheels
      this.wheels = [];
      for (const side of [-1, 1]) {
        const pivot = new T.Group();
        pivot.position.set(side * 0.315, 0.125, 0);
        const wheel = new T.Mesh(new T.CylinderGeometry(0.115, 0.115, 0.06, 24), rubber);
        wheel.rotation.z = Math.PI / 2;
        wheel.castShadow = true;
        wheel.receiveShadow = true;
        pivot.add(wheel);
        const hub = new T.Mesh(new T.CylinderGeometry(0.048, 0.048, 0.064, 20), white2);
        hub.rotation.z = Math.PI / 2;
        pivot.add(hub);
        this.bodyGroup.add(pivot);
        this.wheels.push(pivot);
      }

      // base
      const base = new T.Mesh(new T.CylinderGeometry(0.31, 0.34, 0.14, 32), dark);
      base.position.y = 0.2;
      base.castShadow = true;
      base.receiveShadow = true;
      this.bodyGroup.add(base);
      const baseRing = new T.Mesh(new T.CylinderGeometry(0.345, 0.345, 0.025, 32), cyanMat);
      baseRing.position.y = 0.14;
      this.bodyGroup.add(baseRing);

      // torso
      this.torso = new T.Group();
      this.torso.position.y = 0.54;
      this.bodyGroup.add(this.torso);
      const torsoMesh = new T.Mesh(new T.CapsuleGeometry(0.265, 0.28, 8, 20), white);
      torsoMesh.castShadow = true;
      torsoMesh.receiveShadow = true;
      this.torso.add(torsoMesh);
      const chest = new T.Mesh(new T.BoxGeometry(0.235, 0.13, 0.05), screenMat);
      chest.position.set(0, 0.0, 0.255);
      this.torso.add(chest);
      const chestLine = new T.Mesh(new T.BoxGeometry(0.13, 0.012, 0.055), cyanMat);
      chestLine.position.set(0, 0.02, 0.258);
      this.torso.add(chestLine);
      const chestDot = new T.Mesh(new T.SphereGeometry(0.012, 10, 10), cyanMat);
      chestDot.position.set(0.075, -0.025, 0.265);
      this.torso.add(chestDot);

      // head
      this.headGroup.position.y = 1.02;
      this.bodyGroup.add(this.headGroup);
      const head = new T.Mesh(new T.SphereGeometry(0.238, 32, 24), white);
      head.scale.set(1, 0.93, 0.96);
      head.castShadow = true;
      head.receiveShadow = true;
      this.headGroup.add(head);
      const face = new T.Mesh(new T.BoxGeometry(0.30, 0.185, 0.055), screenMat);
      face.position.set(0, 0.005, 0.205);
      face.rotation.x = -0.05;
      this.headGroup.add(face);
      this.eyes = [];
      for (const side of [-1, 1]) {
        const eye = new T.Mesh(new T.CapsuleGeometry(0.017, 0.045, 4, 10), cyanMat);
        eye.position.set(side * 0.072, 0.02, 0.236);
        eye.rotation.z = Math.PI / 2;
        this.headGroup.add(eye);
        this.eyes.push(eye);
      }
      const mouth = new T.Mesh(new T.BoxGeometry(0.055, 0.008, 0.012), cyanMat);
      mouth.position.set(0, -0.055, 0.236);
      mouth.material = cyanMat;
      this.headGroup.add(mouth);
      this.parts.mouth = mouth;

      // ears + antenna
      for (const side of [-1, 1]) {
        const ear = new T.Mesh(new T.CylinderGeometry(0.055, 0.055, 0.06, 20), white2);
        ear.rotation.z = Math.PI / 2;
        ear.position.set(side * 0.235, 0, 0);
        this.headGroup.add(ear);
        const dot = new T.Mesh(new T.CircleGeometry(0.018, 12), cyanMat);
        dot.position.set(side * 0.268, 0, 0);
        dot.rotation.y = side * Math.PI / 2;
        this.headGroup.add(dot);
      }
      const neck = new T.Mesh(new T.CylinderGeometry(0.08, 0.09, 0.08, 20), dark);
      neck.position.y = 0.9;
      this.bodyGroup.add(neck);

      // lidar puck
      this.lidar = new T.Group();
      this.lidar.position.y = 1.34;
      this.bodyGroup.add(this.lidar);
      const lidarBase = new T.Mesh(new T.CylinderGeometry(0.095, 0.11, 0.055, 24), dark);
      lidarBase.castShadow = true;
      this.lidar.add(lidarBase);
      const lidarRing = new T.Mesh(new T.TorusGeometry(0.105, 0.012, 8, 32), cyanMat);
      lidarRing.rotation.x = Math.PI / 2;
      lidarRing.position.y = 0.035;
      this.lidar.add(lidarRing);
      this.parts.lidarRing = lidarRing;
      const lidarDot = new T.Mesh(new T.SphereGeometry(0.018, 10, 10), cyanMat);
      lidarDot.position.set(0.075, 0.045, 0);
      this.lidar.add(lidarDot);
      this.parts.lidarDot = lidarDot;

      // arms
      this.arms = [];
      for (const side of [-1, 1]) {
        const armPivot = new T.Group();
        armPivot.position.set(side * 0.285, 0.63, 0.01);
        const arm = new T.Mesh(new T.CapsuleGeometry(0.048, 0.19, 4, 12), white2);
        arm.position.y = -0.11;
        arm.castShadow = true;
        armPivot.add(arm);
        const hand = new T.Mesh(new T.SphereGeometry(0.058, 14, 12), white);
        hand.position.y = -0.22;
        hand.castShadow = true;
        armPivot.add(hand);
        armPivot.rotation.z = side * 0.18;
        this.bodyGroup.add(armPivot);
        this.arms.push(armPivot);
      }

      // floor glow + scan rings
      this.glow = new T.Mesh(
        new T.RingGeometry(0.33, 0.56, 48),
        new T.MeshBasicMaterial({
          color: "#5fe3cf",
          transparent: true,
          opacity: 0.16,
          blending: T.AdditiveBlending,
          depthWrite: false,
          side: T.DoubleSide,
        })
      );
      this.glow.rotation.x = -Math.PI / 2;
      this.glow.position.y = 0.012;
      this.group.add(this.glow);

      this.scanRing = new T.Mesh(
        new T.RingGeometry(0.92, 0.975, 72),
        new T.MeshBasicMaterial({
          color: "#78f5df",
          transparent: true,
          opacity: 0,
          blending: T.AdditiveBlending,
          depthWrite: false,
          side: T.DoubleSide,
        })
      );
      this.scanRing.rotation.x = -Math.PI / 2;
      this.scanRing.position.y = 0.02;
      this.group.add(this.scanRing);

      this.scanRing2 = new T.Mesh(
        new T.RingGeometry(0.55, 0.575, 64),
        new T.MeshBasicMaterial({
          color: "#5fe3cf",
          transparent: true,
          opacity: 0,
          blending: T.AdditiveBlending,
          depthWrite: false,
          side: T.DoubleSide,
        })
      );
      this.scanRing2.rotation.x = -Math.PI / 2;
      this.scanRing2.position.y = 0.022;
      this.group.add(this.scanRing2);

      this.group.scale.setScalar(0.95);
    }

    setState(state) {
      this.state = state;
    }

    lookToward(worldX, worldZ) {
      const local = this.group.worldToLocal(new T.Vector3(worldX, 1.1, worldZ));
      const target = Math.atan2(local.x, local.z);
      this.headYawTarget = RF.clamp(target, -1.15, 1.15);
    }

    update(dt, time, opts) {
      const speed = opts.movingSpeed || 0;
      this.speed = RF.damp(this.speed, speed, 8, dt);
      for (const w of this.wheels) w.rotation.x += this.speed * dt * 3.6;

      const scanning = !!opts.scanning;
      const bob = Math.sin(time * (scanning ? 4.6 : 2.2)) * (scanning ? 0.012 : 0.006);
      this.torso.position.y = 0.54 + bob;
      this.headGroup.position.y = 1.02 + bob * 0.7;
      this.torso.rotation.z = Math.sin(time * 1.8) * 0.012 - this.speed * 0.02;
      this.torso.rotation.x = this.speed * 0.035;

      if (this.headYawTarget !== undefined) {
        this.headGroup.rotation.y = RF.damp(this.headGroup.rotation.y, this.headYawTarget, 5, dt);
        this.headGroup.rotation.x = RF.damp(this.headGroup.rotation.x, opts.lookDown ? 0.12 : 0, 4, dt);
      }
      if (scanning) {
        this.headGroup.rotation.y = Math.sin(time * 1.35) * 0.62;
        this.headGroup.rotation.x = 0.06 + Math.sin(time * 0.8) * 0.04;
      }

      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) {
        this.blink = 1;
        this.blinkTimer = 2.4 + Math.random() * 4.2;
      }
      this.blink = Math.max(0, this.blink - dt * 7);
      const eyeScale = 1 - this.blink * 0.86;
      for (const e of this.eyes) e.scale.y = eyeScale;

      this.lidar.rotation.y += dt * (scanning ? 6.2 : 1.4);
      this.parts.lidarDot.rotation.y += dt * 1.2;

      const glowPulse = 0.12 + 0.06 * Math.sin(time * 2.4);
      this.glow.material.opacity = scanning ? 0.28 + 0.12 * Math.sin(time * 8) : glowPulse;
      this.glow.scale.setScalar(scanning ? 1.05 + 0.05 * Math.sin(time * 6) : 1);

      if (scanning) {
        this.scanPhase = (this.scanPhase + dt * 0.42) % 1;
        const p = this.scanPhase;
        this.scanRing.scale.setScalar(0.8 + p * 3.6);
        this.scanRing.material.opacity = (1 - p) * 0.6 * Math.min(1, p * 8);
        const p2 = (this.scanPhase + 0.5) % 1;
        this.scanRing2.scale.setScalar(0.8 + p2 * 2.7);
        this.scanRing2.material.opacity = (1 - p2) * 0.42 * Math.min(1, p2 * 8);
      } else {
        this.scanRing.material.opacity = 0;
        this.scanRing2.material.opacity = 0;
      }

      for (let i = 0; i < this.arms.length; i++) {
        const side = i === 0 ? -1 : 1;
        this.arms[i].rotation.z = side * 0.18 + Math.sin(time * 1.7 + i * 1.3) * 0.045;
        this.arms[i].rotation.x = this.speed * 0.12;
      }

      this.parts.mouth.scale.x = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(time * 2.2));
    }
  }

  class World {
    constructor(canvas) {
      this.canvas = canvas;
      this.scene = new T.Scene();
      this.scene.background = new T.Color(0x070b11);
      this.scene.fog = new T.FogExp2(0x071019, 0.0085);
      this.camera = new T.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 140);
      this.camera.position.set(0, 14, 21);
      this.camera.lookAt(0, 0.4, 0);

      this.renderer = new T.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.outputColorSpace = T.SRGBColorSpace;
      this.renderer.toneMapping = T.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.08;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = T.PCFSoftShadowMap;

      this.roomCenters = [
        { x: -5.8, z: 0.2, name: "客厅", scanX: -5.7, scanZ: 0.55 },
        { x: 0.8, z: 0.2, name: "卧室", scanX: 0.6, scanZ: 0.7 },
        { x: 7.0, z: 0.2, name: "书房", scanX: 7.0, scanZ: 0.7 },
      ];
      this.roomSplatsReady = false;
      this.objects = new Map();
      this.objectList = [];

      this.nav = new RF.NavGrid({ minX: -9.1, maxX: 10.1, minZ: -4.6, maxZ: 4.6, cell: 0.4 });
      this.nav.addObstacleBox({ minX: -9.2, maxX: -9.0, minZ: -4.6, maxZ: 4.6 }, 0);
      this.nav.addObstacleBox({ minX: 10.0, maxX: 10.2, minZ: -4.6, maxZ: 4.6 }, 0);
      this.nav.addObstacleBox({ minX: -9.2, maxX: 10.2, minZ: -4.7, maxZ: -4.5 }, 0);
      this.nav.addObstacleBox({ minX: -2.6, maxX: -2.4, minZ: -4.5, maxZ: 1.3 }, 0);
      this.nav.addObstacleBox({ minX: -2.6, maxX: -2.4, minZ: 3.1, maxZ: 4.5 }, 0);
      this.nav.addObstacleBox({ minX: 3.9, maxX: 4.1, minZ: -4.5, maxZ: 1.3 }, 0);
      this.nav.addObstacleBox({ minX: 3.9, maxX: 4.1, minZ: 3.1, maxZ: 4.5 }, 0);

      this.roomGroup = new T.Group();
      this.objectsGroup = new T.Group();
      this.fxGroup = new T.Group();
      this.scene.add(this.roomGroup, this.objectsGroup, this.fxGroup);

      this.buildMaterials();
      this.buildLighting();
      this.buildShell();
      this.buildLiving();
      this.buildBedroom();
      this.buildStudy();
      this.buildObjects();
      this.nav.bake();

      this.splatGroup = new T.Group();
      this.scene.add(this.splatGroup);
      this.buildRoomSplats();

      // 素材接入点：新机器人提供 group / setState / update / headYawTarget。
      this.robot = RF.createRobot ? RF.createRobot({ THREE: T, world: this }) : new Robot();
      this.robot.group.position.set(-4.6, 0, 3.95);
      this.robot.group.rotation.y = Math.PI * 0.15;
      this.scene.add(this.robot.group);

      this.labels = {};
      document.querySelectorAll(".room-label").forEach((el) => {
        this.labels[el.dataset.room] = el;
      });
      this.roomLabelPos = {
        客厅: new T.Vector3(-5.8, 3.15, 0.2),
        卧室: new T.Vector3(0.8, 3.15, 0.2),
        书房: new T.Vector3(7.0, 3.15, 0.2),
      };
    }

    buildMaterials() {
      const woodTex = makeWoodTexture();
      const wallTex = makeWallTexture();
      const fabricTex = makeFabricTexture();
      this.mats = {
        floor: new T.MeshStandardMaterial({ map: woodTex, color: 0xffffff, roughness: 0.72, metalness: 0.02 }),
        wall: new T.MeshStandardMaterial({ map: wallTex, color: 0xffffff, roughness: 0.96 }),
        wallWarm: std(PALETTE.wallWarm, 0.95),
        wood: std(PALETTE.wood, 0.62, 0.04),
        woodDark: std(PALETTE.woodDark, 0.7, 0.03),
        sofa: new T.MeshStandardMaterial({ map: fabricTex, color: new T.Color(PALETTE.sofa), roughness: 0.94 }),
        sofaLight: new T.MeshStandardMaterial({ map: fabricTex, color: new T.Color(PALETTE.sofaLight), roughness: 0.94 }),
        cream: new T.MeshStandardMaterial({ map: fabricTex, color: new T.Color(PALETTE.cream), roughness: 0.95 }),
        terracotta: new T.MeshStandardMaterial({ map: fabricTex, color: new T.Color(PALETTE.terracotta), roughness: 0.92 }),
        mustard: new T.MeshStandardMaterial({ map: fabricTex, color: new T.Color(PALETTE.mustard), roughness: 0.92 }),
        metal: std(PALETTE.metal, 0.3, 0.72),
        black: std(PALETTE.black, 0.44, 0.25),
        darkWood: std("#6a452d", 0.65, 0.03),
        green: std(PALETTE.green, 0.8, 0.02),
        greenLight: std("#7aa47f", 0.8, 0.02),
        pot: std("#a56449", 0.85),
        white: std("#d8d3c9", 0.7),
        paper: std("#e8e1d3", 0.9),
        glass: new T.MeshStandardMaterial({
          color: "#a9d8e2",
          roughness: 0.08,
          metalness: 0.15,
          transparent: true,
          opacity: 0.24,
        }),
        lamp: new T.MeshStandardMaterial({
          color: "#f6e3bf",
          emissive: "#f4c47c",
          emissiveIntensity: 1.5,
          roughness: 0.72,
        }),
      };
      this.artTextures = [makeArtTexture(3), makeArtTexture(8), makeArtTexture(14)];
      this.rugLiving = makeRugTexture(21, "#d9c8ae", "#a9604c", "#6b7e70");
      this.rugBedroom = makeRugTexture(22, "#cbbba6", "#7c8d7e", "#bd7a5c");
      this.rugStudy = makeRugTexture(23, "#d5c4ab", "#5c6b72", "#b58a58");
      this.skyTex = makeSkyTexture();
      this.screenTex = makeScreenTexture();
    }

    buildLighting() {
      const hemi = new T.HemisphereLight(0xcfe6ff, 0x5b4433, 0.62);
      this.scene.add(hemi);
      this.hemi = hemi;

      const sun = new T.DirectionalLight(0xffe1bb, 2.35);
      sun.position.set(9, 15, 12);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -17;
      sun.shadow.camera.right = 17;
      sun.shadow.camera.top = 13;
      sun.shadow.camera.bottom = -13;
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 46;
      sun.shadow.bias = -0.0005;
      sun.shadow.normalBias = 0.03;
      this.scene.add(sun);
      this.sun = sun;

      const fill = new T.DirectionalLight(0x9fc6ff, 0.78);
      fill.position.set(-12, 9, -8);
      this.scene.add(fill);

      const rim = new T.DirectionalLight(0xffd0a0, 0.42);
      rim.position.set(0, 8, -14);
      this.scene.add(rim);

      // warm practical lights
      this.pointLights = [];
      const addPoint = (x, y, z, color, intensity, distance) => {
        const p = new T.PointLight(color, intensity, distance, 2);
        p.position.set(x, y, z);
        this.scene.add(p);
        this.pointLights.push(p);
        return p;
      };
      addPoint(-6.6, 1.9, -2.2, 0xffc58e, 9, 7);
      addPoint(0.6, 2.0, -1.8, 0xffb877, 8, 7);
      addPoint(7.2, 2.0, -2.1, 0xffc78e, 8, 7);
    }

    box(parent, w, h, d, mat, x, y, z, opts) {
      opts = opts || {};
      const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = opts.cast !== false;
      mesh.receiveShadow = opts.receive !== false;
      if (opts.rotY) mesh.rotation.y = opts.rotY;
      if (opts.rotX) mesh.rotation.x = opts.rotX;
      if (opts.rotZ) mesh.rotation.z = opts.rotZ;
      if (opts.noSplat) mesh.userData.noSplat = true;
      parent.add(mesh);
      return mesh;
    }

    cyl(parent, rt, rb, h, seg, mat, x, y, z, opts) {
      opts = opts || {};
      const mesh = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = opts.cast !== false;
      mesh.receiveShadow = opts.receive !== false;
      if (opts.rotX) mesh.rotation.x = opts.rotX;
      if (opts.rotY) mesh.rotation.y = opts.rotY;
      if (opts.rotZ) mesh.rotation.z = opts.rotZ;
      if (opts.noSplat) mesh.userData.noSplat = true;
      parent.add(mesh);
      return mesh;
    }

    plane(parent, w, h, mat, x, y, z, opts) {
      opts = opts || {};
      const mesh = new T.Mesh(new T.PlaneGeometry(w, h), mat);
      mesh.position.set(x, y, z);
      if (opts.rotX !== undefined) mesh.rotation.x = opts.rotX;
      if (opts.rotY !== undefined) mesh.rotation.y = opts.rotY;
      mesh.receiveShadow = opts.receive !== false;
      mesh.castShadow = false;
      if (opts.noSplat) mesh.userData.noSplat = true;
      parent.add(mesh);
      return mesh;
    }

    obstacle(minX, maxX, minZ, maxZ) {
      this.nav.addObstacleBox({ minX, maxX, minZ, maxZ }, 0.26);
    }

    buildShell() {
      const g = this.roomGroup;
      // floor
      const floor = new T.Mesh(new T.PlaneGeometry(19, 9), this.mats.floor);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(0.5, 0, 0);
      floor.receiveShadow = true;
      floor.name = "floor";
      g.add(floor);

      // rugs
      const rugMat = (tex) => new T.MeshStandardMaterial({ map: tex, roughness: 0.98 });
      const rugL = new T.Mesh(new T.PlaneGeometry(4.3, 3.1), rugMat(this.rugLiving));
      rugL.rotation.x = -Math.PI / 2;
      rugL.position.set(-6.7, 0.012, -1.75);
      rugL.receiveShadow = true;
      g.add(rugL);
      const rugB = new T.Mesh(new T.PlaneGeometry(4.6, 3.2), rugMat(this.rugBedroom));
      rugB.rotation.x = -Math.PI / 2;
      rugB.position.set(0.35, 0.012, -2.2);
      rugB.receiveShadow = true;
      g.add(rugB);
      const rugS = new T.Mesh(new T.PlaneGeometry(3.6, 3.0), rugMat(this.rugStudy));
      rugS.rotation.x = -Math.PI / 2;
      rugS.position.set(7.0, 0.012, -0.9);
      rugS.receiveShadow = true;
      g.add(rugS);

      // outer walls (front is open for the dollhouse camera)
      this.box(g, 19.3, 3.0, 0.16, this.mats.wall, 0.5, 1.5, -4.58, { cast: false });
      this.box(g, 0.16, 3.0, 9.2, this.mats.wall, -9.08, 1.5, 0, { cast: false });
      this.box(g, 0.16, 3.0, 9.2, this.mats.wall, 10.08, 1.5, 0, { cast: false });

      // partitions with doorways
      for (const x of [-2.5, 4.0]) {
        this.box(g, 0.16, 2.75, 5.8, this.mats.wall, x, 1.375, -1.6, { cast: false });
        this.box(g, 0.16, 2.75, 1.4, this.mats.wall, x, 1.375, 3.8, { cast: false });
        // doorway trims
        for (const z of [1.3, 3.1]) {
          this.box(g, 0.22, 2.6, 0.12, this.mats.woodDark, x, 1.3, z, { cast: false, noSplat: true });
        }
        this.box(g, 0.22, 0.18, 1.92, this.mats.woodDark, x, 2.62, 2.2, { cast: false, noSplat: true });
      }

      // baseboards
      this.box(g, 19, 0.1, 0.05, this.mats.woodDark, 0.5, 0.05, -4.48, { cast: false, noSplat: true });
      this.box(g, 0.05, 0.1, 9, this.mats.woodDark, -8.98, 0.05, 0, { cast: false, noSplat: true });
      this.box(g, 0.05, 0.1, 9, this.mats.woodDark, 9.98, 0.05, 0, { cast: false, noSplat: true });

      // windows
      this.makeWindow(g, -6.7, 1.92, -4.47, 3.0, 1.55);
      this.makeWindow(g, 0.9, 1.95, -4.47, 2.1, 1.25);

      // wall art
      this.makeArt(g, -6.7, 2.02, -4.47, 1.35, 0.92, this.artTextures[0], 0);
      this.makeArt(g, -0.9, 1.95, -4.47, 1.05, 0.72, this.artTextures[1], 0);
      this.makeArt(g, 7.2, 1.98, -4.47, 1.2, 0.82, this.artTextures[2], 0);
      this.makeArt(g, 3.86, 1.65, -2.0, 0.9, 1.2, this.artTextures[1], -Math.PI / 2);
    }

    makeWindow(parent, x, y, z, w, h) {
      const frame = this.box(parent, w + 0.14, h + 0.14, 0.08, this.mats.woodDark, x, y, z, { cast: false });
      frame.userData.noSplat = true;
      const skyMat = new T.MeshBasicMaterial({ map: this.skyTex, toneMapped: false });
      const sky = this.plane(parent, w, h, skyMat, x, y, z + 0.045, { noSplat: true });
      sky.userData.noSplat = true;
      const mullionV = this.box(parent, 0.05, h, 0.03, this.mats.woodDark, x, y, z + 0.07, { cast: false, noSplat: true });
      mullionV.userData.noSplat = true;
      const mullionH = this.box(parent, w, 0.05, 0.03, this.mats.woodDark, x, y, z + 0.07, { cast: false, noSplat: true });
      mullionH.userData.noSplat = true;
      const glass = this.plane(parent, w, h, this.mats.glass, x, y, z + 0.055, { noSplat: true });
      glass.userData.noSplat = true;
      // sheer curtains
      const curtainMat = new T.MeshStandardMaterial({
        color: "#e8ddc9",
        roughness: 1,
        transparent: true,
        opacity: 0.62,
        side: T.DoubleSide,
      });
      this.plane(parent, 0.42, h + 0.5, curtainMat, x - w / 2 - 0.22, y - 0.02, z + 0.12, { noSplat: true });
      this.plane(parent, 0.42, h + 0.5, curtainMat, x + w / 2 + 0.22, y - 0.02, z + 0.12, { noSplat: true });
    }

    makeArt(parent, x, y, z, w, h, tex, rotY) {
      const artMat = new T.MeshStandardMaterial({ map: tex, roughness: 0.9 });
      const group = new T.Group();
      group.position.set(x, y, z);
      group.rotation.y = rotY || 0;
      this.box(group, w + 0.08, h + 0.08, 0.05, this.mats.woodDark, 0, 0, 0, { cast: false });
      const canvas = new T.Mesh(new T.PlaneGeometry(w, h), artMat);
      canvas.position.z = 0.032;
      group.add(canvas);
      parent.add(group);
      return group;
    }

    buildLiving() {
      const g = this.roomGroup;
      const x = -6.7;
      const z = -3.42;

      // sofa
      const sofa = new T.Group();
      sofa.position.set(x, 0, z);
      this.box(sofa, 2.95, 0.3, 0.96, this.mats.sofa, 0, 0.26, 0);
      this.box(sofa, 2.75, 0.18, 0.82, this.mats.sofaLight, 0, 0.47, 0.05);
      this.box(sofa, 2.95, 0.6, 0.22, this.mats.sofa, 0, 0.63, -0.38, { rotX: -0.06 });
      this.box(sofa, 0.22, 0.48, 0.9, this.mats.sofa, -1.38, 0.44, 0);
      this.box(sofa, 0.22, 0.48, 0.9, this.mats.sofa, 1.38, 0.44, 0);
      const cushionA = this.box(sofa, 1.25, 0.16, 0.75, this.mats.terracotta, -0.68, 0.59, 0.06, { rotX: -0.04 });
      const cushionB = this.box(sofa, 1.25, 0.16, 0.75, this.mats.mustard, 0.68, 0.59, 0.06, { rotX: -0.04 });
      cushionA.rotation.y = 0.02;
      cushionB.rotation.y = -0.03;
      this.box(sofa, 0.42, 0.42, 0.13, this.mats.cream, -1.18, 0.75, -0.17, { rotZ: 0.18, rotX: -0.12 });
      this.box(sofa, 0.38, 0.38, 0.13, this.mats.terracotta, 1.15, 0.73, -0.16, { rotZ: -0.14, rotX: -0.1 });
      this.box(sofa, 0.95, 0.045, 0.72, this.mats.cream, 0.85, 0.69, 0.18, { rotY: -0.08 });
      for (const sx of [-1.32, 1.32]) {
        for (const sz of [-0.34, 0.34]) {
          this.cyl(sofa, 0.035, 0.035, 0.2, 10, this.mats.woodDark, sx, 0.1, sz);
        }
      }
      g.add(sofa);
      this.obstacle(x - 1.5, x + 1.5, z - 0.55, z + 0.55);

      // coffee table
      const table = new T.Group();
      table.position.set(x, 0, -1.55);
      this.box(table, 2.05, 0.08, 1.02, this.mats.wood, 0, 0.42, 0);
      this.box(table, 1.85, 0.04, 0.86, this.mats.darkWood, 0, 0.18, 0);
      for (const tx of [-0.88, 0.88]) {
        for (const tz of [-0.4, 0.4]) {
          this.cyl(table, 0.035, 0.03, 0.42, 10, this.mats.woodDark, tx, 0.21, tz);
        }
      }
      // table decor
      this.cyl(table, 0.16, 0.12, 0.04, 24, this.mats.metal, -0.55, 0.48, -0.16);
      this.box(table, 0.34, 0.045, 0.25, this.mats.terracotta, -0.55, 0.5, -0.16, { rotY: 0.2 });
      this.box(table, 0.3, 0.035, 0.22, this.mats.cream, -0.55, 0.545, -0.15, { rotY: 0.35 });
      // vase + branches
      this.cyl(table, 0.07, 0.09, 0.26, 18, this.mats.cream, 0.62, 0.59, -0.15);
      this.cyl(table, 0.008, 0.01, 0.5, 6, this.mats.woodDark, 0.62, 0.94, -0.15, { rotZ: 0.16 });
      this.cyl(table, 0.008, 0.01, 0.4, 6, this.mats.woodDark, 0.7, 0.9, -0.1, { rotZ: -0.25, rotX: 0.12 });
      for (const [lx, ly, lz] of [[0.74, 1.12, -0.13], [0.56, 1.0, -0.17], [0.7, 0.87, -0.08], [0.6, 1.18, -0.1]]) {
        const leaf = new T.Mesh(new T.IcosahedronGeometry(0.065, 0), this.mats.green);
        leaf.position.set(lx, ly, lz);
        leaf.castShadow = true;
        table.add(leaf);
      }
      g.add(table);
      this.obstacle(x - 1.08, x + 1.08, -2.11, -0.99);

      // TV cabinet
      const tv = new T.Group();
      tv.position.set(-8.52, 0, 0.2);
      this.box(tv, 0.44, 0.5, 2.45, this.mats.darkWood, 0, 0.25, 0);
      this.box(tv, 0.02, 0.36, 1.05, this.mats.wood, 0.23, 0.26, -0.6, { cast: false });
      this.box(tv, 0.02, 0.36, 1.05, this.mats.wood, 0.23, 0.26, 0.6, { cast: false });
      this.cyl(tv, 0.012, 0.012, 0.12, 8, this.mats.metal, 0.25, 0.26, -0.1, { rotX: Math.PI / 2 });
      this.cyl(tv, 0.012, 0.012, 0.12, 8, this.mats.metal, 0.25, 0.26, 0.1, { rotX: Math.PI / 2 });
      // TV
      this.box(tv, 0.06, 0.98, 1.72, this.mats.black, 0.3, 1.22, 0, { cast: false });
      const screenMat = new T.MeshStandardMaterial({
        map: this.screenTex,
        emissive: 0xffffff,
        emissiveMap: this.screenTex,
        emissiveIntensity: 0.9,
        roughness: 0.3,
      });
      const screen = new T.Mesh(new T.PlaneGeometry(1.62, 0.9), screenMat);
      screen.rotation.y = Math.PI / 2;
      screen.position.set(0.335, 1.22, 0);
      tv.add(screen);
      this.box(tv, 0.1, 0.06, 1.2, this.mats.black, 0.28, 0.63, 0, { cast: false });
      // soundbar + decor
      this.box(tv, 0.1, 0.07, 0.9, this.mats.black, 0.27, 0.56, 1.0, { cast: false });
      this.cyl(tv, 0.07, 0.07, 0.22, 16, this.mats.cream, 0.14, 0.61, -0.95);
      g.add(tv);
      this.obstacle(-8.8, -8.24, -1.05, 1.45);

      // plant near sofa
      this.makePlant(g, -8.45, 0, -2.9, 1.15, 0.34);
      this.obstacle(-8.8, -8.1, -3.25, -2.55);

      // floor lamp
      this.makeFloorLamp(g, -8.4, 2.85, 0xffc78c);
      this.obstacle(-8.65, -8.15, 2.6, 3.1);
    }

    buildBedroom() {
      const g = this.roomGroup;
      const bx = -0.9;
      const bz = -3.0;

      // bed
      const bed = new T.Group();
      bed.position.set(bx, 0, bz);
      this.box(bed, 2.15, 0.3, 2.35, this.mats.woodDark, 0, 0.2, 0);
      this.box(bed, 2.08, 0.26, 2.28, this.mats.cream, 0, 0.47, 0.02);
      this.box(bed, 2.2, 0.9, 0.13, this.mats.darkWood, 0, 0.78, -1.2);
      this.box(bed, 1.55, 0.075, 1.25, this.mats.terracotta, 0.12, 0.635, 0.45, { rotY: -0.02 });
      this.box(bed, 1.0, 0.13, 0.42, this.mats.cream, -0.48, 0.68, -0.92, { rotX: -0.12 });
      this.box(bed, 0.95, 0.13, 0.42, this.mats.cream, 0.5, 0.68, -0.92, { rotX: -0.12 });
      this.box(bed, 0.62, 0.16, 0.4, this.mats.mustard, 0.62, 0.75, -0.5, { rotZ: -0.08 });
      for (const sx of [-1.0, 1.0]) {
        for (const sz of [-1.05, 1.05]) {
          this.cyl(bed, 0.04, 0.04, 0.2, 10, this.mats.woodDark, sx, 0.1, sz);
        }
      }
      g.add(bed);
      this.obstacle(bx - 1.12, bx + 1.12, bz - 1.25, bz + 1.25);

      // nightstand
      const ns = new T.Group();
      ns.position.set(1.12, 0, -3.78);
      this.box(ns, 0.66, 0.55, 0.58, this.mats.wood, 0, 0.275, 0);
      this.box(ns, 0.57, 0.2, 0.02, this.mats.darkWood, 0, 0.36, 0.3, { cast: false });
      this.cyl(ns, 0.022, 0.022, 0.03, 10, this.mats.metal, 0, 0.36, 0.315, { rotX: Math.PI / 2 });
      this.box(ns, 0.57, 0.2, 0.02, this.mats.darkWood, 0, 0.12, 0.3, { cast: false });
      this.cyl(ns, 0.022, 0.022, 0.03, 10, this.mats.metal, 0, 0.12, 0.315, { rotX: Math.PI / 2 });
      for (const lx of [-0.26, 0.26]) for (const lz of [-0.22, 0.22]) this.cyl(ns, 0.025, 0.02, 0.12, 8, this.mats.woodDark, lx, 0.06, lz);
      g.add(ns);
      this.obstacle(0.75, 1.49, -4.12, -3.44);

      // dresser near the door
      const dr = new T.Group();
      dr.position.set(-1.35, 0, 2.72);
      this.box(dr, 1.25, 0.72, 0.5, this.mats.wood, 0, 0.36, 0);
      this.box(dr, 1.14, 0.22, 0.02, this.mats.darkWood, 0, 0.5, 0.26, { cast: false });
      this.box(dr, 1.14, 0.22, 0.02, this.mats.darkWood, 0, 0.25, 0.26, { cast: false });
      for (const hx of [-0.28, 0.28]) {
        this.cyl(dr, 0.018, 0.018, 0.03, 8, this.mats.metal, hx, 0.5, 0.275, { rotX: Math.PI / 2 });
        this.cyl(dr, 0.018, 0.018, 0.03, 8, this.mats.metal, hx, 0.25, 0.275, { rotX: Math.PI / 2 });
      }
      for (const lx of [-0.5, 0.5]) for (const lz of [-0.18, 0.18]) this.cyl(dr, 0.03, 0.025, 0.14, 8, this.mats.woodDark, lx, 0.07, lz);
      // dresser lamp
      this.cyl(dr, 0.07, 0.1, 0.03, 20, this.mats.metal, -0.35, 0.755, 0);
      this.cyl(dr, 0.012, 0.012, 0.3, 8, this.mats.metal, -0.35, 0.9, 0);
      const shade = new T.Mesh(new T.CylinderGeometry(0.11, 0.16, 0.2, 20, 1, true), this.mats.lamp);
      shade.position.set(-0.35, 1.06, 0);
      dr.add(shade);
      g.add(dr);
      this.obstacle(-2.0, -0.7, 2.44, 3.0);
      const dresserLight = new T.PointLight(0xffbd7a, 3.4, 3.2, 2);
      dresserLight.position.set(-1.7, 1.15, 2.72);
      this.scene.add(dresserLight);

      // wardrobe
      const wd = new T.Group();
      wd.position.set(2.85, 0, -4.02);
      this.box(wd, 1.55, 2.2, 0.66, this.mats.wood, 0, 1.1, 0);
      this.box(wd, 0.72, 1.98, 0.03, this.mats.woodDark, -0.38, 1.1, 0.345, { cast: false });
      this.box(wd, 0.72, 1.98, 0.03, this.mats.woodDark, 0.38, 1.1, 0.345, { cast: false });
      this.cyl(wd, 0.014, 0.014, 0.18, 8, this.mats.metal, -0.05, 1.05, 0.37);
      this.cyl(wd, 0.014, 0.014, 0.18, 8, this.mats.metal, 0.05, 1.05, 0.37);
      g.add(wd);
      this.obstacle(2.05, 3.65, -4.36, -3.66);

      // bedroom plant
      this.makePlant(g, 3.55, 0, 2.9, 1.0, 0.27);
      this.obstacle(3.25, 3.85, 2.6, 3.2);
    }

    buildStudy() {
      const g = this.roomGroup;
      const dx = 7.2;
      const dz = -3.92;

      // desk
      const desk = new T.Group();
      desk.position.set(dx, 0, dz);
      this.box(desk, 2.65, 0.075, 0.82, this.mats.wood, 0, 0.76, 0);
      for (const lx of [-1.2, 1.2]) {
        for (const lz of [-0.32, 0.32]) {
          this.cyl(desk, 0.03, 0.025, 0.74, 8, this.mats.woodDark, lx, 0.37, lz);
        }
      }
      this.box(desk, 2.4, 0.04, 0.6, this.mats.darkWood, 0, 0.22, 0);
      // monitor
      this.box(desk, 0.16, 0.03, 0.2, this.mats.black, 0, 0.82, -0.22);
      this.cyl(desk, 0.025, 0.025, 0.28, 8, this.mats.black, 0, 0.96, -0.22);
      this.box(desk, 1.0, 0.58, 0.05, this.mats.black, 0, 1.3, -0.22, { cast: false });
      const monMat = new T.MeshStandardMaterial({
        map: this.screenTex,
        emissive: 0xffffff,
        emissiveMap: this.screenTex,
        emissiveIntensity: 0.75,
        roughness: 0.3,
      });
      const mon = new T.Mesh(new T.PlaneGeometry(0.92, 0.5), monMat);
      mon.position.set(0, 1.3, -0.19);
      desk.add(mon);
      // keyboard + mouse
      this.box(desk, 0.62, 0.025, 0.18, this.mats.black, 0, 0.81, 0.1);
      this.box(desk, 0.08, 0.025, 0.12, this.mats.black, 0.44, 0.81, 0.12);
      // desk lamp
      this.cyl(desk, 0.08, 0.1, 0.025, 20, this.mats.metal, -0.98, 0.805, -0.1);
      this.cyl(desk, 0.012, 0.012, 0.38, 8, this.mats.metal, -0.98, 1.0, -0.1, { rotZ: -0.22 });
      const shade = new T.Mesh(new T.ConeGeometry(0.13, 0.16, 18, 1, true), this.mats.lamp);
      shade.position.set(-1.04, 1.22, -0.1);
      shade.rotation.z = -0.2;
      desk.add(shade);
      g.add(desk);
      this.obstacle(dx - 1.36, dx + 1.36, dz - 0.45, dz + 0.45);

      // desk plant
      this.makePlant(g, 8.18, 0.78, -4.0, 0.42, 0.11, true);

      // chair
      const chair = new T.Group();
      chair.position.set(6.0, 0, -2.95);
      chair.rotation.y = -0.35;
      this.box(chair, 0.52, 0.08, 0.52, this.mats.terracotta, 0, 0.48, 0);
      this.box(chair, 0.5, 0.52, 0.07, this.mats.terracotta, 0, 0.76, -0.24);
      this.cyl(chair, 0.04, 0.04, 0.45, 8, this.mats.metal, 0, 0.24, 0);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        this.box(chair, 0.035, 0.035, 0.34, this.mats.metal, Math.sin(a) * 0.17, 0.04, Math.cos(a) * 0.17, { rotY: a });
      }
      g.add(chair);
      this.obstacle(5.55, 6.45, -3.4, -2.5);

      // bookshelf
      const shelf = new T.Group();
      shelf.position.set(9.55, 0, -0.9);
      this.box(shelf, 0.46, 2.3, 2.65, this.mats.wood, 0, 1.15, 0);
      this.box(shelf, 0.4, 2.18, 2.5, this.mats.darkWood, -0.02, 1.15, 0, { cast: false });
      for (let i = 0; i < 4; i++) {
        this.box(shelf, 0.38, 0.035, 2.45, this.mats.wood, -0.04, 0.36 + i * 0.52, 0, { cast: false });
        const colors = [this.mats.terracotta, this.mats.mustard, this.mats.green, this.mats.cream, this.mats.sofa];
        let zz = -1.1;
        for (let b = 0; b < 7; b++) {
          const bw = 0.1 + Math.random() * 0.08;
          const bh = 0.24 + Math.random() * 0.12;
          const book = this.box(shelf, 0.24, bh, bw, colors[(i + b) % colors.length], -0.16, 0.38 + i * 0.52 + bh / 2, zz + bw / 2, { cast: false });
          book.rotation.y = 0.02;
          zz += bw + 0.02;
        }
      }
      g.add(shelf);
      this.obstacle(9.3, 9.8, -2.25, 0.45);

      // side plant + lamp
      this.makePlant(g, 9.15, 0, 3.45, 1.2, 0.3);
      this.obstacle(8.8, 9.5, 3.1, 3.8);
      this.makeFloorLamp(g, 9.15, 1.85, 0xffc78c);
      this.obstacle(8.9, 9.4, 1.6, 2.1);

      // small side table with decor
      const st = new T.Group();
      st.position.set(5.1, 0, 2.35);
      this.cyl(st, 0.36, 0.4, 0.05, 24, this.mats.wood, 0, 0.5, 0);
      this.cyl(st, 0.035, 0.045, 0.5, 10, this.mats.woodDark, 0, 0.25, 0);
      this.cyl(st, 0.11, 0.08, 0.02, 20, this.mats.cream, 0.1, 0.535, 0.05);
      g.add(st);
      this.obstacle(4.7, 5.5, 1.95, 2.75);
    }

    makePlant(parent, x, y, z, scale, potRadius, elevated) {
      const g = new T.Group();
      g.position.set(x, y, z);
      g.scale.setScalar(scale || 1);
      const pot = new T.Mesh(new T.CylinderGeometry(potRadius * 0.92, potRadius * 0.7, potRadius * 1.25, 20), this.mats.pot);
      pot.position.y = potRadius * 0.62;
      pot.castShadow = true;
      pot.receiveShadow = true;
      g.add(pot);
      const soil = new T.Mesh(new T.CylinderGeometry(potRadius * 0.88, potRadius * 0.88, 0.03, 20), this.mats.woodDark);
      soil.position.y = pot.position.y + potRadius * 0.6;
      g.add(soil);
      const baseY = soil.position.y;
      const stemMat = this.mats.green;
      const stems = 5;
      for (let i = 0; i < stems; i++) {
        const a = (i / stems) * Math.PI * 2;
        const h = 0.5 + (i % 3) * 0.16;
        const stem = new T.Mesh(new T.CylinderGeometry(0.012, 0.018, h, 6), stemMat);
        stem.position.set(Math.sin(a) * 0.08, baseY + h / 2, Math.cos(a) * 0.08);
        stem.rotation.z = Math.sin(a) * 0.25;
        stem.rotation.x = Math.cos(a) * 0.25;
        stem.castShadow = true;
        g.add(stem);
        for (let l = 0; l < 3; l++) {
          const leaf = new T.Mesh(new T.IcosahedronGeometry(0.09 + Math.random() * 0.04, 0), l === 1 ? this.mats.greenLight : this.mats.green);
          leaf.position.set(
            Math.sin(a) * (0.12 + l * 0.07),
            baseY + h * (0.55 + l * 0.18),
            Math.cos(a) * (0.12 + l * 0.07)
          );
          leaf.scale.set(1, 0.55, 0.8);
          leaf.castShadow = true;
          g.add(leaf);
        }
      }
      parent.add(g);
      return g;
    }

    makeFloorLamp(parent, x, z, color) {
      const g = new T.Group();
      g.position.set(x, 0, z);
      this.cyl(g, 0.17, 0.2, 0.04, 24, this.mats.black, 0, 0.02, 0);
      this.cyl(g, 0.018, 0.018, 1.62, 8, this.mats.metal, 0, 0.83, 0);
      const shade = new T.Mesh(new T.CylinderGeometry(0.16, 0.24, 0.3, 24, 1, true), this.mats.lamp);
      shade.position.y = 1.68;
      shade.castShadow = true;
      g.add(shade);
      const bulb = new T.Mesh(new T.SphereGeometry(0.055, 12, 10), new T.MeshBasicMaterial({ color }));
      bulb.position.y = 1.64;
      g.add(bulb);
      parent.add(g);
      return g;
    }

    buildObjects() {
      const defs = [
        {
          id: "cup_red",
          name: "红色马克杯",
          category: "杯具",
          aliases: ["红色马克杯", "红色水杯", "马克杯", "水杯", "杯子", "红杯子"],
          colorName: "红",
          color: "#d9534a",
          shape: "圆柱",
          size: "小",
          room: "客厅",
          roomIndex: 0,
          furniture: "茶几",
          altFurniture: "梳妆台",
          pos: [-6.38, 0.555, -1.5],
          approach: [-6.3, -0.35],
          alt: [-1.55, 0.82, 2.72],
          splatCount: 560,
          build: (root) => this.buildCup(root),
        },
        {
          id: "remote_black",
          name: "黑色遥控器",
          category: "遥控器",
          aliases: ["黑色遥控器", "遥控器", "电视遥控器", "黑遥控", "遥控"],
          colorName: "黑",
          color: "#2c3238",
          shape: "长方体",
          size: "小",
          room: "客厅",
          roomIndex: 0,
          furniture: "沙发",
          altFurniture: "书桌",
          pos: [-7.35, 0.684, -3.45],
          approach: [-4.55, -3.35],
          alt: [7.55, 0.775, -3.75],
          splatCount: 430,
          build: (root) => this.buildRemote(root),
        },
        {
          id: "key_yellow",
          name: "黄色钥匙",
          category: "钥匙",
          aliases: ["黄色钥匙", "黄钥匙", "钥匙"],
          colorName: "黄",
          color: "#e3b23c",
          shape: "长条",
          size: "小",
          room: "客厅",
          roomIndex: 0,
          furniture: "电视柜",
          altFurniture: "梳妆台",
          pos: [-8.2, 0.52, -0.35],
          approach: [-7.45, 0.1],
          alt: [-1.05, 0.735, 2.55],
          splatCount: 360,
          build: (root) => this.buildKey(root),
        },
        {
          id: "book_blue",
          name: "蓝色书本",
          category: "书本",
          aliases: ["蓝色书本", "蓝色的书", "蓝书", "书本", "书"],
          colorName: "蓝",
          color: "#3f6fc4",
          shape: "长方体",
          size: "中",
          room: "卧室",
          roomIndex: 1,
          furniture: "床头柜",
          altFurniture: "茶几",
          pos: [1.12, 0.578, -3.73],
          approach: [1.05, -2.55],
          alt: [-7.05, 0.49, -1.62],
          splatCount: 520,
          build: (root) => this.buildBook(root, 0.28, 0.055, 0.21, "#3f6fc4"),
        },
        {
          id: "bottle_white",
          name: "白色药瓶",
          category: "药瓶",
          aliases: ["白色药瓶", "白药瓶", "药瓶", "瓶子", "白瓶", "药"],
          colorName: "白",
          color: "#e8e4da",
          shape: "圆柱",
          size: "小",
          room: "卧室",
          roomIndex: 1,
          furniture: "床头柜",
          altFurniture: "书桌",
          pos: [1.35, 0.625, -3.92],
          approach: [1.75, -2.7],
          alt: [8.05, 0.84, -3.72],
          splatCount: 430,
          build: (root) => this.buildBottle(root),
        },
        {
          id: "headphones_orange",
          name: "橙色耳机",
          category: "耳机",
          aliases: ["橙色耳机", "橙耳机", "耳机", "头戴耳机"],
          colorName: "橙",
          color: "#e68036",
          shape: "环形",
          size: "中",
          room: "卧室",
          roomIndex: 1,
          furniture: "床",
          altFurniture: "沙发",
          pos: [-1.25, 0.73, -2.75],
          approach: [-1.0, -1.0],
          alt: [-5.75, 0.72, -3.42],
          splatCount: 620,
          build: (root) => this.buildHeadphones(root),
        },
        {
          id: "umbrella_purple",
          name: "紫色雨伞",
          category: "雨伞",
          aliases: ["紫色雨伞", "紫雨伞", "雨伞", "伞"],
          colorName: "紫",
          color: "#8b67c9",
          shape: "长条",
          size: "大",
          room: "书房",
          roomIndex: 2,
          furniture: "门边",
          altFurniture: "墙角",
          pos: [4.48, 0.55, 2.3],
          approach: [4.9, 1.55],
          alt: [-2.25, 0.55, 3.9],
          splatCount: 760,
          build: (root) => this.buildUmbrella(root),
        },
        {
          id: "notebook_green",
          name: "绿色笔记本",
          category: "笔记本",
          aliases: ["绿色笔记本", "绿笔记本", "笔记本", "本子", "绿本子"],
          colorName: "绿",
          color: "#3f9b6b",
          shape: "长方体",
          size: "中",
          room: "书房",
          roomIndex: 2,
          furniture: "书桌",
          altFurniture: "电视柜",
          pos: [6.62, 0.8, -3.57],
          approach: [8.0, -2.6],
          alt: [-8.18, 0.515, 0.9],
          splatCount: 540,
          build: (root) => this.buildNotebook(root),
        },
      ];

      for (const def of defs) {
        const group = new T.Group();
        group.name = "object-" + def.id;
        group.userData.objectId = def.id;
        const meshRoot = new T.Group();
        group.add(meshRoot);
        def.build(meshRoot);

        meshRoot.updateMatrixWorld(true);
        const sampler = new RF.SurfaceSampler();
        meshRoot.traverse((o) => {
          if (o.isMesh) sampler.addMesh(o, { room: def.roomIndex, color: new T.Color(def.color) });
        });
        const data = sampler.build(def.splatCount, {
          seed: def.id.length * 777 + def.splatCount,
          size: def.shape === "长条" ? 0.05 : 0.036,
          sizeJitter: 0.6,
          opacity: 0.95,
          opacityJitter: 0.25,
        });
        const cloud = new RF.ObjectSplatCloud(data);
        const center = this.roomCenters[def.roomIndex];
        cloud.uniforms.uScanOrigin.value.set(center.scanX, 0, center.scanZ);
        group.add(cloud.points);

        group.position.set(def.pos[0], def.pos[1], def.pos[2]);
        group.rotation.y = def.rotation || 0;
        this.objectsGroup.add(group);

        const obj = {
          id: def.id,
          name: def.name,
          category: def.category,
          aliases: def.aliases,
          colorName: def.colorName,
          color: def.color,
          shape: def.shape,
          size: def.size,
          room: def.room,
          roomIndex: def.roomIndex,
          furniture: def.furniture,
          altFurniture: def.altFurniture || "房间角落",
          currentFurniture: def.furniture,
          homePos: def.pos.slice(),
          homeRoom: def.room,
          homeRoomIndex: def.roomIndex,
          currentPos: def.pos.slice(),
          currentRoom: def.room,
          currentRoomIndex: def.roomIndex,
          alt: def.alt.slice(),
          approach: def.approach,
          group,
          meshRoot,
          splats: cloud,
          splatCount: data.count,
          baseY: def.pos[1],
        };
        this.objects.set(def.id, obj);
        this.objectList.push(obj);
      }
    }

    buildCup(root) {
      const mat = std("#d9534a", 0.42, 0.08);
      const inner = std("#7d2a25", 0.6);
      const cream = std("#f0e8d8", 0.7);
      const body = new T.Mesh(new T.CylinderGeometry(0.086, 0.075, 0.19, 28), mat);
      body.castShadow = true;
      body.receiveShadow = true;
      root.add(body);
      const rim = new T.Mesh(new T.TorusGeometry(0.084, 0.008, 8, 28), cream);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.095;
      root.add(rim);
      const coffee = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.006, 24), inner);
      coffee.position.y = 0.086;
      root.add(coffee);
      const handle = new T.Mesh(new T.TorusGeometry(0.055, 0.013, 10, 22, Math.PI * 1.55), mat);
      handle.position.set(0.088, 0.015, 0);
      handle.rotation.y = Math.PI / 2;
      handle.rotation.z = -0.5;
      handle.castShadow = true;
      root.add(handle);
      const stripe = new T.Mesh(new T.CylinderGeometry(0.0855, 0.0855, 0.018, 28, 1, true), cream);
      stripe.position.y = -0.03;
      root.add(stripe);
    }

    buildRemote(root) {
      const mat = std("#2c3238", 0.45, 0.2);
      const rubber = std("#1a1e22", 0.9);
      const body = new T.Mesh(new T.BoxGeometry(0.075, 0.027, 0.215), mat);
      body.castShadow = true;
      root.add(body);
      const grip = new T.Mesh(new T.BoxGeometry(0.078, 0.018, 0.055), rubber);
      grip.position.set(0, 0.003, -0.075);
      root.add(grip);
      const buttonMat = std("#5a636b", 0.6, 0.1);
      const redMat = new T.MeshStandardMaterial({ color: "#c54b40", emissive: "#7a241d", emissiveIntensity: 0.5, roughness: 0.5 });
      for (let i = 0; i < 4; i++) {
        const b = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.006, 12), i === 0 ? redMat : buttonMat);
        b.position.set(0, 0.017, 0.055 - i * 0.03);
        root.add(b);
      }
      for (const x of [-0.017, 0.017]) {
        const b = new T.Mesh(new T.BoxGeometry(0.012, 0.006, 0.02), buttonMat);
        b.position.set(x, 0.017, -0.02);
        root.add(b);
      }
      const ir = new T.Mesh(new T.SphereGeometry(0.006, 8, 8), redMat);
      ir.position.set(0, 0.017, 0.095);
      root.add(ir);
    }

    buildKey(root) {
      const mat = std("#e3b23c", 0.28, 0.85);
      const ring = new T.Mesh(new T.TorusGeometry(0.032, 0.008, 10, 22), mat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(-0.06, 0, 0);
      ring.castShadow = true;
      root.add(ring);
      const shaft = new T.Mesh(new T.BoxGeometry(0.11, 0.009, 0.014), mat);
      shaft.position.set(0.012, 0, 0);
      shaft.castShadow = true;
      root.add(shaft);
      const t1 = new T.Mesh(new T.BoxGeometry(0.012, 0.009, 0.035), mat);
      t1.position.set(0.06, 0, 0.017);
      root.add(t1);
      const t2 = new T.Mesh(new T.BoxGeometry(0.012, 0.009, 0.026), mat);
      t2.position.set(0.035, 0, 0.013);
      root.add(t2);
      root.rotation.y = 0.4;
    }

    buildBook(root, w, h, d, color) {
      const cover = std(color, 0.75, 0.02);
      const pages = std("#eee7d8", 0.9);
      const gold = std("#d6b26a", 0.4, 0.5);
      const c = new T.Mesh(new T.BoxGeometry(w, h, d), cover);
      c.castShadow = true;
      c.receiveShadow = true;
      root.add(c);
      const p = new T.Mesh(new T.BoxGeometry(w * 0.94, h * 0.72, d * 0.93), pages);
      p.position.x = 0.004;
      root.add(p);
      const spine = new T.Mesh(new T.BoxGeometry(0.012, h, d), std("#28518f", 0.8));
      spine.position.x = -w / 2 + 0.006;
      root.add(spine);
      const title = new T.Mesh(new T.BoxGeometry(w * 0.55, 0.001, d * 0.16), gold);
      title.position.set(0.02, h / 2 + 0.001, d * 0.16);
      root.add(title);
      root.rotation.y = -0.18;
    }

    buildBottle(root) {
      const white = std("#e8e4da", 0.42, 0.02);
      const cap = std("#c98a4b", 0.55, 0.05);
      const label = std("#9fc4c9", 0.8);
      const body = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.15, 24), white);
      body.castShadow = true;
      root.add(body);
      const neck = new T.Mesh(new T.CylinderGeometry(0.03, 0.04, 0.025, 20), white);
      neck.position.y = 0.088;
      root.add(neck);
      const c = new T.Mesh(new T.CylinderGeometry(0.032, 0.032, 0.035, 20), cap);
      c.position.y = 0.115;
      c.castShadow = true;
      root.add(c);
      const l = new T.Mesh(new T.CylinderGeometry(0.0465, 0.0465, 0.06, 24, 1, true), label);
      l.position.y = -0.01;
      root.add(l);
      const crossMat = std("#5b8e98", 0.8);
      const cv = new T.Mesh(new T.BoxGeometry(0.004, 0.028, 0.001), crossMat);
      cv.position.set(0, -0.01, 0.047);
      root.add(cv);
      const ch = new T.Mesh(new T.BoxGeometry(0.018, 0.006, 0.001), crossMat);
      ch.position.set(0, -0.01, 0.047);
      root.add(ch);
    }

    buildHeadphones(root) {
      const orange = std("#e68036", 0.55, 0.05);
      const dark = std("#2b2b2b", 0.8);
      const band = new T.Mesh(new T.TorusGeometry(0.135, 0.022, 10, 40, Math.PI), orange);
      band.rotation.x = Math.PI / 2;
      band.rotation.z = 0;
      band.castShadow = true;
      root.add(band);
      const cushion = new T.Mesh(new T.TorusGeometry(0.132, 0.012, 8, 40, Math.PI), dark);
      cushion.rotation.x = Math.PI / 2;
      cushion.position.y = 0.02;
      root.add(cushion);
      for (const side of [-1, 1]) {
        const cup = new T.Mesh(new T.CylinderGeometry(0.052, 0.052, 0.035, 24), orange);
        cup.rotation.z = Math.PI / 2;
        cup.position.set(side * 0.135, -0.005, 0);
        cup.castShadow = true;
        root.add(cup);
        const pad = new T.Mesh(new T.CylinderGeometry(0.043, 0.043, 0.012, 24), dark);
        pad.rotation.z = Math.PI / 2;
        pad.position.set(side * 0.152, -0.005, 0);
        root.add(pad);
      }
    }

    buildUmbrella(root) {
      const purple = std("#8b67c9", 0.58, 0.04);
      const dark = std("#3c2c56", 0.6);
      const metal = std("#b9b4ae", 0.3, 0.7);
      const shaft = new T.Mesh(new T.CylinderGeometry(0.011, 0.011, 1.0, 10), metal);
      shaft.castShadow = true;
      root.add(shaft);
      const canopy = new T.Mesh(new T.ConeGeometry(0.075, 0.56, 18, 1, true), purple);
      canopy.position.y = 0.24;
      canopy.castShadow = true;
      root.add(canopy);
      const tip = new T.Mesh(new T.CylinderGeometry(0.009, 0.009, 0.09, 8), metal);
      tip.position.y = 0.55;
      root.add(tip);
      const band = new T.Mesh(new T.TorusGeometry(0.072, 0.011, 8, 20), dark);
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.06;
      root.add(band);
      const handle = new T.Mesh(new T.TorusGeometry(0.045, 0.011, 10, 20, Math.PI * 1.25), dark);
      handle.position.set(0.045, -0.5, 0);
      handle.rotation.y = Math.PI / 2;
      handle.rotation.z = Math.PI * 0.5;
      root.add(handle);
      root.rotation.z = 0.16;
      root.rotation.y = 0.5;
    }

    buildNotebook(root) {
      const green = std("#3f9b6b", 0.7, 0.02);
      const pages = std("#efe8d8", 0.9);
      const band = std("#2f7050", 0.75);
      const c = new T.Mesh(new T.BoxGeometry(0.23, 0.03, 0.29), green);
      c.castShadow = true;
      root.add(c);
      const p = new T.Mesh(new T.BoxGeometry(0.22, 0.022, 0.28), pages);
      p.position.x = 0.004;
      root.add(p);
      const b = new T.Mesh(new T.BoxGeometry(0.025, 0.031, 0.29), band);
      b.position.x = -0.12;
      root.add(b);
      for (let i = 0; i < 8; i++) {
        const ring = new T.Mesh(new T.TorusGeometry(0.012, 0.003, 6, 12), std("#b9b4ae", 0.3, 0.7));
        ring.rotation.y = Math.PI / 2;
        ring.position.set(-0.128, 0.018, -0.11 + i * 0.031);
        root.add(ring);
      }
      const pen = new T.Mesh(new T.CylinderGeometry(0.006, 0.006, 0.16, 8), std("#d9b45f", 0.4, 0.4));
      pen.rotation.z = Math.PI / 2;
      pen.rotation.y = 0.15;
      pen.position.set(0.045, 0.026, 0.06);
      root.add(pen);
      root.rotation.y = 0.2;
    }

    buildRoomSplats() {
      this.roomGroup.updateMatrixWorld(true);
      const sampler = new RF.SurfaceSampler();
      this.roomGroup.traverse((o) => {
        if (o.isMesh) sampler.addMesh(o);
      });
      const data = sampler.build(46000, {
        seed: 20261030,
        size: 0.118,
        sizeJitter: 0.6,
        opacity: 0.58,
        opacityJitter: 0.42,
      });
      this.roomSplatData = data;
      this.roomSplats = new RF.RoomSplatCloud(data);
      this.splatGroup.add(this.roomSplats.points);
      this.splatCount = data.count;
      this.recomputeRoomSplatCounts();
      for (const obj of this.objectList) this.splatCount += obj.splatCount;
      this.roomSplatsReady = true;
      this.resize();
    }

    getObject(id) {
      return this.objects.get(id);
    }

    recomputeRoomSplatCounts() {
      const counts = [0, 0, 0];
      const rooms = this.roomSplatData && this.roomSplatData.rooms;
      if (rooms) {
        for (let i = 0; i < rooms.length; i++) {
          const idx = Math.round(rooms[i]);
          if (idx >= 0 && idx < 3) counts[idx]++;
        }
      }
      this.roomSplatCounts = counts;
      return counts;
    }

    moveObjectTo(id, pos, roomName, roomIndex, furniture) {
      const obj = this.objects.get(id);
      if (!obj) return null;
      obj.group.position.set(pos[0], pos[1], pos[2]);
      obj.currentPos = pos.slice();
      obj.currentRoom = roomName;
      obj.currentRoomIndex = roomIndex;
      obj.currentFurniture = furniture || (roomName === obj.homeRoom ? obj.furniture : obj.altFurniture);
      obj.group.rotation.y += roomName === "客厅" ? 0.2 : -0.15;
      return obj;
    }

    resetObject(id) {
      const obj = this.objects.get(id);
      if (!obj) return;
      obj.group.position.set(obj.homePos[0], obj.homePos[1], obj.homePos[2]);
      obj.currentPos = obj.homePos.slice();
      obj.currentRoom = obj.homeRoom;
      obj.currentRoomIndex = obj.homeRoomIndex;
      obj.currentFurniture = obj.furniture;
    }

    setViewMode(mode, opts) {
      opts = opts || {};
      const overlays = {
        real: { room: false, obj: false, meshes: true, opacity: 0 },
        overlay: { room: true, obj: true, meshes: true, opacity: 0.6 },
        splat: { room: true, obj: true, meshes: false, opacity: 1.0 },
      };
      const cfg = overlays[mode] || overlays.overlay;
      if (this.roomSplats) {
        this.roomSplats.points.visible = cfg.room;
        this.roomSplats.setOpacity(cfg.opacity);
      }
      for (const obj of this.objectList) {
        obj.splats.points.visible = cfg.obj;
        obj.splats.uniforms.uOpacity.value = cfg.opacity === 0 ? 1 : cfg.opacity;
        obj.meshRoot.visible = cfg.meshes;
      }
      this.roomGroup.visible = cfg.meshes;
      if (this.roomSplats) {
        // keep the room cloud visible even when the shell is hidden
        this.roomSplats.points.visible = cfg.room;
      }
      this.viewMode = mode;
    }

    setSplatPixelScale(scale, pixelRatio) {
      if (this.roomSplats) this.roomSplats.resize(scale, pixelRatio);
      for (const obj of this.objectList) obj.splats.resize(scale, pixelRatio);
    }

    update(dt, time, robotOpts) {
      this.robot.update(dt, time, robotOpts || {});
      if (this.roomSplats) this.roomSplats.update(dt, time);
      for (const obj of this.objectList) obj.splats.update(dt, time);
    }

    resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(w, h);
      const pr = this.renderer.getPixelRatio();
      const scale = (h * 0.5) / Math.tan((this.camera.fov * Math.PI) / 360);
      this.setSplatPixelScale(scale, pr);
    }

    render() {
      this.renderer.render(this.scene, this.camera);
    }
  }

  RF.World = World;
  RF.Robot = Robot;
})();



