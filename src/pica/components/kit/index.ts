// Controls
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from "./Button";
export { Chip, type ChipProps } from "./Chip";
export { IconButton, type IconButtonProps } from "./IconButton";
export { IntentInput, isSendKey, type IntentInputProps, type SendKeyEvent, type SubmitResult } from "./IntentInput";
export {
  SegmentedControl,
  segmentPanelId,
  segmentTabId,
  type SegmentOption,
  type SegmentedControlProps,
} from "./SegmentedControl";
export { TextArea, type TextAreaProps } from "./TextArea";
export { TextInput, type TextInputProps } from "./TextInput";

// Surfaces
export { Banner, BANNER_TONES, type BannerAction, type BannerProps, type BannerTone } from "./Banner";
export { Card, type CardProps } from "./Card";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { Sheet, trapTarget, type SheetProps } from "./Sheet";
export { Skeleton, SkeletonCard, type SkeletonProps } from "./Skeleton";

// Commerce
export { Price, formatMoney, otherVersionsText, type PriceProps } from "./Price";
export { ProductImage, type ProductImageProps } from "./ProductImage";
export { ProductSummary, type ProductSummaryProps } from "./ProductSummary";
export { FEW_REVIEWS, Rating, type RatingProps } from "./Rating";

// Trust
export {
  EVIDENCE,
  EVIDENCE_KINDS,
  EvidenceTag,
  evidenceHeading,
  evidenceLabel,
  type EvidenceTagProps,
} from "./EvidenceTag";
export { SOURCES, SourceTag, sourceLabel, type SourceTagProps } from "./SourceTag";

// Wayfinding
export { BottomBar, type BottomBarItem, type BottomBarProps } from "./BottomBar";
export {
  STAGES,
  StagePath,
  stageFacts,
  type DecisionResult,
  type StageCounts,
  type StageId,
  type StagePathProps,
} from "./StagePath";
export {
  EMPTY_SUMMARY,
  SummaryStrip,
  summaryParts,
  summaryStep,
  summaryText,
  type SummaryInput,
  type SummaryStripProps,
} from "./SummaryStrip";
export { useLand, type LandMotion } from "./useLand";

// Helpers
export { cn, isExternalHref } from "./cn";
export { contrastRatio, luminance } from "./contrast";
export { rovingIndex } from "./roving";
