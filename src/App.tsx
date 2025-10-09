import './styles/global.css'
import 'react-toastify/dist/ReactToastify.min.css';

import {LiveGame} from "./components/LiveStatusGameCard/LiveGame";
import {HashRouter, Routes, Route, Navigate} from "react-router-dom";
import {Footer} from "./components/Footer/Footer";
import {LiveGames} from "./components/LiveGameCard/LiveGames";
import {Navbar} from "./components/Navbar/Navbar";
import { useTheme } from './theme/ThemeContext'
import React from "react";
import {SeriesScoreboardTest} from "./components/LiveStatusGameCard/SeriesScoreboardTest";
import {BackfillTest} from "./components/Navbar/BackfillTest";

function App() {
    const { theme } = useTheme();

    return (
        <HashRouter basename="/">
            <div className="theme-container" style={{...theme as React.CSSProperties}}>
                <Navbar/>
                <div className="container">
                    <Routes>
                        <Route path="/" element={<>
                            <LiveGames/>
                            <BackfillTest/>
                        </>}/>
                        <Route path="/live/:gameid" element={<LiveGame/>}/>
                        <Route path="/test-series-scoreboard" element={<SeriesScoreboardTest/>}/>
                        <Route path="*" element={<Navigate to="/"/>}/>
                    </Routes>
                </div>
                <Footer/>
            </div>
        </HashRouter>
    );
}

export default App;
