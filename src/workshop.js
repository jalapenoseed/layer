import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
export class Workshop {
  constructor(canvas) {
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0x19241f, 1);
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(5, 3.4, 7);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 1.2, 0);
    this.controls.minDistance = 3;
    this.controls.maxDistance = 20;
    this.scene.add(new T.HemisphereLight(0xe5ffde, 0x49534a, 2.5));
    const light = new T.DirectionalLight(0xffdfae, 3);
    light.position.set(2, 5, 4);
    this.scene.add(light);
    const rim = new T.DirectionalLight(0xb3e7dd, 2);
    rim.position.set(-4, 2, -3);
    this.scene.add(rim);
    const grid = new T.GridHelper(30, 30, 0x4b6556, 0x2a3a30);
    this.scene.add(grid);
    this.group = new T.Group();
    this.group.position.y = 1.7;
    this.scene.add(this.group);
    this.active = false;
    this.animate = () => {
      requestAnimationFrame(this.animate);
      if (!this.active) return;
      const r = canvas.parentElement.getBoundingClientRect();
      if (this.w !== r.width || this.h !== r.height) {
        this.w = r.width;
        this.h = r.height;
        this.renderer.setSize(this.w, this.h, false);
        this.camera.aspect = this.w / this.h;
        this.camera.updateProjectionMatrix();
      }
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    this.animate();
  }
  build(source, type = "relief", depth = 1.2) {
    while (this.group.children.length) {
      const o = this.group.children[0];
      this.group.remove(o);
      o.geometry.dispose();
      o.material.map?.dispose();
      o.material.dispose();
    }
    const texture = new T.CanvasTexture(source);
    texture.colorSpace = T.SRGBColorSpace;
    texture.magFilter = T.NearestFilter;
    texture.minFilter = T.LinearFilter;
    const ratio = source.width / source.height;
    const material = new T.MeshStandardMaterial({
      map: texture,
      side: T.DoubleSide,
      alphaTest: 0.03,
      roughness: 0.75,
      metalness: 0.06,
    });
    let geometry;
    if (type === "box") geometry = new T.BoxGeometry(3, 3 / ratio, 3);
    else {
      const samples = 128;
      geometry = new T.PlaneGeometry(
        4,
        4 / ratio,
        type === "relief" ? samples : 1,
        type === "relief" ? samples : 1,
      );
      if (type === "relief") {
        const ctx = source.getContext("2d"),
          data = ctx.getImageData(0, 0, source.width, source.height).data,
          p = geometry.attributes.position,
          uv = geometry.attributes.uv;
        for (let i = 0; i < p.count; i++) {
          const x = Math.min(
              source.width - 1,
              Math.floor(uv.getX(i) * source.width),
            ),
            y = Math.min(
              source.height - 1,
              Math.floor((1 - uv.getY(i)) * source.height),
            ),
            j = (y * source.width + x) * 4;
          const luminance =
            (data[j] * 0.2126 + data[j + 1] * 0.7152 + data[j + 2] * 0.0722) /
            255;
          p.setZ(i, luminance * depth);
        }
        geometry.computeVertexNormals();
      }
    }
    const mesh = new T.Mesh(geometry, material);
    mesh.name = `LAYER_${type}`;
    this.group.add(mesh);
    this.group.rotation.y = -0.25;
  }
  updateTexture(source) {
    const map = this.group.children[0]?.material.map;
    if (map) {
      map.image = source;
      map.needsUpdate = true;
    }
  }
  async export() {
    const exporter = new GLTFExporter();
    return await exporter.parseAsync(this.group, { binary: true });
  }
}
