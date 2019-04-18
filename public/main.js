const socket = io();
const RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection || window.msRTCPeerConnection;
const RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription || window.msRTCSessionDescription;
const configuration = { iceServers: [{ "urls": "stun:stun.l.google.com:19302" }] };
//const configuration = {sdpSemantics: 'unified-plan'};
const selfView = document.getElementById("selfView");
const remoteViewContainer = document.getElementById("remoteViewContainer");
let pcPeers = {};
let localStream;

socket.on('connect', () => {
  console.log('connect');
  getLocalStream();
});
socket.on('exchange', data => {
  exchange(data);
});
socket.on('leave', socketId => {
  leave(socketId);
});

function getLocalStream() {
  const constrains = {
    "audio": true,
    "video": true,
  };
  const callback = stream => {
    localStream = stream;
    //window.mediaStream = stream;
    selfView.srcObject = stream;
    selfView.muted = true;
    selfView.onloadedmetadata = () => {
      selfView.play();
    };
  };
  
  navigator.mediaDevices.getUserMedia(constrains)
    .then(callback)
    .catch(logError);
}

function press() {
  let roomID = document.getElementById('roomID').value;
  if (roomID === "") {
    alert('Please enter room ID');
  } else {
    let roomIDContainer = document.getElementById('roomIDContainer');
    roomIDContainer.parentElement.removeChild(roomIDContainer);
    join(roomID);
  }
}

function join(roomID) {
  let state = 'join';
  let callback = socketIds => {
    console.log('join', socketIds);
    for (const i in socketIds) {
      if (socketIds.hasOwnProperty(i)) {
        const socketId = socketIds[i];
        createPC(socketId, true);
      }
    }
  };
  
  socket.emit(state, roomID, callback);
}

function createPC(socketId, isOffer) {
  
  let peer = new RTCPeerConnection(configuration);
  
  pcPeers = {
    ...pcPeers,
    [socketId]: peer,
  };
  
  peer.addStream(localStream);
  
  peer.onicecandidate = event => {
    //console.log('onicecandidate', event);
    if (event.candidate) {
      socket.emit('exchange', { 'to': socketId, 'candidate': event.candidate });
    }
  };
  
  peer.onnegotiationneeded = () => {
    //console.log('onnegotiationneeded');
    if (isOffer) {
      createOffer();
    }
  };
  
  peer.oniceconnectionstatechange = event => {
    //console.log('oniceconnectionstatechange', event);
    if (event.target.iceConnectionState === 'connected') {
      console.log('event.target.iceConnectionState === "completed"');
    }
    if (event.target.iceConnectionState === "connected") {
      console.log('event.target.iceConnectionState === "connected"');
    }
  };
  peer.onsignalingstatechange = event => {
    console.log("on signaling state change", event.target.signalingState);
  };
  
  peer.ontrack = event => {
    //console.log('onaddstream', event);
    let video = document.createElement('video');
    
    video.id = "remoteView" + socketId;
    video.autoplay = 'autoplay';
    
    console.log(event.streams);
    
    video.srcObject = event.streams[0];
    video.muted = true;
    video.onloadedmetadata = () => {
      video.play();
    };
    
    remoteViewContainer.appendChild(video);
  };
  
  function createOffer() {
    let callback = desc => {
      console.log('createOffer', desc);
      peer.setLocalDescription(desc)
        .then(callback2)
        .catch(logError);
    };
    let callback2 = () => {
      console.log('setLocalDescription', peer.localDescription);
      socket.emit('exchange', { 'to': socketId, 'sdp': peer.localDescription });
    };
    peer.createOffer()
      .then(callback)
      .catch(logError);
  }
  
  return peer;
}

function exchange(data) {
  let fromId = data.from;
  let peer;
  if (fromId in pcPeers) {
    peer = pcPeers[fromId];
  } else {
    peer = createPC(fromId, false);
  }
  
  if (data.sdp) {
    //console.log('exchange sdp', data);
    let sdp = new RTCSessionDescription(data.sdp);
    
    let callback = () => peer.remoteDescription.type === "offer" ? peer.createAnswer().then(callback2).catch(logError) : null;
    let callback2 = desc => peer.setLocalDescription(desc).then(callback3).catch(logError);
    let callback3 = () => socket.emit('exchange', { 'to': fromId, 'sdp': peer.localDescription });
    
    peer.setRemoteDescription(sdp)
      .then(callback)
      .catch(logError);
  } else {
    //console.log('exchange candidate', data);
    peer.addIceCandidate(new RTCIceCandidate(data.candidate))
      .catch(logError);
  }
}

function leave(socketId) {
  console.log('leave', socketId);
  
  const peer = pcPeers[socketId];
  
  peer.close();
  
  delete pcPeers[socketId];
  
  let video = document.getElementById("remoteView" + socketId);
  
  if (video) video.remove();
}

function logError(error) {
  console.log('\n\n-------------------');
  console.log("Log Error:", error);
  console.log(error.toString());
  console.trace();
  console.log('-------------------\n\n');
}
