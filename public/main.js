const socket = io();
const RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection || window.msRTCPeerConnection;
const RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription || window.msRTCSessionDescription;
const configuration = { iceServers: [{ urls: "stun:stun.1.google.com:19302" }] };
//const configuration = {sdpSemantics: 'unified-plan'};

const selfView = document.getElementById("selfView");
const remoteViewContainer = document.getElementById("remoteViewContainer");

let pcPeers = {};
let localStream;

socket.on('connect', () => {
  //log('socket connected');
  getLocalStream();
});
socket.on('exchange', data => {
  //log('socket exchange data');
  exchange(data);
});
socket.on('leave', socketId => {
  //log('socket left');
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
    selfView.onloadedmetadata = async () => {
      try {
        await selfView.play();
      } catch (error) {
        logError(error);
      }
    };
  };
  
  //window.RTCRtpSender.getCapabilities("video").codecs.map(e=>e.name).indexOf("H264")
  
  /*navigator.mediaDevices.getUserMedia = ( navigator.mediaDevices.getUserMedia ||
   navigator.webkitGetUserMedia ||
   navigator.mozGetUserMedia ||
   navigator.msGetUserMedia);*/
  
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
  
  let onJoin = socketIds => {
    //log('join');
    //console.log(socketIds);
    
    for (const i in socketIds) {
      if (socketIds.hasOwnProperty(i)) {
        const socketId = socketIds[i];
        
        createPC(socketId, true);
      }
    }
  };
  
  socket.emit('join', roomID, onJoin);
}

function createPC(socketId, isOffer) {
  
  let peer = new RTCPeerConnection(configuration);
  
  console.log(peer);
  
  pcPeers = {
    ...pcPeers,
    [socketId]: peer,
  };
  
  peer.onicecandidate = event => {
    //log('on ice candidate');
    //console.log(event);
    
    if (event.candidate) {
      socket.emit('exchange', { 'to': socketId, 'candidate': event.candidate });
    }
  };
  
  peer.onnegotiationneeded = () => {
    //log('on negotiation needed');
    
    /*peer.createOffer()
     .then(function (offer) {
     peer.setLocalDescription(offer)
     .then(() => socket.emit('exchange', { 'to': socketId, 'sdp': peer.localDescription }))
     .catch(logError);
     })
     .catch(logError);*/
    
    if (isOffer) {
      createOffer();
    }
  };
  
  peer.oniceconnectionstatechange = event => {
    //log('on ice connection state change');
    //console.log(event);
    
    if (peer.iceConnectionState === 'connected') {
      //log('peer.iceConnectionState === "connected"');
    }
    if (peer.iceConnectionState === "connected") {
      //log('peer.iceConnectionState === "connected"');
    }
  };
  peer.onsignalingstatechange = event => {
    //log('On signaling state change');
    //console.log(event);
    //console.log(peer.signalingState);
  };
  
  //peer.addStream(localStream);
  
  for (const track of localStream.getTracks()) {
   console.log(track);
   console.log(localStream);
   peer.addTrack(track, localStream);
   }
  
  peer.ontrack = event => {
    //console.log('onaddstream', event);
    let video = document.createElement('video');
    
    video.id = "remoteView" + socketId;
    
    //console.log(event.streams);
    
    video.srcObject = event.streams[0];
    video.muted = true;
    //video.autoplay = true;
    video.onloadedmetadata = async () => {
      try {
        await video.play();
      } catch (error) {
        logError(error);
      }
    };
    
    remoteViewContainer.appendChild(video);
  };
  
  function createOffer() {
    let callback = desc => {
      //console.log('createOffer', desc);
      peer.setLocalDescription(desc)
        .then(callback2)
        .catch(logError);
    };
    let callback2 = () => {
      //console.log('setLocalDescription', peer.localDescription);
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
  //console.log('leave', socketId);
  
  const peer = pcPeers[socketId];
  
  peer.close();
  
  delete pcPeers[socketId];
  
  let video = document.getElementById("remoteView" + socketId);
  
  if (video) video.remove();
}

function logError(error) {
  console.log('\n\n%c START ________________________ Log Error ______________________', ' color: red; font-size: 20px');
  //console.log(error + '\n\n');
  console.log(error.toString() + '\n\n');
  console.trace();
  console.log('%c END __________________________ Log Error ______________________\n\n', 'color: red; font-size: 20px');
}

function log(log) {
  console.log('\n\n%c ______________________ ' + log + ' ______________________', 'font-size: 20px');
}