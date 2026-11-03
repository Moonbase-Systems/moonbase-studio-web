import { type AnimationPlayer, type AnimationPlayerState, capabilitiesForMediaKind } from './animation-player';

export function createImageAnimationPlayer(url: string): AnimationPlayer {
  const image = document.createElement('img');
  image.alt = '';
  image.draggable = false;
  image.src = url;
  let state: AnimationPlayerState = 'idle';
  let generation = 0;

  function show(nextUrl: string) {
    generation += 1;
    const token = generation;
    image.src = '';
    queueMicrotask(() => {
      if (token !== generation) {
        return;
      }
      image.src = nextUrl;
    });
  }

  return {
    kind: 'image',
    capabilities: capabilitiesForMediaKind('gif'),
    element: image,
    play() {
      state = 'playing';
      if (!image.src) {
        show(url);
      }
    },
    pause() {},
    stop() {},
    restart() {
      state = 'playing';
      show(url);
    },
    setRate() {},
    setVolume() {},
    seek() {},
    onEnded() {
      return () => {};
    },
    dispose() {
      generation += 1;
      image.removeAttribute('src');
      image.remove();
    },
    getState: () => state,
    hasAudio: () => false,
  };
}
