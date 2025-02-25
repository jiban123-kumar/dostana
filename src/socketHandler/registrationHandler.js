const UserStatus = require("../model/userStatus");
const Friend = require("../model/friendModel");

module.exports = (socket, io) => {
  // Extract user info from the handshake auth data
  const { userId, name, profileImage } = socket.handshake.auth || {};

  if (userId) {
    // Join a room with the user's ID so that friends can target updates
    socket.join(userId);

    // When a socket connects, update the user status to online and notify friends.
    (async () => {
      try {
        const userStatus = await UserStatus.findOneAndUpdate({ user: userId }, { isOnline: true, lastSeen: null }, { new: true, upsert: true });

        // Find accepted friends
        const friends = await Friend.find({
          status: "accepted",
          $or: [{ requester: userId }, { recipient: userId }],
        });

        // Notify each friend that this user is online
        friends.forEach((friend) => {
          const friendId = friend.requester._id.toString() === userId ? friend.recipient._id.toString() : friend.requester._id.toString();

          io.to(friendId).emit("friend-online-status", {
            userId: userStatus.user,
            isOnline: true,
            lastSeen: null,
            profileImage,
            name,
          });
        });
      } catch (error) {
        console.error("Error updating user status on connection:", error);
      }
    })();
  }
  // When the socket disconnects, update the user status to offline and notify friends.
  socket.on("disconnect", async (reason) => {
    if (userId) {
      try {
        const userStatus = await UserStatus.findOneAndUpdate({ user: userId }, { isOnline: false, lastSeen: new Date() }, { new: true });

        const friends = await Friend.find({
          status: "accepted",
          $or: [{ requester: userId }, { recipient: userId }],
        });

        friends.forEach((friend) => {
          const friendId = friend.requester._id.toString() === userId ? friend.recipient._id.toString() : friend.requester._id.toString();

          io.to(friendId).emit("friend-online-status", {
            userId: userStatus.user,
            isOnline: false,
            lastSeen: userStatus.lastSeen,
          });
        });
      } catch (error) {
        console.error("Error updating user status on disconnect:", error);
      }
    }
  });
};
