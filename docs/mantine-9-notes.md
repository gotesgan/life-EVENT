# Mantine 9.7.2 — verified API cheat-sheet

`[L]` = read from installed `node_modules` · `[D]` = mantine.dev (site reports v9.7.2) · `[U]` = unverified.
Stack: Next.js 16 App Router · React 19.3 · TS strict · Mantine only.

## 0. Inventory `[L]`

```
@mantine/core|hooks|form|dates|notifications|modals  9.7.2
  core peers: react ^19.2.0, react-dom ^19.2.0, @mantine/hooks 9.7.2
  dates peer: dayjs >=1.0.0        form dep: @standard-schema/spec ^1.1.0
postcss-preset-mantine 1.18.0 · postcss-simple-vars 7.0.1
@tabler/icons-react 3.49.0 · zod 4.6.7 · dayjs 1.11.23
```

Layout: `@mantine/core/{lib,esm,cjs,styles.css,styles.layer.css,styles/*}`. **No `dist/` in 9.7.2.**

**NOT installed — do not import** `[L]`: `@mantine/carousel` (**no Carousel anywhere**),
`@mantine/charts`, `@mantine/dropzone`, `@mantine/spotlight`, `@mantine/code-highlight`,
`@mantine/tiptap`, `@mantine/nprogress`, `@mantine/lightbox`.

**`DataTable` does not exist** `[L]` — not in core, no data-grid package installed. `Table` is a
styled HTML table (statics `Thead Tbody Tfoot Tr Th Td Caption ScrollContainer DataRenderer`, a
convenience `data` prop, `variant: 'default'|'vertical'`). No sorting/filtering state.

Extra v9 components present `[L]`: `DataList EmptyState Marquee Menubar Toggle Tree TreeSelect
Cascader Splitter Toolbar OverflowList MaskInput RollingNumber NumberFormatter AngleSlider
FloatingWindow Typography ComboboxPopover Scroller ActionBar ModalBase Pill PillsInput`,
`Modal.Stack`, `Drawer.Stack`. All requested components exist (`AppShell Combobox MultiSelect Select
RangeSlider NumberInput TextInput SegmentedControl Checkbox Radio Drawer Modal Menu Popover Table
Pagination Badge Card Tabs Accordion Timeline Skeleton Alert Tooltip Avatar AspectRatio Image
DatePickerInput TagsInput`).

## 1. Next.js App Router `[L]` `[D]`

`postcss.config.cjs` (project root — currently absent):

```js
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
```

`globals.css` — library CSS first, then yours:

```css
@import '@mantine/core/styles.css';
@import '@mantine/dates/styles.css';
@import '@mantine/notifications/styles.css';
@import './tokens.css'; /* semantic tokens + overrides */
@import './app.css';
```

`@mantine/form` and `@mantine/modals` ship **no CSS** `[L]`. `styles.layer.css` wraps everything in
`@layer mantine { … }` (verified first line) — only use it if you declare your own layers, and use it
for _all_ Mantine packages consistently.

```tsx
// src/app/layout.tsx
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import './globals.css';

import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { DatesProvider } from '@mantine/dates';
import { theme } from '@/theme/theme';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });
export const metadata: Metadata = { title: 'Live Envt' };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={manrope.variable} {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript defaultColorScheme="auto" />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="auto">
          <DatesProvider settings={{ locale: 'en', firstDayOfWeek: 1, consistentWeeks: true }}>
            <ModalsProvider>
              <Notifications position="bottom-right" limit={5} />
              {children}
            </ModalsProvider>
          </DatesProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
```

`[L]` `mantineHtmlProps === { suppressHydrationWarning: true, 'data-mantine-color-scheme': 'light' }`.
`ColorSchemeScript` props: `{ defaultColorScheme?, localStorageKey? = 'mantine-color-scheme-value',
forceColorScheme? }` + any `<script>` props (`nonce`). `DatesProvider` **requires** `settings`. All
`@mantine/*` entries begin with `"use client"` — don't add it to pages. **Compound components
(`Popover.Target`) cannot be used in Server Components** — use named exports (`PopoverTarget`,
`PopoverDropdown`, `ModalRoot`, `DrawerRoot`, …) or add `'use client'` `[D]`. Optional:
`experimental: { optimizePackageImports: ['@mantine/core', '@mantine/hooks'] }`.

## 2. Theme `[L]`

`createTheme(theme: MantineThemeOverride): MantineThemeOverride`, `MantineThemeOverride = PartialDeep<MantineTheme>`
— **all fields optional**. Full `MantineTheme`: `focusRing ('auto'|'always'|'never')`, `scale`,
`fontSmoothing`, `white`, `black`, `colors: Record<string, MantineColorsTuple>` (**tuple = 10+ strings**),
`primaryShade (0..9 | {light,dark})`, `primaryColor`, `variantColorResolver`, `autoContrast`,
`luminanceThreshold (0.3)`, `fontFamily`, `fontFamilyMonospace`,
`headings { fontFamily, fontWeight, textWrap, sizes: { h1..h6 } }`, `radius`,
`defaultRadius`, `spacing`, `fontSizes`, `lineHeights`, `fontWeights`, `breakpoints` (use **em**),
`shadows`, `respectReducedMotion` (**default `false`**), `cursorType`, `defaultGradient`,
`activeClassName`, `focusClassName`,
`components: Record<string, { classNames?, styles?, vars?, defaultProps? }>`, `other`.

```tsx
// src/theme/theme.ts
import { createTheme, DEFAULT_THEME, type MantineColorsTuple } from '@mantine/core';
import { cssVariablesResolver } from './css-variables-resolver';

const brand: MantineColorsTuple = [
  '#eef4ff',
  '#dbe6ff',
  '#b3c9ff',
  '#87a9ff',
  '#628eff',
  '#4a7cff',
  '#3b72ff',
  '#2a5fe4',
  '#1e4fc9',
  '#0f3dab',
];

export const theme = createTheme({
  fontFamily: `var(--font-manrope), ${DEFAULT_THEME.fontFamily}`,
  headings: {
    fontFamily: `var(--font-manrope), ${DEFAULT_THEME.fontFamily}`,
    fontWeight: '650',
    textWrap: 'balance',
    sizes: {
      h1: { fontSize: '2.5rem', lineHeight: '1.15' },
      h2: { fontSize: '2rem', lineHeight: '1.2' },
    },
  },
  colors: { brand },
  primaryColor: 'brand',
  primaryShade: { light: 6, dark: 5 },
  defaultRadius: 'md', // v9 default; was 'sm' in v8
  autoContrast: true,
  luminanceThreshold: 0.3,
  respectReducedMotion: true,
  cursorType: 'pointer',
  fontSizes: { xs: '0.75rem', sm: '0.8125rem', md: '0.9375rem', lg: '1.0625rem', xl: '1.25rem' },
  lineHeights: { xs: '1.4', sm: '1.45', md: '1.55', lg: '1.6', xl: '1.65' },
  spacing: { xs: '0.5rem', sm: '0.75rem', md: '1rem', lg: '1.5rem', xl: '2.25rem' },
  radius: { xs: '0.25rem', sm: '0.5rem', md: '0.75rem', lg: '1.125rem', xl: '1.75rem' },
  shadows: {
    sm: '0 2px 6px rgb(15 23 42 / 0.08)',
    md: '0 8px 20px rgb(15 23 42 / 0.10)',
    lg: '0 16px 36px rgb(15 23 42 / 0.12)',
    xl: '0 28px 60px rgb(15 23 42 / 0.16)',
  },
  breakpoints: { xs: '36em', sm: '48em', md: '62em', lg: '75em', xl: '88em' },
  other: {
    appMaxWidth: 1440,
    headerHeight: 60,
    navbarWidth: 280,
    surfaceLight: '#ffffff',
    surfaceDark: '#14161c',
    surfaceMutedLight: '#f4f5f8',
    surfaceMutedDark: '#1b1e26',
    textMutedLight: '#5b6273',
    textMutedDark: '#9aa3b5',
    borderLight: '#e3e5ec',
    borderDark: '#272b36',
  },
  components: {
    Button: { defaultProps: { radius: 'md' } },
    Card: { defaultProps: { withBorder: true, radius: 'lg' } },
  },
  cssVariablesResolver,
});
```

Type `theme.other` (otherwise `Record<string, any>`):

```ts
declare module '@mantine/core' {
  export interface MantineThemeOther {
    appMaxWidth: number;
    headerHeight: number;
    navbarWidth: number;
    surfaceLight: string;
    surfaceDark: string;
    surfaceMutedLight: string;
    surfaceMutedDark: string;
    textMutedLight: string;
    textMutedDark: string;
    borderLight: string;
    borderDark: string;
  }
}
```

`MantineColorScheme = 'light' | 'dark' | 'auto'` `[L]`.

## 3. `cssVariablesResolver` `[L]` `[D]`

```ts
type CSSVariablesResolver = (theme: MantineTheme) => ConvertCSSVariablesInput;
interface ConvertCSSVariablesInput {
  variables: CSSVariables;
  light: CSSVariables;
  dark: CSSVariables;
}
```

```tsx
// src/theme/css-variables-resolver.ts
import type { CSSVariablesResolver } from '@mantine/core';

export const cssVariablesResolver: CSSVariablesResolver = (theme) => ({
  variables: {
    '--app-max-width': `${theme.other.appMaxWidth}px`,
    '--app-header-height': `${theme.other.headerHeight}px`,
    '--app-navbar-width': `${theme.other.navbarWidth}px`,
    '--app-radius-card': theme.radius.lg,
  },
  light: {
    '--app-surface': theme.other.surfaceLight,
    '--app-surface-muted': theme.other.surfaceMutedLight,
    '--app-text': theme.colors.dark[8],
    '--app-text-muted': theme.other.textMutedLight,
    '--app-border': theme.other.borderLight,
  },
  dark: {
    '--app-surface': theme.other.surfaceDark,
    '--app-surface-muted': theme.other.surfaceMutedDark,
    '--app-text': theme.colors.dark[0],
    '--app-text-muted': theme.other.textMutedDark,
    '--app-border': theme.other.borderDark,
  },
});
```

Mantine emits `light`/`dark` entries inside `[data-mantine-color-scheme='…']` blocks, so
`background: var(--app-surface)` in plain CSS is scheme-aware with **no JS and no hydration risk**.
`v8CssVariablesResolver` is also exported `[L]` (migration escape hatch for Mantine 8 `light`-variant
transparency only).

## 4. Theme tokens in CSS Modules `[L postcss-preset-mantine@1.18.0 dist/preset.js]`

Mixins: `light dark light-root dark-root where-light where-dark where-light-root where-dark-root
hover where-hover rtl ltr not-rtl not-ltr where-rtl where-ltr where-not-rtl where-not-ltr
smaller-than larger-than`.
Functions: `rem() em() light-dark(a,b) alpha(color,amount) lighten() darken()`.
There is **no** `theme()` function.

```css
/* src/components/FilterPanel/FilterPanel.module.css */
.panel {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: rem(12px);
  padding: rem(16px) rem(20px);
  color: light-dark(var(--mantine-color-dark-8), var(--mantine-color-dark-0));

  @mixin hover {
    border-color: var(--mantine-color-brand-5);
  }
  @mixin dark {
    box-shadow: none;
  }
  @mixin smaller-than $mantine-breakpoint-sm {
    padding: rem(12px);
    border-radius: rem(10px);
  }
  @mixin larger-than $mantine-breakpoint-md {
    position: sticky;
    top: rem(72px);
  }
  @mixin rtl {
    padding-inline-end: rem(12px);
  }
}
.overlay {
  background: alpha(var(--mantine-color-brand-6), 0.12);
  border-color: lighten(var(--app-border), 0.4);
}
```

`light-dark()` **does not work on `:root`/`html`** — use `light-root`/`dark-root` there. `rem()` emits
`calc(Nrem * var(--mantine-scale))`. `smaller-than $mantine-breakpoint-*` needs the
`postcss-simple-vars` variables from §1; it subtracts `0.1px` to avoid intersecting `larger-than`.

## 5. Styling, variants, polymorphism `[L]`

```ts
interface StylesApiProps<Payload> {
  unstyled?: boolean;
  variant?: string;
  classNames?: ClassNames<Payload>; // selector -> string|undefined, OR (theme, props, ctx) => record
  styles?: Styles<Payload>; // selector -> CSSProperties, OR (theme, props, ctx) => record
  vars?: PartialVarsResolver<Payload>; // (theme, props, ctx) => { [selector]: { '--var': value } }
  attributes?: Attributes<Payload>; // selector -> Record<string, any>   (v9)
}
```

**`Modifier` does not exist in Mantine 9** (`grep -rn "Modifier" @mantine/core/lib` → 0 hits); the
equivalent type is `MantineStyleProp`.

Global defaults — verified from `useProps` source: `theme.components[name].defaultProps` may be an
**object or a `(theme) => props` function**:

```tsx
const theme = createTheme({
  components: {
    Button: { defaultProps: { radius: 'md', size: 'sm' } },
    TextInput: TextInput.extend({
      defaultProps: { radius: 'md' },
      classNames: { input: classes.input, label: classes.label },
      vars: (t, props) => ({ wrapper: { '--input-mb': props.error ? '0' : t.spacing.md } }),
    }),
  },
});
```

**Variant mechanism (a) — `variantColorResolver`** (`color`-driven variants of
`Button`/`ActionIcon`/`ThemeIcon`/`Badge`/`Alert`/…):

```ts
interface VariantColorsResolverInput {
  color?: MantineColor;
  theme: MantineTheme;
  variant: string;
  gradient?: MantineGradient;
  autoContrast?: boolean;
}
interface VariantColorResolverResult {
  background: string;
  hover: string;
  color: string;
  border: string;
  hoverColor?: string;
}
type VariantColorsResolver = (input: VariantColorsResolverInput) => VariantColorResolverResult;

const variantColorResolver: VariantColorsResolver = (input) => {
  if (input.variant !== 'soft') return defaultVariantColorsResolver(input);
  const c = input.color ?? 'brand';
  return {
    background: rgba(input.theme.colors[c][5], 0.14),
    hover: rgba(input.theme.colors[c][5], 0.22),
    color: `var(--mantine-color-${c}-light-color)`,
    border: '1px solid transparent',
  };
};
export const theme = createTheme({ variantColorResolver });
```

`<Button variant="soft" color="brand">`. `rgba` and `defaultVariantColorsResolver` are exported `[L]`.

**Mechanism (b) — `classNames` keyed on `variant`**: the reliable route for a bespoke visual identity,
since it uses real CSS Modules. `.extend()` exists on every `MantineComponent` and returns a
`MantineThemeComponent` `[L]`.

```tsx
Card: Card.extend({
  classNames: (t, props) => ({ root: props.variant === 'spotlight' ? classes.spotlight : classes.card }),
}),
```

**Polymorphism**: every component accepts `component` and `renderRoot`.

```tsx
import Link from 'next/link';
<Button component={Link} href="/environments">Environments</Button>
<Card component="article" variant="spotlight" />
```

From `@mantine/core/core/factory`: `factory`, `genericFactory`, `polymorphicFactory`,
`createPolymorphicComponent`, `polymorphic`; types `Factory`, `PolymorphicFactory`, `MantineComponent`,
`ExtendComponent`, `PolymorphicComponentProps`, `PolymorphicRef`.

## 6. Dark mode `[L]` `[D]`

```ts
useMantineColorScheme({ keepTransitions?: boolean }): {
  colorScheme: 'light' | 'dark' | 'auto';
  setColorScheme: (v: MantineColorScheme) => void;
  clearColorScheme: () => void;
  toggleColorScheme: () => void;
};
useComputedColorScheme(defaultValue?: 'light' | 'dark' = 'light',
  options?: { getInitialValueInEffect: boolean }): 'light' | 'dark';
```

`MantineProvider` sets `data-mantine-color-scheme="light|dark"` on `document.documentElement`
(override with `getRootElement`).

```tsx
'use client';
export function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme('light', { getInitialValueInEffect: true });
  return (
    <ActionIcon variant="default" size="lg" aria-label="Toggle color scheme"
      onClick={() => setColorScheme(computed === 'light' ? 'dark' : 'light')}>
      <IconSun className={cx(classes.icon, classes.light)} />
      <IconMoon className={cx(classes.icon, classes.dark)} />
    </ActionIcon>
  );
}
/* ColorSchemeToggle.module.css */
.icon { width: rem(20px); height: rem(20px); }
.light { @mixin dark { display: none; } }
.dark  { display: none; @mixin dark { display: block; } }
```

**Never read `colorScheme` in SSR-rendered markup** — the server has no storage, so values differ and
you get a hydration mismatch. Use `useComputedColorScheme(..., { getInitialValueInEffect: true })`
plus the `light`/`dark` CSS mixins `[D]`.

**localStorage vs cookie `[L]`: only `localStorageColorSchemeManager({ key? })` ships.**
`color-scheme-managers/index.d.ts` exports exactly `localStorageColorSchemeManager`,
`isMantineColorScheme`, and the `MantineColorSchemeManager` type. **There is no built-in cookie
manager**, and `ColorSchemeScript`'s `getScript()` is **internal — not exported** (`grep -rn getScript`
matches only inside `ColorSchemeScript.mjs`). Cookie-based SSR scheme needs your own manager against
the verified interface `{ get(defaultValue), set(value), subscribe(onUpdate), unsubscribe(), clear() }`:

```ts
export function cookieColorSchemeManager(key = 'mantine-color-scheme'): MantineColorSchemeManager {
  return {
    get: (defaultValue) => {
      if (typeof document === 'undefined') return defaultValue;
      const v = document.cookie.match(new RegExp(`(?:^|; )${key}=([^;]*)`))?.[1] as
        MantineColorScheme | undefined;
      return v === 'light' || v === 'dark' || v === 'auto' ? v : defaultValue;
    },
    set: (value) => {
      document.cookie = `${key}=${value};path=/;max-age=31536000;SameSite=Lax`;
      document.documentElement.setAttribute(
        'data-mantine-color-scheme',
        value === 'auto'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : value,
      );
    },
    subscribe: () => {},
    unsubscribe: () => {},
    clear: () => {
      document.cookie = `${key}=;path=/;max-age=0`;
    },
  };
}
```

**Flash prevention on the supported path:** render `ColorSchemeScript` in `<head>` with the **same
`defaultColorScheme`** as `MantineProvider` and the same `localStorageKey` as the manager `[D]`.

## 7. Forms `[L]`

```ts
useForm<Values, TransformedValues, Rules>(input?: UseFormInput<Values, TransformedValues>)
```

`UseFormInput`: `name, mode ('controlled'|'uncontrolled'), initialValues, initialErrors,
initialTouched, initialDirty, transformValues, validate, clearInputErrorOnChange,
validateInputOnChange, validateInputOnBlur, onValuesChange, enhanceGetInputProps,
onSubmitPreventDefault, touchTrigger, cascadeUpdates, validateDebounce, resolveValidationError`.
Returned (verified): `values, errors, submitting, initialized, getInputProps, onSubmit, onReset,
setFieldValue, setFieldError, clearFieldError, clearErrors, reset, resetField, validate,
validateField, isValid, isValidating, validating, insertListItem, removeListItem, replaceListItem,
reorderListItem, isDirty, isTouched, setTouched, setDirty, getValues, getInitialValues,
getTransformedValues, watch, useWatchValue, key, getInputNode, initialize, setInitialValues,
setValues, setErrors, setSubmitting`.
**v9 breaking change: the 2nd generic is the transformed values type, not the transform fn type** `[D]`.

```tsx
const form = useForm<FormValues, TransformedValues>({
  mode: 'uncontrolled',
  initialValues: { name: '', locationId: '2', seats: 1, plan: 'pro' },
  validateInputOnBlur: ['name', 'plan'],
  validate: { name: (v) => (v.trim().length < 2 ? 'At least 2 characters' : null) },
  transformValues: (v) => ({ ...v, locationId: Number(v.locationId), seats: Number(v.seats) }),
});
form.onSubmit((values /* TransformedValues */) => {});
const snapshot: FormValues = form.getValues();
form.setFieldError('name', 'Already taken');
form.insertListItem('tags', '', 0);
form.removeListItem('tags', 2);
form.reorderListItem('tags', { from: 0, to: 1 });

<TextInput
  label="Environment name"
  withAsterisk
  key={form.key('name')}
  {...form.getInputProps('name')}
/>;
```

`getInputProps(path, { type?: 'input'|'checkbox'|'radio', withError?, withFocus? })` returns
`{ onChange, value|defaultValue, checked|defaultChecked, error, onFocus, onBlur }`;
`key={form.key(path)}` matters in `'uncontrolled'` mode. Validators: `isNotEmpty, matches, isEmail,
hasLength, isInRange, matchesField, isNotEmptyHTML, isJSONString, isUrl, isOneOf`; plus `FORM_INDEX,
useField, createFormContext, createFormActions, formRootRule` `[L]`.

**`zodResolver` DOES NOT EXIST `[L]`** — `grep -rl "zodResolver" node_modules/@mantine` returns
nothing. The export is `schemaResolver`, typed against
`import type { StandardSchemaV1 } from '@standard-schema/spec'`
(`@standard-schema/spec@^1.1.0`, hoisted to `node_modules/.pnpm/node_modules/@standard-schema/spec`).

```ts
schemaResolver<Sync extends boolean = false>(
  schema: StandardSchemaV1, _options?: { sync?: Sync }
): Sync extends true ? (values: any) => FormErrors : (values: any) => Promise<FormErrors>;
```

```tsx
import { z } from 'zod'; // zod@4.6.7 installed; 'zod/v4' also valid
import { useForm, schemaResolver } from '@mantine/form';

const schema = z.object({
  email: z.email({ error: 'Invalid email' }),
  seats: z.coerce.number().int().min(1).max(500),
});
const form = useForm({
  initialValues: { email: '', seats: 1 },
  validate: schemaResolver(schema, { sync: true }),
});
```

The resolver calls `schema['~standard'].validate(values)` and maps `issues[].path` (object segments
joined by `.`) into `FormErrors`, so **any Standard Schema library works** (Zod 4, Valibot, ArkType).
**Zod 3 is not Standard-Schema compliant.** `{ sync: true }` gives synchronous client validation; omit
it for an async submit-time validator.

## 8. Dates `[L]`

Required: `import '@mantine/dates/styles.css';` · `dayjs` is a **declared peer** (`>=1.0.0`; 1.11.23
installed), not bundled · `<DatesProvider settings={...}>` where **`settings` is required**.
Settings: `locale: string`, `firstDayOfWeek: 0..6`, `weekendDays: DayOfWeek[]`,
`labelSeparator: string`, `consistentWeeks: boolean` (all partial).

```tsx
import 'dayjs/locale/de';   // side-effect locale registration
<DatesProvider settings={{ locale: 'de', firstDayOfWeek: 1, consistentWeeks: true }}>
```

**v9 date values are strings** `[L]`:

```ts
type DateStringValue = string; // 'YYYY-MM-DD'
type DateTimeStringValue = string; // 'YYYY-MM-DD HH:mm:ss'
type DateValue = DateStringValue | Date | null;
type DatePickerValue<Type, ValueType = DateValue> = Type extends 'range'
  ? [ValueType | null, ValueType | null]
  : Type extends 'multiple'
    ? ValueType[]
    : ValueType | null;
```

`DatePickerInput` `value` accepts **`Date | string | null`**, but **`onChange` always emits strings**:
`onChange?: (value: DatePickerValue<Type, DateStringValue>) => void`.

```tsx
const [value, setValue] = useState<string | null>(null);
<DatePickerInput
  label="Launch date"
  placeholder="Pick a date"
  value={value}
  onChange={setValue} /* DateStringValue, not Date */
  valueFormat="MMM D, YYYY"
  clearable
  dropdownType="popover"
/>;
```

`DatePickerInputProps` = `DateInputSharedProps` (`closeOnChange, dropdownType, popoverProps,
modalProps, clearable, clearSectionMode, clearButtonProps, readOnly, sortDates, labelSeparator,
placeholder, valueFormatter, onDropdownClose`) + `DatePickerBaseProps` (`type, value, defaultValue,
onChange, allowDeselect, allowSingleDateInRange, maxLevel, defaultLevel, level, onLevelChange,
presets, minDate, maxDate, locale`, calendar settings) + `valueFormat?` (default `"MMMM D, YYYY"`).
**v6/v7 spellings `dateParser` / `inputFormat` do not exist here.**
Exported: `DatesProvider DatePicker DatePickerInput DateInput DateTimePicker InlineDateTimePicker
TimeInput TimePicker TimeGrid YearPicker YearPickerInput MonthPicker MonthPickerInput Calendar
MiniCalendar HiddenDatesInput Day Month WeekdaysRow YearsList MonthsList` + picker levels.

## 9. Overlays `[L]`

**ModalBaseProps** (base of `Modal` + `Drawer`): `opened` _(required)_, `onClose` _(required)_,
`size='md'`, `padding='md'`, `shadow='xl'`, `zIndex=200`, `lockScroll=true`, `trapFocus=true`,
`withinPortal=true`, `portalProps`, `closeOnClickOutside=true`, `closeOnEscape=true`,
`returnFocus=true`, `keepMounted`, `keepMountedMode: 'activity'|'display-none' = 'activity'`,
`transitionProps`, `onExitTransitionEnd`, `onEnterTransitionEnd`, `removeScrollProps`, `id`.
`DrawerProps = DrawerRootProps & { title?, withOverlay?=true, overlayProps?, children?,
withCloseButton?=true, closeButtonProps?, stackId? }`; `DrawerRootProps` adds
`position: 'bottom'|'left'|'right'|'top'` (default `'left'`), `radius=0`, `offset: number|string = 0`,
`scrollAreaComponent='div'`. Statics: `Root Overlay Content Body Header Title CloseButton Stack`.
`Modal` mirrors this (`centered`, `fullScreen` via `ModalRootProps`) with the same static names.
Focus trap, Escape, outside-click and focus return are **on by default** in both.

**Menu** = `__PopoverProps` + `{ opened?, defaultOpened?, onChange?, onOpen?, onClose?,
closeOnItemClick?, loop?, closeOnEscape?=true, trigger?: 'click'|'hover'|'click-hover', openDelay?,
closeDelay?, closeOnClickOutside?, clickOutsideEvents?: string[] (default
['mousedown','touchstart','keydown']), trapFocus?, id?, menuItemTabIndex?: -1|0 = -1,
withInitialFocusPlaceholder?=true, returnFocus?=true,
alignItemsLabels?: 'all'|'with-indicators'|'none' = 'with-indicators', checkIcon? }`.
v9 statics: `Item Label Dropdown Target Divider Search Sub CheckboxItem CheckboxGroup RadioItem
RadioGroup ContextMenu` (+ `MenuSub*`). The trigger slot is `Menu.Target`, **not** `Menu.Trigger`.

**Popover / `__PopoverProps`** (shared with `Menu` and `Combobox`): `position='bottom'`, `offset=8`,
`width='max-content'|'target'`, `withArrow=false`, `withOverlay=false`, `withinPortal=true`,
`zIndex=300`, `radius`, `shadow`, `trapFocus=false`, `closeOnClickOutside=true`, `closeOnEscape=true`,
`withRoles=true`, `returnFocus=false`, `hideDetached=true`, `preventPositionChangeWhenVisible=true`,
`keepMountedMode`, `disabled`, `middlewares`, `arrowSize=7`, `arrowOffset=5`, `arrowRadius=0`,
`floatingStrategy='absolute'`. **`positionDependencies` was removed in v9.** Statics: `Target
Dropdown ContextMenu`.

**Combobox** = `__PopoverProps` + `{ children?, store?: ComboboxStore, onOptionSubmit?(value, optionProps),
size='sm', dropdownPadding=4, resetSelectionOnOptionHover=false, readOnly?, floatingHeight?: 'viewport' }`.
Statics: `Target Dropdown Options Option Search Empty Chevron Footer Header EventsTarget
DropdownTarget Group ClearButton HiddenInput`. v9 adds a standalone **`ComboboxPopover`**.

**`ComboboxLikeProps`** (Select / MultiSelect / TagsInput): `data?: ComboboxData<Value>`,
`dropdownOpened?`, `defaultDropdownOpened?`, `onDropdownOpen?`, `onDropdownClose?`,
`selectFirstOptionOnChange?`, `selectFirstOptionOnDropdownOpen?`, `onOptionSubmit?`,
`comboboxProps?: ComboboxProps`, `filter?: OptionsFilter<Value>`, `limit?`, `withScrollArea?=true`,
`maxDropdownHeight?=220`, `floatingHeight?`.

- `Select`: `value: Value|null`, `onChange(value, option)`, `searchable?`, `withCheckIcon?`,
  `checkIconPosition: 'left'|'right'`, `allowDeselect?=true`, `clearable?`, `nothingFoundMessage?`,
  `autoSelectOnBlur?`, `renderOption?`, `chevronColor?`.
- `MultiSelect`: `value: Value[]`, `maxValues?`, `hidePickedOptions?`, `renderPill?`,
  `withPillsReorder?` _(v9)_, `clearSearchOnChange?=true`, `openOnFocus?=true`, `onMaxValues?`,
  `onRemove?`, `hiddenInputValuesDivider?=','`.
- `TagsInput`: `maxTags?`, `splitChars?=[',']`, `allowDuplicates?=false`, `acceptValueOnBlur?=true`,
  `isDuplicate?`, `withPillsReorder?` _(v9)_, `onMaxTags?`, `onDuplicate?`.

## 10. Table `[L]`

```tsx
<Table.ScrollContainer minWidth={720}>
  <Table
    striped="odd"
    highlightOnHover
    withTableBorder
    withRowBorders={false}
    horizontalSpacing="md"
    verticalSpacing="sm"
    tabularNums
    stickyHeader
    stickyHeaderOffset={60}
    captionSide="bottom"
    variant="vertical"
    data={{ head: ['Env'], body: [['prod']], caption: 'Environments' }} /* convenience only */
  >
    <Table.Thead>
      <Table.Tr>
        <Table.Th>Env</Table.Th>
      </Table.Tr>
    </Table.Thead>
    <Table.Tbody>
      <Table.Tr>
        <Table.Td>prod</Table.Td>
      </Table.Tr>
    </Table.Tbody>
  </Table>
</Table.ScrollContainer>
```

Also `layout?: tableLayout`, `borderColor?`, `stripedColor?`, `highlightOnHoverColor?`. Pair `Table`
with `Pagination` and your own sorting/filtering state — nothing is built in.

## 11. Notifications & Modals `[L]`

`NotificationData` for `notifications.show({...})`: `id?`, `message` _(required)_, `title?`, `icon?`,
`color?`, `radius?`, `loading?`, `withBorder?`, `withCloseButton?`, `closeButtonProps?`,
`loaderProps?`, `position?`, `priority?=0`, `autoClose?: boolean|number`, `allowClose?=true`,
`withAutoCloseProgress?`, `onClose?`, `onOpen?`, `renderNotification?` (`null` restores default),
plus `data-*`. Also `notifications.hide/update/clean/cleanQueue/updateState/promise`; named exports
`showNotification, hideNotification, updateNotification, cleanNotifications, cleanNotificationsQueue,
promiseNotification, createNotificationsStore, notificationsStore, useNotifications`.

```tsx
import { notifications } from '@mantine/notifications';

notifications.show({
  title: 'Deploy started',
  message: 'Rebuilding “staging-eu”.',
  color: 'brand',
  icon: <IconRocket size={18} />,
  autoClose: 4000,
  withAutoCloseProgress: true,
});

notifications.promise(deploy(), {
  loading: { title: 'Deploying', message: 'Please wait…' },
  success: { title: 'Deployed', message: 'All checks passed', color: 'teal' },
  error: { title: 'Failed', message: 'See logs', color: 'red' },
});
```

`<Notifications>`: `position='bottom-right'`, `autoClose=4000`, `transitionDuration=250`,
`allowDragDismiss=true`, `allowScrollDismiss=true`, `containerWidth=440`,
`notificationMaxHeight=200`, `limit=5`, `zIndex=400`, `withinPortal=true`, `portalProps`, `store`,
`pauseResetOnHover: 'all'|'notification' = 'all'` _(v9 default change)_, `renderNotification`,
`layout: 'default'|'stacked'`, `withAutoCloseProgress=false`.

`@mantine/modals` (no CSS): `ModalsProvider, useModals, modals, openModal, closeModal,
closeAllModals, openConfirmModal, openContextModal, updateModal, updateContextModal`.
`OpenConfirmModal = ModalSettings & ConfirmModalProps` where
`ModalSettings = Partial<Omit<ModalProps,'opened'>> & { modalId?: string }`; `ConfirmModalProps`
adds `id, children, onCancel, onConfirm, closeOnConfirm, closeOnCancel, cancelProps, confirmProps,
groupProps, labels: { confirm, cancel }`.

```tsx
import { modals } from '@mantine/modals';

modals.openConfirmModal({
  title: 'Delete environment',
  centered: true,
  radius: 'lg',
  children: <Text size="sm">This cannot be undone.</Text>,
  labels: { confirm: 'Delete', cancel: 'Cancel' },
  confirmProps: { color: 'red' },
  onConfirm: () => deleteEnv(id),
});
modals.open({ title: 'Edit', modalId: 'edit-env', children: <EditForm /> });
modals.update({ modalId: 'edit-env', title: 'Saving…' });
modals.closeAll();
```

`ModalsProvider` props: `{ children?, modals?: Record<string, React.FC<ContextModalProps>>,
modalProps?: ModalSettings, labels?: ConfirmLabels }`.

## 12. Icons `[L]`

`@tabler/icons-react@3.49.0`; verified present: `IconSearch IconMenu2 IconX IconUser IconPlus
IconChevronDown IconChevronLeft IconChevronRight IconLayoutDashboard IconBell IconFilter IconTrash
IconAdjustmentsHorizontal`.

Slots: `leftSection` — `TextInput Select MultiSelect TagsInput NumberInput Button ActionIcon NavLink
Badge Pill`; `rightSection` — input family + `Button NavLink Badge`; `icon` — `Notification Alert
Checkbox Radio Timeline.Item ThemeIcon Stepper.Step`.

```tsx
import { IconSearch, IconPlus } from '@tabler/icons-react';

<TextInput label="Search" placeholder="Search environments…"
  leftSection={<IconSearch size={16} stroke={1.6} />} rightSectionWidth={36} />
<Button leftSection={<IconPlus size={16} />}>New environment</Button>
```

Tabler icons accept `size`, `stroke`, `color`, `className`; plain SVG, safe in Server Components.

## 13. Accessibility `[L]`

Verified built-ins to rely on: focus trap (`Modal`/`Drawer` `trapFocus=true`; `Menu` `trapFocus?`;
`Popover` `trapFocus=false` — opt in) · focus return (`Modal`/`Drawer`/`Menu` `returnFocus=true`,
`Popover` `returnFocus=false`) · `closeOnEscape=true` + `closeOnClickOutside=true` on the modal family
and `Popover`, with configurable `clickOutsideEvents` · keyboard nav in `Tabs` (`loop`,
`activateTabWithKeyboard=true`, `allowTabDeactivation`), `Accordion` (`loop`), `Menu` (`loop`,
`menuItemTabIndex`, initial focus placeholder), `SegmentedControl` (real radio group, auto-generated
`name`), `Pagination` (`getControlProps`, `formatLabel`, `withEdges`), `Combobox`/`Select` (arrows +
`Enter`) · ARIA id chain auto-generated by `InputBase` / `Input.Wrapper` unless `withAria={false}`;
`Popover` `withRoles=true`; `VisuallyHidden` available · focus ring via
`theme.focusRing: 'auto'|'always'|'never'` and `theme.focusClassName`.

**`respectReducedMotion` is `false` by default — set it `true`.** It disables Mantine
transitions/animations when the OS requests reduced motion.

```tsx
export const theme = createTheme({ respectReducedMotion: true, focusRing: 'auto' });
```

## 14. Mantine 9 breaking changes vs 7/8 `[D]` `[L]`

1. **React 19.2+ required** (peer `react ^19.2.0`; project has 19.3.0).
2. **`zodResolver` removed** → `schemaResolver` (Standard Schema); **Zod 4 only**.
3. **`useForm` 2nd generic** = transformed values type, not the transform fn type.
4. **`<Text color>` / `<Anchor color>` removed** → `c` style prop.
5. **`Collapse in` → `expanded`.**
6. **`Spoiler initialState` → `defaultExpanded`.**
7. **`Grid gutter` → `gap`** (+ `rowGap`/`columnGap`); `overflow="hidden"` no longer needed (native
   CSS `gap`, no negative margins).
8. **`theme.defaultRadius` default `sm` (4px) → `md` (8px).**
9. **`light` variant colors** now solid, not transparent; escape hatch `v8CssVariablesResolver`.
10. **`TypographyStylesProvider` → `Typography`.**
11. **`Popover`/`Tooltip` `positionDependencies` removed.**
12. **`Notifications` `pauseResetOnHover` default `'notification'` → `'all'`.**
13. **`useFullscreen` split** → `useFullscreenElement` / `useFullscreenDocument`.
14. **`useMouse` split** → `useMouse` (element `ref`) / `useMousePosition` (document).
15. **`useMutationObserver`** third target arg removed → `useMutationObserverTarget`.
16. **Hook type renames**: `UseScrollSpyReturnType`→`UseScrollSpyReturnValue`,
    `StateHistory`→`UseStateHistoryValue`, `OS`→`UseOSReturnValue`.
17. **`useLocalStorage`/`useSessionStorage`** value type includes `undefined` without `defaultValue`
    (same for `readLocalStorageValue`/`readSessionStorageValue`).
18. **`useHeadroom` returns `{ pinned, scrollProgress }`**, not a boolean.
19. **`mantineHtmlProps`** is the v9 SSR way to set `<html>` attributes.
20. **`StylesApiProps` gained `attributes`**; `MantineProvider` gained `deduplicateInlineStyles`.
21. **No `DataTable`** and no data-grid package installed.
22. **Gains** (all `[L]`): `Menu.Search/CheckboxItem/CheckboxGroup/RadioItem/RadioGroup/ContextMenu`,
    `Modal.Stack`/`Drawer.Stack`, `Notifications.layout/priority/renderNotification`,
    `MultiSelect`/`TagsInput` `withPillsReorder`, input `success`/`successProps`/`withSuccessStyles`
    and `loading`/`loadingPosition`, `AppShell` `resize` controller.
23. `Modifier` type does not exist; `ComboboxPopover` is a new standalone component.

## 15. Recipes

### 15.1 AppShell with responsive header + navbar `[L]`

`AppShell` props: `header: { height, collapsed?, offset? }`,
`navbar`/`aside`: `{ width, breakpoint, collapsed?: { desktop?, mobile? } }`,
`footer: { height, collapsed?, offset? }`, plus `padding` (**not `p`**), `withBorder=true`,
`mode: 'fixed'|'static'`, `layout: 'default'|'alt'`, `zIndex`, `transitionDuration`, `disabled`,
`offsetScrollbars=true`, and a v9-only `resize` controller from `useAppShellResize`.
Statics: `Header Navbar Main Aside Footer Section`.

```tsx
'use client';
import { AppShell, Burger, Group, NavLink, ScrollArea, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconLayoutDashboard, IconServer } from '@tabler/icons-react';
import Link from 'next/link';
import { ColorSchemeToggle } from '@/components/ColorSchemeToggle';

export function AppFrame({ children }: { children: React.ReactNode }) {
  const [opened, { toggle }] = useDisclosure();
  return (
    <AppShell
      header={{ height: 60 }}
      padding="md"
      mode="fixed"
      layout="default"
      navbar={{ width: 280, breakpoint: 'sm', collapsed: { mobile: !opened } }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
              aria-label="Toggle navigation"
            />
            <Text fw={650}>Live Envt</Text>
          </Group>
          <ColorSchemeToggle />
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="xs">
        <AppShell.Section grow component={ScrollArea}>
          <NavLink
            component={Link}
            href="/"
            label="Overview"
            leftSection={<IconLayoutDashboard size={18} />}
          />
          <NavLink
            component={Link}
            href="/environments"
            label="Environments"
            leftSection={<IconServer size={18} />}
          />
        </AppShell.Section>
      </AppShell.Navbar>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
```

### 15.2 Mobile filter Drawer as a bottom sheet

```tsx
<Drawer
  opened={filtersOpened}
  onClose={closeFilters}
  position="bottom"
  size="min(85dvh, 620px)"
  radius="lg"
  offset={8}
  title="Filters"
  scrollAreaComponent={ScrollArea.Autosize}
  overlayProps={{ backgroundOpacity: 0.45, blur: 3 }}
  transitionProps={{ transition: 'slide-up', duration: 220 }}
>
  <Stack gap="md">{filterFields}</Stack>
  <Group justify="space-between" mt="lg">
    <Button variant="default" onClick={reset}>
      Reset
    </Button>
    <Button onClick={apply}>Show {count} results</Button>
  </Group>
</Drawer>
```

### 15.3 Form field with label + error

```tsx
<Stack gap="sm">
  <TextInput
    label="Environment name"
    description="Lowercase, hyphens allowed"
    placeholder="production-eu"
    withAsterisk
    key={form.key('name')}
    {...form.getInputProps('name')}
  />
  <NumberInput
    label="Seats"
    min={1}
    max={500}
    clampBehavior="strict"
    thousandSeparator=","
    {...form.getInputProps('seats')}
  />
  <Select
    label="Plan"
    searchable
    data={plans}
    nothingFoundMessage="No plan found"
    clearable
    {...form.getInputProps('plan')}
  />
</Stack>
```

### 15.4 Status Badge

```tsx
const statusMap = {
  healthy: { color: 'teal', label: 'Healthy' },
  degraded: { color: 'yellow', label: 'Degraded' },
  down: { color: 'red', label: 'Down' },
} as const;

<Badge
  variant="light"
  color={statusMap[status].color}
  size="sm"
  radius="sm"
  leftSection={<span aria-hidden>●</span>}
>
  {statusMap[status].label}
</Badge>;
```

`BadgeProps`: `size, circle, radius, color, variant, gradient, leftSection, rightSection, fullWidth,
autoContrast, children`. CSS vars: `--badge-height, --badge-padding-x, --badge-fz, --badge-radius,
--badge-bg, --badge-color, --badge-bd, --badge-dot-color`.

### 15.5 Filter chip row with removable chips

```tsx
<Chip.Group multiple value={selected} onChange={setSelected}>
  <Group gap="xs">
    <Chip value="prod" size="sm" radius="xl" variant="light">Production</Chip>
    <Chip value="staging" size="sm" radius="xl" variant="light">Staging</Chip>
  </Group>
</Chip.Group>

<Group gap={6}>
  {applied.map((f) => (
    <Pill key={f.id} withRemoveButton onRemove={() => remove(f.id)} radius="xl" size="sm">
      <Text size="xs" fw={550}>{f.label}</Text>
    </Pill>
  ))}
</Group>
```

`PillProps`: `size, withRemoveButton, onRemove, removeButtonProps, radius, disabled`. `Chip` is the
interactive toggle; `Badge` is not interactive. `MultiSelect` also renders pills via `renderPill`.

### 15.6 Paginated results header

```tsx
<Group justify="space-between" align="center" mb="md">
  <Text size="sm" c="dimmed">
    Showing <b>{(page - 1) * pageSize + 1}</b>–<b>{Math.min(page * pageSize, total)}</b> of{' '}
    <b>{total}</b> environments
  </Text>
  <Pagination
    value={page}
    onChange={setPage}
    total={Math.ceil(total / pageSize)}
    siblings={1}
    boundaries={1}
    withEdges
    withControls
    size="sm"
    radius="md"
    getControlProps={(control) => ({ 'aria-label': `Go to ${control} page` })}
  />
</Group>
```

Extras: `withEdges, withControls, withPages, hideWithOnePage, gap, getControlProps, formatLabel,
nextIcon, previousIcon, firstIcon, lastIcon, dotsIcon`; `Pagination.Root` also exists.

### 15.7 Skeleton listing card

```tsx
export function EnvironmentCardSkeleton() {
  return (
    <Card withBorder radius="lg" padding="lg">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap="xs" style={{ flex: 1 }}>
          <Skeleton height={18} width="55%" radius="sm" />
          <Skeleton height={12} width="80%" radius="sm" />
          <Skeleton height={12} width="40%" radius="sm" />
        </Stack>
        <Skeleton height={44} circle />
      </Group>
      <Group gap="xs" mt="lg">
        <Skeleton height={24} width={84} radius="xl" />
        <Skeleton height={24} width={64} radius="xl" />
      </Group>
    </Card>
  );
}
```

`SkeletonProps`: `visible` (when `false`, children render instead), `height`, `width`, `circle`,
`radius`, `animate`. `Card` statics: `Card.Section`; props `shadow, radius, withBorder, padding,
orientation: 'horizontal'|'vertical'`.

## Sources

Local `.d.ts`/source under `node_modules/@mantine/*`; `postcss-preset-mantine@1.18.0/dist/preset.js`.
Docs: [guides/next](https://mantine.dev/guides/next/) ·
[8x-to-9x](https://mantine.dev/guides/8x-to-9x/) ·
[theming/color-schemes](https://mantine.dev/theming/color-schemes/) ·
[theming/mantine-provider](https://mantine.dev/theming/mantine-provider/) ·
[styles/css-variables](https://mantine.dev/styles/css-variables/) ·
[styles/styles-api](https://mantine.dev/styles/styles-api/) ·
[styles/css-modules](https://mantine.dev/styles/css-modules/) ·
[styles/postcss-preset](https://mantine.dev/styles/postcss-preset/).
