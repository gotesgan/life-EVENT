import type { ReactNode } from 'react';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { cx } from '@/components/ui/cx';
import classes from './PageSection.module.css';

export interface PageSectionProps {
  children: ReactNode;
  /** Renders a `SectionHeading` and wires `aria-labelledby` for you. */
  title?: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** Anchor target and the id the heading uses. */
  id?: string;
  spacing?: 'normal' | 'tight' | 'hero';
  className?: string;
}

/**
 * A vertically-rhythmed page section.
 *
 * Every band on every page uses this, so section spacing is decided once. When
 * a `title` is supplied the section is labelled by its own heading, which means
 * a screen-reader user can jump between bands by landmark and heading.
 */
export function PageSection({
  children,
  title,
  eyebrow,
  description,
  action,
  id,
  spacing = 'normal',
  className,
}: PageSectionProps) {
  const headingId = id ? `${id}-heading` : undefined;

  return (
    <section
      id={id}
      aria-labelledby={title && headingId ? headingId : undefined}
      className={cx(
        classes.section,
        spacing === 'tight' && classes.tight,
        spacing === 'hero' && classes.hero,
        className,
      )}
    >
      {title ? (
        <SectionHeading
          id={headingId}
          title={title}
          eyebrow={eyebrow}
          description={description}
          action={action}
        />
      ) : null}
      {children}
    </section>
  );
}
