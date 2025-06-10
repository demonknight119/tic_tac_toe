import React, { useState } from 'react';
import { useSocket } from '../context/SocketContext';

const JoinGame = ({ onJoinGame, onBack }) => {
  const [gameId, setGameId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { socket } = useSocket();

  React.useEffect(() => {
    if (socket) {
      socket.on('gameStarted', () => {
        onJoinGame(gameId);
      });

      socket.on('error', ({ message }) => {
        setError(message);
        setLoading(false);
      });

      return () => {
        socket.off('gameStarted');
        socket.off('error');
      };
    }
  }, [socket, gameId, onJoinGame]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!gameId.trim()) {
      setError('Please enter a game ID');
      return;
    }

    setError('');
    setLoading(true);
    
    if (socket) {
      socket.emit('joinGame', gameId.toUpperCase());
    }
  };

  return (
    <div className="auth-container">
      <form className="join-game-form" onSubmit={handleSubmit}>
        <h3>Join Game</h3>
        
        {error && <div className="error-message">{error}</div>}

        <div className="form-group">
          <label htmlFor="gameId">Game ID</label>
          <input
            type="text"
            id="gameId"
            value={gameId}
            onChange={(e) => setGameId(e.target.value.toUpperCase())}
            placeholder="Enter 6-character game ID"
            maxLength="6"
            required
          />
        </div>

        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Joining...' : 'Join Game'}
        </button>

        <div className="auth-switch">
          <button type="button" onClick={onBack}>
            Back to Dashboard
          </button>
        </div>
      </form>
    </div>
  );
};

export default JoinGame;