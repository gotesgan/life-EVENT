import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import type { ReactElement } from 'react';
import { HeaderNav } from '@/components/layout/HeaderNav';
import { MobileNavLinks } from '@/components/layout/MobileNavLinks';
import { MobileTabBarView } from '@/components/layout/MobileTabBarView';
import { DRAWER_GROUPS, NAV_SECTIONS } from '@/components/layout/navigation';

/**
 * The restructured site navigation.
 *
 * The desktop header is now a two-tier bar whose items open a wide dropdown with
 * a side rail inside it, and the phone surfaces are split between a fixed
 * quick-action bar and a drawer. All of it is static links, so the behaviours
 * worth locking down are the ones a stylesheet cannot express and a screenshot
 * cannot prove: *which* destinations each surface offers, that the rail actually
 * swaps the pane, that a keyboard user can open a panel, and that the drawer
 * never repeats a link.
 *
 * `next/navigation` and `next/link` are mocked: the pathname is the only input
 * these components take from the router, and mocking it lets a test move the
 * visitor to another page without a real navigation.
 */

const nav = vi.hoisted(() => ({ pathname: '/' }));

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string | { pathname: string };
    children?: React.ReactNode;
  } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/ui/ClientLink', () => ({
  default: ({
    href,
    children,
    onClick,
    ...rest
  }: {
    href: string;
    children?: React.ReactNode;
  } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) => (
    /* `preventDefault` keeps jsdom from trying to navigate the test document
       when a link is clicked; the component's own handler still runs. */
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
      {...rest}
    >
      {children}
    </a>
  ),
}));

function renderWithProvider(ui: ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

function primaryNav() {
  return within(screen.getByRole('navigation', { name: 'Primary' }));
}

/**
 * The inside of the open dropdown panel.
 *
 * Mantine renders its dropdown through floating-ui's `hide()` middleware and
 * applies an inline `display: none` while the trigger is `referenceHidden`.
 * jsdom measures every element as zero-sized and out of the viewport, so that
 * middleware always fires under test even though the panel is open — in a real
 * browser it is visible. Query the mounted dropdown directly and opt into
 * hidden elements, rather than write assertions that only pass here.
 */
function panel() {
  const dropdown = document.querySelector('[class*="Popover-dropdown"]');
  if (!dropdown) throw new Error('expected one panel to be open');
  return within(dropdown as HTMLElement);
}

describe('HeaderNav', () => {
  it('offers the header sections in order, each one a real link', () => {
    nav.pathname = '/';
    renderWithProvider(<HeaderNav />);

    const links = primaryNav()
      .getAllByRole('link')
      .map((link) => link.textContent?.trim());

    expect(links).toEqual(NAV_SECTIONS.map((section) => section.label));
  });

  it('points each section at its own index route rather than dead-ending on a trigger', () => {
    nav.pathname = '/';
    renderWithProvider(<HeaderNav />);

    expect(primaryNav().getByRole('link', { name: /Venues/ })).toHaveAttribute(
      'href',
      '/categories/venues',
    );
  });

  it('closes every panel on first paint', () => {
    nav.pathname = '/';
    renderWithProvider(<HeaderNav />);

    expect(primaryNav().queryByText('Banquet Halls')).not.toBeInTheDocument();
    expect(primaryNav().getByRole('link', { name: /Venues/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('opens a panel on hover, with a rail on the left and the first row in the pane', async () => {
    const user = userEvent.setup();
    nav.pathname = '/';
    renderWithProvider(<HeaderNav />);

    await user.hover(primaryNav().getByRole('link', { name: /Venues/ }));

    /* Rail: the branch itself, then its two children. */
    expect(await screen.findByText('Banquet Halls')).toBeInTheDocument();
    expect(panel().getByText('Hotels & Resorts')).toBeInTheDocument();
    expect(panel().getByText('Lawns & Farmhouses')).toBeInTheDocument();

    /* Pane: the first rail row is active, so its description and city cuts show. */
    expect(panel().getByText(/Banquet halls, hotels, resorts/)).toBeInTheDocument();
    expect(panel().getByRole('link', { name: 'Anywhere in India', hidden: true })).toHaveAttribute(
      'href',
      '/vendors?category=venues',
    );
    expect(panel().getByRole('link', { name: 'Mumbai', hidden: true })).toHaveAttribute(
      'href',
      '/vendors?category=venues&location=mumbai',
    );
  });

  it('swaps the pane when the pointer moves down the rail', async () => {
    const user = userEvent.setup();
    nav.pathname = '/';
    renderWithProvider(<HeaderNav />);

    await user.hover(primaryNav().getByRole('link', { name: /Venues/ }));
    await screen.findByText('Banquet Halls');

    await user.hover(panel().getByText('Banquet Halls'));

    expect(panel().getByRole('link', { name: 'Anywhere in India', hidden: true })).toHaveAttribute(
      'href',
      '/vendors?category=banquet-halls',
    );
    expect(panel().getByRole('link', { name: 'Pune', hidden: true })).toHaveAttribute(
      'href',
      '/vendors?category=banquet-halls&location=pune',
    );
  });

  it('opens a panel for the keyboard as well as the pointer', async () => {
    nav.pathname = '/';
    renderWithProvider(<HeaderNav />);

    fireEvent.focus(primaryNav().getByRole('link', { name: /Catering/ }));

    expect(await screen.findByText('Live Food Stations')).toBeInTheDocument();
  });

  it('keeps the panel links reachable as ordinary links, not menu items', async () => {
    const user = userEvent.setup();
    nav.pathname = '/';
    renderWithProvider(<HeaderNav />);

    await user.hover(primaryNav().getByRole('link', { name: /Venues/ }));
    await screen.findByText('Banquet Halls');

    /* The panel's destinations are exposed as links, not as `menuitem`, which
       would promise the arrow-key semantics of a `Menu` this does not build. */
    expect(
      panel().getByRole('link', { name: 'Anywhere in India', hidden: true }),
    ).toBeInTheDocument();
    expect(panel().queryAllByRole('menuitem', { hidden: true })).toHaveLength(0);
  });

  it('closes the panel once the visitor lands on another page', async () => {
    const user = userEvent.setup();
    nav.pathname = '/';
    const { rerender } = renderWithProvider(<HeaderNav />);

    await user.hover(primaryNav().getByRole('link', { name: /Venues/ }));
    await screen.findByText('Banquet Halls');

    nav.pathname = '/categories/venues';
    rerender(
      <MantineProvider>
        <HeaderNav />
      </MantineProvider>,
    );

    expect(screen.queryByText('Banquet Halls')).not.toBeInTheDocument();
  });
});

describe('MobileTabBarView', () => {
  const tabBar = () => within(screen.getByRole('navigation', { name: 'Quick actions' }));

  it('carries the five agreed slots', () => {
    renderWithProvider(
      <MobileTabBarView accountHref="/account" accountLabel="Priya" pathname="/" />,
    );

    expect(
      tabBar()
        .getAllByRole('link')
        .map((link) => link.textContent?.trim()),
    ).toEqual(['Home', 'Browse', 'Search', 'Enquire', 'Priya']);
  });

  it('points each slot at the surface it stands for', () => {
    renderWithProvider(
      <MobileTabBarView accountHref="/account" accountLabel="Priya" pathname="/" />,
    );

    expect(tabBar().getByRole('link', { name: 'Browse' })).toHaveAttribute('href', '/categories');
    expect(tabBar().getByRole('link', { name: 'Search' })).toHaveAttribute('href', '/vendors');
    expect(tabBar().getByRole('link', { name: 'Enquire' })).toHaveAttribute('href', '/enquire');
  });

  it('marks no tab current before the pathname is known', () => {
    renderWithProvider(
      <MobileTabBarView accountHref="/account" accountLabel="Priya" pathname={null} />,
    );

    for (const link of tabBar().getAllByRole('link')) {
      expect(link).not.toHaveAttribute('aria-current');
    }
  });

  it('marks the tab for the page being viewed', () => {
    renderWithProvider(
      <MobileTabBarView accountHref="/account" accountLabel="Priya" pathname="/vendors" />,
    );

    expect(tabBar().getByRole('link', { name: 'Search' })).toHaveAttribute('aria-current', 'page');
    expect(tabBar().getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('does not treat the home tab as current on every page', () => {
    renderWithProvider(
      <MobileTabBarView accountHref="/account" accountLabel="Priya" pathname="/enquire" />,
    );

    expect(tabBar().getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
    expect(tabBar().getByRole('link', { name: 'Enquire' })).toHaveAttribute('aria-current', 'page');
  });

  it('marks the account tab current on a deeper account page', () => {
    renderWithProvider(
      <MobileTabBarView
        accountHref="/account"
        accountLabel="Priya"
        pathname="/account/enquiries"
      />,
    );

    expect(tabBar().getByRole('link', { name: 'Priya' })).toHaveAttribute('aria-current', 'page');
  });

  it('ignores the sign-in redirect query when deciding what is current', () => {
    renderWithProvider(
      <MobileTabBarView
        accountHref="/sign-in?next=%2Faccount"
        accountLabel="Sign in"
        pathname="/sign-in"
      />,
    );

    expect(tabBar().getByRole('link', { name: 'Sign in' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('MobileNavLinks', () => {
  it('groups every destination that is not on the tab bar', () => {
    nav.pathname = '/';
    renderWithProvider(<MobileNavLinks onNavigate={() => {}} />);

    const drawer = within(screen.getByRole('navigation', { name: 'Mobile' }));

    for (const group of DRAWER_GROUPS) {
      expect(drawer.getByText(group.label)).toBeInTheDocument();
    }
  });

  it('never repeats a link across its groups', () => {
    nav.pathname = '/';
    renderWithProvider(<MobileNavLinks onNavigate={() => {}} />);

    const hrefs = within(screen.getByRole('navigation', { name: 'Mobile' }))
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    expect(hrefs.length).toBeGreaterThan(0);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('marks the page the visitor is on, ignoring any filter query string', () => {
    nav.pathname = '/about';
    renderWithProvider(<MobileNavLinks onNavigate={() => {}} />);

    const drawer = within(screen.getByRole('navigation', { name: 'Mobile' }));

    expect(drawer.getByRole('link', { name: 'About' })).toHaveAttribute('data-active', 'true');
    expect(drawer.getByRole('link', { name: 'Contact' })).not.toHaveAttribute('data-active');
  });

  it('closes the drawer when a destination is chosen', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    nav.pathname = '/';
    renderWithProvider(<MobileNavLinks onNavigate={onNavigate} />);

    await user.click(
      within(screen.getByRole('navigation', { name: 'Mobile' })).getByRole('link', {
        name: 'Contact',
      }),
    );

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
