const socket = io();
const RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection || window.msRTCPeerConnection;
const RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription || window.msRTCSessionDescription;
const configuration = { iceServers: [{ urls: "stun:stun.1.google.com:19302" }] };
//const configuration = {sdpSemantics: 'unified-plan'};

const localVideo = document.getElementById("localVideo");
/*const remoteVideo = document.getElementById('remoteVideo');*/

const p = document.querySelector("p");
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
  log('Get local Stream');
  const constrains = {
    "audio": false,
    "video": true,
  };
  const getStream = stream => {
    localStream = stream;
    localVideo.srcObject = stream;
    localVideo.muted = true;
    localVideo.onloadedmetadata = async () => {
      try {
        await localVideo.play();
      } catch (error) {
        logError(error);
      }
    };
    
    // Check if browser is firefox
    if (navigator.userAgent.search("Firefox") === -1) {
      //log('Video Codecs', window.RTCRtpSender.getCapabilities("video").codecs, 'table');
      //log('Array with tracks', localStream.getTracks(), 'table');
    }
  };
  
  // Check codecs types
  /*console.log(window.RTCRtpSender.getCapabilities("video").codecs.map(e => e.name).indexOf("H264"));
   console.log(window.RTCRtpSender.getCapabilities("video"));
   console.log(window.RTCRtpSender.getCapabilities("audio"));*/
  
  // Get media devices
  /*navigator.mediaDevices.enumerateDevices().then(console.table);*/
  
  navigator.mediaDevices.getUserMedia(constrains)
    .then(getStream)
    .catch(logError);
}

function onPress() {
  log('You are entering the room');
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
    for (const i in socketIds) {
      if (socketIds.hasOwnProperty(i)) {
        const socketId = socketIds[i];
        log('Socket', socketId);
        createPC(socketId, true);
      }
    }
  };
  
  socket.emit('join', roomID, onJoin);
}

function createPC(socketId, isOffer) {
  log('In Create PC');
  let peer = new RTCPeerConnection(configuration);
  
  //log('Peer', peer, 'table');
  
  log('Peer', peer);
  
  pcPeers = {
    ...pcPeers,
    [socketId]: peer,
  };
  
  peer.onicecandidate = event => {
    //log('On Ice Candidate', event, 'table');
    
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
    if (peer.iceConnectionState === 'connected') {
      log('peer.iceConnectionState === "connected"', event);
    }
  };
  peer.onsignalingstatechange = event => {
    log('peer.onsignalingstatechange', event);
    log('peer.signalingState', peer.signalingState);
  };
  
  //peer.addStream(localStream);
  for (const track of localStream.getTracks()) {
    log('local streams', localStream.getTracks());
    peer.addTrack(track, localStream);
  }
  
  peer.ontrack = event => {
    
    let stream = event.stream;
    
    log('stream', stream);
    /* if (stream.getAudioTracks().length) alert('Peer has audio stream.');
     if (stream.getVideoTracks().length) alert('Peer has video stream.');*/
    
    //console.log('onaddstream', event);
    let video = document.createElement('video');
    video.id = "remoteView" + socketId;
    
    let isPlaying = video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2;
    
    // Check if video isn't playing
    if (!isPlaying) {
      // Doesn't duplicate same stream
      if (video.srcObject !== event.streams[0]) {
        video.srcObject = event.streams[0];
        video.play();
      }
    }
    
    /*video.srcObject = event.streams[0];
     video.muted = false;
     
     video.autoplay = true;
     video.onloadedmetadata = async () => {
     try {
     await video.play();
     } catch (error) {
     logError(error);
     }
     };*/
    
    // Console on site for webview debug
    p.innerHTML += `<br> is stream active? ${event.streams[0].active}`;
    p.innerHTML += `<br> stream id: ${event.streams[0].id}`;
    console.log(event.streams);
    
    /*remoteVideo.srcObject = event.streams[0];
     remoteVideo.play();*/
    
    remoteViewContainer.appendChild(video);
  };
  
  function createOffer() {
    let callback = desc => {
      
      //log('The SDP offer', desc.sdp);
      
      peer.setLocalDescription(desc)
        .then(callback2)
        .catch(logError);
    };
    let callback2 = () => {
      
      log('setLocalDescription', peer.localDescription);
      
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
  
  if (data.sdp) log('Exchange', data);
  
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
  console.log('\n\n%c START ________________________ Log Error ______________________', ' color: red; font-size: 15px');
  //console.log(error + '\n\n');
  console.log(error.toString() + '\n\n');
  console.trace();
  console.log('%c END __________________________ Log Error ______________________\n\n', 'color: red; font-size: 15px');
}

function log(log, value, type) {
  let count = 60;
  let i = 0;
  let str = '';
  let z = count - log.length;
  
  for (i; i <= z; i++) {
    str += '_';
    if (i === Math.floor(z / 2)) {
      str += log;
    }
  }
  console.log('%c' + str, 'font-size: 15px');
  value !== undefined ? (type === 'table' ? console.table(value) : console.log(value)) : null;
  console.log('\n\n');
}
