const socket = io();

const loginDiv = document.getElementById('login');
const chatDiv = document.getElementById('chat');
const usernameInput = document.getElementById('username');
const startButton = document.getElementById('startButton');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const endButton = document.getElementById('endButton');
const messagesDiv = document.getElementById('messages');

let username;
let localStream;
let peerConnection;

const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

startButton.addEventListener('click', async () => {
  username = usernameInput.value.trim();
  if (!username) {
    alert('Please enter your name.');
    return;
  }

  socket.emit('setName', username);
  socket.emit('startChat');

  loginDiv.style.display = 'none';
  chatDiv.style.display = 'flex';

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
});

socket.on('partnerId', async (partnerId) => {
  peerConnection = new RTCPeerConnection(configuration);

  localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('signal', { candidate: event.candidate, to: partnerId });
    }
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('signal', { sdp: peerConnection.localDescription, to: partnerId });
});

socket.on('signal', async (data) => {
  if (data.sdp) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    if (data.sdp.type === 'offer') {
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('signal', { sdp: peerConnection.localDescription, to: data.from });
    }
  } else if (data.candidate) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
});

sendButton.addEventListener('click', () => {
  const message = messageInput.value.trim();
  if (message) {
    appendMessage(`You: ${message}`, 'sent');
    socket.emit('sendMessage', message);
    messageInput.value = '';
  }
});

endButton.addEventListener('click', () => {
  socket.emit('endChat');
  peerConnection.close();
  location.reload();
});

socket.on('receiveMessage', (data) => {
  appendMessage(`${data.sender}: ${data.message}`, 'received');
});

function appendMessage(message, type) {
  const msgDiv = document.createElement('div');
  msgDiv.textContent = message;
  msgDiv.classList.add(type);
  messagesDiv.appendChild(msgDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
