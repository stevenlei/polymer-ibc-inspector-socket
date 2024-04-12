# Polymer IBC Inspector (Socket Server)

This is a socket server that listens for Polymer IBC packets in real-time and emits them to connected clients from the [Polymer IBC Inspector](https://ibcinspector.com), supporting the "Live" page.

The server is written in Node.js and uses the [socket.io](https://socket.io) library to handle the WebSocket connections.

**This was built in the early days to support the [Polymer IBC Inspector](https://ibcinspector.com) and should be migrated to the [polymer-ibc-indexer](https://github.com/stevenlei/polymer-ibc-indexer) very soon, which is a more robust and reliable solution.**

## Environment Requirements

- Node.js v20 or higher
- Redis Server

## Installation

1. Clone the repository
2. Run `npm install`
3. Copy the `.env.example` file to `.env` and fill in the required values: `OP_WSS_RPC_URL` and `BASE_WSS_RPC_URL` respectively
4. Run `npm start`
