import { Surface } from '@/components/ui/Surface';
import type { ListingSpaceView } from '@/server/dto/listing.dto';
import classes from './SpaceList.module.css';

/** Area is not money, so it gets a plain Indian-grouped number, not `₹`. */
const areaFormat = new Intl.NumberFormat('en-IN');

export interface SpaceListProps {
  spaces: readonly ListingSpaceView[];
}

/**
 * Named venue spaces.
 *
 * Indian venues rent named halls, and a flat listing produces wrong enquiries —
 * so each space carries its own seated/standing capacity, floor area and layout
 * options rather than being folded into one venue-level number.
 */
export function SpaceList({ spaces }: SpaceListProps) {
  if (spaces.length === 0) return null;

  return (
    <div className={classes.grid}>
      {spaces.map((space) => (
        <Surface key={space.id} as="article" tone="raised" padding="md" className={classes.space}>
          <h3 className={classes.name}>{space.name}</h3>

          {space.isIndoor || space.isOutdoor ? (
            <div className={classes.badges}>
              {space.isIndoor ? <span className={classes.badge}>Indoor</span> : null}
              {space.isOutdoor ? <span className={classes.badge}>Outdoor</span> : null}
            </div>
          ) : null}

          <dl className={classes.facts}>
            {space.capacitySeated ? (
              <div>
                <dt className={classes.factLabel}>Seated</dt>
                <dd className={classes.factValue}>{space.capacitySeated}</dd>
              </div>
            ) : null}
            {space.capacityStanding ? (
              <div>
                <dt className={classes.factLabel}>Standing</dt>
                <dd className={classes.factValue}>{space.capacityStanding}</dd>
              </div>
            ) : null}
            {space.areaSqft ? (
              <div>
                <dt className={classes.factLabel}>Area</dt>
                <dd className={classes.factValue}>{areaFormat.format(space.areaSqft)} sq ft</dd>
              </div>
            ) : null}
          </dl>

          {space.description ? <p className={classes.description}>{space.description}</p> : null}

          {space.layoutOptions.length > 0 ? (
            <ul className={classes.layouts}>
              {space.layoutOptions.map((layout) => (
                <li key={layout} className={classes.layout}>
                  {layout}
                </li>
              ))}
            </ul>
          ) : null}
        </Surface>
      ))}
    </div>
  );
}
