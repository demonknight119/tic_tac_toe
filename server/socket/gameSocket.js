const Game = require("../models/Game");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

const activeGames = new Map();
const authenticatedUsers = new Map(); // Track authenticated users

const handleSocketConnection = (io) => {
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // Authenticate socket connection
    socket.on("authenticate", async (token) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (user) {
          socket.userId = user._id.toString();
          socket.username = user.username;
          authenticatedUsers.set(socket.id, {
            userId: user._id.toString(),
            username: user.username,
          });
          console.log(
            "User authenticated:",
            socket.username,
            "Socket ID:",
            socket.id
          );
          socket.emit("authenticated", { success: true });
        } else {
          console.log("User not found for token");
          socket.emit("authenticated", { success: false });
        }
      } catch (error) {
        console.error("Authentication error:", error);
        socket.emit("authenticated", { success: false });
      }
    });

    // Create game
    socket.on("createGame", async () => {
      if (!socket.userId) {
        console.log("Create game: User not authenticated");
        socket.emit("error", { message: "Not authenticated" });
        return;
      }

      try {
        const gameId = generateGameId();
        const game = new Game({
          gameId,
          players: [
            {
              userId: socket.userId,
              username: socket.username,
              symbol: "X",
            },
          ],
        });

        await game.save();
        activeGames.set(gameId, game);

        socket.join(gameId);
        socket.gameId = gameId;

        console.log(
          `Game created: ${gameId} by ${socket.username} (${socket.id})`
        );
        socket.emit("gameCreated", { gameId, symbol: "X" });
      } catch (error) {
        console.error("Create game error:", error);
        socket.emit("error", { message: "Failed to create game" });
      }
    });

    // Join game
    socket.on("joinGame", async (gameId) => {
      if (!socket.userId) {
        console.log("Join game: User not authenticated");
        socket.emit("error", { message: "Not authenticated" });
        return;
      }

      try {
        let game = activeGames.get(gameId);
        if (!game) {
          game = await Game.findOne({ gameId });
          if (game) {
            activeGames.set(gameId, game);
          }
        }

        if (!game) {
          console.log(`Game not found: ${gameId}`);
          socket.emit("error", { message: "Game not found" });
          return;
        }

        if (game.players.length >= 2) {
          console.log(`Game is full: ${gameId}`);
          socket.emit("error", { message: "Game is full" });
          return;
        }

        if (game.players.some((p) => p.userId.toString() === socket.userId)) {
          console.log(`User already in game: ${socket.username} in ${gameId}`);
          socket.emit("error", { message: "Already in this game" });
          return;
        }

        // Add second player
        game.players.push({
          userId: socket.userId,
          username: socket.username,
          symbol: "O",
        });
        game.status = "playing";

        await game.save();
        activeGames.set(gameId, game);

        socket.join(gameId);
        socket.gameId = gameId;

        console.log(
          `Player ${socket.username} (${socket.id}) joined game ${gameId}`
        );
        console.log(
          `Players in game: ${game.players.map((p) => p.username).join(", ")}`
        );

        // Get all sockets in the room
        const socketsInRoom = await io.in(gameId).fetchSockets();
        console.log(
          `Sockets in room ${gameId}:`,
          socketsInRoom.map((s) => s.id)
        );

        // Emit to all players in the game
        io.to(gameId).emit("gameStarted", {
          players: game.players,
          board: game.board,
          currentPlayer: game.currentPlayer,
          status: game.status,
        });

        console.log(`Game started event emitted to room ${gameId}`);
      } catch (error) {
        console.error("Join game error:", error);
        socket.emit("error", { message: "Failed to join game" });
      }
    });

    // Make move
    socket.on("makeMove", async (data) => {
      const { row, col } = data;
      const gameId = socket.gameId;

      console.log(
        `Move attempt by ${socket.username} (${socket.id}): row ${row}, col ${col} in game ${gameId}`
      );

      if (!gameId) {
        console.log("Make move: Not in a game");
        socket.emit("error", { message: "Not in a game" });
        return;
      }

      if (!socket.userId) {
        console.log("Make move: Not authenticated");
        socket.emit("error", { message: "Not authenticated" });
        return;
      }

      try {
        let game = activeGames.get(gameId);
        if (!game) {
          game = await Game.findOne({ gameId });
          if (game) {
            activeGames.set(gameId, game);
          }
        }

        if (!game) {
          console.log(`Make move: Game not found ${gameId}`);
          socket.emit("error", { message: "Game not found" });
          return;
        }

        if (game.status !== "playing") {
          console.log(`Make move: Game not active. Status: ${game.status}`);
          socket.emit("error", { message: "Game is not active" });
          return;
        }

        const player = game.players.find(
          (p) => p.userId.toString() === socket.userId
        );
        if (!player) {
          console.log(
            `Make move: Player not in game. UserId: ${socket.userId}`
          );
          console.log(
            "Players in game:",
            game.players.map((p) => ({
              userId: p.userId.toString(),
              username: p.username,
            }))
          );
          socket.emit("error", { message: "You are not in this game" });
          return;
        }

        console.log(
          `Player symbol: ${player.symbol}, Current player: ${game.currentPlayer}`
        );

        if (game.currentPlayer !== player.symbol) {
          console.log(
            `Make move: Not player's turn. Expected: ${game.currentPlayer}, Player: ${player.symbol}`
          );
          socket.emit("error", { message: "Not your turn" });
          return;
        }

        if (game.board[row][col] !== "") {
          console.log(
            `Make move: Cell occupied at [${row}][${col}]: ${game.board[row][col]}`
          );
          socket.emit("error", { message: "Cell already occupied" });
          return;
        }

        // Make the move
        game.board[row][col] = player.symbol;
        console.log(`Move made: ${player.symbol} at [${row}][${col}]`);

        // Check for winner
        const winner = checkWinner(game.board);

        if (winner) {
          game.status = "finished";
          game.winner = winner;
          console.log(`Game finished. Winner: ${winner}`);
          await updatePlayerStats(game);
        } else {
          // Switch turns
          game.currentPlayer = game.currentPlayer === "X" ? "O" : "X";
          console.log(`Turn switched to: ${game.currentPlayer}`);
        }

        await game.save();
        activeGames.set(gameId, game);

        // Get all sockets in the room before emitting
        const socketsInRoom = await io.in(gameId).fetchSockets();
        console.log(
          `Emitting moveMade to ${socketsInRoom.length} sockets in room ${gameId}`
        );

        // Emit to all players in the game
        io.to(gameId).emit("moveMade", {
          board: game.board,
          currentPlayer: game.currentPlayer,
          winner: game.winner,
          status: game.status,
        });

        if (game.status === "finished") {
          // Clean up after a delay
          setTimeout(() => {
            activeGames.delete(gameId);
          }, 30000); // Keep for 30 seconds after finish
        }
      } catch (error) {
        console.error("Make move error:", error);
        socket.emit("error", { message: "Failed to make move" });
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id, socket.username);

      // Remove from authenticated users
      authenticatedUsers.delete(socket.id);

      // Handle game cleanup if needed
      if (socket.gameId) {
        const game = activeGames.get(socket.gameId);
        if (game && game.status === "waiting") {
          // If game was waiting and creator disconnects, remove the game
          activeGames.delete(socket.gameId);
          Game.findOneAndDelete({ gameId: socket.gameId }).catch(console.error);
        }
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
    if (
      board[i][0] &&
      board[i][0] === board[i][1] &&
      board[i][1] === board[i][2]
    ) {
      return board[i][0];
    }
  }

  // Check columns
  for (let j = 0; j < 3; j++) {
    if (
      board[0][j] &&
      board[0][j] === board[1][j] &&
      board[1][j] === board[2][j]
    ) {
      return board[0][j];
    }
  }

  // Check diagonals
  if (
    board[0][0] &&
    board[0][0] === board[1][1] &&
    board[1][1] === board[2][2]
  ) {
    return board[0][0];
  }
  if (
    board[0][2] &&
    board[0][2] === board[1][1] &&
    board[1][1] === board[2][0]
  ) {
    return board[0][2];
  }

  // Check for draw
  const isFull = board.every((row) => row.every((cell) => cell !== ""));
  if (isFull) {
    return "draw";
  }

  return null;
};

const updatePlayerStats = async (game) => {
  try {
    if (game.winner === "draw") {
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
  } catch (error) {
    console.error("Error updating player stats:", error);
  }
};

module.exports = { handleSocketConnection };
