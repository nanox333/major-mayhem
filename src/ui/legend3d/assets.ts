import * as T from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let source: Promise<T.Group> | undefined;
/** One CPU-side kit is cached. Each mounted renderer owns its GPU resources. */
export function preloadNoscope(): Promise<T.Group> {
  return source ??= (async () => {
    const url = `${import.meta.env.BASE_URL}assets/highlights/noscope/kit.glb`;
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error('Highlight kit unavailable');
    return (await new GLTFLoader().parseAsync(await response.arrayBuffer(), url)).scene;
  })().catch(error => { source = undefined; throw error; });
}
export async function instantiateNoscope(): Promise<T.Group> {
  const kit = clone(await preloadNoscope()) as T.Group;
  const geometries = new Map<T.BufferGeometry,T.BufferGeometry>();
  const materials = new Map<T.Material,T.Material>();
  const textures = new Map<T.Texture,T.Texture>();
  const material = (original: T.Material) => {
    if (!materials.has(original)) {
      const copy = original.clone();
      for (const [key, value] of Object.entries(copy)) if (value instanceof T.Texture) {
        if (!textures.has(value)) textures.set(value,value.clone());
        (copy as unknown as Record<string,unknown>)[key] = textures.get(value);
      }
      materials.set(original,copy);
    }
    return materials.get(original)!;
  };
  kit.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    if (!geometries.has(object.geometry)) geometries.set(object.geometry,object.geometry.clone());
    object.geometry = geometries.get(object.geometry)!;
    object.material = Array.isArray(object.material) ? object.material.map(material) : material(object.material);
  });
  return kit;
}
export function disposeKit(kit: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>();
  kit.traverse(object => {
    if (object instanceof T.Mesh || object instanceof T.Points || object instanceof T.LineSegments) {
      if (object instanceof T.SkinnedMesh) object.skeleton.dispose();
      geometries.add(object.geometry);
      (Array.isArray(object.material) ? object.material : [object.material]).forEach((m: T.Material) => materials.add(m));
    } else if (object instanceof T.Sprite) materials.add(object.material);
  });
  materials.forEach(m => { Object.values(m).forEach(value => {if (value instanceof T.Texture) textures.add(value);}); m.dispose(); });
  geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose());
}

/** One operator from the no-scope kit (the `Target` node: the textured, rigged soldier and nothing else, so no rifle or bullet comes with it),
 *  with its own geometry and materials, for the highlights that need more than one soldier (the 1v5 clutch shows six). The caller disposes it with `disposeKit`. */
export async function instantiateOperator(): Promise<T.Object3D> {
  const kit = await preloadNoscope();
  const node = kit.getObjectByName('Target');
  if (!node) throw new Error('No operator in the highlight kit');
  const copy = clone(node) as T.Object3D;
  const geometries = new Map<T.BufferGeometry, T.BufferGeometry>();
  copy.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    if (!geometries.has(object.geometry)) geometries.set(object.geometry, object.geometry.clone());
    object.geometry = geometries.get(object.geometry)!;
    object.material = Array.isArray(object.material) ? object.material.map(m => m.clone()) : object.material.clone();
  });
  return copy;
}
