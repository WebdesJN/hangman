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

function stringifyJSON(data) {
  //data is an object, to we need to convert it to a string.
  //Since its too long for json.stringify, we need to convert it to a string manually
  /*     
  const JSONData = {
    roomId: roomId,
    players: gameRooms[roomId].players,
    state: gameRooms[roomId].state,
  };
  */

  let out = "{";
  const keys = Object.keys(data);

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];

    if (key === "players") {
      let playerArr = "[";
      data[key].map((player, index) => {
        let playerObj = "{";
        const keys = Object.keys(player);
        for (let i = 0; i < keys.length - 1; i++) {
          const entry = [key] + ":" + data[key];
          playerObj += JSON.stringify(entry, null, 4) + ",";
        }
        playerObj += "}";
        if (index === data[key].length - 1) {
          playerArr += playerObj;
          playerArr += "]";
        } else {
          playerArr += playerObj + ",";
        }
      });
      out += playerArr + ",";
    } else {
      const entry = key + ":" + data[key];
      out += JSON.stringify(entry, null, 4) + ",";
    }
  }

  // Add the last item without a trailing comma
  if (keys.length > 0) {
    const lastKey = keys[keys.length - 1];
    const lastEntry = { [lastKey]: data[lastKey] };
    out += JSON.stringify(lastEntry, null, 4);
  }

  out += "]";
  console.log(out);
  //out is our stringified object
  return out;
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

// WebSocket Handlers
wss.on("connection", (ws) => {
  ws.on("message", (request) => {
    let foundGame = false;
    let sessionId = null;
    const data = JSON.parse(request);
    const type = data.type;
    const roomId = data?.roomId;
    const username = data?.username;
    const word = data?.word;
    const randWord = data?.randWord;

    if (!sessionId && data.sessionId) {
      sessionId = data.sessionId;
      ws.sessionId = sessionId;
    }
    if (sessionId) {
      if (Object.keys(gameRooms).length === 0) {
        ws.send(
          JSON.stringify({
            message: "You have not entered any game rooms yet!",
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
            message: "You have not entered any game rooms yet!",
          })
        );
      }
    }

    if (type === "create") {
      if (username && word) {
        //https://random-word-api.herokuapp.com/word?lang=de
        const roomId = generateRoomId();

        gameRooms[roomId] = {
          state: {
            keys: [],
            numbOfLettersWord: word.split("").length,
            guessedLetters: [],
            randWord: randWord,
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
        if (gameRooms[roomId].state.randWord) {
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
          JSON.stringify({
            message: "You need to select a username and a Word!",
          })
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
          if (!gameRooms[roomId].state.randWord) {
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
              addKey: true,
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
              end: true,
              addKey: true,
              state: { guessedLetters: guessedLetters },
              message: "you lost, Game is over!",
            })
          );
          /* playerWs.close(); */
          gameRooms[roomId].state.guessedLetters = [];
          gameRooms[roomId].state.keys = [];
        });
      } else if (
        gameRooms[roomId]?.word?.split("")?.length ===
        gameRooms[roomId]?.state?.guessedLetters?.length
      ) {
        gameRooms[roomId]?.players?.map((player) => {
          const id = player.id;
          const playerWs = player[id];

          playerWs.send(
            JSON.stringify({
              end: true,
              type: "gameInfo",
              message: "you won, Game is over!",
            })
          );
          gameRooms[roomId].state.guessedLetters = [];
          gameRooms[roomId].state.keys = [];
        });
      }
    } else if (type === "continue") {
      gameRooms[roomId].state.keys = [];
      gameRooms[roomId].state.numbOfLettersWord = word.split("").length;
      gameRooms[roomId].state.guessedLetters = [];
      gameRooms[roomId].word = word;
      if (gameRooms[roomId].state.randWord) {
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
          " continued a game with roomID: " +
          roomId +
          " at " +
          new Date()
      );
    }
  });

  ws.on("close", () => {
    console.log("A player disconnected.");
    Object.keys(gameRooms).forEach((roomId) => {
      gameRooms[roomId].players.map((player, index) => {
        if (player[ws.sessionId]) {
          gameRooms[roomId].players.splice(index, 1);
          if (gameRooms[roomId].players.length === 0) {
            delete gameRooms[roomId];
          }
        }
      });
    });
  });
});

// Start server
server.listen(port, () => {
  console.log("Server running on https://webdesjn.de/api");
});
