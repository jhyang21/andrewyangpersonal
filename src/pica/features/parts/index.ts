// Parts that more than one screen shares, built on the new kit and mascot.
// Each part with a side effect (analytics or the store) also has a `…View`
// with none, for the parts page at /kit/parts.

// Wayfinding
export { JourneyPath, type JourneyPathProps } from "./JourneyPath";
export { journeyPath, type JourneyPathModel } from "./journey-path-model";
export { DecisionMenu, type DecisionMenuProps } from "./DecisionMenu";
export { DECISION_MENU, decisionMenuActions, hasMenu, type DecisionMenuActions } from "./decision-menu-model";

// Sheets
export {
  EVIDENCE_SHEET_ID,
  EvidenceSheet,
  EvidenceSheetView,
  type EvidenceSheetProps,
  type EvidenceSheetViewProps,
} from "./EvidenceSheet";
export { END_SHEET, EndDecisionSheet, type EndDecisionSheetProps } from "./EndDecisionSheet";

// Ending a decision
export { DECLINE_REASONS_HEADING, DeclineReasons, type DeclineReasonsProps } from "./DeclineReasons";
export {
  RETURN_CHECK,
  ReturnCheck,
  ReturnCheckView,
  returnCheckText,
  type ReturnCheckProps,
  type ReturnCheckViewProps,
} from "./ReturnCheck";

// Notices
export {
  ErrorNotice,
  ErrorNoticeView,
  ErrorState,
  ErrorStateView,
  RETRY_LABEL,
  type ErrorNoticeProps,
  type ErrorNoticeViewProps,
  type ErrorPlace,
  type ErrorStateProps,
  type ErrorStateViewProps,
} from "./ErrorNotice";
export { STALE_BANNER, StaleBanner, type StaleBannerProps } from "./StaleBanner";
export {
  STORAGE_NOTICE,
  StorageNotice,
  StorageNoticeView,
  type StorageNoticeViewProps,
  type StorageProblem,
} from "./StorageNotice";

// Needs
export { CanvasItemEditor, type CanvasItemEditorProps } from "./CanvasItemEditor";
export {
  EDITOR,
  editButtonId,
  editorLabels,
  editorSave,
  focusAfterRemove,
  type EditorSave,
} from "./canvas-item-model";
export { placeFocusAfterRemove, type RemovedFrom } from "./canvas-item-focus";
