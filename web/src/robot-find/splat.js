/* global THREE, RF */
(function () {
  const RF = window.RF;
  const T = THREE;

  const _v0 = new T.Vector3();
  const _v1 = new T.Vector3();
  const _v2 = new T.Vector3();
  const _n = new T.Vector3();
  const _uv = [new T.Vector2(), new T.Vector2(), new T.Vector2()];

  /* ---------------- texture color sampling ---------------- */
  class TextureSamplerCache {
    constructor() {
      this.map = new Map();
    }
    get(texture) {
      if (!texture || !texture.image) return null;
      const key = texture.uuid;
      if (this.map.has(key)) return this.map.get(key);
      let sampler = null;
      try {
        const src = texture.image;
        const w = 64;
        const h = 64;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(src, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        sampler = {
          w,
          h,
          data,
          repeatX: texture.repeat ? texture.repeat.x : 1,
          repeatY: texture.repeat ? texture.repeat.y : 1,
          offsetX: texture.offset ? texture.offset.x : 0,
          offsetY: texture.offset ? texture.offset.y : 0,
        };
      } catch (e) {
        sampler = null;
      }
      this.map.set(key, sampler);
      return sampler;
    }
    sample(sampler, u, v, out) {
      if (!sampler) return false;
      u = u * sampler.repeatX + sampler.offsetX;
      v = v * sampler.repeatY + sampler.offsetY;
      let x = Math.floor(((u % 1) + 1) % 1 * sampler.w);
      let y = Math.floor(((v % 1) + 1) % 1 * sampler.h);
      if (x >= sampler.w) x = sampler.w - 1;
      if (y >= sampler.h) y = sampler.h - 1;
      const i = (y * sampler.w + x) * 4;
      const d = sampler.data;
      out[0] = srgbToLinear(d[i] / 255);
      out[1] = srgbToLinear(d[i + 1] / 255);
      out[2] = srgbToLinear(d[i + 2] / 255);
      return true;
    }
  }

  function srgbToLinear(c) {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  /* ---------------- surface sampler ---------------- */
  class SurfaceSampler {
    constructor() {
      this.tris = [];
      this.totalArea = 0;
      this.textureCache = new TextureSamplerCache();
    }

    addMesh(mesh, opts) {
      opts = opts || {};
      const geom = mesh.geometry;
      if (!geom || !geom.attributes || !geom.attributes.position) return 0;
      if (mesh.userData.noSplat) return 0;
      const pos = geom.attributes.position;
      const uvAttr = geom.attributes.uv;
      const index = geom.index;
      const matrix = opts.matrix || mesh.matrixWorld;
      const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      if (!mat) return 0;
      const color = opts.color || mat.color || new T.Color(0.6, 0.6, 0.6);
      const sampler = mat.map ? this.textureCache.get(mat.map) : null;
      const triCount = index ? index.count / 3 : pos.count / 3;
      const stride = Math.max(1, Math.floor(triCount / 900));
      const usesUv = !!sampler && !!uvAttr;
      const worldCenter = new T.Vector3().setFromMatrixPosition(matrix);
      let added = 0;

      for (let ti = 0; ti < triCount; ti += stride) {
        const i0 = index ? index.getX(ti * 3) : ti * 3;
        const i1 = index ? index.getX(ti * 3 + 1) : ti * 3 + 1;
        const i2 = index ? index.getX(ti * 3 + 2) : ti * 3 + 2;
        _v0.fromBufferAttribute(pos, i0).applyMatrix4(matrix);
        _v1.fromBufferAttribute(pos, i1).applyMatrix4(matrix);
        _v2.fromBufferAttribute(pos, i2).applyMatrix4(matrix);
        _n.subVectors(_v1, _v0);
        const cross = new T.Vector3().crossVectors(_n, _v2.clone().sub(_v0));
        const area = cross.length() * 0.5;
        if (!isFinite(area) || area <= 0.0000001) continue;
        const tri = {
          ax: _v0.x, ay: _v0.y, az: _v0.z,
          bx: _v1.x, by: _v1.y, bz: _v1.z,
          cx: _v2.x, cy: _v2.y, cz: _v2.z,
          area,
          color: [color.r, color.g, color.b],
          uv: null,
          sampler: usesUv ? sampler : null,
        };
        if (usesUv) {
          _uv[0].fromBufferAttribute(uvAttr, i0);
          _uv[1].fromBufferAttribute(uvAttr, i1);
          _uv[2].fromBufferAttribute(uvAttr, i2);
          tri.uv = [
            [_uv[0].x, _uv[0].y],
            [_uv[1].x, _uv[1].y],
            [_uv[2].x, _uv[2].y],
          ];
        }
        if (opts.room === undefined) {
          tri.room = worldCenter.x < -2.5 ? 0 : worldCenter.x < 4 ? 1 : 2;
        } else {
          tri.room = opts.room;
        }
        this.tris.push(tri);
        this.totalArea += area;
        added++;
      }
      return added;
    }

    addMeshes(meshes, opts) {
      let n = 0;
      for (const m of meshes) n += this.addMesh(m, opts);
      return n;
    }

    build(count, opts) {
      opts = opts || {};
      const rng = RF.mulberry32(opts.seed || 20261030);
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const sizes = new Float32Array(count);
      const opacities = new Float32Array(count);
      const rooms = new Float32Array(count);
      const seeds = new Float32Array(count);
      const nTris = this.tris.length;
      if (nTris === 0 || this.totalArea <= 0) {
        return { count: 0, positions, colors, sizes, opacities, rooms, seeds };
      }
      const cumulative = new Float32Array(nTris);
      let acc = 0;
      for (let i = 0; i < nTris; i++) {
        acc += this.tris[i].area;
        cumulative[i] = acc;
      }
      const total = acc;
      const tmpColor = [0, 0, 0];
      const baseSize = opts.size || 0.11;
      const sizeJitter = opts.sizeJitter === undefined ? 0.55 : opts.sizeJitter;
      const baseOpacity = opts.opacity || 0.62;
      const opacityJitter = opts.opacityJitter === undefined ? 0.35 : opts.opacityJitter;

      for (let i = 0; i < count; i++) {
        let lo = 0;
        let hi = nTris - 1;
        const target = rng() * total;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (cumulative[mid] < target) lo = mid + 1;
          else hi = mid;
        }
        const tri = this.tris[lo];
        let u = rng();
        let v = rng();
        if (u + v > 1) {
          u = 1 - u;
          v = 1 - v;
        }
        const w = 1 - u - v;
        const px = tri.ax * w + tri.bx * u + tri.cx * v;
        const py = tri.ay * w + tri.by * u + tri.cy * v;
        const pz = tri.az * w + tri.bz * u + tri.cz * v;
        positions[i * 3] = px + (rng() - 0.5) * 0.012;
        positions[i * 3 + 1] = py + (rng() - 0.5) * 0.012;
        positions[i * 3 + 2] = pz + (rng() - 0.5) * 0.012;

        let cr = tri.color[0];
        let cg = tri.color[1];
        let cb = tri.color[2];
        if (tri.sampler && tri.uv) {
          const uu = tri.uv[0][0] * w + tri.uv[1][0] * u + tri.uv[2][0] * v;
          const vv = tri.uv[0][1] * w + tri.uv[1][1] * u + tri.uv[2][1] * v;
          if (this.textureCache.sample(tri.sampler, uu, vv, tmpColor)) {
            cr = tmpColor[0];
            cg = tmpColor[1];
            cb = tmpColor[2];
          }
        }
        const tint = 0.9 + rng() * 0.2;
        colors[i * 3] = Math.min(1, cr * tint);
        colors[i * 3 + 1] = Math.min(1, cg * tint);
        colors[i * 3 + 2] = Math.min(1, cb * tint);
        sizes[i] = baseSize * (1 - sizeJitter * 0.5 + rng() * sizeJitter);
        opacities[i] = baseOpacity * (1 - opacityJitter * 0.5 + rng() * opacityJitter);
        rooms[i] = tri.room;
        seeds[i] = rng() * 10;
      }
      return { count, positions, colors, sizes, opacities, rooms, seeds };
    }
  }

  /* ---------------- materials ---------------- */
  const ROOM_VERT = `
    uniform float uTime;
    uniform float uScale;
    uniform float uPixelRatio;
    uniform float uOpacity;
    uniform vec3 uRoomProgress;
    uniform vec3 uOrigin0;
    uniform vec3 uOrigin1;
    uniform vec3 uOrigin2;
    attribute vec3 aColor;
    attribute float aSize;
    attribute float aOpacity;
    attribute float aRoom;
    attribute float aSeed;
    varying vec3 vColor;
    varying float vAlpha;
    varying float vGlow;

    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      float depth = max(-mv.z, 0.25);
      gl_PointSize = clamp(aSize * uScale / depth, 1.0, 96.0) * uPixelRatio;

      float p = aRoom < 0.5 ? uRoomProgress.x : (aRoom < 1.5 ? uRoomProgress.y : uRoomProgress.z);
      vec3 origin = aRoom < 0.5 ? uOrigin0 : (aRoom < 1.5 ? uOrigin1 : uOrigin2);
      float rn = clamp(distance(position.xz, origin.xz) / 4.8, 0.0, 1.0);
      float start = rn * 0.82;
      float reveal = smoothstep(start, start + 0.18, p);
      float wave = exp(-pow((p - rn - 0.04) * 7.0, 2.0)) * step(0.001, p) * (1.0 - p * 0.35) * (1.0 - smoothstep(0.88, 1.0, p));
      float twinkle = 0.9 + 0.1 * sin(uTime * 1.4 + aSeed * 6.283);

      vColor = aColor * (1.0 + wave * 1.5) * twinkle;
      vAlpha = aOpacity * uOpacity * reveal * (0.85 + wave * 0.9);
      vGlow = wave;
    }
  `;

  const ROOM_FRAG = `
    varying vec3 vColor;
    varying float vAlpha;
    varying float vGlow;
    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float r2 = dot(c, c) * 4.0;
      float g = exp(-r2 * 2.1);
      float a = g * vAlpha;
      if (a < 0.006) discard;
      gl_FragColor = vec4(vColor * (1.0 + vGlow * 0.35), a);
    }
  `;

  const OBJ_VERT = `
    uniform float uTime;
    uniform float uScale;
    uniform float uPixelRatio;
    uniform float uOpacity;
    uniform float uReveal;
    uniform float uHighlight;
    uniform vec3 uScanOrigin;
    attribute vec3 aColor;
    attribute float aSize;
    attribute float aOpacity;
    attribute float aSeed;
    varying vec3 vColor;
    varying float vAlpha;
    varying float vGlow;

    void main() {
      vec4 world = modelMatrix * vec4(position, 1.0);
      vec4 mv = viewMatrix * world;
      gl_Position = projectionMatrix * mv;
      float depth = max(-mv.z, 0.25);
      gl_PointSize = clamp(aSize * uScale / depth, 1.0, 84.0) * uPixelRatio;

      float rn = clamp(distance(world.xz, uScanOrigin.xz) / 4.8, 0.0, 1.0);
      float start = rn * 0.82;
      float reveal = smoothstep(start, start + 0.18, uReveal);
      float wave = exp(-pow((uReveal - rn - 0.05) * 7.0, 2.0)) * step(0.001, uReveal) * (1.0 - smoothstep(0.88, 1.0, uReveal));
      float pulse = 0.55 + 0.45 * sin(uTime * 5.0 + aSeed);
      float hl = uHighlight;

      vColor = aColor * (1.0 + wave * 1.8 + hl * (0.9 + pulse * 0.6));
      vAlpha = aOpacity * uOpacity * reveal * (0.95 + wave * 0.8 + hl * 0.7);
      vGlow = wave + hl * 0.4;
    }
  `;

  const OBJ_FRAG = `
    varying vec3 vColor;
    varying float vAlpha;
    varying float vGlow;
    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float r2 = dot(c, c) * 4.0;
      float g = exp(-r2 * 2.0);
      float a = g * vAlpha;
      if (a < 0.006) discard;
      gl_FragColor = vec4(vColor * (1.0 + vGlow * 0.3), a);
    }
  `;

  function makeSplatGeometry(data) {
    const geom = new T.BufferGeometry();
    geom.setAttribute("position", new T.BufferAttribute(data.positions, 3));
    geom.setAttribute("aColor", new T.BufferAttribute(data.colors, 3));
    geom.setAttribute("aSize", new T.BufferAttribute(data.sizes, 1));
    geom.setAttribute("aOpacity", new T.BufferAttribute(data.opacities, 1));
    geom.setAttribute("aSeed", new T.BufferAttribute(data.seeds, 1));
    if (data.rooms) geom.setAttribute("aRoom", new T.BufferAttribute(data.rooms, 1));
    geom.computeBoundingSphere();
    return geom;
  }

  class RoomSplatCloud {
    constructor(data) {
      this.data = data;
      this.uniforms = {
        uTime: { value: 0 },
        uScale: { value: 1000 },
        uPixelRatio: { value: 1 },
        uOpacity: { value: 1 },
        uRoomProgress: { value: new T.Vector3(0, 0, 0) },
        uOrigin0: { value: new T.Vector3(-5.8, 0, 0.3) },
        uOrigin1: { value: new T.Vector3(0.8, 0, 0.3) },
        uOrigin2: { value: new T.Vector3(7.0, 0, 0.3) },
      };
      this.material = new T.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: ROOM_VERT,
        fragmentShader: ROOM_FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: T.AdditiveBlending,
      });
      this.points = new T.Points(makeSplatGeometry(data), this.material);
      this.points.frustumCulled = false;
      this.points.renderOrder = 4;
      this.points.name = "room-splats";
      this.count = data.count;
    }
    setProgress(roomIndex, p) {
      const v = this.uniforms.uRoomProgress.value;
      if (roomIndex === 0) v.x = p;
      else if (roomIndex === 1) v.y = p;
      else v.z = p;
    }
    setAllProgress(p) {
      this.uniforms.uRoomProgress.value.set(p, p, p);
    }
    setOpacity(v) {
      this.uniforms.uOpacity.value = v;
    }
    update(dt, time) {
      this.uniforms.uTime.value = time;
    }
    resize(scale, pixelRatio) {
      this.uniforms.uScale.value = scale;
      this.uniforms.uPixelRatio.value = pixelRatio;
    }
  }

  class ObjectSplatCloud {
    constructor(data) {
      this.data = data;
      this.uniforms = {
        uTime: { value: 0 },
        uScale: { value: 1000 },
        uPixelRatio: { value: 1 },
        uOpacity: { value: 1 },
        uReveal: { value: 0 },
        uHighlight: { value: 0 },
        uScanOrigin: { value: new T.Vector3() },
      };
      this.material = new T.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: OBJ_VERT,
        fragmentShader: OBJ_FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: T.AdditiveBlending,
      });
      this.points = new T.Points(makeSplatGeometry(data), this.material);
      this.points.frustumCulled = false;
      this.points.renderOrder = 5;
      this.points.name = "object-splats";
      this.count = data.count;
    }
    setReveal(v) {
      this.uniforms.uReveal.value = v;
    }
    setHighlight(v) {
      this.uniforms.uHighlight.value = v;
    }
    update(dt, time) {
      this.uniforms.uTime.value = time;
    }
    resize(scale, pixelRatio) {
      this.uniforms.uScale.value = scale;
      this.uniforms.uPixelRatio.value = pixelRatio;
    }
  }

  /* ---------------- quantization / pack ---------------- */
  function quantizeSplatData(data) {
    const n = data.count;
    const pos = new Int16Array(n * 3);
    for (let i = 0; i < n * 3; i++) {
      pos[i] = Math.max(-32767, Math.min(32767, Math.round(data.positions[i] * 200)));
    }
    const col = new Uint8Array(n * 3);
    for (let i = 0; i < n * 3; i++) col[i] = Math.max(0, Math.min(255, Math.round(data.colors[i] * 255)));
    const size = new Uint8Array(n);
    for (let i = 0; i < n; i++) size[i] = Math.max(1, Math.min(255, Math.round(data.sizes[i] * 1000)));
    const op = new Uint8Array(n);
    for (let i = 0; i < n; i++) op[i] = Math.max(0, Math.min(255, Math.round(data.opacities[i] * 255)));
    const room = new Uint8Array(n);
    if (data.rooms) for (let i = 0; i < n; i++) room[i] = data.rooms[i] | 0;
    return {
      count: n,
      pos: RF.bytesToBase64(new Uint8Array(pos.buffer)),
      col: RF.bytesToBase64(col),
      size: RF.bytesToBase64(size),
      op: RF.bytesToBase64(op),
      room: RF.bytesToBase64(room),
      posScale: 200,
      sizeScale: 1000,
    };
  }

  function dequantizeSplatData(pack) {
    const n = pack.count;
    const posBytes = RF.base64ToBytes(pack.pos);
    const posI = new Int16Array(posBytes.buffer, posBytes.byteOffset, n * 3);
    const positions = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) positions[i] = posI[i] / (pack.posScale || 200);
    const colBytes = RF.base64ToBytes(pack.col);
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) colors[i] = colBytes[i] / 255;
    const sizeBytes = RF.base64ToBytes(pack.size);
    const sizes = new Float32Array(n);
    for (let i = 0; i < n; i++) sizes[i] = sizeBytes[i] / (pack.sizeScale || 1000);
    const opBytes = RF.base64ToBytes(pack.op);
    const opacities = new Float32Array(n);
    for (let i = 0; i < n; i++) opacities[i] = opBytes[i] / 255;
    const roomBytes = RF.base64ToBytes(pack.room);
    const rooms = new Float32Array(n);
    for (let i = 0; i < n; i++) rooms[i] = roomBytes[i];
    const seeds = new Float32Array(n);
    const rng = RF.mulberry32(7);
    for (let i = 0; i < n; i++) seeds[i] = rng() * 10;
    return { count: n, positions, colors, sizes, opacities, rooms, seeds };
  }

  function splatByteSize(data) {
    return data.count * (3 * 2 + 3 + 1 + 1 + 1);
  }

  RF.SurfaceSampler = SurfaceSampler;
  RF.RoomSplatCloud = RoomSplatCloud;
  RF.ObjectSplatCloud = ObjectSplatCloud;
  RF.quantizeSplatData = quantizeSplatData;
  RF.dequantizeSplatData = dequantizeSplatData;
  RF.splatByteSize = splatByteSize;
  RF.srgbToLinear = srgbToLinear;
})();

