'use client';

import { type ReactNode, useState } from 'react';
import Link from '@/components/ui/ClientLink';
import { usePathname } from 'next/navigation';
import { AppShell, Badge, Burger, Group, NavLink, ScrollArea, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconAdjustmentsHorizontal,
  IconBuildingStore,
  IconCalendarEvent,
  IconCategory,
  IconExternalLink,
  IconInbox,
  IconLayoutDashboard,
  IconMapPin,
  IconShieldCheck,
  IconSofa,
  IconTags,
  IconUsers,
} from '@tabler/icons-react';
import { BrandMark, ThemeToggle } from '@/components/ui';
import classes from './AdminShell.module.css';

/** The topbar is a single dense line: enough for orientation, not a banner. */
const HEADER_HEIGHT = 52;
const NAVBAR_WIDTH = 244;

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  /** `inbox` renders the NEW enquiry badge. */
  badge?: 'inbox';
}

const PRIMARY_NAV: NavItem[] = [
  { href: '/admin', label: 'Overview', icon: <IconLayoutDashboard size={18} stroke={1.5} /> },
  {
    href: '/admin/listings',
    label: 'Listings',
    icon: <IconBuildingStore size={18} stroke={1.5} />,
  },
  {
    href: '/admin/enquiries',
    label: 'Enquiries',
    icon: <IconInbox size={18} stroke={1.5} />,
    badge: 'inbox',
  },
  { href: '/admin/customers', label: 'Customers', icon: <IconUsers size={18} stroke={1.5} /> },
];

const CATALOGUE_NAV: NavItem[] = [
  {
    href: '/admin/catalogue/categories',
    label: 'Categories',
    icon: <IconCategory size={18} stroke={1.5} />,
  },
  {
    href: '/admin/catalogue/attributes',
    label: 'Attributes',
    icon: <IconAdjustmentsHorizontal size={18} stroke={1.5} />,
  },
  {
    href: '/admin/catalogue/locations',
    label: 'Locations',
    icon: <IconMapPin size={18} stroke={1.5} />,
  },
  {
    href: '/admin/catalogue/event-types',
    label: 'Event types',
    icon: <IconCalendarEvent size={18} stroke={1.5} />,
  },
  {
    href: '/admin/catalogue/amenities',
    label: 'Amenities',
    icon: <IconSofa size={18} stroke={1.5} />,
  },
];

export interface AdminShellProps {
  children: ReactNode;
  /** Rendered in the header so an administrator can confirm who they are. */
  actorName: string;
  /** Enquiry inbox NEW count; `null` when the count could not be resolved. */
  newEnquiryCount: number | null;
}

function isActivePath(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navClasses(active: boolean, parent = false): string {
  return [classes.navItem, active ? classes.navItemActive : '', parent ? classes.navItemParent : '']
    .filter(Boolean)
    .join(' ');
}

function navLabel(label: string, active: boolean): ReactNode {
  return (
    <span className={classes.navLabel}>
      <span
        aria-hidden
        className={active ? classes.navMarker : `${classes.navMarker} ${classes.navMarkerIdle}`}
      />
      {label}
    </span>
  );
}

/**
 * The interactive half of the admin chrome.
 *
 * The Server Component layout owns the authorization decision; this component
 * only draws the shell, so no client code ever decides whether a route is
 * reachable. Nav links use `Link` (real anchors) so keyboard and middle-click
 * behave.
 *
 * The active row carries **three** channels, none of them colour alone (guide
 * §6.5.4): `aria-current="page"`, a solid marker bar, and the `--app-brand-soft`
 * fill. It is deliberately *not* a primary fill — the action colour stays
 * reserved for the buttons on the page, so "this is where you are" can never be
 * misread as "this does something". The marker is a real child span so it is a
 * styleable box, and it is `aria-hidden` so it cannot alter the link's name.
 *
 * Layout: the rail and topbar share one chrome surface (`--app-surface-muted`)
 * and the workspace is a raised pane, so the eye reads three zones — where am I
 * (topbar), where can I go (rail), what am I doing (pane) — without any of them
 * needing a shadow.
 */
export function AdminShell({ children, actorName, newEnquiryCount }: AdminShellProps) {
  const pathname = usePathname();
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure(false);
  const [catalogueOpened, setCatalogueOpened] = useState(pathname.startsWith('/admin/catalogue'));

  const catalogueActive = pathname.startsWith('/admin/catalogue');
  const catalogueCollapsedActive = catalogueActive && !catalogueOpened;

  const renderItem = (item: NavItem) => {
    const active = isActivePath(pathname, item.href);
    return (
      <NavLink
        key={item.href}
        component={Link}
        href={item.href}
        leftSection={item.icon}
        active={active}
        aria-current={active ? 'page' : undefined}
        onClick={closeMobile}
        className={navClasses(active)}
        label={navLabel(item.label, active)}
        rightSection={
          item.badge === 'inbox' && newEnquiryCount !== null && newEnquiryCount > 0 ? (
            <Badge
              size="sm"
              radius="xl"
              variant="filled"
              color="brand"
              className={classes.navInboxBadge}
              aria-label={`${newEnquiryCount} new`}
            >
              {newEnquiryCount}
            </Badge>
          ) : undefined
        }
      />
    );
  };

  return (
    <AppShell
      header={{ height: HEADER_HEIGHT }}
      navbar={{
        width: NAVBAR_WIDTH,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened },
      }}
      padding="md"
    >
      <AppShell.Header className={classes.header}>
        <Group h="100%" justify="space-between" wrap="nowrap" className={classes.headerInner}>
          <Group gap="sm" wrap="nowrap" className={classes.headerBrand}>
            <Burger
              opened={mobileOpened}
              onClick={toggleMobile}
              hiddenFrom="sm"
              size="sm"
              aria-label="Toggle admin navigation"
            />
            <BrandMark size="sm" />
            <Text component="span" className={classes.headerDivider} aria-hidden>
              /
            </Text>
            <Text component="span" className={classes.headerRole}>
              Admin
            </Text>
          </Group>

          <Group wrap="nowrap" className={classes.headerRight}>
            <div className={classes.actor}>
              <Text component="span" className={classes.actorLabel}>
                Signed in
              </Text>
              <Text component="span" title={actorName} className={classes.actorName}>
                {actorName}
              </Text>
            </div>
            <Link href="/" className={classes.publicLink}>
              <IconExternalLink size={13} stroke={1.5} aria-hidden />
              View public site
            </Link>
            <ThemeToggle size="sm" />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar className={classes.navbar}>
        <AppShell.Section grow component={ScrollArea} type="hover" offsetScrollbars>
          <nav aria-label="Admin sections" className={classes.navSections}>
            <Stack gap={2}>{PRIMARY_NAV.map(renderItem)}</Stack>

            <p className={classes.navGroupLabel}>Catalogue</p>

            <NavLink
              component="button"
              type="button"
              leftSection={<IconTags size={18} stroke={1.5} />}
              opened={catalogueOpened}
              onChange={() => setCatalogueOpened((open) => !open)}
              active={catalogueCollapsedActive}
              className={navClasses(catalogueCollapsedActive, true)}
              label={navLabel('Catalogue', catalogueCollapsedActive)}
            />

            <Stack gap={0} className={classes.navChildren}>
              {CATALOGUE_NAV.map(renderItem)}
            </Stack>

            <p className={classes.navGroupLabel}>Compliance</p>
            <Stack gap={2}>
              {renderItem({
                href: '/admin/audit',
                label: 'Audit log',
                icon: <IconShieldCheck size={18} stroke={1.5} />,
              })}
            </Stack>
          </nav>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main className={classes.main}>
        <div className={classes.mainInner}>{children}</div>
      </AppShell.Main>
    </AppShell>
  );
}
