import type {
  ActionName,
  ActionResultMap,
  CreateCanvasInput,
  CreateCardInput,
  CreateFrameInput,
  CreateWatchBotInput,
  FullscreenFrameInput,
  GetCanvasStateInput,
  GetWatchBotStatusInput,
  MoveCardInput,
  MoveFrameInput,
  PauseWatchBotInput,
  RenameCanvasInput,
  ResizeCardInput,
  ResizeFrameInput,
  ResumeWatchBotInput,
  SetCardFrameInput,
  SwitchCanvasInput,
  UpdateCanvasViewportInput,
  UpdateCardInput,
  UpdateFrameInput,
  UpdateWatchBotInput,
} from "@openbento/domain";

/**
 * Catalog input map. UI, the temporary adapter, and tests share this.
 * Do not invent parallel UI request types.
 */
export type ActionInputByName = {
  createCanvas: CreateCanvasInput;
  renameCanvas: RenameCanvasInput;
  switchCanvas: SwitchCanvasInput;
  updateCanvasViewport: UpdateCanvasViewportInput;
  createCard: CreateCardInput;
  updateCard: UpdateCardInput;
  moveCard: MoveCardInput;
  resizeCard: ResizeCardInput;
  setCardFrame: SetCardFrameInput;
  createFrame: CreateFrameInput;
  updateFrame: UpdateFrameInput;
  moveFrame: MoveFrameInput;
  resizeFrame: ResizeFrameInput;
  createWatchBot: CreateWatchBotInput;
  updateWatchBot: UpdateWatchBotInput;
  pauseWatchBot: PauseWatchBotInput;
  resumeWatchBot: ResumeWatchBotInput;
  getCanvasState: GetCanvasStateInput;
  getWatchBotStatus: GetWatchBotStatusInput;
  fullscreenFrame: FullscreenFrameInput;
};

export type CatalogCall<N extends ActionName = ActionName> = {
  [K in N]: { name: K; input: ActionInputByName[K] };
}[N];

export type CatalogResult<N extends ActionName> = ActionResultMap[N];
