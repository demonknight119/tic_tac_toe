import React, { useState, useEffect } from "react";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";

const Game = ({ gameId, onBack }) => {
  const [gameState, setGameState] = useState({
    board: [
      ["", "", ""],
      ["", "", ""],
      ["", "", ""],
    ],
    currentPlayer: "X",
    players: [],
    status: "waiting",
    winner: null,
  });
  const [mySymbol, setMySymbol] = useState(null);
  const [error, setError] = useState("");

  const { socket } = useSocket();
  const { user, updateUserStats } = useAuth();

  useEffect(() => {
    if (socket) {
      const handleGameStarted = (data) => {
        console.log("Game started received:", data);
        console.log("Current user:", user.username);

        // Update game state
        setGameState({
          board: data.board,
          currentPlayer: data.currentPlayer,
          players: data.players,
          status: "playing",
          winner: null,
        });

        // Find my symbol
        const myPlayer = data.players.find((p) => p.username === user.username);
        if (myPlayer) {
          setMySymbol(myPlayer.symbol);
          console.log("My symbol set to:", myPlayer.symbol);
          console.log("All players:", data.players);
        } else {
          console.error("Could not find my player in game data:", data.players);
          console.error("Looking for username:", user.username);
        }
      };

      const handleMoveMade = (data) => {
        console.log("Move made received:", data);
        setGameState((prev) => ({
          ...prev,
          board: data.board,
          currentPlayer: data.currentPlayer,
          winner: data.winner,
          status: data.status,
        }));

        // Update user stats if game finished
        if (data.status === "finished") {
          if (data.winner === "draw") {
            updateUserStats({ draws: user.draws + 1 });
          } else if (data.winner === mySymbol) {
            updateUserStats({ wins: user.wins + 1 });
          } else {
            updateUserStats({ losses: user.losses + 1 });
          }
        }
      };

      const handleError = ({ message }) => {
        console.error("Game error received:", message);
        setError(message);
        // Clear error after 5 seconds
        setTimeout(() => setError(""), 5000);
      };

      socket.on("gameStarted", handleGameStarted);
      socket.on("moveMade", handleMoveMade);
      socket.on("error", handleError);

      return () => {
        socket.off("gameStarted", handleGameStarted);
        socket.off("moveMade", handleMoveMade);
        socket.off("error", handleError);
      };
    }
  }, [socket, user, mySymbol, updateUserStats]);

  const handleCellClick = (row, col) => {
    console.log(`=== CELL CLICK DEBUG ===`);
    console.log(`Cell clicked: [${row}][${col}]`);
    console.log("User:", user.username);
    console.log("My symbol:", mySymbol);
    console.log("Current player:", gameState.currentPlayer);
    console.log("Game status:", gameState.status);
    console.log("Cell value:", gameState.board[row][col]);
    console.log("Socket connected:", socket?.connected);
    console.log("Players in game:", gameState.players);

    // Check if cell is already occupied
    if (gameState.board[row][col] !== "") {
      console.log("❌ Cell already occupied");
      setError("Cell is already occupied");
      return;
    }

    // Check if game is in playing state
    if (gameState.status !== "playing") {
      console.log("❌ Game not in playing state:", gameState.status);
      setError("Game is not active");
      return;
    }

    // Check if it's my turn
    if (gameState.currentPlayer !== mySymbol) {
      console.log(
        "❌ Not my turn. Current:",
        gameState.currentPlayer,
        "Mine:",
        mySymbol
      );
      setError(`It's ${gameState.currentPlayer}'s turn`);
      return;
    }

    // Check socket connection
    if (!socket || !socket.connected) {
      console.log("❌ Socket not connected");
      setError("Connection lost. Please refresh the page.");
      return;
    }

    console.log("✅ All checks passed, emitting makeMove");
    setError("");
    socket.emit("makeMove", { row, col });
  };

  const isMyTurn =
    gameState.currentPlayer === mySymbol && gameState.status === "playing";

  if (gameState.status === "waiting") {
    return (
      <div className="game-container">
        <div className="waiting-message">
          <div className="spinner"></div>
          <h3>Waiting for another player...</h3>
          <p>
            Game ID: <strong>{gameId}</strong>
          </p>
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "10px",
          }}
        >
          {gameState.players.map((player) => (
            <div
              key={player.userId}
              style={{
                fontWeight:
                  player.username === user.username ? "bold" : "normal",
                color: player.username === user.username ? "#667eea" : "#333",
                padding: "5px 10px",
                borderRadius: "5px",
                backgroundColor:
                  player.username === user.username ? "#f0f4ff" : "transparent",
              }}
            >
              {player.username} ({player.symbol})
              {player.username === user.username && " 👤"}
            </div>
          ))}
        </div>

        {error && (
          <div className="error-message" style={{ marginBottom: "10px" }}>
            {error}
          </div>
        )}

        {gameState.status === "playing" && (
          <div
            style={{
              color: isMyTurn ? "#28a745" : "#666",
              fontWeight: isMyTurn ? "bold" : "normal",
              fontSize: "16px",
              marginBottom: "10px",
              padding: "8px",
              borderRadius: "5px",
              backgroundColor: isMyTurn ? "#d4edda" : "#f8f9fa",
              textAlign: "center",
            }}
          >
            {isMyTurn
              ? "🎯 Your turn! Click on an empty cell"
              : `⏳ Waiting for ${gameState.currentPlayer}...`}
          </div>
        )}

        {gameState.status === "finished" && (
          <div
            style={{
              padding: "10px",
              borderRadius: "5px",
              backgroundColor:
                gameState.winner === mySymbol
                  ? "#d4edda"
                  : gameState.winner === "draw"
                  ? "#fff3cd"
                  : "#f8d7da",
              textAlign: "center",
              marginBottom: "10px",
            }}
          >
            {gameState.winner === "draw" ? (
              <p>
                <strong>🤝 It's a draw!</strong>
              </p>
            ) : (
              <p>
                <strong>
                  {gameState.winner === mySymbol
                    ? "🎉 You won!"
                    : "😔 You lost!"}
                </strong>
              </p>
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
              disabled={
                !isMyTurn || cell !== "" || gameState.status !== "playing"
              }
              style={{
                cursor:
                  isMyTurn && cell === "" && gameState.status === "playing"
                    ? "pointer"
                    : "not-allowed",
                opacity:
                  isMyTurn && cell === "" && gameState.status === "playing"
                    ? 1
                    : 0.7,
                backgroundColor: cell !== "" ? "#f8f9fa" : "white",
                color: cell === "X" ? "#dc3545" : "#007bff",
                fontWeight: "bold",
                fontSize: "36px",
                border: "2px solid #333",
                transition: "all 0.2s ease",
              }}
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
