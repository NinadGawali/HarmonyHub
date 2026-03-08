import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { roomAPI } from '../api/api';
import { Music2, Users, Plus, LogIn } from 'lucide-react';

export default function Home() {
  const [adminName, setAdminName] = useState('');
  const [userName, setUserName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!adminName.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    
    try {
      const response = await roomAPI.create(adminName.trim());
      const { roomId } = response.data;
      navigate(`/admin/${roomId}`, { state: { adminName: adminName.trim() } });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!userName.trim()) {
      setError('Please enter your name');
      return;
    }
    
    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    setLoading(true);
    
    try {
      await roomAPI.join(roomCode.toUpperCase().trim(), userName.trim());
      navigate(`/room/${roomCode.toUpperCase().trim()}`, { 
        state: { userName: userName.trim() } 
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-page">
      <div className="home-container">
        <div className="home-header">
          <Music2 size={64} className="logo" />
          <h1>HarmonyHub</h1>
          <p>Real-time music voting for your party</p>
        </div>

        <div className="home-cards">
          {/* Create Room Card */}
          <div className="home-card">
            <div className="card-icon create">
              <Plus size={32} />
            </div>
            <h2>Create a Room</h2>
            <p>Start a new voting session and manage songs</p>
            
            <form onSubmit={handleCreateRoom} className="home-form">
              <input
                type="text"
                placeholder="Your name"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                maxLength={50}
                disabled={loading}
              />
              <button type="submit" disabled={loading} className="btn-primary">
                <Users size={20} />
                <span>{loading ? 'Creating...' : 'Create Room'}</span>
              </button>
            </form>
          </div>

          {/* Join Room Card */}
          <div className="home-card">
            <div className="card-icon join">
              <LogIn size={32} />
            </div>
            <h2>Join a Room</h2>
            <p>Enter a room code to start voting</p>
            
            <form onSubmit={handleJoinRoom} className="home-form">
              <input
                type="text"
                placeholder="Your name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                maxLength={50}
                disabled={loading}
              />
              <input
                type="text"
                placeholder="Room code (e.g., ABC123)"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                disabled={loading}
              />
              <button type="submit" disabled={loading} className="btn-secondary">
                <LogIn size={20} />
                <span>{loading ? 'Joining...' : 'Join Room'}</span>
              </button>
            </form>
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="home-footer">
          <p>Built with React, Node.js, Socket.io & Redis</p>
        </div>
      </div>
    </div>
  );
}
