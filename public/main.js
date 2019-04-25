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
    "audio": false,
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
    
    if (navigator.userAgent.search("Firefox") === -1) {
      //log('Video Codecs', window.RTCRtpSender.getCapabilities("video").codecs, 'table');
    }
    //log('Array with tracks', localStream.getTracks(), 'table');
  };
  
  /*console.log(window.RTCRtpSender.getCapabilities("video").codecs.map(e => e.name).indexOf("H264"));
   console.log(window.RTCRtpSender.getCapabilities("video"));
   console.log(window.RTCRtpSender.getCapabilities("audio"));*/
  
  /*navigator.mediaDevices.getUserMedia = ( navigator.mediaDevices.getUserMedia ||
   navigator.webkitGetUserMedia ||
   navigator.mozGetUserMedia ||
   navigator.msGetUserMedia);*/
  
  //navigator.mediaDevices.enumerateDevices().then(console.table);
  
  navigator.mediaDevices.getUserMedia(constrains)
    .then(callback)
    .catch(logError);
}

function onPress() {
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
    //log('join', socketIds, 'table');
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
    //log('on ice connection state change', event);
    
    if (peer.iceConnectionState === 'connected') {
      //log('peer.iceConnectionState === "connected"');
    }
    if (peer.iceConnectionState === "connected") {
      //log('peer.iceConnectionState === "connected"');
    }
  };
  peer.onsignalingstatechange = event => {
    //log('On signaling state change', event);
    //console.log(peer.signalingState);
  };
  
  //peer.addStream(localStream);
  for (const track of localStream.getTracks()) {
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
      
      log('The SDP offer', desc.sdp);
      
      peer.setLocalDescription(desc)
        .then(callback2)
        .catch(logError);
    };
    let callback2 = () => {
      
      //log('setLocalDescription', peer.localDescription, 'table');
      
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