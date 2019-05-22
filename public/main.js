/* ==============================
 Global Variables
 ================================ */
const socket = io();
const configuration = {
  iceServers: [
    { urls: "stun:stun.1.google.com:19302" },
    /*{ 'urls': 'stun:stun1.l.google.com:19302' },
     { 'urls': 'stun:stun2.l.google.com:19302' },
     { 'urls': 'stun:stun3.l.google.com:19302' },
     { 'urls': 'stun:stun4.l.google.com:19302' },*/
  ],
};

const constrains = {
  "audio": false,
  "video": true,
};

const p = document.querySelector("p");
const localVideo = document.getElementById("localVideo");
const remoteViewContainer = document.getElementById("remoteViewContainer");

let pcPeers = {};
let localStream;

/* ==============================
 Socket Functionality
 ================================ */
socket.on('connect', async () => await getLocalStream());
socket.on('exchange', data => exchange(data));
socket.on('leave', socketId => leave(socketId));

/* ==============================
 Functions
 ================================ */
async function getLocalStream() {
  console.log('get local stream');
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constrains);
    
    localStream = stream;
    localVideo.srcObject = stream;
    localVideo.muted = true;
    localVideo.onloadedmetadata = async () => {
      try {
        await localVideo.play();
      } catch (e) {logError(e);}
    };
  } catch (e) {logError(e);}
}

function onPress() {
  console.log('you press the button');
  let roomID = document.getElementById('roomID').value;
  
  if (roomID === "") {
    alert('Please enter room ID!');
  } else {
    let roomIDContainer = document.getElementById('roomIDContainer');
    roomIDContainer.parentElement.removeChild(roomIDContainer);
    
    join(roomID);
  }
}

function join(roomID) {
  let onJoin = socketIds => {
    for (const i in socketIds) {
      if (socketIds.hasOwnProperty(i)) {
        const socketId = socketIds[i];
        console.log('Socket', socketId);
        createPC(socketId, true);
      }
    }
  };
  
  socket.emit('join', roomID, onJoin);
}

function createPC(socketId, isOffer) {
  const pc = new RTCPeerConnection(configuration);
  console.log('create pc');
  
  pcPeers = {
    ...pcPeers,
    [socketId]: pc,
  };
  
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  
  pc.onicecandidate = event => {
    console.log('onicecandidate');
    
    if (event.candidate) {
      socket.emit('exchange', { 'to': socketId, 'candidate': event.candidate });
    }
  };
  
  pc.onnegotiationneeded = async () => {
    console.log('onnegotiationneeded');
    
    if (isOffer) {
      try {
        const description = await pc.createOffer();
        await pc.setLocalDescription(description);
        
        socket.emit('exchange', { 'to': socketId, 'sdp': pc.localDescription });
      } catch (e) {logError(e);}
      
    }
  };
  
  pc.oniceconnectionstatechange = event => {
    console.log('oniceconnectionstatechange');
    if (pc.iceConnectionState === 'connected') {
      console.log('connected', event);
    }
  };
  
  pc.onsignalingstatechange = event => {
    console.log('onsignalingstatechange', event);
    console.log('signalingState', pc.signalingState);
  };
  
  pc.ontrack = event => {
    let video = document.createElement('video');
    video.id = "remoteView" + socketId;
    
    video.autoplay = true;
    video.loop = true;
    video.playsinline = true;
    video.load();
    video.controls = true;
    
    let isPlaying = video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2;
    
    // Check if video isn't playing
    if (!isPlaying) {
      // Doesn't duplicate same stream
      if (video.srcObject !== event.streams[0]) {
        video.srcObject = event.streams[0];
        /*localVideo.onloadedmetadata = async () => {
          try {
            await video.play();
          } catch (e) {logError(e);}
        };*/
      }
    }
    
    // Console on site for webview debug
    p.innerHTML += `<br> is stream active? ${event.streams[0].active}`;
    p.innerHTML += `<br> stream id: ${event.streams[0].id}`;
    console.log(event.streams);
    
    playVideo(video);
  };
  
  return pc;
}

function playVideo(video) {
  remoteViewContainer.appendChild(video);
  p.innerHTML += `<br> asdf`;
  setTimeout(() => video.play(), 3000);
}

async function exchange(data) {
  let pc;
  let fromId = data.from;
  
  if (fromId in pcPeers) {
    pc = pcPeers[fromId];
  } else {
    pc = createPC(fromId, false);
  }
  
  if (data.sdp) {
    const remoteOffer = new RTCSessionDescription(data.sdp);
    
    console.log('exchange sdp', data);
    console.log('remoteOffer:\n', remoteOffer);
    
    try {
      await pc.setRemoteDescription(remoteOffer);
      console.log('setRemoteDescription ok');
      
      if (pc.remoteDescription.type === "offer") {
        const description = await pc.createAnswer();
        await pc.setLocalDescription(description);
        
        console.log('createAnswer:\n', description);
        socket.emit('exchange', { 'to': fromId, 'sdp': pc.localDescription });
      }
    } catch (e) {console.log(e);}
    
  } else {
    console.log('exchange candidate', data);
    
    try {
      await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (e) {logError(e);}
  }
}

function leave(socketId) {
  //console.log('leave', socketId);
  
  const peer = pcPeers[socketId];
  
  peer.close();
  
  delete pcPeers[socketId];
  
  let video = document.getElementById("remoteView" + socketId);
  
  if (video) video.remove();
}

function logError(error) {
  console.log('\n\n%c START ________________________ Log Error ______________________', ' color: red; font-size: 15px');
  //console.log(error + '\n\n');
  console.log(error.toString() + '\n\n');
  console.trace();
  console.log('%c END __________________________ Log Error ______________________\n\n', 'color: red; font-size: 15px');
}
