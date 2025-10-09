import React from "react";
import { GameDetails, Game, Team, Match } from "./types/detailsPersistentTypes";
import { useMemo } from "react";
import "./styles/seriesScoreboard.css";

interface SeriesScoreboardProps {
    gameDetails: GameDetails;
    selectedGameNumber: number;
    onGameSelect: (gameNumber: number) => void;
}

export function SeriesScoreboard({ gameDetails, selectedGameNumber, onGameSelect }: SeriesScoreboardProps) {
    const { match } = gameDetails.data.event;
    const { teams, games, strategy } = match;
    
    // Determine series information
    const seriesInfo = useMemo(() => {
        const bestOfCount = strategy.count;
        const winsToWin = Math.floor(bestOfCount / 2) + 1;
        
        // Calculate wins for each team using the result property
        const teamWins = teams.reduce((acc, team) => {
            acc[team.id] = team.result?.gameWins || 0;
            return acc;
        }, {} as Record<string, number>);
        
        // Get completed games with results
        const completedGames = games.filter(game => {
            const state = game.state.toLowerCase();
            return ["completed", "finished", "postgame", "post_game"].includes(state);
        });
        
        // Determine if series is complete
        const seriesWinner = teams.find(team => teamWins[team.id] >= winsToWin);
        const isSeriesComplete = !!seriesWinner;
        
        return {
            bestOfCount,
            winsToWin,
            teamWins,
            seriesWinner,
            isSeriesComplete,
            completedGames
        };
    }, [teams, games, strategy]);
    
    // Create game pills for display
    const gamePills = useMemo(() => {
        return games
            .filter(game => {
                const state = game.state.toLowerCase();
                // Only show games that have started or completed
                return !["unstarted", "not_started", "notstarted", "scheduled", "pending"].includes(state);
            })
            .sort((a, b) => a.number - b.number)
            .map(game => {
                const isActive = game.number === selectedGameNumber;
                const isLive = game.state === "inProgress" || game.state === "in_game";
                
                // Determine winning team for styling
                // For completed games, try to determine the winner
                // For live games, no winner yet
                let winningTeamIndex = null;
                const isCompleted = ["completed", "finished", "postgame", "post_game"].includes(game.state.toLowerCase());
                
                if (isCompleted) {
                    // Try to determine the winner by checking which team has more wins
                    // This is based on the assumption that the team result property gets updated after each game
                    const blueTeamInGame = game.teams.find(team => team.side === "blue");
                    const redTeamInGame = game.teams.find(team => team.side === "red");
                    
                    if (blueTeamInGame && redTeamInGame) {
                        const blueTeamResult = teams.find(t => t.id === blueTeamInGame.id);
                        const redTeamResult = teams.find(t => t.id === redTeamInGame.id);
                        
                        // We can't directly determine the winner from a single game's data
                        // So we'll use a heuristic: the team with the current higher win count
                        // likely won this game (assuming we process games in order)
                        if (blueTeamResult && redTeamResult) {
                            if (blueTeamResult.result?.gameWins > redTeamResult.result?.gameWins) {
                                winningTeamIndex = teams.findIndex(t => t.id === blueTeamResult.id);
                            } else if (redTeamResult.result?.gameWins > blueTeamResult.result?.gameWins) {
                                winningTeamIndex = teams.findIndex(t => t.id === redTeamResult.id);
                            }
                        }
                    }
                    
                    // Fallback to position-based logic if we can't determine the winner
                    if (winningTeamIndex === null || (winningTeamIndex !== 0 && winningTeamIndex !== 1)) {
                        winningTeamIndex = game.teams.findIndex(team => {
                            return team.side === "blue"; // Simplified fallback logic
                        });
                        
                        // Ensure the index is valid (0 or 1)
                        if (winningTeamIndex !== 0 && winningTeamIndex !== 1) {
                            winningTeamIndex = null;
                        }
                    }
                }
                
                return {
                    gameNumber: game.number,
                    gameId: game.id,
                    isActive,
                    isLive,
                    winningTeamIndex: winningTeamIndex >= 0 ? winningTeamIndex : null
                };
            });
    }, [games, selectedGameNumber]);
    
    return React.createElement('div', { className: "series-scoreboard" }, 
        // Team headers with logos and scores
        React.createElement('div', { className: "series-header" },
            // Blue team
            React.createElement('div', { className: "team-info blue-team" },
                React.createElement('img', {
                    src: teams[0]?.image,
                    alt: teams[0]?.name,
                    className: "team-logo"
                }),
                React.createElement('div', { className: "team-details" },
                    React.createElement('h3', { className: "team-name" }, teams[0]?.name),
                    React.createElement('div', { className: "team-code" }, teams[0]?.code)
                )
            ),
            
            // Series score
            React.createElement('div', { className: "series-score" },
                React.createElement('div', { className: "score-display" },
                    React.createElement('span', {
                        className: `team-score ${seriesInfo.seriesWinner?.id === teams[0]?.id ? 'winner' : ''}`
                    }, seriesInfo.teamWins[teams[0]?.id] || 0),
                    React.createElement('span', { className: "score-separator" }, "–"),
                    React.createElement('span', {
                        className: `team-score ${seriesInfo.seriesWinner?.id === teams[1]?.id ? 'winner' : ''}`
                    }, seriesInfo.teamWins[teams[1]?.id] || 0)
                ),
                React.createElement('div', { className: "series-format" }, `Best of ${seriesInfo.bestOfCount}`),
                seriesInfo.isSeriesComplete && React.createElement('div', { className: "series-status" }, "Series Complete")
            ),
            
            // Red team
            React.createElement('div', { className: "team-info red-team" },
                React.createElement('div', { className: "team-details" },
                    React.createElement('h3', { className: "team-name" }, teams[1]?.name),
                    React.createElement('div', { className: "team-code" }, teams[1]?.code)
                ),
                React.createElement('img', {
                    src: teams[1]?.image,
                    alt: teams[1]?.name,
                    className: "team-logo"
                })
            )
        ),
        
        // Game pills
        React.createElement('div', { className: "game-pills-container" },
            gamePills.map(pill =>
                React.createElement('button', {
                    key: pill.gameId,
                    className: `game-pill ${pill.isActive ? 'active' : ''} ${
                        pill.winningTeamIndex === 0 ? 'blue-win' : 
                        pill.winningTeamIndex === 1 ? 'red-win' : 
                        'no-winner'
                    } ${pill.isLive ? 'live' : ''}`,
                    onClick: () => onGameSelect(pill.gameNumber),
                    title: `Game ${pill.gameNumber}${pill.isLive ? ' - LIVE' : ''}`
                },
                    `G${pill.gameNumber}`,
                    pill.isLive && React.createElement('span', { className: "live-indicator" }, "●")
                )
            )
        )
    );
}