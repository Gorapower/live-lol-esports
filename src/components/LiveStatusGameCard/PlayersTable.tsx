import './styles/playerStatusStyle.css'

import { GameMetadata } from "./types/windowLiveTypes";
import {GameDetails} from "./types/detailsPersistentTypes";

import {MiniHealthBar} from "./MiniHealthBar";
import React, {useEffect, useState} from "react";
import {toast} from 'react-toastify';
import {Frame as FrameDetails} from "./types/detailsLiveTypes";
import {Frame as FrameWindow, Participant as ParticipantWindow} from "./types/windowLiveTypes";

import {ReactComponent as TowerSVG} from '../../assets/images/tower.svg';
import {ReactComponent as BaronSVG} from '../../assets/images/baron.svg';
import {ReactComponent as KillSVG} from '../../assets/images/kill.svg';
import {ReactComponent as GoldSVG} from '../../assets/images/gold.svg';
import {ReactComponent as InhibitorSVG} from '../../assets/images/inhibitor.svg';

import {ReactComponent as OceanDragonSVG} from '../../assets/images/dragon-ocean.svg';
import {ReactComponent as InfernalDragonSVG} from '../../assets/images/dragon-infernal.svg';
import {ReactComponent as CloudDragonSVG} from '../../assets/images/dragon-cloud.svg';
import {ReactComponent as MountainDragonSVG} from '../../assets/images/dragon-mountain.svg';
import {ReactComponent as ElderDragonSVG} from '../../assets/images/dragon-elder.svg';
import {ReactComponent as HextechDragonSVG} from '../../assets/images/dragon-hextech.svg';
import {ReactComponent as ChemtechDragonSVG} from '../../assets/images/dragon-chemtech.svg';
import {ItemsDisplay} from "./ItemsDisplay";

import {LiveAPIWatcher} from "./LiveAPIWatcher";
import { CHAMPIONS_URL } from '../../utils/LoLEsportsAPI';

type Props = {
    lastFrameWindow: FrameWindow,
    lastFrameDetails: FrameDetails,
    gameMetadata: GameMetadata,
    gameDetails: GameDetails,
    isLive?: boolean, // Add isLive prop to control notifications
    isFinal?: boolean, // Add isFinal prop to indicate if the game is finished
}

export function PlayersTable({ lastFrameWindow, lastFrameDetails, gameMetadata, gameDetails, isLive = true, isFinal = false } : Props) {
    const [gameState, setGameState] = useState<GameState>(GameState[lastFrameWindow.gameState as keyof typeof GameState]);

    useEffect(() => {
        let currentGameState: GameState = GameState[lastFrameWindow.gameState as keyof typeof GameState]

        if(currentGameState !== gameState){
            setGameState(currentGameState);

            toast.info(`Game status updated: ${currentGameState.toUpperCase()}`, {
                position: "top-right",
                autoClose: 15000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
            });
        }
    }, [lastFrameWindow.gameState, gameState]);

    let blueTeam = gameDetails.data.event.match.teams[0];
    let redTeam = gameDetails.data.event.match.teams[1];

    const auxBlueTeam = blueTeam

    /*
        Sometimes teams remain wrong even after checking the last frame,
        in leagues like TCL, so we do this verification by name
    */
    const summonerName = gameMetadata.blueTeamMetadata.participantMetadata[0].summonerName.split(" ");

    if(redTeam.code.startsWith(summonerName[0])){ // We need to check only the first characters because academy teams use A, more in the tag but not in the names
        blueTeam = redTeam;
        redTeam = auxBlueTeam;
    }

    const winPrediction = getWinPrediction(
        lastFrameWindow.blueTeam.totalGold,
        lastFrameWindow.redTeam.totalGold
    );

    document.title = `${blueTeam.name} VS ${redTeam.name}`;

    return (
        <div className="status-live-game-card">

            

            <div className="status-live-game-card-content">
                <div className="live-game-stats-header">
                    <div className="live-game-stats-header-team-images">
                        <div className="blue-team">
                            <img src={blueTeam.image} alt={blueTeam.name}/>
                        </div>
                        <h3>{blueTeam.code}</h3>
                        <h1>
                            VS
                            <h3>{gameState.toUpperCase()}</h3>
                        </h1>
                        <h3>{redTeam.code}</h3>
                        <div className="red-team">
                            <img src={redTeam.image} alt={redTeam.name}/>
                        </div>
                    </div>
                    <div className="live-game-stats-header-status">
                        <div className="blue-team">
                            <div className="team-stats inhibitors">
                                <InhibitorSVG/>
                                {lastFrameWindow.blueTeam.inhibitors}
                            </div>
                            <div className="team-stats barons">
                                <BaronSVG/>
                                {lastFrameWindow.blueTeam.barons}
                            </div>
                            <div className="team-stats towers">
                                <TowerSVG/>
                                {lastFrameWindow.blueTeam.towers}
                            </div>
                            <div className="team-stats gold">
                                <GoldSVG/>
                                <span>
                                    {Number(lastFrameWindow.blueTeam.totalGold).toLocaleString('en-US')}
                                </span>
                            </div>
                            <div className="team-stats kills">
                                <KillSVG/>
                                {lastFrameWindow.blueTeam.totalKills}
                            </div>
                        </div>
                        <div className="red-team">
                            <div className="team-stats">
                                <InhibitorSVG/>
                                {lastFrameWindow.redTeam.inhibitors}
                            </div>
                            <div className="team-stats">
                                <BaronSVG/>
                                {lastFrameWindow.redTeam.barons}
                            </div>
                            <div className="team-stats">
                                <TowerSVG/>
                                {lastFrameWindow.redTeam.towers}
                            </div>
                            <div className="team-stats gold">
                                <GoldSVG/>
                                <span>
                                    {Number(lastFrameWindow.redTeam.totalGold).toLocaleString('en-US')}
                                </span>
                            </div>
                            <div className="team-stats">
                                <KillSVG/>
                                {lastFrameWindow.redTeam.totalKills}
                            </div>
                        </div>
                    </div>
                    <div className="win-probability-text">
                        <span className="win-probability-text-blue">
                            {winPrediction.bluePercent.toFixed(0)}%
                        </span>
                        <span className="win-probability-text-label">Win Prediction</span>
                        <span className="win-probability-text-red">
                            {winPrediction.redPercent.toFixed(0)}%
                        </span>
                    </div>
                    <div className="live-game-stats-header-gold">
                        <div className="blue-team" style={{flex: winPrediction.flexBlue}}/>
                        <div className="red-team" style={{flex: winPrediction.flexRed}}/>
                    </div>
                    <div className="live-game-stats-header-dragons">
                        <div className="blue-team">
                            {lastFrameWindow.blueTeam.dragons.map(dragon => (
                                getDragonSVG(dragon)
                            ))}
                        </div>
                        <div className="red-team">

                            {lastFrameWindow.redTeam.dragons.slice().reverse().map(dragon => (
                                getDragonSVG(dragon)
                            ))}
                        </div>
                    </div>
                </div>

                <table className="status-live-game-card-table">
                    <thead>
                    <tr>
                        <th className="table-top-row-champion" title="champion/team">
                            <span>{blueTeam.name.toUpperCase()}</span>
                        </th>
                        <th className="table-top-row-vida" title="life">
                            <span>HP</span>
                        </th>
                        <th className="table-top-row-items" title="items">
                            <span>ITEMS</span>
                        </th>
                        <th className="table-top-row" title="creep score">
                            <span>CS</span>
                        </th>
                        <th className="table-top-row player-stats-kda" title="kills">
                            <span>K</span>
                        </th>
                        <th className="table-top-row player-stats-kda" title="kills">
                            <span>D</span>
                        </th>
                        <th className="table-top-row player-stats-kda" title="kills">
                            <span>A</span>
                        </th>
                        <th className="table-top-row" title="gold">
                            <span>GOLD</span>
                        </th>
                        <th className="table-top-row" title="gold difference">
                            <span>+/-</span>
                        </th>
                    </tr>
                    </thead>
                    <tbody>
                    {lastFrameWindow.blueTeam.participants.map((player: ParticipantWindow) => {
                        let goldDifference = getGoldDifference(player, "blue", gameMetadata, lastFrameWindow);

                        return (
                            <tr>
                                <th>
                                    <div className="player-champion-info">
                                        <img
                                            src={`${CHAMPIONS_URL}${gameMetadata.blueTeamMetadata.participantMetadata[player.participantId - 1].championId}.png`}
                                            className="player-champion"
                                            alt="champion image"/>
                                        <span className=" player-champion-info-level">{player.level}</span>
                                        <div className=" player-champion-info-name">
                                            <span>{gameMetadata.blueTeamMetadata.participantMetadata[player.participantId - 1].championId}</span>
                                            <span
                                                className=" player-card-player-name">{gameMetadata.blueTeamMetadata.participantMetadata[player.participantId - 1].summonerName}</span>
                                        </div>
                                    </div>
                                </th>
                                <td>
                                    <MiniHealthBar currentHealth={player.currentHealth} maxHealth={player.maxHealth}/>
                                </td>
                                <td>
                                    <ItemsDisplay participantId={player.participantId - 1} lastFrame={lastFrameDetails}/>
                                </td>
                                <td>
                                    <div className=" player-stats">{player.creepScore}</div>
                                </td>
                                <td>
                                    <div className=" player-stats player-stats-kda">{player.kills}</div>
                                </td>
                                <td>
                                    <div className=" player-stats player-stats-kda">{player.deaths}</div>
                                </td>
                                <td>
                                    <div className=" player-stats player-stats-kda">{player.assists}</div>
                                </td>
                                <td>
                                    <div
                                        className=" player-stats">{Number(player.totalGold).toLocaleString('en-US')}</div>
                                </td>
                                <td>
                                    <div className={`player-stats player-gold-${goldDifference?.style}`}>{goldDifference.goldDifference}</div>
                                </td>
                            </tr>
                        )
                    })}
                    </tbody>
                </table>

                <table className="status-live-game-card-table">
                    <thead>
                    <tr>
                        <th className="table-top-row-champion" title="champion/team">
                            <span>{redTeam.name.toUpperCase()}</span>
                        </th>
                        <th className="table-top-row-vida" title="life">
                            <span>HP</span>
                        </th>
                        <th className="table-top-row-items" title="items">
                            <span>ITEMS</span>
                        </th>
                        <th className="table-top-row" title="creep score">
                            <span>CS</span>
                        </th>
                        <th className="table-top-row player-stats-kda" title="kills">
                            <span>K</span>
                        </th>
                        <th className="table-top-row player-stats-kda" title="kills">
                            <span>D</span>
                        </th>
                        <th className="table-top-row player-stats-kda" title="kills">
                            <span>A</span>
                        </th>
                        <th className="table-top-row" title="gold">
                            <span>GOLD</span>
                        </th>
                        <th className="table-top-row" title="gold difference">
                            <span>+/-</span>
                        </th>
                    </tr>
                    </thead>
                    <tbody>
                    {lastFrameWindow.redTeam.participants.map((player) => {
                        let goldDifference = getGoldDifference(player, "red", gameMetadata, lastFrameWindow);

                        return(
                            <tr>
                                <th>
                                    <div className="player-champion-info">
                                        <img
                                            src={`${CHAMPIONS_URL}${gameMetadata.redTeamMetadata.participantMetadata[player.participantId - 6].championId}.png`}
                                            className="player-champion"
                                            alt="champion image"/>
                                        <span className=" player-champion-info-level">{player.level}</span>
                                        <div className=" player-champion-info-name">
                                            <span>{gameMetadata.redTeamMetadata.participantMetadata[player.participantId - 6].championId}</span>
                                            <span className=" player-card-player-name">{gameMetadata.redTeamMetadata.participantMetadata[player.participantId - 6].summonerName}</span>
                                        </div>
                                    </div>
                                </th>
                                <td>
                                    <MiniHealthBar currentHealth={player.currentHealth} maxHealth={player.maxHealth}/>
                                </td>
                                <td>
                                    <ItemsDisplay participantId={player.participantId - 1} lastFrame={lastFrameDetails}/>
                                </td>
                                <td>
                                    <div className=" player-stats">{player.creepScore}</div>
                                </td>
                                <td>
                                    <div className=" player-stats player-stats-kda">{player.kills}</div>
                                </td>
                                <td>
                                    <div className=" player-stats player-stats-kda">{player.deaths}</div>
                                </td>
                                <td>
                                    <div className=" player-stats player-stats-kda">{player.assists}</div>
                                </td>
                                <td>
                                    <div className=" player-stats">{Number(player.totalGold).toLocaleString('en-US')}</div>
                                </td>
                                <td>
                                    <div className={`player-stats player-gold-${goldDifference?.style}`}>{goldDifference.goldDifference}</div>
                                </td>
                            </tr>
                        )
                    })}
                    </tbody>
                </table>
            </div>

            <LiveAPIWatcher gameMetadata={gameMetadata} lastFrameWindow={lastFrameWindow} blueTeam={blueTeam} redTeam={redTeam} isLive={isLive && !isFinal}/>
        </div>
    );
}

function getGoldDifference(player: ParticipantWindow, side: string, gameMetadata: GameMetadata, frame: FrameWindow) {
    if(6 > player.participantId) { // blue side
        const redPlayer = frame.redTeam.participants[player.participantId - 1];
        const goldResult = player.totalGold - redPlayer.totalGold;

        return {
            style: goldResult > 0 ? "positive" : "negative",
            goldDifference: goldResult > 0 ? "+" + Number(goldResult).toLocaleString("en-US") : Number(goldResult).toLocaleString("en-US")
        };
    }else{
        const bluePlayer = frame.blueTeam.participants[player.participantId - 6];
        const goldResult = player.totalGold - bluePlayer.totalGold;

        return {
            style: goldResult > 0 ? "positive" : "negative",
            goldDifference: goldResult > 0 ? "+" + Number(goldResult).toLocaleString("en-US") : Number(goldResult).toLocaleString("en-US")
        };
    }
}

function getDragonSVG(dragonName: string){
    switch (dragonName) {
        case "ocean": return <OceanDragonSVG className="dragon"/>;
        case "infernal": return <InfernalDragonSVG className="dragon"/>
        case "cloud": return <CloudDragonSVG className="dragon"/>
        case "mountain": return <MountainDragonSVG className="dragon"/>
        case "hextech": return <HextechDragonSVG className="dragon"/>
        case "chemtech": return <ChemtechDragonSVG className="dragon"/>
        case "elder": return <ElderDragonSVG className="dragon"/>
    }
}

function getWinPrediction(goldBlue: number, goldRed: number) {
    const total = goldBlue + goldRed;

    if (total <= 0) {
        return {
            flexBlue: 1,
            flexRed: 1,
            bluePercent: 50,
            redPercent: 50,
        };
    }

    const blueShare = goldBlue / total;
    const redShare = goldRed / total;
    const bluePercent = Math.min(100, Math.max(0, Math.round(blueShare * 100)));
    const redPercent = Math.max(0, 100 - bluePercent);

    return {
        flexBlue: Math.max(blueShare, 0.05),
        flexRed: Math.max(redShare, 0.05),
        bluePercent,
        redPercent,
    };
}

enum GameState {
    in_game = "LIVE",
    paused = "PAUSED",
    finished = "FINISHED"
}
