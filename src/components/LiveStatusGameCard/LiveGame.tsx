import './styles/playerStatusStyle.css'

import {
    getGameDetails,
    getISODateMultiplyOf10,
    getLiveDetailsGame,
    getLiveWindowGame,
} from "../../utils/LoLEsportsAPI";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GameMetadata, Frame as FrameWindow } from "./types/windowLiveTypes";
import { ReactComponent as Loading } from "../../assets/images/loading.svg";
import { PlayersTable } from "./PlayersTable";
import { Frame as FrameDetails } from "./types/detailsLiveTypes";
import { GameDetails } from "./types/detailsPersistentTypes";
import { useParams } from "react-router-dom";

export function LiveGame() {
    const [lastFrameWindow, setLastFrameWindow] = useState<FrameWindow>();
    const [lastFrameDetails, setLastFrameDetails] = useState<FrameDetails>();
    const [gameData, setGameData] = useState<GameDetails>();
    const [metadata, setMetadata] = useState<GameMetadata>();
    const [selectedGameNumber, setSelectedGameNumber] = useState<number>();
    const [selectedGameId, setSelectedGameId] = useState<string>();

    const { gameid } = useParams<{ gameid: string }>();
    const matchId = gameid || "";

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
        setLastFrameWindow(undefined);
        setLastFrameDetails(undefined);
        setMetadata(undefined);
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

    useEffect(() => {
        if (!selectedGameId) {
            return;
        }

        resetFrames();

        let isMounted = true;

        const fetchWindow = () => {
            const date = getISODateMultiplyOf10();
            getLiveWindowGame(selectedGameId, date)
                .then((response) => {
                    if (!isMounted) return;
                    const frames = response.data.frames;
                    if (!Array.isArray(frames) || frames.length === 0) return;

                    setLastFrameWindow(frames[frames.length - 1]);
                    setMetadata(response.data.gameMetadata);
                })
                .catch(() => {});
        };

        const fetchDetails = () => {
            const date = getISODateMultiplyOf10();
            getLiveDetailsGame(selectedGameId, date)
                .then((response) => {
                    if (!isMounted) return;
                    const frames = response.data.frames;
                    if (!Array.isArray(frames) || frames.length === 0) return;

                    setLastFrameDetails(frames[frames.length - 1]);
                })
                .catch(() => {});
        };

        fetchWindow();
        fetchDetails();

        const windowIntervalID = setInterval(() => {
            fetchWindow();
            fetchDetails();
        }, 500);

        return () => {
            isMounted = false;
            clearInterval(windowIntervalID);
        };
    }, [selectedGameId, resetFrames]);

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

    const gameSelector = useMemo(() => {
        if (!gameData) return null;
        return (
            <div className="game-selector">
                {gameData.data.event.match.games.map((g) => (
                    <button
                        key={g.id}
                        className={`game-selector-button ${
                            g.number === selectedGameNumber ? "selected" : ""
                        }`}
                        onClick={() => handleGameSelection(g.number)}
                        title={`Game ${g.number} — ${g.state}`}
                    >
                        Game {g.number}
                        {g.state === "inProgress" || g.state === "in_game" ? " · LIVE" : ""}
                    </button>
                ))}
            </div>
        );
    }, [gameData, handleGameSelection, selectedGameNumber]);

    return (
        <div>
            {/* Game selector (series) */}
            {gameSelector}

            {/* Content */}
            {lastFrameWindow !== undefined &&
            lastFrameDetails !== undefined &&
            metadata !== undefined &&
            gameData !== undefined ? (
                <PlayersTable
                    lastFrameWindow={lastFrameWindow}
                    lastFrameDetails={lastFrameDetails}
                    gameMetadata={metadata}
                    gameDetails={gameData}
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
