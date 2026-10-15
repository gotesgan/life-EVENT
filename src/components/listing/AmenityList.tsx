import { IconCheck } from '@tabler/icons-react';
import classes from './AmenityList.module.css';

export interface AmenityListProps {
  amenities: ReadonlyArray<{ code: string; label: string; groupLabel: string | null }>;
  /**
   * Overrides the heading for the ungrouped bucket. Defaults to "Facilities",
   * which is what an amenity is on a venue page.
   */
  ungroupedLabel?: string;
}

/**
 * Amenities grouped by their own `groupLabel`.
 *
 * Commercial badges deliberately have no home here: the research found
 * "Assured"-style ribbons sitting between "Parking" and "Power backup", which
 * devalues the real facilities beside them. Trust markers get their own,
 * explained slot on the profile instead.
 */
export function AmenityList({ amenities, ungroupedLabel = 'Facilities' }: AmenityListProps) {
  if (amenities.length === 0) return null;

  const groups = new Map<string, Array<{ code: string; label: string }>>();
  for (const amenity of amenities) {
    const key = amenity.groupLabel ?? ungroupedLabel;
    const bucket = groups.get(key) ?? [];
    bucket.push({ code: amenity.code, label: amenity.label });
    groups.set(key, bucket);
  }

  return (
    <div className={classes.grid}>
      {[...groups.entries()].map(([label, items]) => (
        <div key={label} className={classes.group}>
          <h3 className={classes.groupLabel}>{label}</h3>
          <ul className={classes.list}>
            {items.map((item) => (
              <li key={item.code} className={classes.item}>
                <IconCheck className={classes.icon} size="1rem" stroke={1.5} aria-hidden />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
