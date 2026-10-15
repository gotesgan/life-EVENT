/**
 * PostCSS pipeline for the design system.
 *
 * `postcss-preset-mantine` supplies the CSS-Modules mixins (`light-dark()`,
 * `rem()`, `@mixin dark`, `@mixin smaller-than …`) used by every
 * `*.module.css` in `src/components/ui`, and `postcss-simple-vars` supplies the
 * Mantine breakpoint variables those mixins interpolate.
 *
 * The breakpoints must match `theme.breakpoints` in `src/theme/theme.ts` and
 * the `@media` queries written by hand in `src/app/globals.css`.
 */
module.exports = {
  plugins: {
    'postcss-preset-mantine': {},
    'postcss-simple-vars': {
      variables: {
        'mantine-breakpoint-xs': '36em',
        'mantine-breakpoint-sm': '48em',
        'mantine-breakpoint-md': '62em',
        'mantine-breakpoint-lg': '75em',
        'mantine-breakpoint-xl': '88em',
      },
    },
  },
};
