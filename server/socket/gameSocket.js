const Game = require('../models/Game');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const activeGames = new Map();
const waitingPlayers = [];

const handleSocketConnection = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Authenticate socket connection
    socket.on('authenticate', async (token) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        
        if (user) {
          socket.userId = user._id.toString();
          socket.username = user.username;
          socket.emit('authenticated', { success: true });
        } else {
          socket.emit('authenticated', { success: false });
        }
      } catch (error) {
        socket.emit('authenticated', { success: false });
      }
    });

    // Create game
    socket.on('createGame', async () => {
      if (!socket.userId) return;

      const gameId = generateGameId();
      const game = new Game({
        gameId,
        players: [{
          userId: socket.userId,
          username: socket.username,
          symbol: 'X'
        }]
      });

      await game.save();
      activeGames.set(gameId, game);
      
      socket.join(gameId);
      socket.gameId = gameId;
      
      socket.emit('gameCreated', { gameId, symbol: 'X' });
    });

    // Join game
    socket.on('joinGame', async (gameId) => {
      if (!socket.userId) return;

      const game = activeGames.get(gameId) || await Game.findOne({ gameId });
      
      if (!game) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }

      if (game.players.length >= 2) {
        socket.emit('error', { message: 'Game is full' });
        return;
      }

      if (game.players.some(p => p.userId.toString() === socket.userId)) {
        socket.emit('error', { message: 'Already in this game' });
        return;
      }

      game.players.push({
        userId: socket.userId,
        username: socket.username,
        symbol: 'O'
      });
      game.status = 'playing';

      await game.save();
      activeGames.set(gameId, game);

      socket.join(gameId);
      socket.gameId = gameId;

      io.to(gameId).emit('gameStarted', {
        players: game.players,
        board: game.board,
        currentPlayer: game.currentPlayer
      });
    });

    // Make move
    socket.on('makeMove', async (data) => {
      const { row, col } = data;
      const gameId = socket.gameId;

      if (!gameId) return;

      const game = activeGames.get(gameId);
      if (!game) return;

      const player = game.players.find(p => p.userId.toString() === socket.userId);
      if (!player) return;

      if (game.currentPlayer !== player.symbol) {
        socket.emit('error', { message: 'Not your turn' });
        return;
      }

      if (game.board[row][col] !== '') {
        socket.emit('error', { message: 'Cell already occupied' });
        return;
      }

      // Make the move
      game.board[row][col] = player.symbol;
      
      // Check for winner
      const winner = checkWinner(game.board);
      
      if (winner) {
        game.status = 'finished';
        game.winner = winner;
        await updatePlayerStats(game);
      } else {
        game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X';
      }

      await game.save();
      activeGames.set(gameId, game);

      io.to(gameId).emit('moveMade', {
        board: game.board,
        currentPlayer: game.currentPlayer,
        winner: game.winner,
        status: game.status
      });

      if (game.status === 'finished') {
        activeGames.delete(gameId);
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      
      // Remove from waiting players
      const waitingIndex = waitingPlayers.findIndex(p => p.socketId === socket.id);
      if (waitingIndex > -1) {
        waitingPlayers.splice(waitingIndex, 1);
      }
    });
  });
};

const generateGameId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const checkWinner = (board) => {
  // Check rows
  for (let i = 0; i < 3; i++) {
    if (board[i][0] && board[i][0] === board[i][1] && board[i][1] === board[i][2]) {
      return board[i][0];
    }
  }

  // Check columns
  for (let j = 0; j < 3; j++) {
    if (board[0][j] && board[0][j] === board[1][j] && board[1][j] === board[2][j]) {
      return board[0][j];
    }
  }

  // Check diagonals
  if (board[0][0] && board[0][0] === board[1][1] && board[1][1] === board[2][2]) {
    return board[0][0];
  }
  if (board[0][2] && board[0][2] === board[1][1] && board[1][1] === board[2][0]) {
    return board[0][2];
  }

  // Check for draw
  const isFull = board.every(row => row.every(cell => cell !== ''));
  if (isFull) {
    return 'draw';
  }

  return null;
};

const updatePlayerStats = async (game) => {
  if (game.winner === 'draw') {
    // Update draws for both players
    for (const player of game.players) {
      await User.findByIdAndUpdate(player.userId, { $inc: { draws: 1 } });
    }
  } else {
    // Update wins and losses
    for (const player of game.players) {
      if (player.symbol === game.winner) {
        await User.findByIdAndUpdate(player.userId, { $inc: { wins: 1 } });
      } else {
        await User.findByIdAndUpdate(player.userId, { $inc: { losses: 1 } });
      }
    }
  }
};

module.exports = { handleSocketConnection };