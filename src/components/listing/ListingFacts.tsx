import type { ListingAttributeGroupView } from '@/server/dto/listing.dto';
import classes from './ListingFacts.module.css';

export interface ListingFact {
  label: string;
  value: string;
}

export interface ListingFactsProps {
  /** The listing's own attributes, already formatted by the DTO. */
  groups: readonly ListingAttributeGroupView[];
  /**
   * Facts the profile computes itself — capacity, event types — rendered ahead
   * of the attributes so the most decision-relevant numbers come first.
   */
  extras?: readonly ListingFact[];
  /** How many rows before the full attribute list further down the page. */
  max?: number;
}

/**
 * The at-a-glance fact strip near the top of a profile.
 *
 * It reads only attributes the business actually recorded: there are no "not
 * specified" filler rows and no invented values, because a missing attribute is
 * information too — the full list below simply omits it. Each label is a real
 * `<dt>` so the pair is announced together by assistive technology.
 */
export function ListingFacts({ groups, extras = [], max = 8 }: ListingFactsProps) {
  const attributes: ListingFact[] = groups.flatMap((group) =>
    group.attributes.map((attribute) => ({
      label: attribute.label,
      value: attribute.value,
    })),
  );

  const facts = [...extras, ...attributes].slice(0, max);
  if (facts.length === 0) return null;

  return (
    <dl className={classes.grid}>
      {facts.map((fact, index) => (
        <div key={`${fact.label}-${index}`} className={classes.fact}>
          <dt className={classes.label}>{fact.label}</dt>
          <dd className={classes.value}>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
