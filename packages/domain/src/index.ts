export {
  ACTION_CATALOG,
  ACTION_CATALOG_LIST,
  ACTION_NAMES,
  actionInputForbidsOwnerId,
  type ActionInputMap,
  type ActionName,
  type ActionResultMap,
  type CreateCanvasInput,
  type CreateCardInput,
  type CreateFrameInput,
  type CreateWatchBotInput,
  type DomainAction,
  type FullscreenFrameInput,
  type GetCanvasStateInput,
  type GetWatchBotStatusInput,
  type JsonSchema,
  type MoveCardInput,
  type MoveFrameInput,
  type PauseWatchBotInput,
  type RenameCanvasInput,
  type ResizeCardInput,
  type ResizeFrameInput,
  type ResumeWatchBotInput,
  type SetCardFrameInput,
  type SwitchCanvasInput,
  type UpdateCanvasViewportInput,
  type UpdateCardInput,
  type UpdateFrameInput,
  type UpdateWatchBotInput,
} from "./actions";

export {
  assertSameCanvasMembership,
  canSetCardFrame,
  containsRect,
  rectArea,
  sameCanvasMembershipReason,
  selectSmallestContainingFrame,
  SameCanvasMembershipError,
  type FrameContainmentCandidate,
  type SameCanvasMembershipCode,
  type SameCanvasMembershipInput,
} from "./frames";

export {
  PAYLOAD_SCHEMA_ONE_OF,
  PAYLOAD_SCHEMAS,
  PROVENANCE_SCHEMA,
  isCardProvenance,
  isValidCardPayload,
  isValidNotePayload,
  isValidSourcePayload,
  matchesJsonSchema,
  typePayloadCouplingAllOf,
} from "./payloads";

export {
  cardTypeRequiresProvenance,
  isNoteCardType,
} from "./provenance";

export {
  WEBMCP_TOOL_NAMES,
  WEBMCP_TOOL_TO_ACTION,
  isWebMcpToolName,
  listWebMcpTools,
  type WebMcpToolDefinition,
  type WebMcpToolName,
} from "./webmcp";

export {
  applyCardFrameFromGeometry,
  createWebMcpRuntime,
  type WebMcpExecute,
  type WebMcpRuntime,
  type WebMcpToolEvent,
} from "./webmcp-runtime";

export { DomainError, isDomainError, type DomainErrorCode } from "./errors";

export {
  ActionExecutor,
  createActionExecutor,
  DEFAULT_CARD_SIZE,
  DEFAULT_VIEWPORT,
  type ActionExecutorDeps,
} from "./executor";

export {
  canvasFromRecord,
  canvasToRecord,
  cardFromRecord,
  cardToRecord,
  frameFromRecord,
  frameToRecord,
  watchBotEventFromRecord,
  watchBotFromRecord,
  watchBotToRecord,
} from "./mappers";

export type {
  CanvasRecord,
  CardRecord,
  FrameRecord,
  WatchBotEventRecord,
  WatchBotRecord,
} from "./schema";

export { InMemoryDomainStore, type DomainStore } from "./store";

export {
  CARD_TYPES,
  SOURCE_CARD_TYPES,
  SOURCE_TYPES,
  WATCHBOT_SOURCE_TYPES,
  WATCHBOT_STATUSES,
  type Actor,
  type AiSummaryPayload,
  type Canvas,
  type CanvasState,
  type Card,
  type CardPayload,
  type CardPayloadByType,
  type CardProvenance,
  type CardType,
  type ChartPayload,
  type DiscriminatedCardContent,
  type NotePayload,
  type SourceCardPayload,
  type TimelinePayload,
  type WatchBotStatusPayload,
  type Frame,
  type FrameFullscreenView,
  type OwnerId,
  type Point,
  type Rect,
  type Size,
  type SourceCardType,
  type SourceType,
  type Viewport,
  type WatchBot,
  type WatchBotEvent,
  type WatchBotEventKind,
  type WatchBotSourceType,
  type WatchBotStatus,
  type WatchBotStatusView,
} from "./types";
