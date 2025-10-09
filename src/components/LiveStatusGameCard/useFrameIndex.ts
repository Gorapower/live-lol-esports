import { useState, useEffect, useCallback, useRef } from "react";
import { Frame as FrameWindow, GameMetadata } from "./types/windowLiveTypes";
import { Frame as FrameDetails } from "./types/detailsLiveTypes";
import {
  getLiveWindowGame,
  getLiveDetailsGame,
  getISODateMultiplyOf10,
} from "../../utils/LoLEsportsAPI";
import {
  roundToPrevious10s,
  toISO,
  toEpochMillis,
  findClosestTimestampIndex,
} from "../../utils/timestampUtils";

interface FrameIndexState {
  framesWindow: Map<number, FrameWindow>;
  framesDetails: Map<number, FrameDetails>;
  orderedTimestamps: number[];
  hasFirstFrame: boolean;
  isBackfilling: boolean;
  livePointer: number;
  playbackPointer: number | null;
  metadata: GameMetadata | undefined;
}

interface FrameIndexReturn {
  currentWindow: FrameWindow | undefined;
  currentDetails: FrameDetails | undefined;
  currentMetadata: GameMetadata | undefined;
  timestamps: number[];
  hasFirstFrame: boolean;
  isBackfilling: boolean;
  isLive: boolean;
  selectedTimestamp: number | null;
  currentTimestamp: number | null;
  goLive: () => void;
  setPlaybackByEpoch: (epoch: number) => void;
}

interface MergeResult {
  changed: boolean;
  addedEarlier: boolean;
  addedLater: boolean;
  hasFramesAfter: boolean;
}

const BACKFILL_STEP_MS = 10_000;
const BACKFILL_DELAY_MS = 200;
const BACKFILL_RETRY_DELAY_MS = 1_000;
const LIVE_POLL_INTERVAL_MS = 500;

const createInitialState = (): FrameIndexState => ({
  framesWindow: new Map(),
  framesDetails: new Map(),
  orderedTimestamps: [],
  hasFirstFrame: false,
  isBackfilling: false,
  livePointer: -1,
  playbackPointer: null,
  metadata: undefined,
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useFrameIndex(gameId: string): FrameIndexReturn {
  const [state, setState] = useState<FrameIndexState>(() => createInitialState());
  const stateRef = useRef<FrameIndexState>(state);

  const setFrameState = useCallback(
    (updater: (prev: FrameIndexState) => FrameIndexState) => {
      setState((prev) => {
        const next = updater(prev);
        stateRef.current = next;
        return next;
      });
    },
    []
  );

  const isMountedRef = useRef(true);
  const backfillRunningRef = useRef(false);
  const backfillStartedRef = useRef(false);
  const cancelBackfillRef = useRef(false);
  const backfillCursorRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cancelBackfillRef.current = true;
      backfillRunningRef.current = false;
      backfillStartedRef.current = false;
      backfillCursorRef.current = null;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  const mergeFrames = useCallback(
    (
      windowFrames: FrameWindow[],
      detailFrames: FrameDetails[],
      metadata?: GameMetadata
    ): MergeResult => {
      let changed = false;
      let addedEarlier = false;
      let addedLater = false;
      let hasFramesAfter = stateRef.current.orderedTimestamps.length > 0;

      const hasPayload = windowFrames.length > 0 || detailFrames.length > 0;
      const shouldSetMetadata = Boolean(metadata && !stateRef.current.metadata);

      if (!hasPayload && !shouldSetMetadata) {
        return { changed: false, addedEarlier: false, addedLater: false, hasFramesAfter };
      }

      setFrameState((prev) => {
        const nextWindow = new Map(prev.framesWindow);
        const nextDetails = new Map(prev.framesDetails);
        const timestampSet = new Set(prev.orderedTimestamps);

        windowFrames.forEach((frame) => {
          const epoch = toEpochMillis(frame.rfc460Timestamp);
          nextWindow.set(epoch, frame);
          timestampSet.add(epoch);
        });

        detailFrames.forEach((frame) => {
          const epoch = toEpochMillis(frame.rfc460Timestamp);
          nextDetails.set(epoch, frame);
          timestampSet.add(epoch);
        });

        const sortedTimestamps = Array.from(timestampSet).sort((a, b) => a - b);
        hasFramesAfter = sortedTimestamps.length > 0;

        let metadataToUse = prev.metadata;
        let metadataMutated = false;
        if (!metadataToUse && metadata) {
          metadataToUse = metadata;
          metadataMutated = true;
        }

        let timestampsChanged =
          sortedTimestamps.length !== prev.orderedTimestamps.length;
        if (!timestampsChanged) {
          for (let i = 0; i < sortedTimestamps.length; i += 1) {
            if (sortedTimestamps[i] !== prev.orderedTimestamps[i]) {
              timestampsChanged = true;
              break;
            }
          }
        }

        if (!hasPayload && !timestampsChanged && !metadataMutated) {
          changed = false;
          addedEarlier = false;
          addedLater = false;
          return prev;
        }

        const prevEarliest =
          prev.orderedTimestamps.length > 0 ? prev.orderedTimestamps[0] : null;
        const prevLatest =
          prev.orderedTimestamps.length > 0
            ? prev.orderedTimestamps[prev.orderedTimestamps.length - 1]
            : null;

        const livePointer =
          sortedTimestamps.length > 0 ? sortedTimestamps.length - 1 : -1;

        let playbackPointer = prev.playbackPointer;
        if (prev.playbackPointer !== null) {
          const prevPointerTs = prev.orderedTimestamps[prev.playbackPointer];
          if (prevPointerTs !== undefined) {
            const newIndex = sortedTimestamps.indexOf(prevPointerTs);
            playbackPointer = newIndex === -1 ? null : newIndex;
          } else {
            playbackPointer = null;
          }
        }

        changed = true;
        addedEarlier =
          sortedTimestamps.length > 0 &&
          (prevEarliest === null || sortedTimestamps[0] < prevEarliest);
        addedLater =
          sortedTimestamps.length > 0 &&
          (prevLatest === null ||
            sortedTimestamps[sortedTimestamps.length - 1] > prevLatest);

        return {
          ...prev,
          framesWindow: nextWindow,
          framesDetails: nextDetails,
          orderedTimestamps: sortedTimestamps,
          livePointer,
          playbackPointer,
          metadata: metadataToUse,
        };
      });

      return { changed, addedEarlier, addedLater, hasFramesAfter };
    },
    [setFrameState]
  );

  const markHasFirstFrame = useCallback(() => {
    setFrameState((prev) => {
      if (prev.hasFirstFrame) {
        if (prev.isBackfilling) {
          return { ...prev, isBackfilling: false };
        }
        return prev;
      }
      return { ...prev, hasFirstFrame: true, isBackfilling: false };
    });
    backfillCursorRef.current = null;
  }, [setFrameState]);

  const fetchChunk = useCallback(
    async (startingTime: string) => {
      if (!gameId) {
        return { windowFrames: [] as FrameWindow[], detailFrames: [] as FrameDetails[], metadata: undefined as GameMetadata | undefined };
      }

      const [windowResponse, detailsResponse] = await Promise.all([
        getLiveWindowGame(gameId, startingTime),
        getLiveDetailsGame(gameId, startingTime),
      ]);

      const windowFrames: FrameWindow[] = windowResponse.data?.frames ?? [];
      const detailFrames: FrameDetails[] = detailsResponse.data?.frames ?? [];
      const metadata: GameMetadata | undefined = windowResponse.data?.gameMetadata;

      return { windowFrames, detailFrames, metadata };
    },
    [gameId]
  );

  const runBackfill = useCallback(async () => {
    if (!gameId) return;
    if (backfillRunningRef.current) return;

    backfillRunningRef.current = true;
    cancelBackfillRef.current = false;

    setFrameState((prev) =>
      prev.isBackfilling ? prev : { ...prev, isBackfilling: true }
    );

    try {
      while (isMountedRef.current && !cancelBackfillRef.current) {
        const currentState = stateRef.current;
        if (currentState.hasFirstFrame) {
          break;
        }
        if (currentState.orderedTimestamps.length === 0) {
          break;
        }

        if (backfillCursorRef.current === null) {
          const anchorTs = currentState.orderedTimestamps[0];
          if (anchorTs === undefined) {
            break;
          }
          const roundedAnchor = roundToPrevious10s(new Date(anchorTs)).getTime();
          backfillCursorRef.current = roundedAnchor;
        }

        const targetCursor = backfillCursorRef.current - BACKFILL_STEP_MS;
        backfillCursorRef.current = targetCursor;

        if (!Number.isFinite(targetCursor)) {
          markHasFirstFrame();
          break;
        }

        const targetTime = toISO(new Date(targetCursor));

        let chunk;
        try {
          chunk = await fetchChunk(targetTime);
        } catch {
          if (!isMountedRef.current || cancelBackfillRef.current) {
            break;
          }
          await delay(BACKFILL_RETRY_DELAY_MS);
          continue;
        }

        const { windowFrames, detailFrames, metadata } = chunk;

        if (windowFrames.length === 0 && detailFrames.length === 0) {
          markHasFirstFrame();
          break;
        }

        const mergeResult = mergeFrames(windowFrames, detailFrames, metadata);

        if (!mergeResult.changed) {
          await delay(BACKFILL_DELAY_MS);
          continue;
        }

        if (mergeResult.addedEarlier) {
          const updatedState = stateRef.current;
          const updatedAnchor = updatedState.orderedTimestamps[0];
          if (updatedAnchor !== undefined) {
            backfillCursorRef.current = roundToPrevious10s(
              new Date(updatedAnchor)
            ).getTime();
          }
        }

        await delay(BACKFILL_DELAY_MS);
      }
    } finally {
      backfillRunningRef.current = false;
      backfillStartedRef.current = stateRef.current.hasFirstFrame;
      setFrameState((prev) =>
        prev.isBackfilling ? { ...prev, isBackfilling: false } : prev
      );
    }
  }, [fetchChunk, gameId, markHasFirstFrame, mergeFrames, setFrameState]);

  const maybeStartBackfill = useCallback(() => {
    if (
      backfillStartedRef.current ||
      backfillRunningRef.current ||
      cancelBackfillRef.current ||
      !isMountedRef.current
    ) {
      return;
    }

    const current = stateRef.current;
    if (current.hasFirstFrame || current.orderedTimestamps.length === 0) {
      return;
    }

    backfillStartedRef.current = true;
    void runBackfill();
  }, [runBackfill]);

  const startLivePolling = useCallback(() => {
    if (!gameId) {
      return;
    }

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    const poll = async () => {
      if (!isMountedRef.current || cancelBackfillRef.current) {
        return;
      }

      try {
        const { windowFrames, detailFrames, metadata } = await fetchChunk(
          getISODateMultiplyOf10()
        );
        const mergeResult = mergeFrames(windowFrames, detailFrames, metadata);
        if (mergeResult.hasFramesAfter) {
          maybeStartBackfill();
        }
      } catch {
        // swallow errors; next poll will retry
      }
    };

    void poll();
    pollIntervalRef.current = setInterval(poll, LIVE_POLL_INTERVAL_MS);
  }, [fetchChunk, gameId, maybeStartBackfill, mergeFrames]);

  useEffect(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    cancelBackfillRef.current = true;
    backfillRunningRef.current = false;
    backfillCursorRef.current = null;

    if (!gameId) {
      backfillStartedRef.current = false;
      setFrameState(() => createInitialState());
      return;
    }

    cancelBackfillRef.current = false;
    backfillStartedRef.current = false;
    backfillCursorRef.current = null;
    setFrameState(() => createInitialState());

    const initialize = async () => {
      try {
        const { windowFrames, detailFrames, metadata } = await fetchChunk(
          getISODateMultiplyOf10()
        );
        const mergeResult = mergeFrames(windowFrames, detailFrames, metadata);
        if (mergeResult.hasFramesAfter) {
          maybeStartBackfill();
        }
      } catch {
        // ignore errors; live polling will continue attempts
      } finally {
        startLivePolling();
      }
    };

    void initialize();

    return () => {
      cancelBackfillRef.current = true;
      backfillRunningRef.current = false;
      backfillCursorRef.current = null;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [fetchChunk, gameId, maybeStartBackfill, mergeFrames, setFrameState, startLivePolling]);

  const goLive = useCallback(() => {
    setFrameState((prev) => {
      if (prev.playbackPointer === null) {
        return prev;
      }
      return { ...prev, playbackPointer: null };
    });
  }, [setFrameState]);

  const setPlaybackByEpoch = useCallback(
    (epoch: number) => {
      setFrameState((prev) => {
        if (prev.orderedTimestamps.length === 0) {
          return prev;
        }
        const index = findClosestTimestampIndex(prev.orderedTimestamps, epoch);
        if (index < 0) {
          return prev;
        }
        if (prev.playbackPointer === index) {
          return prev;
        }
        return { ...prev, playbackPointer: index };
      });
    },
    [setFrameState]
  );

  const currentIndex =
    state.playbackPointer !== null ? state.playbackPointer : state.livePointer;
  const currentTimestamp =
    currentIndex >= 0 && currentIndex < state.orderedTimestamps.length
      ? state.orderedTimestamps[currentIndex]
      : null;

  const currentWindow =
    currentTimestamp !== null
      ? state.framesWindow.get(currentTimestamp)
      : undefined;

  let currentDetails =
    currentTimestamp !== null
      ? state.framesDetails.get(currentTimestamp)
      : undefined;

  if (!currentDetails && currentTimestamp !== null) {
    const previousTs =
      currentIndex - 1 >= 0 ? state.orderedTimestamps[currentIndex - 1] : undefined;
    const nextTs =
      currentIndex + 1 < state.orderedTimestamps.length
        ? state.orderedTimestamps[currentIndex + 1]
        : undefined;
    currentDetails =
      (previousTs !== undefined
        ? state.framesDetails.get(previousTs)
        : undefined) ??
      (nextTs !== undefined ? state.framesDetails.get(nextTs) : undefined);
  }

  const selectedTimestamp =
    state.playbackPointer !== null && state.playbackPointer >= 0
      ? state.orderedTimestamps[state.playbackPointer] ?? null
      : null;

  return {
    currentWindow,
    currentDetails,
    currentMetadata: state.metadata,
    timestamps: state.orderedTimestamps,
    hasFirstFrame: state.hasFirstFrame,
    isBackfilling: state.isBackfilling,
    isLive: state.playbackPointer === null,
    selectedTimestamp,
    currentTimestamp,
    goLive,
    setPlaybackByEpoch,
  };
}
