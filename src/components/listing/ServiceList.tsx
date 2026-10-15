import type { ListingServiceView } from '@/server/dto/listing.dto';
import classes from './ServiceList.module.css';

export interface ServiceListProps {
  services: readonly ListingServiceView[];
}

/** 90 → "1 hr 30 min"; 45 → "45 min"; 120 → "2 hours". */
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourLabel = `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  return rest === 0 ? hourLabel : `${hourLabel} ${rest} min`;
}

/**
 * What the business sells, with the price it published for each service.
 *
 * `priceLabel` is the DTO's formatted range; an unpriced service simply shows no
 * price rather than a placeholder, because the section heading already explains
 * that prices appear when published.
 */
export function ServiceList({ services }: ServiceListProps) {
  if (services.length === 0) return null;

  return (
    <ul className={classes.list}>
      {services.map((service) => (
        <li key={service.id} className={classes.item}>
          <div className={classes.head}>
            <h3 className={classes.name}>{service.name}</h3>
            {service.priceLabel ? (
              <span className={classes.price}>{service.priceLabel}</span>
            ) : null}
          </div>

          {service.description ? (
            <p className={classes.description}>{service.description}</p>
          ) : null}

          {service.durationMinutes ? (
            <p className={classes.meta}>Typically {formatDuration(service.durationMinutes)}</p>
          ) : null}

          {service.includes.length > 0 ? (
            <ul className={classes.includes}>
              {service.includes.map((item) => (
                <li key={item} className={classes.include}>
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
