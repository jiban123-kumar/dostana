module.exports = (socket, io) => {
  // --- Content Reaction ---
  socket.on("contentReaction", (data) => {
    socket.broadcast.to(data.targetUserId).emit("contentReaction", data);
  });

  // --- Content Share ---
  socket.on("contentShare", (data) => {
    const targetUserId = data.targetUserId;
    io.to(targetUserId).emit("contentShare", data);
  });

  // For newContent, if you want to exclude the sender:
  socket.on("contentCreation", (data) => {
    io.emit("contentCreation", data);
  });

  socket.on("contentDeletion", (data) => {
    console.log("data", data);
    io.emit("contentDeletion", data);
  });

  socket.on("contentNewComment", (data) => {
    socket.broadcast.to(data.targetUserId).emit("contentNewComment", data);
  });
  socket.on("contentCommentDeletion", (data) => {
    socket.broadcast.to(data.targetUserId).emit("contentDeleteComment", data);
  });
};
