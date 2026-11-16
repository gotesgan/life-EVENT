/**
 * Minimal ambient types for `jsdom`.
 *
 * `jsdom` ships no declarations, and `@types/jsdom` is not a dependency. The
 * scraper only constructs a document and reads it, so the surface it needs is
 * this small; adding a whole types package for one script would be a dependency
 * the project does not otherwise need.
 */
declare module 'jsdom' {
  export class JSDOM {
    constructor(html: string, options?: { url?: string; contentType?: string });
    readonly window: Window & typeof globalThis;
  }
}
