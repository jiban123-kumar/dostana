// socketHandlers/friendHandler.js

module.exports = (socket, io) => {
  socket.on("friend-request-accepted", (data) => {
    io.to(data.targetUserId).emit("friend-request-accepted", data);
  });
  socket.on("friend-request-declined", (data) => {
    io.to(data.targetUserId).emit("friend-request-declined", data);
  });
  socket.on("friend-request-cancelled", (data) => {
    io.to(data.targetUserId).emit("friend-request-cancelled", data);
  });
  socket.on("friend-request-sent", (data) => {
    console.log("friend-request-sent", data.targetUserId);
    io.to(data.targetUserId).emit("friend-request-received", data);
  });
  socket.on("friend-removed", (data) => {
    io.to(data.targetUserId).emit("friend-removed", data);
  });
};
