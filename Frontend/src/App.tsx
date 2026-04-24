import { Route, Routes } from 'react-router-dom';
import './App.css';
import Home from './pages/Home';
import Rules from './pages/Rules';
import CreateGamePage from "./pages/CreateGamePage";
import JoinGamePage from "./pages/JoinGamePage";
import GameLobbyPage from "./pages/GameLobbyPage";










function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/rules" element={<Rules />} />
      <Route path="/create" element={<CreateGamePage />} />
      <Route path="/join" element={<JoinGamePage />} />
      <Route path="/lobby" element={<GameLobbyPage />} />
    </Routes>
  );
}

export default App;
