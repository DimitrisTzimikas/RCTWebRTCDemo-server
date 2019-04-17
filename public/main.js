let socket = io();

let RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection || window.msRTCPeerConnection;
let RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription || window.msRTCSessionDescription;

let configuration = { iceServers: [{ "urls": "stun:stun.l.google.com:19302" }] };

let pcPeers = {};

let selfView = document.getElementById("selfView");
let selfView2 = document.getElementById("selfView2");
let remoteViewContainer = document.getElementById("remoteViewContainer");

let localStream;
let flag = false;

socket.on('exchange', data => {
  exchange(data);
});

socket.on('leave', socketId => {
  leave(socketId);
});

socket.on('connect', () => {
  console.log('connect');
  getLocalStream();
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
  
  peer.ontrack = function (event) {
    //console.log('onaddstream', event);
    let element = document.createElement('video');
    
    /*element.id = "remoteView" + socketId;
     element.autoplay = 'autoplay';
     element.srcObject = event.streams[0];*/
    
    /*remoteViewContainer.appendChild(element);
     event.streams.getTracks().forEach(track => peer.addTrack(track, event.streams));*/
    
    /*selfView2.id = "remoteView" + socketId;
     selfView2.autoplay = 'autoplay';
     selfView2.srcObject = event.streams[0];*/
    
    //localStream = event;
    
    element.id = "remoteView" + socketId;
    element.autoplay = 'autoplay';
    window.mediaStream = event.streams[0];
    element.srcObject = event.streams[0];
    element.muted = true;
    element.onloadedmetadata = () => {
      element.play();
    };
    
    remoteViewContainer.appendChild(element);
    
    /*if (flag === false) {
     remoteViewContainer.appendChild(element);
     
     /!*selfView2.id = "remoteView" + socketId;
     selfView2.autoplay = 'autoplay';
     selfView2.srcObject = event.streams[0];*!/
     
     //localStream = event;
     window.mediaStream = event.streams[0];
     element.srcObject = event.streams[0];
     element.muted = true;
     element.onloadedmetadata = () => {
     element.play();
     };
     
     flag = true;
     }*/
  };
  
  function createOffer() {
    let callback = desc => {
      //console.log('createOffer', desc);
      peer.setLocalDescription(desc, callback2, logError);
    };
    let callback2 = () => {
      //console.log('setLocalDescription', peer.localDescription);
      socket.emit('exchange', { 'to': socketId, 'sdp': peer.localDescription });
    };
    peer.createOffer(callback, logError);
  }
  
  return peer;
}

function exchange(data) {
  let fromId = data.from;
  let pc;
  if (fromId in pcPeers) {
    pc = pcPeers[fromId];
  } else {
    pc = createPC(fromId, false);
  }
  
  if (data.sdp) {
    console.log('exchange sdp', data);
    pc.setRemoteDescription(new RTCSessionDescription(data.sdp), function () {
      if (pc.remoteDescription.type === "offer") {
        pc.createAnswer(function (desc) {
          console.log('createAnswer', desc);
          pc.setLocalDescription(desc, function () {
            console.log('setLocalDescription', pc.localDescription);
            socket.emit('exchange', { 'to': fromId, 'sdp': pc.localDescription });
          }, logError);
        }, logError);
      }
    }, logError);
  } else {
    console.log('exchange candidate', data);
    pc.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
}

function leave(socketId) {
  console.log('leave', socketId);
  let pc = pcPeers[socketId];
  pc.close();
  delete pcPeers[socketId];
  let video = document.getElementById("remoteView" + socketId);
  if (video) video.remove();
}

function logError(error) {
  console.log("logError", error);
}
