import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Room from './pages/Room';
import Admin from './pages/Admin';
import LocationTracker from './components/LocationTracker';
import './styles/App.css';

function App() {
  return (
    <Router>
      <LocationTracker />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:roomId" element={<Room />} />
        <Route path="/admin/:roomId" element={<Admin />} />
      </Routes>
    </Router>
  );
}

export default App;
