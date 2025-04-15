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

const filePath = path.join(__dirname, "scores.json");
const readScoresFromFile = () => {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]", "utf8");
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
};
const writeScoresToFile = (scores) => {
  fs.writeFileSync(filePath, JSON.stringify(scores, null, 2), "utf8");
};

let scores = readScoresFromFile();

io.on("connection", (socket) => {
  console.log("👨‍⚖️ Người chấm kết nối:", socket.id);

  socket.on("luuDiem", (data) => {
    const { nguoiCham, doi, chiTiet } = data;

    const index = scores.findIndex(
      (d) => d.doi === doi && d.nguoiCham === nguoiCham
    );

    const diemMoi = {
      id: Date.now(),
      nguoiCham,
      doi,
      chiTiet,
      thoiGian: new Date().toISOString(),
    };
    if (index !== -1) {
      scores[index] = diemMoi; 
    } else {
      scores.push(diemMoi); 
    }

    writeScoresToFile(scores);
    console.log("✅ Đã lưu điểm:", diemMoi);
    const diemDoi = scores.filter((d) => d.doi === doi);


    if (diemDoi.length === 3) {
      const tongDiemDoi = diemDoi.reduce((sum, d) => {
        const diemGiámKhảo = Object.values(d.chiTiet).reduce((acc, val) => acc + val, 0);
        return sum + diemGiámKhảo;
      }, 0);
      io.emit("capNhatDiem", {
        doi,
        tongDiem: tongDiemDoi,
        chiTiet: diemDoi, 
      });
      console.log(`🎉 Đội ${doi} đã đủ 3 người chấm! Tổng điểm: ${tongDiemDoi}`);
    } else {
      const diemGiámKhảo = Object.values(diemMoi.chiTiet).reduce((acc, val) => acc + val, 0);
      io.emit("capNhatDiemGiámKhảo", {
        nguoiCham: diemMoi.nguoiCham,
        doi,
        tongDiem: diemGiámKhảo,
        chiTiet: diemMoi.chiTiet,
      });
    }
  });

  socket.on("layDanhSachDiem", () => {
    socket.emit("danhSachDiem", scores);
  });

  socket.on("resetDiem", () => {
    scores = [];
    writeScoresToFile(scores);
    io.emit("danhSachDiem", scores);
    console.log("🗑️ Đã reset toàn bộ điểm.");
  });

  socket.on("disconnect", () => {
    console.log("❌ Người chấm ngắt kết nối:", socket.id);
  });
});

app.get("/", (req, res) => {
  res.send("🧮 Scoring Server is Running!");
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🧮 Scoring Server chạy tại http://localhost:${PORT}`);
});
