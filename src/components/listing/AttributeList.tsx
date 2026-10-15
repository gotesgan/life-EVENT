import type { ListingAttributeGroupView } from '@/server/dto/listing.dto';
import classes from './AttributeList.module.css';

export interface AttributeListProps {
  groups: readonly ListingAttributeGroupView[];
}

/**
 * The full attribute list, as label/value rows.
 *
 * Rendered from real listing data only — a row exists because the business (or
 * an administrator) recorded that attribute, so there are no "not specified"
 * filler rows and no invented values. Values are pre-formatted by the DTO
 * (`formatAttributeValue`), so a date or an option label cannot be rendered two
 * different ways in two places.
 */
export function AttributeList({ groups }: AttributeListProps) {
  const populated = groups.filter((group) => group.attributes.length > 0);
  if (populated.length === 0) return null;

  return (
    <div>
      {populated.map((group, index) => (
        <div key={group.groupLabel ?? `group-${index}`} className={classes.group}>
          {group.groupLabel ? <h3 className={classes.groupLabel}>{group.groupLabel}</h3> : null}

          <dl className={classes.list}>
            {group.attributes.map((attribute) => (
              <div key={attribute.code} className={classes.row}>
                <dt className={classes.label}>{attribute.label}</dt>
                <dd className={classes.value}>{attribute.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
