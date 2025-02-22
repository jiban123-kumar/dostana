module.exports = (io) => {
  io.on("connection", (socket) => {
    require("./registrationHandler")(socket, io);
    require("./friendHandler")(socket, io);
    require("./contentHandler")(socket, io);
    require("./messageHandler")(socket, io);
    require("./notificationHandler")(socket, io);
  });
};
