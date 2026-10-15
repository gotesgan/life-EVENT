import { IconCheck, IconX } from '@tabler/icons-react';
import { Surface } from '@/components/ui/Surface';
import type { ListingPackageView } from '@/server/dto/listing.dto';
import classes from './PackageList.module.css';

export interface PackageListProps {
  packages: readonly ListingPackageView[];
}

/**
 * Packages side by side so they can actually be compared.
 *
 * Inclusions and exclusions are separate lists with distinct icons *and* distinct
 * text, so "what is in this package" never depends on colour alone.
 */
export function PackageList({ packages }: PackageListProps) {
  if (packages.length === 0) return null;

  return (
    <div className={classes.grid}>
      {packages.map((pack) => (
        <Surface key={pack.id} as="article" tone="raised" padding="md" className={classes.card}>
          <div className={classes.head}>
            <h3 className={classes.name}>{pack.name}</h3>
            {pack.priceLabel ? <span className={classes.price}>{pack.priceLabel}</span> : null}
          </div>

          {pack.minGuests || pack.maxGuests ? (
            <p className={classes.guests}>
              {pack.minGuests && pack.maxGuests
                ? `For ${pack.minGuests}–${pack.maxGuests} guests`
                : pack.minGuests
                  ? `From ${pack.minGuests} guests`
                  : `Up to ${pack.maxGuests} guests`}
            </p>
          ) : null}

          {pack.description ? <p className={classes.description}>{pack.description}</p> : null}

          {pack.inclusions.length > 0 ? (
            <div>
              <p className={classes.listLabel}>Included</p>
              <ul className={classes.list}>
                {pack.inclusions.map((item) => (
                  <li key={item} className={classes.row}>
                    <IconCheck
                      className={`${classes.rowIcon} ${classes.included}`}
                      size="1rem"
                      stroke={1.5}
                      aria-hidden
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {pack.exclusions.length > 0 ? (
            <div>
              <p className={classes.listLabel}>Not included</p>
              <ul className={classes.list}>
                {pack.exclusions.map((item) => (
                  <li key={item} className={classes.row}>
                    <IconX
                      className={`${classes.rowIcon} ${classes.excluded}`}
                      size="1rem"
                      stroke={1.5}
                      aria-hidden
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Surface>
      ))}
    </div>
  );
}
