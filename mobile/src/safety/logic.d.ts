export type NsfwClass = "unknown" | "clean" | "sexy" | "explicit";
export type FaceClass = "unknown" | "present" | "absent";
export type SafetyAction = "none" | "suspicion" | "confirmed";

export type SafetyScores = { porn: number; hentai: number; sexy: number };

export type SafetyVerdict = {
  face: FaceClass;
  nsfw: NsfwClass;
  scores?: SafetyScores;
  model?: string;
};

export type SafetySession = {
  window: NsfwClass[];
  faceAbsent: number;
  suspicionLatched: boolean;
  confirmedLatched: boolean;
};

export type FilterGate = { enabled: boolean; confirmPending: boolean };

export type SafetyLogRecord = {
  type: "safety_log";
  log_only: true;
  reason: "explicit_shadow";
  target_user_id: string;
  model: string;
  model_ready: boolean;
  face: string;
  nsfw: string;
  window: string[];
  scores?: SafetyScores;
  ts: number;
};

export type SafetyDetector = {
  id: string;
  requested: string;
  ready: boolean;
  classify(
    frame: { width: number; height: number; rgbBase64?: string } | null
  ): Promise<SafetyVerdict>;
};

export const FACE_ABSENT_SUSPICION: number;
export const FACE_HINT_AFTER_MS: number;

export type FaceWatch = { absentSince: number | null; showHint: boolean };

export function createFaceWatch(): FaceWatch;
export function pushFaceSample(
  watch: FaceWatch | null | undefined,
  face: string | null | undefined,
  nowMs: number
): { watch: FaceWatch; showHint: boolean; blocked: false };
export function faceForSelfCheck(
  detectorReady: boolean,
  face: string | null | undefined
): FaceClass;
export function deliverSafetyLog(
  record: SafetyLogRecord | null | undefined,
  opts?: { accept?: boolean; send?: (record: SafetyLogRecord) => void }
): { sent: boolean; reason: string };
export function classifyScores(scores: Partial<SafetyScores> | null | undefined): NsfwClass;
export function createSafetySession(): SafetySession;
export function pushVerdict(
  session: SafetySession | null | undefined,
  verdict: Partial<SafetyVerdict> | null | undefined
): { session: SafetySession; action: SafetyAction };
export function safetyFilterEnabled(stored: boolean | null | undefined): boolean;
export function beginDisableFilter(): FilterGate;
export function confirmDisableFilter(): FilterGate;
export function cancelDisableFilter(): FilterGate;
export const HUB_ACCEPTS_SAFETY_LOG: boolean;
export function buildSafetyLog(input: {
  targetUserId?: string;
  model?: string;
  modelReady?: boolean;
  face?: string;
  nsfw?: string;
  window?: string[];
  scores?: Partial<SafetyScores>;
  ts?: number;
}): SafetyLogRecord;
export function createSafetyDetector(mode?: string): SafetyDetector;
