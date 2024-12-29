const express = require("express");
const session = require("express-session");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const SQLiteStore = require("connect-sqlite3")(session);
const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");
const port = "3000";
const fs = require("fs");
/* const privateKey = fs.readFileSync(
  "/volume1/web/wichtelSecureSSLProof/privkey.pem",
  "utf8"
);
const certificate = fs.readFileSync(
  "/volume1/web/wichtelSecureSSLProof/fullchain.pem",
  "utf8"
); */

/* const credentials = { key: privateKey, cert: certificate }; */
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const gameRooms = {};

// Generate a secret key for sessions
const secretKey = crypto.randomBytes(32).toString("hex");

// Configure session middleware
app.use(cookieParser());
app.use(express.json());
app.use(
  session({
    store: new SQLiteStore(),
    secret: secretKey,
    resave: false,
    saveUninitialized: true,
    cookie: {
      path: "/",
      httpOnly: true,
      secure: true, // Nur über HTTPS ausliefern
      sameSite: "Strict", // Verhindert Third-Party-Zugriffe
      maxAge: null,
    },
  })
);
app.use(
  cors({
    origin: "http://localhost:4200",
    credentials: true,
  })
);

// Utility functions
function generateRoomId() {
  return crypto.randomBytes(8).toString("hex");
}

// HTTP Routes
const router = express.Router();

router.get("/", (req, res) => {
  const sessionId = req.sessionID;
  res.send({ sessionId: sessionId });
});

/* router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Error destroying session");
    }
    res.send({ message: 'Session destroyed. <a href="/">Go back</a>' });
  });
}); */

router.get("/gamerooms", (req, res) => {
  res.send(gameRooms);
});

app.use(router);

function checkLetterInWord(roomId, key) {
  let guessedLetters = [];
  gameRooms[roomId].word.split("").map((letter, index) => {
    if (key.toLowerCase() === letter.toLowerCase()) {
      guessedLetters.push({ key: key, index: index });
    }
  });
  return guessedLetters;
}

function countGuessedLetters(roomId) {
  const failcountArr = [];
  gameRooms[roomId]?.state?.guessedLetters?.map((letterInfo) => {
    if (!failcountArr.includes(letterInfo.key))
      failcountArr.push(letterInfo.key);
  });
  return failcountArr.length;
}

// WebSocket Handlers
wss.on("connection", (ws) => {
  ws.on("message", (request) => {
    let foundGame = false;
    const data = JSON.parse(request);
    const sessionId = data.sessionId;
    if (sessionId) {
      if (Object.keys(gameRooms).length === 0) {
        ws.send(
          JSON.stringify({
            message: "You have not entered any game rooms yet!1",
          })
        );
      } else {
        Object.keys(gameRooms).forEach((roomId) => {
          gameRooms[roomId].players.map((player) => {
            if (player[sessionId]) {
              foundGame = true;
              player[sessionId] = ws;
              ws.send(
                JSON.stringify({
                  roomId: roomId,
                  players: gameRooms[roomId].players,
                  state: gameRooms[roomId].state,
                })
              );
            }
          });
        });
      }
      if (!foundGame) {
        ws.send(
          JSON.stringify({
            message: "You have not entered any game rooms yet!2",
          })
        );
      }
    }
    const type = data.type;
    const roomId = data?.roomId;
    const username = data?.username;
    const word = data?.word;
    const randWord = data?.randWord;
    if (type === "create") {
      if (username) {
        //https://random-word-api.herokuapp.com/word?lang=de
        const roomId = generateRoomId();

        gameRooms[roomId] = {
          state: {
            keys: [],
            numbOfLettersWord: word.split("").length,
            guessedLetters: [],
          }, //keys, word length,
          word: word,
          players: [
            {
              admin: true,
              id: sessionId,
              [sessionId]: ws,
              name: username,
            },
          ],
        };
        if (randWord) {
          gameRooms[roomId].state = { ...gameRooms[roomId].state, count: 0 };
        } else {
          gameRooms[roomId].state = { ...gameRooms[roomId].state, count: 1 };
        }
        ws.send(
          JSON.stringify({
            roomId: roomId,
            players: gameRooms[roomId].players,
            state: gameRooms[roomId].state,
          })
        );
        console.log(
          "user " +
            username +
            " created a game with roomID: " +
            roomId +
            " at " +
            new Date()
        );
      } else {
        ws.send(
          JSON.stringify({ message: "You need a username. Maybe 'Rat'?" })
        );
      }
    } else if (type === "join") {
      if (!gameRooms[roomId]) {
        ws.send(JSON.stringify({ message: "Game room not found." }));
      } else {
        gameRooms[roomId].players.push({
          id: sessionId,
          [sessionId]: ws,
          name: username,
        });
        ws.send(
          JSON.stringify({
            roomId: roomId,
            players: gameRooms[roomId].players,
            state: gameRooms[roomId].state,
          })
        );
        gameRooms[roomId].players.forEach((player) => {
          const id = player.id;
          const playerWs = player[id];

          if (ws !== playerWs) {
            playerWs.send(
              JSON.stringify({
                type: "playerJoin",
                players: gameRooms[roomId].players,
              })
            );
          }
        });
      }
    } else if (type === "action") {
      /*       if (!gameRooms[roomId].state.count) {
        gameRooms[roomId].state.count = 0;
      } */
      const turnIndex = gameRooms[roomId].state?.count;
      if (gameRooms[roomId].players[turnIndex]?.id === sessionId) {
        if (gameRooms[roomId].players.length > 1) {
          gameRooms[roomId].state.count++;
        }
        if (
          gameRooms[roomId].state.count === gameRooms[roomId].players.length
        ) {
          if (!randWord) {
            gameRooms[roomId].state.count = 1;
          } else {
            gameRooms[roomId].state.count = 0;
          }
        }

        const letter = data.key;
        const guessedLetters = checkLetterInWord(roomId, letter);
        gameRooms[roomId].state.keys.push(letter);
        if (!gameRooms[roomId].state.guessedLetters) {
          gameRooms[roomId].state = {
            ...gameRooms[roomId].state,
            guessedLetters: guessedLetters,
          };
        } else {
          guessedLetters.forEach((letter) => {
            gameRooms[roomId].state.guessedLetters.push(letter);
          });
        }

        gameRooms[roomId].players.forEach((player) => {
          const id = player.id;
          const playerWs = player[id];
          playerWs.send(
            JSON.stringify({
              state: {
                keys: letter,
                guessedLetters: guessedLetters,
                count: gameRooms[roomId].state.count,
              },
            })
          );
        });
      }
      const fails =
        gameRooms[roomId]?.state?.keys?.length - countGuessedLetters(roomId);
      if (fails === 6) {
        gameRooms[roomId]?.players.map((player) => {
          const id = player.id;
          const playerWs = player[id];
          let guessedLetters = [];
          const wordArr = gameRooms[roomId].word.split("");
          let checkletters = [];
          wordArr.forEach((letter) => {
            if (!checkletters.includes(letter)) {
              checkletters.push(letter);
              guessedLetters = [
                ...guessedLetters,
                ...checkLetterInWord(roomId, letter),
              ];
            }
          });
          playerWs.send(
            JSON.stringify({
              state: { guessedLetters: guessedLetters },
            })
          );
          playerWs.close();
        });
        delete gameRooms[roomId];
      } else if (
        gameRooms[roomId]?.word?.split("")?.length ===
        gameRooms[roomId]?.state?.guessedLetters?.length
      ) {
        gameRooms[roomId]?.players?.map((player) => {
          const id = player.id;
          const playerWs = player[id];

          playerWs.send(
            JSON.stringify({
              type: "gameInfo",
              message: "you won, Game is over!",
            })
          );
          delete gameRooms[roomId];
          playerWs.close();
        });
      }
    }
  });

  ws.on("close", () => {
    console.log("A player disconnected.");
  });
});

// Start server
server.listen(port, () => {
  console.log("Server running on https://webdesjn.de/api");
});
