import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const Dashboard = ({ onCreateGame, onJoinGameClick }) => {
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('gameCreated', ({ gameId, symbol }) => {
        onCreateGame(gameId);
      });

      return () => {
        socket.off('gameCreated');
      };
    }
  }, [socket, onCreateGame]);

  const fetchLeaderboard = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/game/leaderboard');
      setLeaderboard(response.data);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGame = () => {
    if (socket) {
      socket.emit('createGame');
    }
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="user-info">
          <h2>Welcome, {user.username}!</h2>
          <div className="user-stats">
            <div className="stat">
              <div className="stat-value">{user.wins}</div>
              <div className="stat-label">Wins</div>
            </div>
            <div className="stat">
              <div className="stat-value">{user.losses}</div>
              <div className="stat-label">Losses</div>
            </div>
            <div className="stat">
              <div className="stat-value">{user.draws}</div>
              <div className="stat-label">Draws</div>
            </div>
          </div>
        </div>
        <button className="logout-btn" onClick={logout}>
          Logout
        </button>
      </div>

      <div className="game-actions">
        <button className="create-game-btn" onClick={handleCreateGame}>
          Create New Game
        </button>
        <button className="join-game-btn" onClick={onJoinGameClick}>
          Join Game
        </button>
      </div>

      <div className="leaderboard">
        <h3>Leaderboard</h3>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <div className="spinner"></div>
          </div>
        ) : (
          <ul className="leaderboard-list">
            {leaderboard.map((player, index) => (
              <li key={player._id} className="leaderboard-item">
                <span className="player-rank">#{index + 1}</span>
                <span className="player-name">{player.username}</span>
                <span className="player-wins">{player.wins} wins</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Dashboard;