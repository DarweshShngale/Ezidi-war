import { Vector2, type WebGLRenderer, type Scene, type PerspectiveCamera } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function filmPass(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera,
  quality: number,
) {
  const composer = new EffectComposer(renderer);
  if (quality === 3) {
    const ao = new SSAOPass(scene, camera, innerWidth, innerHeight, 8);
    ao.kernelRadius = 3;
    ao.minDistance = 0.002;
    ao.maxDistance = 0.065;
    composer.addPass(ao);
  } else composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new Vector2(innerWidth, innerHeight), 0.17, 0.28, 1.08);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return {
    render: () => composer.render(),
    resize: () => {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(innerWidth, innerHeight);
    },
    dispose: () => {
      composer.passes.forEach((pass) => pass.dispose());
      composer.dispose();
    },
  };
}
