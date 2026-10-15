/**
 * The UI primitive library.
 *
 * Pages compose these instead of hand-rolling Mantine styles. Names are stable
 * public API: import from `@/components/ui`.
 */
export { AspectImage, type AspectImageProps } from './AspectImage';
export { BrandMark, type BrandMarkProps, type BrandMarkSize } from './BrandMark';
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './Button';
export {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardMedia,
  CardTitle,
  type CardProps,
  type CardSectionProps,
  type CardTitleProps,
} from './Card';
export { CapacityTag, type CapacityTagProps, type CapacityTagSize } from './CapacityTag';
export {
  Container,
  type ContainerElement,
  type ContainerProps,
  type ContainerSize,
} from './Container';
export { cx, type ClassValue } from './cx';
export { DataTable, type DataTableColumn, type DataTableProps } from './DataTable';
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { ErrorState, type ErrorStateProps } from './ErrorState';
export { FilterChip, type FilterChipProps } from './FilterChip';
export {
  NumberInput,
  Select,
  Textarea,
  TextInput,
  type AppNumberInputProps,
  type AppSelectProps,
  type AppTextareaProps,
  type AppTextInputProps,
} from './Inputs';
export { MediaPlaceholder, type MediaPlaceholderProps, type MediaRatio } from './MediaPlaceholder';
export { PageHeader, type Breadcrumb, type PageHeaderProps } from './PageHeader';
export { Pagination, type PaginationProps } from './Pagination';
export { PriceTag, type PriceTagProps, type PriceTagSize } from './PriceTag';
export { Prose, type ProseProps } from './Prose';
export { SectionHeading, type SectionHeadingProps } from './SectionHeading';
export {
  FilterPanelSkeleton,
  ListingCardSkeleton,
  ListingDetailSkeleton,
  ListingGridSkeleton,
  TableSkeleton,
  type FilterPanelSkeletonProps,
  type ListingGridSkeletonProps,
  type SkeletonProps,
  type TableSkeletonProps,
} from './Skeletons';
export {
  StatusBadge,
  StatusBadge as Badge,
  type StatusBadgeProps,
  type StatusSize,
  type StatusTone,
  type StatusVariant,
} from './StatusBadge';
export {
  Surface,
  type SurfaceElement,
  type SurfacePadding,
  type SurfaceProps,
  type SurfaceRadius,
  type SurfaceTone,
} from './Surface';
export { ThemeToggle, type ThemeToggleProps, type ThemeToggleSize } from './ThemeToggle';

/**
 * Client-boundary `next/link`. Use this (never `next/link` directly) in any file
 * that passes a link component to a Client Component — see ClientLink.tsx for
 * why `next/link` cannot cross the boundary from a Server Component.
 */
export { default as ClientLink } from './ClientLink';
