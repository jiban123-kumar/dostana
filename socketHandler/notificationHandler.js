module.exports = (socket, io) => {
  // Listen for the "send-notification" event from the sender.
  socket.on("new-notification", (data) => {
    io.to(data.targetUserId).emit("new-notification", { notification: data.notification });
  });
};
