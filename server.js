// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let waitingUsers = []; // Queue for random matching
let activeChats = {}; // Store active chat sessions

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // User sets their name
  socket.on('setName', (name) => {
    socket.data.name = name;
    console.log(`${name} connected.`);
  });

  // Start Chat
  socket.on('startChat', () => {
    if (waitingUsers.length > 0) {
      const partner = waitingUsers.pop(); // Match with a waiting user
      activeChats[socket.id] = partner;
      activeChats[partner.id] = socket;

      // Notify both users
      socket.emit('chatMatched', partner.data.name);
      partner.emit('chatMatched', socket.data.name);

      // Exchange IDs for WebRTC signaling
      socket.emit('partnerId', partner.id);
      partner.emit('partnerId', socket.id);
    } else {
      waitingUsers.push(socket);
      socket.emit('waiting', 'Waiting for a partner...');
    }
  });

  // Forward WebRTC signaling data
  socket.on('signal', (data) => {
    const partner = activeChats[socket.id];
    if (partner) {
      partner.emit('signal', data);
    }
  });

  // Send message
  socket.on('sendMessage', (message) => {
    const partner = activeChats[socket.id];
    if (partner) {
      partner.emit('receiveMessage', {
        sender: socket.data.name,
        message,
      });
    }
  });

  // End Chat
  socket.on('endChat', () => {
    const partner = activeChats[socket.id];
    if (partner) {
      partner.emit('chatEnded', 'The chat has been ended by your partner.');
      delete activeChats[partner.id];
    }
    delete activeChats[socket.id];
    socket.emit('chatEnded', 'You have left the chat.');
  });

  // Handle Disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    const partner = activeChats[socket.id];
    if (partner) {
      partner.emit('chatEnded', 'Your partner has disconnected.');
      delete activeChats[partner.id];
    }
    delete activeChats[socket.id];

    // Remove from waitingUsers if in the queue
    waitingUsers = waitingUsers.filter((user) => user.id !== socket.id);
  });
});


app.get("/", (req, res) => {
    return res.sendFile("/public/index.html");
  });

  
server.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
