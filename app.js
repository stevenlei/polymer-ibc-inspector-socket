require("dotenv").config();
const { ethers } = require("ethers");

const { Server } = require("socket.io");
const { createClient } = require("redis");
const redisLock = require("redis-lock");

// Keep socket alive
const SOCKET_EXPECTED_PONG_BACK = 15000;
const SOCKET_KEEP_ALIVE_CHECK_INTERVAL = 7500;
let socketPingTimeout = null;
let socketKeepAliveInterval = null;

let io, redis, lock;

// const opDispatcherAbi = require("./abi/OP_DISPATCHER.json");
// const baseDispatcherAbi = require("./abi/BASE_DISPATCHER.json");
// const opSimDispatcherAbi = require("./abi/OP_DISPATCHER_SIM.json");
// const baseSimDispatcherAbi = require("./abi/BASE_DISPATCHER_SIM.json");

// # Contract addresses last updated on 2024-03-04, for public testnet launch
// OP_DISPATCHER='0x58f1863f75c9db1c7266dc3d7b43832b58f35e83'
// BASE_DISPATCHER='0xfc1d3e02e00e0077628e8cc9edb6812f95db05dc'

// # Contract addresses for the sim-client
// OP_DISPATCHER_SIM="0x6C9427E8d770Ad9e5a493D201280Cc178125CEc0"
// BASE_DISPATCHER_SIM="0x0dE926fE2001B2c96e9cA6b79089CEB276325E9F"

/*
Contract Events:

SendPacket(address indexed sourcePortAddress, bytes32 indexed sourceChannelId, bytes packet, uint64 sequence, uint64 timeoutTimestamp)

opDispatcher: {
  "_type": "log",
  "address": "0x6C9427E8d770Ad9e5a493D201280Cc178125CEc0",
  "blockHash": "0xffce930dd2877bbcde3afb9aad46d9ff062b125caeec3eb25f76c4a827e04f9c",
  "blockNumber": 9349278,
  "data": "0x0000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000017bd0c6d0e355000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000043fa4449df5870a6f036711d9af7a86eeb4195eb",
  "index": 0,
  "removed": false,
  "topics": [
    "0xb5bff96e18da044e4e34510d16df9053b9f1920f6a960732e5aaf22fe9b80136",
    "0x00000000000000000000000085a7d4df0ce7b6b91b983bfa9c9ec1054a9e399e",
    "0x6368616e6e656c2d333732343600000000000000000000000000000000000000"
  ],
  "transactionHash": "0x79b2c2eb9ba09ab57d9dedc750202a03152203085a3df33b5b705d776173e3e7",
  "transactionIndex": 1
}


RecvPacket(address indexed destPortAddress, bytes32 indexed destChannelId, uint64 sequence)

baseDispatcher: {
  "_type": "log",
  "address": "0x0dE926fE2001B2c96e9cA6b79089CEB276325E9F",
  "blockHash": "0xc7a324b335d03a067261218ce6254115ff35fcd7b47eaa231f2a9613adef36b8",
  "blockNumber": 7366411,
  "data": "0x0000000000000000000000000000000000000000000000000000000000000001",
  "index": 1,
  "removed": false,
  "topics": [
    "0xde5b57e6566d68a30b0979431df3d5df6db3b9aa89f8820f595b9315bf86d067",
    "0x000000000000000000000000a36909f55839c5b5c2484556474b3f560ba27115",
    "0x6368616e6e656c2d333732343700000000000000000000000000000000000000"
  ],
  "transactionHash": "0x69b1fda18931e4801d4e67516b18fbe0b6b109612ffafa0183f6e48e53fdf0e8",
  "transactionIndex": 2
}


WriteAckPacket(address indexed writerPortAddress, bytes32 indexed writerChannelId, uint64 sequence, (bool,bytes) ackPacket)

baseDispatcher: {
  "_type": "log",
  "address": "0x0dE926fE2001B2c96e9cA6b79089CEB276325E9F",
  "blockHash": "0xc7a324b335d03a067261218ce6254115ff35fcd7b47eaa231f2a9613adef36b8",
  "blockNumber": 7366411,
  "data": "0x000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000001",
  "index": 2,
  "removed": false,
  "topics": [
    "0xa32e6f42b1d63fb83ad73b009a6dbb9413d1da02e95b1bb08f081815eea8db20",
    "0x000000000000000000000000a36909f55839c5b5c2484556474b3f560ba27115",
    "0x6368616e6e656c2d333732343700000000000000000000000000000000000000"
  ],
  "transactionHash": "0x69b1fda18931e4801d4e67516b18fbe0b6b109612ffafa0183f6e48e53fdf0e8",
  "transactionIndex": 2
}


Acknowledgement(address indexed sourcePortAddress, bytes32 indexed sourceChannelId, uint64 sequence)

opDispatcher: {
  "_type": "log",
  "address": "0x6C9427E8d770Ad9e5a493D201280Cc178125CEc0",
  "blockHash": "0x7e4cfa2e559a5d2a4fc93f841a2dc51d2fcd13cb16e2abb1402d99cc53c49fcd",
  "blockNumber": 9349294,
  "data": "0x0000000000000000000000000000000000000000000000000000000000000001",
  "index": 3,
  "removed": false,
  "topics": [
    "0xe46f6591236abe528fe47a3b281fb002524dadd3e62b1f317ed285d07273c3b1",
    "0x00000000000000000000000085a7d4df0ce7b6b91b983bfa9c9ec1054a9e399e",
    "0x6368616e6e656c2d333732343600000000000000000000000000000000000000"
  ],
  "transactionHash": "0xda2142d30226c0d323520029c77be1aa2092f9b5fbe7ad8519f276dd74fb2bb4",
  "transactionIndex": 2
}

*/

async function main() {
  io = new Server({
    cors: {
      origin: "*",
    },
  });

  io.on("connection", async (socket) => {
    // send the packets from redis
    console.log(socket.id);

    const packets = await redis.get("packet");

    // parse the packet object
    const parsedPackets = JSON.parse(packets) || [];

    // send the packets
    for (const packet of parsedPackets) {
      socket.emit("packet", packet);
    }
  });

  io.listen(8008);

  redis = createClient();
  lock = redisLock(redis);
  await redis.connect();

  const wsProviderOp = new ethers.WebSocketProvider(process.env.OP_WSS_RPC_URL);
  const wsProviderBase = new ethers.WebSocketProvider(
    process.env.BASE_WSS_RPC_URL
  );

  wsProviderOp.on(
    {
      address: [process.env.OP_DISPATCHER_SIM, process.env.OP_DISPATCHER],
    },
    (event) => {
      processEvent("op", event);
    }
  );

  wsProviderBase.on(
    {
      address: [process.env.BASE_DISPATCHER_SIM, process.env.BASE_DISPATCHER],
    },
    (event) => {
      processEvent("base", event);
    }
  );

  // [OP] keep the socket alive
  let opPingTimeout = null;
  let opKeepAliveInterval = null;

  wsProviderOp.websocket.on("open", () => {
    opKeepAliveInterval = setInterval(() => {
      console.debug(
        `>>> [OP] Checking if the connection is alive, sending a ping.`
      );

      wsProviderOp.websocket.ping();

      opPingTimeout = setTimeout(() => {
        wsProviderOp.websocket.terminate();
      }, SOCKET_EXPECTED_PONG_BACK);
    }, SOCKET_KEEP_ALIVE_CHECK_INTERVAL);
  });

  wsProviderOp.websocket.on("close", () => {
    console.error(
      `> [OP] The websocket connection was closed, reconnecting...`
    );
    clearInterval(opKeepAliveInterval);
    clearTimeout(opPingTimeout);

    // pm2 will restart the process
    process.exit(1);
  });

  wsProviderOp.websocket.on("pong", () => {
    console.debug(
      `> [OP] Received pong, so connection is alive, clearing the timeout.`
    );
    clearInterval(opPingTimeout);
  });

  // [BASE] keep the socket alive
  let basePingTimeout = null;
  let baseKeepAliveInterval = null;

  wsProviderBase.websocket.on("open", () => {
    baseKeepAliveInterval = setInterval(() => {
      console.debug(
        `>>> [BASE] Checking if the connection is alive, sending a ping.`
      );

      wsProviderBase.websocket.ping();

      basePingTimeout = setTimeout(() => {
        wsProviderBase.websocket.terminate();
      }, SOCKET_EXPECTED_PONG_BACK);
    }, SOCKET_KEEP_ALIVE_CHECK_INTERVAL);
  });

  wsProviderBase.websocket.on("close", () => {
    console.error(
      `> [BASE] The websocket connection was closed, reconnecting...`
    );
    clearInterval(baseKeepAliveInterval);
    clearTimeout(basePingTimeout);

    // pm2 will restart the process
    process.exit(1);
  });

  wsProviderBase.websocket.on("pong", () => {
    console.debug(
      `> [BASE] Received pong, so connection is alive, clearing the timeout.`
    );
    clearInterval(basePingTimeout);
  });
}

async function processEvent(chain, event) {
  // so we need to decode 4 types of events
  // 1. SendPacket
  // 2. RecvPacket
  // 3. WriteAckPacket
  // 4. Acknowledgement

  // console.log(event);

  // encode event signature to match
  const signatureSendPacket = ethers.id(
    "SendPacket(address,bytes32,bytes,uint64,uint64)"
  );
  const signatureRecvPacket = ethers.id("RecvPacket(address,bytes32,uint64)");
  const signatureWriteAckPacket = ethers.id(
    "WriteAckPacket(address,bytes32,uint64,(bool,bytes))"
  );
  const signatureAcknowledgement = ethers.id(
    "Acknowledgement(address,bytes32,uint64)"
  );

  /*
Put the decoded data into following structure:
{
  type: "SendPacket",
  sourcePort: "0x85a7d4df0ce7b6b91b983bfa9c9ec1054a9e399e",
  destPort: "0xa36909f55839c5b5c2484556474b3f560ba27115",
  timeout: 1710537096,
  arrival: 15,
  block: 9349278,
  tx: "0xda...2bb4",
  op: true,
  base: false,
},
{
  type: "RecvPacket",
  sourcePort: "0x85a7d4df0ce7b6b91b983bfa9c9ec1054a9e399e",
  destPort: "0xa36909f55839c5b5c2484556474b3f560ba27115",
  timeout: 1710537096,
  arrival: 15,
  block: 9349278,
  tx: "0xda...2bb4",
  op: false,
  base: true,
},
{
  type: "WriteAckPacket",
  sourcePort: "0x85a7d4df0ce7b6b91b983bfa9c9ec1054a9e399e",
  destPort: "0xa36909f55839c5b5c2484556474b3f560ba27115",
  timeout: 1710537096,
  arrival: 15,
  block: 9349278,
  tx: "0xda...2bb4",
  op: false,
  base: true,
},
{
  type: "Acknowledgement",
  sourcePort: "0x85a7d4df0ce7b6b91b983bfa9c9ec1054a9e399e",
  destPort: "0xa36909f55839c5b5c2484556474b3f560ba27115",
  timeout: 1710537096,
  arrival: 15,
  block: 9349278,
  tx: "0xda...2bb4",
  op: true,
  base: false,
},
*/

  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  if (event.topics[0] === signatureSendPacket) {
    console.log("SendPacket", chain, event);

    try {
      // decode data
      const [sourcePortAddress] = abiCoder.decode(["address"], event.topics[1]);
      const [sourceChainId] = abiCoder.decode(["bytes32"], event.topics[2]);
      const [packet, sequence, timeoutTimestamp] = abiCoder.decode(
        ["bytes", "uint64", "uint64"],
        event.data
      );

      const result = {
        type: "SendPacket",
        sequence: Number(sequence),
        sourceChainId: ethers.decodeBytes32String(sourceChainId),
        sourcePort: sourcePortAddress,
        timeout: Number(timeoutTimestamp / 1000000000n),
        arrival: +new Date(),
        block: event.blockNumber,
        tx: event.transactionHash,
        op: chain === "op",
        base: chain === "base",
        packet: packet,
      };

      console.log(result);
      io.emit("packet", result);

      await storeInRedis("packet", result);
    } catch (e) {
      console.error(e);
    }
  } else if (event.topics[0] === signatureRecvPacket) {
    console.log("RecvPacket", chain, event);

    try {
      // decode data
      const [destPortAddress] = abiCoder.decode(["address"], event.topics[1]);
      const [destChainId] = abiCoder.decode(["bytes32"], event.topics[2]);
      const [sequence] = abiCoder.decode(["uint64"], event.data);

      const result = {
        type: "RecvPacket",
        sequence: Number(sequence),
        destChainId: ethers.decodeBytes32String(destChainId),
        destPort: destPortAddress,
        arrival: +new Date(),
        block: event.blockNumber,
        tx: event.transactionHash,
        op: chain === "op",
        base: chain === "base",
      };

      console.log(result);
      io.emit("packet", result);

      await storeInRedis("packet", result);
    } catch (e) {
      console.error(e);
    }
  } else if (event.topics[0] === signatureWriteAckPacket) {
    console.log("WriteAckPacket", chain, event);

    try {
      // decode data
      const [writerPortAddress] = abiCoder.decode(["address"], event.topics[1]);
      const [writerChainId] = abiCoder.decode(["bytes32"], event.topics[2]);
      const [sequence, ackPacket] = abiCoder.decode(
        ["uint64", "(bool,bytes)"],
        event.data
      );

      const result = {
        type: "WriteAckPacket",
        sequence: Number(sequence),
        writerChainId: ethers.decodeBytes32String(writerChainId),
        writerPort: writerPortAddress,
        arrival: +new Date(),
        block: event.blockNumber,
        tx: event.transactionHash,
        op: chain === "op",
        base: chain === "base",
        ackPacket: ackPacket,
      };

      console.log(result);
      io.emit("packet", result);

      await storeInRedis("packet", result);
    } catch (e) {
      console.error(e);
    }
  } else if (event.topics[0] === signatureAcknowledgement) {
    console.log("Acknowledgement", chain, event);

    try {
      // decode data
      const [sourcePortAddress] = abiCoder.decode(["address"], event.topics[1]);
      const [sourceChainId] = abiCoder.decode(["bytes32"], event.topics[2]);
      const [sequence] = abiCoder.decode(["uint64"], event.data);

      const result = {
        type: "Acknowledgement",
        sequence: Number(sequence),
        sourceChainId: ethers.decodeBytes32String(sourceChainId),
        sourcePort: sourcePortAddress,
        arrival: +new Date(),
        block: event.blockNumber,
        tx: event.transactionHash,
        op: chain === "op",
        base: chain === "base",
      };

      console.log(result);
      io.emit("packet", result);

      await storeInRedis("packet", result);
    } catch (e) {
      console.error(e);
    }
  }
}

async function storeInRedis(key, value) {
  const done = await lock("writing");

  // get the packet object from redis
  const packets = await redis.get(key);

  // parse the packet object
  const parsedPackets = JSON.parse(packets) || [];

  // append the new packet
  parsedPackets.push(value);

  // slice the array to keep only the last 120 packets
  const slicedPackets = parsedPackets.slice(-120);

  // store the new packet object
  await redis.set(key, JSON.stringify(slicedPackets));

  await done();

  return true;
}

main();
