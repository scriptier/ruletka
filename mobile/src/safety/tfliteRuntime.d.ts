export function createTfliteBackedDetector(): {
  id: string;
  requested: string;
  readonly ready: boolean;
  classify(frame: { width?: number; height?: number; rgbBase64?: string } | null): Promise<{
    face: string;
    nsfw: string;
    model: string;
    scores?: { porn: number; hentai: number; sexy: number };
  }>;
};

export function watchVideoFrames(
  getStream: () =>
    | {
        getVideoTracks?: () => {
          id?: string;
          remote?: boolean;
          _peerConnectionId?: number;
        }[];
      }
    | null
    | undefined
): {
  stop: () => void;
  latest: () => { rgbBase64: string; width: number; height: number } | null;
};
