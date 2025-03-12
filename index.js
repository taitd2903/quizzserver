const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const server = http.createServer(app); 
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors());

// Đọc danh sách câu hỏi
const questions = JSON.parse(
  fs.readFileSync(path.join(__dirname, "questions.json"), "utf8")
);

// Đọc và ghi dữ liệu người chơi
const filePath = path.join(__dirname, "players.json");
const readPlayersFromFile = () => {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]", "utf8");
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
};

const writePlayersToFile = (players) => {
  fs.writeFileSync(filePath, JSON.stringify(players, null, 2), "utf8");
};

// Biến lưu trạng thái trò chơi
let players = readPlayersFromFile();
let questionIndex = 0;
let pendingAnswers = {};
let questionStartTime = Date.now();

io.on("connection", (socket) => {
  console.log("⚡ Người chơi kết nối:", socket.id);

  // Người chơi tham gia vào hệ thống
  socket.on("join", ({ name, avatar }) => {
    players.push({ id: socket.id, name, avatar, score: 0, totalTime: 0 });
    writePlayersToFile(players);
    io.emit("players", players);
  });

  // Bắt đầu quiz
  socket.on("startGame", () => {
    questionIndex = 0;
    questionStartTime = Date.now();
    io.emit("startGame", questions[questionIndex]);
  });

  // Nhận câu trả lời của người chơi
  socket.on("answer", ({ name, answer }) => {
    const currentTime = Date.now() - questionStartTime;

    if (!pendingAnswers[name]) {
      pendingAnswers[name] = { answer, time: currentTime };
    } else {
      pendingAnswers[name].answer = answer;
      pendingAnswers[name].time = currentTime;
    }
  });

  // Chuyển sang câu hỏi tiếp theo
  socket.on("nextQuestion", () => {
    players.forEach((player) => {
      if (pendingAnswers[player.name]?.answer === questions[questionIndex].correct) {
        player.score += 1;
        player.totalTime = (player.totalTime || 0) + pendingAnswers[player.name].time;
      }
    });

    writePlayersToFile(players);
    io.emit("players", players);
    pendingAnswers = {};

    if (questionIndex < questions.length - 1) {
      questionIndex++;
      questionStartTime = Date.now();
      io.emit("nextQuestion", questions[questionIndex]);
    } else {
      // Xếp hạng top 3 người chơi
      const topPlayers = [...players]
        .sort((a, b) => b.score - a.score || a.totalTime - b.totalTime)
        .slice(0, 3);

      io.emit("finish", { topPlayers });
    }
  });

  // Reset lại game
  socket.on("resetGame", () => {
    players = [];
    writePlayersToFile(players);
    questionIndex = 0;
    io.emit("resetGame");
    io.emit("players", players);
  });

  // Khi người chơi rời khỏi
  socket.on("disconnect", () => {
    players = players.filter((p) => p.id !== socket.id);
    writePlayersToFile(players);
    io.emit("players", players);
  });
});

// Endpoint để kiểm tra server đang chạy
app.get("/", (req, res) => {
  res.send("🚀 Quiz Server is Running!");
});

// Lắng nghe cổng do Render cấp
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server chạy trên cổng ${PORT}`);
});
