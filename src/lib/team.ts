/**
 * The leadership team shown on `/team`.
 *
 * Kept in one module rather than inline in the page so the portrait grid stays a
 * presentation concern: a name, role or photograph changes here and every
 * surface that reads the team picks it up. The photographs are pre-cropped to
 * the grid's 4:5 ratio under `public/media/team/`.
 */
export interface TeamMember {
  /** Stable key and image basename. */
  slug: string;
  name: string;
  role: string;
  /** One line on what the role owns — not a biography. */
  focus: string;
  image: {
    src: string;
    /** Describes the photograph, not the person's job. */
    alt: string;
  };
}

/**
 * Order follows how the team was introduced, not seniority: CEO, managing
 * partner, founder. A founder-first ordering is a design decision, so it should
 * be an explicit change here rather than an accident of the grid.
 */
export const TEAM_MEMBERS = [
  {
    slug: 'pratik-nachare',
    name: 'Pratik Nachare',
    role: 'CEO',
    focus:
      'Company direction, product and the standard the catalogue is held to — including what it refuses to publish.',
    image: {
      src: '/media/team/pratik-nachare.jpg',
      alt: 'Portrait of Pratik Nachare in a navy blazer over a black shirt.',
    },
  },
  {
    slug: 'ravindra-bohara',
    name: 'Ravindra Bohara',
    role: 'Managing Partner',
    focus:
      'Partnerships, and the event businesses that join the catalogue and keep its published details honest.',
    image: {
      src: '/media/team/ravindra-bohara.jpg',
      alt: 'Portrait of Ravindra Bohara in a blue blazer and a checked white shirt.',
    },
  },
  {
    slug: 'jyoti-solanke',
    name: 'Jyoti Solanke',
    role: 'Founder',
    focus:
      'The idea Life Events started with, and the direction the company is still held to as it grows.',
    image: {
      src: '/media/team/jyoti-solanke.jpg',
      alt: 'Portrait of Jyoti Solanke in a dark green blazer and a cream top.',
    },
  },
] satisfies readonly TeamMember[];
