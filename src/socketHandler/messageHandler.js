// socketHandlers/contentHandler.js

module.exports = (socket, io) => {
  // Listen for the "send-message" event from the sender.
  socket.on("newMessage", (data) => {
    io.to(data.targetUserId).emit("newMessage", data);
  });
  socket.on("messageDeleted", (data) => {
    io.to(data.targetUserId).emit("messageDeleted", data);
  });
};
