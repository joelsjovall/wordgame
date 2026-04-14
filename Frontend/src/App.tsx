import { Route, Routes } from 'react-router-dom';
import './App.css';
import Home from './pages/Home';
import Rules from './pages/Rules';
import CreateGamePage from "./pages/CreateGamePage";




function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/rules" element={<Rules />} />
      <Route path="/create" element={<CreateGamePage />} />
    </Routes>
  );
}

export default App;
