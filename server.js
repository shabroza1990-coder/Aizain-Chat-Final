const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e8 // 100MB bandwidth buffer
});

app.use(express.static("public"));

const activeUsers = {};
const bannedRooms = new Set();
const roomStats = {}; // Tracks structural metrics per room

function updateRoomMetrics(room) {
    if (!room || room === "ADMIN_HOST_ROOM") return;
    const clients = io.sockets.adapter.rooms.get(room);
    const count = clients ? clients.size : 0;
    
    if (!roomStats[room]) {
        roomStats[room] = { mediaCount: 0 };
    }
    
    io.to(room).emit("roomMetricsUpdate", {
        userCount: count,
        mediaCount: roomStats[room].mediaCount
    });
}

io.on("connection", (socket) => {
    
    socket.on("joinRoom", ({ username, room }) => {
        if (bannedRooms.has(room) && room !== "ADMIN_HOST_ROOM") {
            socket.emit("bannedError", "ACCESS DENIED: Blacklisted Node Network ID.");
            return;
        }

        socket.join(room);
        activeUsers[socket.id] = { username, room, isMuted: false };

        if (!roomStats[room]) roomStats[room] = { mediaCount: 0 };

        // Broadcast Special Global Star Trigger notice if Aizain enters normal nodes
        if (username === "Aizain" && room !== "ADMIN_HOST_ROOM") {
            io.to(room).emit("starUserAlert", `${username} has arrived.`);
        }

        const time = new Date().toLocaleTimeString();
        if (room !== "ADMIN_HOST_ROOM") {
            io.to("ADMIN_HOST_ROOM").emit("adminLog", {
                id: socket.id,
                text: `[${time}] 🟢 Live Feed: User [ ${username} ] mapped to Node Channel [ ${room} ]`,
                username,
                room
            });
            updateRoomMetrics(room);
        }

        // Live Typing Core Stream
        socket.on("typingState", (isTyping) => {
            socket.to(room).emit("typingBroadcast", { username, isTyping });
        });

        socket.on("chatMessage", (msgData) => {
            if (activeUsers[socket.id]?.isMuted) return socket.emit("mutedNotice");
            io.to(room).emit("message", { user: username, text: msgData.text, replyData: msgData.replyData, type: "text" });
        });

        socket.on("voiceMessage", (audioData) => {
            if (activeUsers[socket.id]?.isMuted) return socket.emit("mutedNotice");
            roomStats[room].mediaCount++;
            io.to(room).emit("message", { user: username, audio: audioData, type: "voice" });
            updateRoomMetrics(room);
        });

        socket.on("imageMessage", (imageData) => {
            if (activeUsers[socket.id]?.isMuted) return socket.emit("mutedNotice");
            roomStats[room].mediaCount++;
            io.to(room).emit("message", { user: username, image: imageData, type: "image" });
            updateRoomMetrics(room);
        });
    });

    // --- HOST COMMAND MATRIX HANDLERS ---
    socket.on("adminBanRoom", (targetRoom) => {
        bannedRooms.add(targetRoom);
        io.to(targetRoom).emit("bannedError", "CRITICAL DISCONNECT: Targeted sector banned.");
        io.in(targetRoom).socketsLeave(targetRoom);
        io.to("ADMIN_HOST_ROOM").emit("adminLog", { text: `[ALERT] 🚫 Sector [ ${targetRoom} ] completely terminated.` });
    });

    socket.on("adminClearRoom", (targetRoom) => {
        io.to(targetRoom).emit("clearChatFromServer");
        io.to("ADMIN_HOST_ROOM").emit("adminLog", { text: `[PURGE] 🧹 Sector [ ${targetRoom} ] buffer cleared.` });
    });

    // Targeted Interactive Control Handlers
    socket.on("adminMuteUser", (targetSocketId) => {
        if (activeUsers[targetSocketId]) {
            activeUsers[targetSocketId].isMuted = true;
            io.to(targetSocketId).emit("mutedNotice");
            io.to("ADMIN_HOST_ROOM").emit("adminLog", { text: `[CONTROL] 🔇 Target ${activeUsers[targetSocketId].username} muted globally.` });
        }
    });

    socket.on("adminKickUser", (targetSocketId) => {
        if (activeUsers[targetSocketId]) {
            const userRef = activeUsers[targetSocketId];
            io.to(targetSocketId).emit("bannedError", "Forced server kick command initiated by Host Admin.");
            const targetSocket = io.sockets.sockets.get(targetSocketId);
            if (targetSocket) targetSocket.leave(userRef.room);
            io.to("ADMIN_HOST_ROOM").emit("adminLog", { text: `[CONTROL] 🥾 Target ${userRef.username} kicked from ${userRef.room}.` });
            updateRoomMetrics(userRef.room);
        }
    });

    socket.on("disconnect", () => {
        const user = activeUsers[socket.id];
        if (user) {
            const time = new Date().toLocaleTimeString();
            if (user.room !== "ADMIN_HOST_ROOM") {
                io.to("ADMIN_HOST_ROOM").emit("adminLog", { text: `[${time}] 🔴 Live Feed: ${user.username} severed connection from Node [ ${user.room} ]` });
                updateRoomMetrics(user.room);
            }
        }
        delete activeUsers[socket.id];
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Aizain Core Matrix active on Port ${PORT}`);
});
