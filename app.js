const express = require('express');
const app = express();
const fs = require('fs');
const open = require('open');
const options = {
  key: fs.readFileSync('./fake-keys/privatekey.pem'),
  cert: fs.readFileSync('./fake-keys/certificate.pem'),
};
const serverPort = (process.env.PORT || 4443);
const https = require('https');
const http = require('http');
let server;
if (process.env.LOCAL) {
  server = https.createServer(options, app);
} else {
  server = http.createServer(app);
}
const io = require('socket.io')(server);

//Middleware
app.use(express.static(__dirname + '/public'));
app.get('/', getCallback);
server.listen(serverPort, listenCallback);
io.on('connection', ioCallback);

// Functions
function getCallback(req, res) {
  console.log('get /');
  res.sendFile(__dirname + '/index.html');
}

function listenCallback() {
  console.log('server up and running at %s port', serverPort);
  if (process.env.LOCAL) {
    open('https://localhost:' + serverPort);
  }
}

function ioCallback(socket) {
  console.log('ioCallback');
  
  const onDisconnect = () => {
    console.log('disconnect');
    
    if (socket.room) {
      let room = socket.room;
      io.to(room).emit('leave', socket.id);
      socket.leave(room);
      
      console.log('leave');
    }
  };
  const onJoin = (name, callback) => {
    console.log('join', name);
    
    let socketIds = socketIdsInRoom(name);
    callback(socketIds);
    socket.join(name);
    socket.room = name;
  };
  const onExchange = data => {
    //console.log('exchange', data);
    
    data.from = socket.id;
    let to = io.sockets.connected[data.to];
    to.emit('exchange', data);
  };
  
  socket.on('disconnect', onDisconnect);
  socket.on('join', onJoin);
  socket.on('exchange', onExchange);
}

function socketIdsInRoom(name) {
  let socketIds = io.nsps['/'].adapter.rooms[name];
  if (socketIds) {
    let collection = [];
    for (let key in socketIds) {
      collection.push(key);
    }
    return collection;
  } else {
    return [];
  }
}
