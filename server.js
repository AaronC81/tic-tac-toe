// Prepare a web server
const app = require("express")();

// Create a plain HTTP server for sockets
const http = require("http").Server(app);
const io = require("socket.io")(http);

// A template for game state
const initialGameState = {
    // The socket ID of each player.
    playerO: null,
    playerX: null,

    // How many players are connected.
    playersConnected: 0,

    // The player whose turn it is, either X or O. 'null' means the game hasn't
    // started yet. 
    whoseTurn: null,

    // The current state of the board, as a 2D array. 'null' means not placed,
    // otherwise there will be either X or O.
    board: [
        [null, null, null],
        [null, null, null],
        [null, null, null]
    ],

    // If this isn't 'null', then the game is finished, with the winner being
    // either X or O.
    winner: null
}

// Clone the initial state into our current game state
// Converting something to JSON and back is one of the fastest ways of cloning
var gameState = JSON.parse(JSON.stringify(initialGameState));

// When somebody visits the root of our site, serve the index page
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Given any number of arguments, checks if they're all equal.
function allEqual() {
    return [...arguments].every(x => x === arguments[0]);
}

// Calculates the winner of a given board, or 'null' if there's no winner yet
// but could be. If all squares are full and nobody's won, returns ?.
function winner(board) {
    // Check for a row win
    for (var row = 0; row < 3; row++) {
        // If they're all equal, somebody's won
        if (allEqual(board[row][0], board[row][1], board[row][2])) {
            return board[row][0];
        }
    }

    // Check for a column win
    for (var row = 0; row < 3; row++) {
        for (var col = 0; col < 3; col++) {
            if (allEqual(board[0][col], board[1][col], board[2][col])) {
                return board[0][col];
            }
        }
    }

    // Check for a diagonal win like /
    if (allEqual(board[2][0], board[1][1], board[0][2])) {
        return board[2][0];
    }

    // Check for a diagonal win like \
    if (allEqual(board[2][2], board[1][1], board[0][0])) {
        return board[2][2];
    }

    // If the board is full, there's no winner now
    // Squishes board from [[x, x, x], [x, ...], ...] to [x, x, x, x, ...]
    var flatBoard = [].concat.apply([], board);
    // If this board doesn't contain null, every cell is filled, so no winner
    if (!flatBoard.includes(null)) {
        return "?";
    }

    return null;
}

// When somebody connects...
io.on("connection", socket => {
    console.log("A new client has connected");

    // Decide which player they need to be - the first player is X, second is O
    switch (gameState.playersConnected) {
        case 0:
            thisPlayer = "X";
            gameState.playerX = socket.id;
            break;
        case 1:
            thisPlayer = "O";
            gameState.playerO = socket.id;
            break;
        default:   
            thisPlayer = "S"; // spectator
    }
    gameState.playersConnected++;

    // If the client tells us to start the game...
    socket.on("start game", () => {
        console.log("Received start game")

        // TODO: Check there are players
        // X goes first
        gameState.whoseTurn = "X";

        // Send the new state to each player
        io.emit("state change", gameState);
    });

    // If the client makes a move...
    socket.on("make move", location => {
        // TODO: Check it's actually their turn
        // Location is encoded as [row, col]
        row = location[0];
        col = location[1];

        // Set the board to this player
        gameState.board[row][col] = gameState.whoseTurn;

        // Set the winner
        gameState.winner = winner(gameState.board);

        // If there is no winner still, change to the next player
        if (gameState.winner == null) {
            gameState.whoseTurn = (gameState.whoseTurn == "X" ? "O" : "X");
        }

        // Send the new state to each player
        io.emit("state change", gameState);
    });

    // If the client tells us to reset...
    socket.on("reset", () => {
        // Create a new game state
        gameState = JSON.parse(JSON.stringify(initialGameState));

        // Tell all clients to reset too
        io.emit("reset");
    })

    // They've just connected; emit the current state
    io.emit("state change", gameState);
});

// Start the web server on port 8000
http.listen(8000, "0.0.0.0");