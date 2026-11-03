import {
  ACESFilmicToneMapping,
  PCFShadowMap,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';

import type { Camera, Scene } from 'three';

export class GameRenderer {
  readonly instance: WebGLRenderer;

  constructor(container: HTMLElement) {
    this.instance = new WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });

    this.instance.domElement.className = 'game-canvas';

    this.instance.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, 2),
    );

    this.instance.outputColorSpace = SRGBColorSpace;
    this.instance.toneMapping = ACESFilmicToneMapping;
    this.instance.toneMappingExposure = 1.1;

    this.instance.shadowMap.enabled = true;
    this.instance.shadowMap.type = PCFShadowMap;

    container.appendChild(this.instance.domElement);

    this.resize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight,
    );
  }

  resize(width: number, height: number): void {
    this.instance.setSize(width, height, false);
  }

  render(scene: Scene, camera: Camera): void {
    this.instance.render(scene, camera);
  }

  dispose(): void {
    this.instance.dispose();
    this.instance.domElement.remove();
  }
}
