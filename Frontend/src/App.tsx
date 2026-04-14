import { Route, Routes } from 'react-router-dom';
import './App.css';
import Home from './pages/Home';
import Rules from './pages/Rules';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/rules" element={<Rules />} />
    </Routes>
  );
}

export default App;
