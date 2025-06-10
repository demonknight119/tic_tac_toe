import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Game from './components/Game';
import JoinGame from './components/JoinGame';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [gameId, setGameId] = useState(null);

  if (loading) {
    return (
      <div className="auth-container">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  const handleCreateGame = (newGameId) => {
    setGameId(newGameId);
    setCurrentView('game');
  };

  const handleJoinGame = (joinGameId) => {
    setGameId(joinGameId);
    setCurrentView('game');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setGameId(null);
  };

  return (
    <SocketProvider>
      <div className="container">
        {currentView === 'dashboard' && (
          <Dashboard
            onCreateGame={handleCreateGame}
            onJoinGameClick={() => setCurrentView('joinGame')}
          />
        )}
        {currentView === 'joinGame' && (
          <JoinGame
            onJoinGame={handleJoinGame}
            onBack={handleBackToDashboard}
          />
        )}
        {currentView === 'game' && gameId && (
          <Game
            gameId={gameId}
            onBack={handleBackToDashboard}
          />
        )}
      </div>
    </SocketProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;