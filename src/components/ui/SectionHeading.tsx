import type { ReactNode } from 'react';
import { cx } from './cx';
import classes from './SectionHeading.module.css';

export interface SectionHeadingProps {
  title: ReactNode;
  /** Small uppercase label above the title. Avoid restating the title. */
  eyebrow?: ReactNode;
  description?: ReactNode;
  /**
   * "View all" link slot, right-aligned. Pass an `Anchor`/`Link` already
   * labelled — this component does not invent link text.
   */
  action?: ReactNode;
  /** Heading level. Defaults to `h2`; use `h3` inside an already-titled section. */
  level?: 2 | 3;
  className?: string;
  id?: string;
}

/**
 * Section title with an optional eyebrow, description and trailing action.
 *
 * Never auto-appends the entity name (`Facilities at …`), which the competitor
 * research identified as the pattern that makes pages read as machine-generated.
 */
export function SectionHeading({
  title,
  eyebrow,
  description,
  action,
  level = 2,
  className,
  id,
}: SectionHeadingProps) {
  const Heading = level === 2 ? 'h2' : 'h3';

  return (
    <div id={id} className={cx(classes.root, className)}>
      <div className={classes.text}>
        {eyebrow ? <p className={classes.eyebrow}>{eyebrow}</p> : null}
        <Heading className={classes.title}>{title}</Heading>
        {description ? <p className={classes.description}>{description}</p> : null}
      </div>

      {action ? <div className={classes.action}>{action}</div> : null}
    </div>
  );
}
