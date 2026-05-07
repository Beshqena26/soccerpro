export class ImageCache {
  private cache = new Map<string, HTMLImageElement>();

  async preload(urls: string[]): Promise<void> {
    const unique = [...new Set(urls)].filter((u) => !this.cache.has(u));
    await Promise.all(
      unique.map(
        (url) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              this.cache.set(url, img);
              resolve();
            };
            img.onerror = () => {
              // Silently skip failed images; get() will return null
              resolve();
            };
            img.src = url;
          }),
      ),
    );
  }

  get(url: string): HTMLImageElement | null {
    return this.cache.get(url) ?? null;
  }

  has(url: string): boolean {
    return this.cache.has(url);
  }
}
