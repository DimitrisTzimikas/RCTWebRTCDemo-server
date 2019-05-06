'use strict';

const startButton = document.getElementById('startButton');
const callButton = document.getElementById('callButton');
const hangupButton = document.getElementById('hangupButton');
const p = document.querySelector("p");

callButton.disabled = true;
hangupButton.disabled = true;
startButton.addEventListener('click', start);
callButton.addEventListener('click', call);
hangupButton.addEventListener('click', hangup);

let startTime;
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
remoteVideo.autoplay = true;

localVideo.addEventListener('loadedmetadata', function () {
  console.log(`Local video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`);
  p.innerHTML += '<br>' + `Local video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`;
  p.innerHTML += `<br> hello`;
});

remoteVideo.addEventListener('loadedmetadata', function () {
  console.log(`Remote video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`);
  p.innerHTML += '<br>' + `Remote video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`;
  p.innerHTML += `<br> hello again`;
  remoteVideo.autoplay = true;
});

remoteVideo.addEventListener('resize', () => {
  console.log(`Remote video size changed to ${remoteVideo.videoWidth}x${remoteVideo.videoHeight}`);
  p.innerHTML += '<br>' + `Remote video size changed to ${remoteVideo.videoWidth}x${remoteVideo.videoHeight}`;
  // We'll use the first onsize callback as an indication that video has started
  // playing out.
  p.innerHTML += '<br>' + startTime;
  if (startTime) {
    const elapsedTime = window.performance.now() - startTime;
    console.log('Setup time: ' + elapsedTime.toFixed(3) + 'ms');
    p.innerHTML += '<br>' + 'Setup time: ' + elapsedTime.toFixed(3) + 'ms';
    startTime = null;
  }
});

let localStream;
let pc1;
let pc2;

// Deprecated
/*const offerOptions = {
 offerToReceiveAudio: 1,
 offerToReceiveVideo: 1,
 };*/

function getName(pc) {
  return (pc === pc1) ? 'pc1' : 'pc2';
}

function getOtherPc(pc) {
  return (pc === pc1) ? pc2 : pc1;
}

async function start() {
  console.log('Requesting local stream');
  p.innerHTML += '<br>' + 'Requesting local stream';
  startButton.disabled = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    console.log('Received local stream');
    p.innerHTML += '<br>' + 'Received local stream';
    localVideo.srcObject = stream;
    localStream = stream;
    callButton.disabled = false;
  } catch (e) {
    console.log(`getUserMedia() error: ${e.name}`);
    p.innerHTML += '<br>' + `getUserMedia() error: ${e.name}`;
  }
}

function getSelectedSdpSemantics() {
  const sdpSemanticsSelect = document.querySelector('#sdpSemantics');
  const option = sdpSemanticsSelect.options[sdpSemanticsSelect.selectedIndex];
  return option.value === '' ? {} : { sdpSemantics: option.value };
}

async function call() {
  callButton.disabled = true;
  hangupButton.disabled = false;
  console.log('Starting call');
  p.innerHTML += '<br>' + 'Starting call';
  startTime = window.performance.now();
  p.innerHTML += '<br>' + startTime;
  const videoTracks = localStream.getVideoTracks();
  const audioTracks = localStream.getAudioTracks();
  if (videoTracks.length > 0) {
    console.log(`Using video device: ${videoTracks[0].label}`);
    p.innerHTML += '<br>' + `Using video device: ${videoTracks[0].label}`;
  }
  if (audioTracks.length > 0) {
    console.log(`Using audio device: ${audioTracks[0].label}`);
    p.innerHTML += '<br>' + `Using audio device: ${audioTracks[0].label}`;
  }
  const configuration = getSelectedSdpSemantics();
  console.log('RTCPeerConnection configuration:', configuration);
  p.innerHTML += '<br>' + 'RTCPeerConnection configuration:', configuration;
  pc1 = new RTCPeerConnection(configuration);
  console.log('Created local peer connection object pc1');
  p.innerHTML += '<br>' + 'Created local peer connection object pc1';
  pc1.addEventListener('icecandidate', e => onIceCandidate(pc1, e));
  pc2 = new RTCPeerConnection(configuration);
  console.log('Created remote peer connection object pc2');
  p.innerHTML += '<br>' + 'Created remote peer connection object pc2';
  pc2.addEventListener('icecandidate', e => onIceCandidate(pc2, e));
  pc1.addEventListener('iceconnectionstatechange', e => onIceStateChange(pc1, e));
  pc2.addEventListener('iceconnectionstatechange', e => onIceStateChange(pc2, e));
  pc2.addEventListener('track', gotRemoteStream);
  
  localStream.getTracks().forEach(track => pc1.addTrack(track, localStream));
  console.log('Added local stream to pc1');
  p.innerHTML += '<br>' + 'Added local stream to pc1';
  
  try {
    console.log('pc1 createOffer start');
    p.innerHTML += '<br>' + 'pc1 createOffer start';
    
    // Deprecated
    /*const offer = await pc1.createOffer(offerOptions);*/
    const offer = await pc1.createOffer();
    await onCreateOfferSuccess(offer);
  } catch (e) {
    onCreateSessionDescriptionError(e);
  }
}

function onCreateSessionDescriptionError(error) {
  console.log(`Failed to create session description: ${error.toString()}`);
  p.innerHTML += '<br>' + `Failed to create session description: ${error.toString()}`;
}

async function onCreateOfferSuccess(desc) {
  console.log(`Offer from pc1\n${desc.sdp}`);
  //p.innerHTML += '<br>' + `Offer from pc1\n${desc.sdp}`;
  console.log('pc1 setLocalDescription start');
  p.innerHTML += '<br>' + 'pc1 setLocalDescription start';
  try {
    await pc1.setLocalDescription(desc);
    onSetLocalSuccess(pc1);
  } catch (e) {
    onSetSessionDescriptionError();
  }
  
  console.log('pc2 setRemoteDescription start');
  p.innerHTML += '<br>' + 'pc2 setRemoteDescription start';
  try {
    await pc2.setRemoteDescription(desc);
    onSetRemoteSuccess(pc2);
  } catch (e) {
    onSetSessionDescriptionError();
  }
  
  console.log('pc2 createAnswer start');
  p.innerHTML += '<br>' + 'pc2 createAnswer start';
  // Since the 'remote' side has no media stream we need
  // to pass in the right constraints in order for it to
  // accept the incoming offer of audio and video.
  try {
    const answer = await pc2.createAnswer();
    await onCreateAnswerSuccess(answer);
  } catch (e) {
    onCreateSessionDescriptionError(e);
  }
}

function onSetLocalSuccess(pc) {
  console.log(`${getName(pc)} setLocalDescription complete`);
  p.innerHTML += '<br>' + `${getName(pc)} setLocalDescription complete`;
}

function onSetRemoteSuccess(pc) {
  console.log(`${getName(pc)} setRemoteDescription complete`);
  p.innerHTML += '<br>' + `${getName(pc)} setRemoteDescription complete`;
}

function onSetSessionDescriptionError(error) {
  console.log(`Failed to set session description: ${error.toString()}`);
  p.innerHTML += '<br>' + `Failed to set session description: ${error.toString()}`;
}

function gotRemoteStream(e) {
  console.log(`\n\n\n\n\n\n\n\n`);
  console.log(e);
  console.log(`\n\n\n\n\n\n\n\n`);
  if (remoteVideo.srcObject !== e.streams[0]) {
    remoteVideo.srcObject = e.streams[0];
    remoteVideo.play();
    console.log('pc2 received remote stream');
    p.innerHTML += '<br>' + 'pc2 received remote stream';
  }
}

async function onCreateAnswerSuccess(desc) {
  console.log(`Answer from pc2:\n${desc.sdp}`);
  //p.innerHTML += '<br>' + `Answer from pc2:\n${desc.sdp}`;
  console.log('pc2 setLocalDescription start');
  p.innerHTML += '<br>' + 'pc2 setLocalDescription start';
  try {
    await pc2.setLocalDescription(desc);
    onSetLocalSuccess(pc2);
  } catch (e) {
    onSetSessionDescriptionError(e);
  }
  console.log('pc1 setRemoteDescription start');
  p.innerHTML += '<br>' + 'pc1 setRemoteDescription start';
  try {
    await pc1.setRemoteDescription(desc);
    onSetRemoteSuccess(pc1);
  } catch (e) {
    onSetSessionDescriptionError(e);
  }
}

async function onIceCandidate(pc, event) {
  try {
    await (getOtherPc(pc).addIceCandidate(event.candidate));
    onAddIceCandidateSuccess(pc);
  } catch (e) {
    onAddIceCandidateError(pc, e);
  }
  console.log(`${getName(pc)} ICE candidate:\n${event.candidate ? event.candidate.candidate : '(null)'}`);
  //p.innerHTML += '<br>' + `${getName(pc)} ICE candidate:\n${event.candidate ? event.candidate.candidate : '(null)'}`;
}

function onAddIceCandidateSuccess(pc) {
  console.log(`${getName(pc)} addIceCandidate success`);
  //p.innerHTML += '<br>' + `${getName(pc)} addIceCandidate success`;
}

function onAddIceCandidateError(pc, error) {
  console.log(`${getName(pc)} failed to add ICE Candidate: ${error.toString()}`);
  //p.innerHTML += '<br>' + `${getName(pc)} failed to add ICE Candidate: ${error.toString()}`;
}

function onIceStateChange(pc, event) {
  if (pc) {
    console.log(`${getName(pc)} ICE state: ${pc.iceConnectionState}`);
    //p.innerHTML += '<br>' + `${getName(pc)} ICE state: ${pc.iceConnectionState}`;
    console.log('ICE state change event: ', event);
    //p.innerHTML += '<br>' + 'ICE state change event: ' + event;
  }
}

function hangup() {
  console.log('Ending call');
  p.innerHTML += '<br>' + 'Ending call';
  pc1.close();
  pc2.close();
  pc1 = null;
  pc2 = null;
  hangupButton.disabled = true;
  callButton.disabled = false;
}
