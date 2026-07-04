const imageCache = new Map();

export function getCachedImage(source, onReady) {
  let image = imageCache.get(source);

  if (!image) {
    image = new Image();
    image.decoding = "async";
    image.loading = "eager";
    image.src = source;
    image.decode?.().catch(() => {});
    imageCache.set(source, image);
  }

  if (typeof onReady === "function") {
    if (image.complete && image.naturalWidth > 0) {
      queueMicrotask(onReady);
    } else {
      image.addEventListener("load", onReady, { once: true });
    }
  }

  return image;
}

export function preloadImages(sources, concurrency = 6) {
  const queue = [...new Set(sources)].filter(Boolean);
  let active = 0;

  return new Promise((resolve) => {
    const next = () => {
      if (queue.length === 0 && active === 0) {
        resolve();
        return;
      }

      while (active < concurrency && queue.length > 0) {
        active += 1;
        const source = queue.shift();
        const image = getCachedImage(source);
        const done = () => {
          active -= 1;
          next();
        };

        if (image.complete) {
          done();
        } else {
          image.addEventListener("load", done, { once: true });
          image.addEventListener("error", done, { once: true });
        }
      }
    };

    next();
  });
}
