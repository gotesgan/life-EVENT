import type { ReactNode } from 'react';
import { cx } from './cx';
import classes from './Prose.module.css';

export interface ProseProps {
  children: ReactNode;
  /** `body` for editorial pages; `secondary` for a denser panel. */
  size?: 'body' | 'secondary';
  /** Widens the measure for a short panel that is not long-form copy. */
  measure?: 'prose' | 'wide';
  as?: 'div' | 'section' | 'article';
  className?: string;
}

/**
 * Long-form copy.
 *
 * This exists so the editorial pages do not each re-invent a paragraph rhythm
 * out of Mantine `Stack` gaps, which is what produced four slightly different
 * measures on four pages that should read as one document family.
 *
 * It styles its *children* rather than offering a variant per element: a page
 * writes plain `<p>`, `<ul>`, `<strong>` and `<a>`, and the measure, the
 * leading, the list rhythm and the link treatment come from here. That keeps
 * the semantics (a real list is still a list) while the visual language stays
 * in one file. Prose never sets a heading size — headings belong to the page
 * outline and to `globals.css`.
 */
export function Prose({
  children,
  size = 'body',
  measure = 'prose',
  as: Tag = 'div',
  className,
}: ProseProps) {
  return (
    <Tag
      className={cx(
        classes.prose,
        size === 'secondary' && classes.secondary,
        measure === 'wide' && classes.wide,
        className,
      )}
    >
      {children}
    </Tag>
  );
}
