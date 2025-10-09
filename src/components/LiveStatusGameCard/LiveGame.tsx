import './styles/playerStatusStyle.css'

import {
    getGameDetails,
} from "../../utils/LoLEsportsAPI";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GameMetadata, Frame as FrameWindow } from "./types/windowLiveTypes";
import { ReactComponent as Loading } from "../../assets/images/loading.svg";
import { PlayersTable } from "./PlayersTable";
import { Frame as FrameDetails } from "./types/detailsLiveTypes";
import { GameDetails } from "./types/detailsPersistentTypes";
import { useParams } from "react-router-dom";
import { useFrameIndex } from "./useFrameIndex";
import { TimelineScrubber } from "./TimelineScrubber";
import { SeriesScoreboard } from "./SeriesScoreboard";

export function LiveGame() {
    const [gameData, setGameData] = useState<GameDetails>();
    const [selectedGameNumber, setSelectedGameNumber] = useState<number>();
    const [selectedGameId, setSelectedGameId] = useState<string>();

    const { gameid } = useParams<{ gameid: string }>();
    const matchId = gameid || "";

    // Use our new frame index hook for frame management
    const {
        currentWindow,
        currentDetails,
        currentMetadata,
        timestamps,
        hasFirstFrame,
        isBackfilling,
        isLive,
        isFinal,
        selectedTimestamp,
        goLive,
        setPlaybackByEpoch,
    } = useFrameIndex(selectedGameId || "");

    const selectedGameState = useMemo(() => {
        if (!gameData || selectedGameNumber === undefined) return undefined;
        const selected = gameData.data.event.match.games.find(
            (g) => g.number === selectedGameNumber
        );
        return selected?.state;
    }, [gameData, selectedGameNumber]);

    const isUpcomingGame = useMemo(() => {
        if (!selectedGameState) return false;
        const value = selectedGameState.toLowerCase();
        return ["unstarted", "not_started", "notstarted", "scheduled", "pending"].includes(
            value
        );
    }, [selectedGameState]);

    const resetFrames = useCallback(() => {
        // Frame management is now handled by useFrameIndex hook
    }, []);

    useEffect(() => {
        if (!matchId) {
            setGameData(undefined);
            setSelectedGameNumber(undefined);
            setSelectedGameId(undefined);
            resetFrames();
            return;
        }

        let isMounted = true;

        resetFrames();
        setGameData(undefined);
        setSelectedGameNumber(undefined);
        setSelectedGameId(undefined);

        getGameDetails(matchId)
            .then((response) => {
                if (!isMounted) return;

                const details: GameDetails | undefined = response.data;
                if (!details) return;

                setGameData(details);
                const games = details.data.event.match.games ?? [];
                if (!games.length) return;

                const inProgress =
                    games.find((g) => g.state === "inProgress") ??
                    games.find((g) => g.state === "in_game");
                const latestCompleted = [...games]
                    .reverse()
                    .find((g) => {
                        const state = (g.state ?? "").toLowerCase();
                        return ["completed", "finished", "postgame", "post_game"].includes(
                            state
                        );
                    });
                const fallback = games[0];
                const defaultGame = inProgress ?? latestCompleted ?? fallback;

                if (defaultGame) {
                    setSelectedGameNumber(defaultGame.number);
                    setSelectedGameId(defaultGame.id);
                }
            })
            .catch(() => {});

        return () => {
            isMounted = false;
        };
    }, [matchId, resetFrames]);

    // Frame fetching is now handled by the useFrameIndex hook

    const handleGameSelection = useCallback(
        (gameNumber: number) => {
            if (!gameData) return;
            if (gameNumber === selectedGameNumber) return;

            const targeted = gameData.data.event.match.games.find(
                (g) => g.number === gameNumber
            );
            if (!targeted) return;

            setSelectedGameNumber(targeted.number);
            setSelectedGameId(targeted.id);
        },
        [gameData, selectedGameNumber]
    );

    // Replace the old game selector with the new SeriesScoreboard
    const seriesScoreboard = useMemo(() => {
        if (!gameData || selectedGameNumber === undefined) return null;
        return (
            <SeriesScoreboard
                gameDetails={gameData}
                selectedGameNumber={selectedGameNumber}
                onGameSelect={handleGameSelection}
            />
        );
    }, [gameData, selectedGameNumber, handleGameSelection]);

    // Use metadata from the hook
    const metadata = currentMetadata;

    return (
        <div>
            {/* Series Scoreboard */}
            {seriesScoreboard}

            {/* Timeline Scrubber */}
            {selectedGameId && (
                <TimelineScrubber
                    timestamps={timestamps}
                    value={selectedTimestamp}
                    onChange={setPlaybackByEpoch}
                    onLive={goLive}
                    disabled={!hasFirstFrame}
                    isBackfilling={isBackfilling}
                />
            )}

            {/* Content */}
            {currentWindow !== undefined &&
            currentDetails !== undefined &&
            metadata !== undefined &&
            gameData !== undefined ? (
                <PlayersTable
                    lastFrameWindow={currentWindow}
                    lastFrameDetails={currentDetails}
                    gameMetadata={metadata}
                    gameDetails={gameData}
                    isLive={isLive}
                    isFinal={isFinal}
                />
            ) : isUpcomingGame ? (
                <div className="loading-game-container">
                    <span>Selected game has not started yet.</span>
                </div>
            ) : (
                <div className="loading-game-container">
                    <Loading className="loading-game-image" />
                </div>
            )}
        </div>
    );
}
