import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

const Game = ({ gameId, onBack }) => {
  const [gameState, setGameState] = useState({
    board: [['', '', ''], ['', '', ''], ['', '', '']],
    currentPlayer: 'X',
    players: [],
    status: 'waiting',
    winner: null
  });
  const [mySymbol, setMySymbol] = useState(null);
  const [error, setError] = useState('');

  const { socket } = useSocket();
  const { user, updateUserStats } = useAuth();

  useEffect(() => {
    if (socket) {
      socket.on('gameStarted', (data) => {
        setGameState(prev => ({
          ...prev,
          ...data,
          status: 'playing'
        }));
        
        // Determine my symbol
        const myPlayer = data.players.find(p => p.username === user.username);
        if (myPlayer) {
          setMySymbol(myPlayer.symbol);
        }
      });

      socket.on('moveMade', (data) => {
        setGameState(prev => ({
          ...prev,
          ...data
        }));

        // Update user stats if game finished
        if (data.status === 'finished') {
          if (data.winner === 'draw') {
            updateUserStats({ draws: user.draws + 1 });
          } else if (data.winner === mySymbol) {
            updateUserStats({ wins: user.wins + 1 });
          } else {
            updateUserStats({ losses: user.losses + 1 });
          }
        }
      });

      socket.on('error', ({ message }) => {
        setError(message);
      });

      return () => {
        socket.off('gameStarted');
        socket.off('moveMade');
        socket.off('error');
      };
    }
  }, [socket, user, mySymbol, updateUserStats]);

  const handleCellClick = (row, col) => {
    if (gameState.board[row][col] !== '' || 
        gameState.status !== 'playing' || 
        gameState.currentPlayer !== mySymbol) {
      return;
    }

    setError('');
    if (socket) {
      socket.emit('makeMove', { row, col });
    }
  };

  const isMyTurn = gameState.currentPlayer === mySymbol && gameState.status === 'playing';

  if (gameState.status === 'waiting') {
    return (
      <div className="game-container">
        <div className="waiting-message">
          <div className="spinner"></div>
          <h3>Waiting for another player...</h3>
          <p>Game ID: <strong>{gameId}</strong></p>
          <p>Share this ID with a friend to play together!</p>
          <button className="back-btn" onClick={onBack}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-container">
      <div className="game-info">
        <h3>Game ID: {gameId}</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          {gameState.players.map(player => (
            <div key={player.userId}>
              <strong>{player.username}</strong> ({player.symbol})
            </div>
          ))}
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        {gameState.status === 'playing' && (
          <p>
            {isMyTurn ? "Your turn!" : `${gameState.currentPlayer}'s turn`}
          </p>
        )}
        
        {gameState.status === 'finished' && (
          <div>
            {gameState.winner === 'draw' ? (
              <p><strong>It's a draw!</strong></p>
            ) : (
              <p><strong>
                {gameState.winner === mySymbol ? 'You won!' : 'You lost!'}
              </strong></p>
            )}
          </div>
        )}
      </div>

      <div className="game-board">
        {gameState.board.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <button
              key={`${rowIndex}-${colIndex}`}
              className="game-cell"
              onClick={() => handleCellClick(rowIndex, colIndex)}
              disabled={!isMyTurn || cell !== ''}
            >
              {cell}
            </button>
          ))
        )}
      </div>

      <div className="game-actions-bottom">
        <button className="back-btn" onClick={onBack}>
          Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default Game;