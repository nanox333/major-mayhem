/** While a full-page cinematic's lead-in plays, the scene is already mounted underneath (renderers made, shaders compiled, textures uploaded) but its
 *  clock is held at zero. Each highlight's frame loop re-anchors its start time while `on` is true, so when the lead-in lifts the animation begins
 *  from its first frame, already warm, with no stutter. */
export const legendHold = { on: false };
