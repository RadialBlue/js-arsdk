/*
 * Copyright 2017-2019 Tom Swindell
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * 
 */
const EventEmitter = require('events')

const Codec = require('./codec.js')
const CommandSet = require('./commands.js')

/**
 * Returns a hexadecimal formatted string, spaced at byte bounderies.
 * @private
 * @param {Buffer} buffer 
 */
const HEXDUMP = (buffer) => buffer.toString('hex').replace(/([0-9a-fA-F]{2})/g, '$1 ')

/**
 * Emitted when the connection has been closed.
 * @public
 * @event Connection#closed
 */

/**
 * Emitted when an error has occured.
 * @public
 * @event Connection#error
 * 
 * @property {Error} error
 */

/**
 * Emitted whenever a ping message is received from remote endpoint.
 * @public
 * @event Connection#ping
 */

/**
 * Emitted whenever a command is received from remote endpoint.
 * @public
 * @event Connection#navdata
 * 
 * @property {Message} message
 * @property {RemoteInfo} rinfo
 */

 /**
 * ARNet device control channel
 * 
 * @class
 * @public
 * @implements EventEmitter
 * 
 * @param {string} remoteAddr Remote device IPv4 address.
 * @param {uint16} remotePort Remote device C2D port (frequently 2233)
 * @param {dgram.Socket} socket Underlying UDP transport to use.
 * @param {Object} [opts]
 * @param {Logger} [opts.logger=console] Custom logger instance.
 */
function Connection (remoteAddr, remotePort, __socket, __opts) {
  EventEmitter.call(this)

  __opts = __opts || {}

  const __self = this
  const __debug = process.env.ARNET_DEBUG
  const __log  = __opts.logger || console

  const __messages = new CommandSet()

  const __queue = [] // Requests buffered for sending.
  const __responses = [] // Response queue for requested response/s.
  const __sequence = {} // Frame sequence field counters.

  let   __keepalive // Keep-alive timeoutId

  /**
   * Initialize this connection and it's incoming and outgoing command queues
   * and processors.
   * 
   * @public
   * @method Connection#initialize
   * 
   * @param {Object} [opts]
   * 
   * @returns {Promise}
   */
  const initialize = async (opts) => {
    opts = opts || {}

    // Import ARSDK command set from ARSDK XML command specificiation files.
    // XXX - Currently really only interested in a limited subset of commands,
    // should make this a bit more customisable.
    const modules = opts.modules || [
      'common', 'ardrone3', 'skyctrl', 'drone_manager', /* 'mapper',
      'controller_info', 'animation', 'user_storage',
      'rth', 'gimbal', 'battery', 'mediastore', 'precise_home' */
    ]
    await __messages.import.apply(__messages, modules)

    // Startup the keep-alive watchdog, this gets reset everytime we receive
    // some data.
    __keepalive = setTimeout(() => {
      __log.info("Keep-alive timeout, closing socket.")
      __self.close()
    }, opts.keepalive || 1000 * 5)

    // XXX - Abstract error and close handlers and deregister handlers in close.
    __socket.on('error', e => __self.emit('error', e))
    __socket.on('close', () => __self.emit('closed'))
    __socket.on('message', onIncomingMessage)

    // Handle killing keepalive watchdog
    __self.on('closed', () => clearTimeout(__keepalive))
  }

  /**
   * Send a Low-Level ARNET protocol frame to remote endpoint.
   * 
   * @public
   * @method Connection#sendFrame
   * 
   * @param {uint8} type Transport type
   * @param {uint8} id Transport id
   * @param {uint8} seq Message sequence
   * @param {Buffer} payload Message payload
   */
  const sendFrame = (type, id, seq, payload) => {
    const frame = Codec.Frame.pack(type, id, seq, payload)
    __socket.send(frame, remotePort, remoteAddr)

    if (__debug >= 4)
      __log.info(`TX: ${remoteAddr}:${remotePort} --> `, HEXDUMP(frame))
  }

  /**
   * Send ARNet command via transport to remote endpoint.
   * 
   * @public
   * @method Connection#sendCommand
   * 
   * @param {Object|string} command ARNET message info or command string.
   * @param {Object} [params] Command parameters.
   * 
   * @returns {Promise} If not expecting response, resolves straight away.
   * Otherwise when the expected response has been received, resolves with
   * result.
   */
  const sendCommand = (minfo, args, dequeue) => {
    args = args || []

    if (typeof(minfo) === 'string') minfo = __messages.resolve(minfo)
    if (!minfo) return

    return new Promise((resolve, reject) => {
        const { featureId, classId, messageId, bufferId, expects } = minfo

        // Queue requests (unless dequeueing) whilst waiting for responses.
        if (!dequeue && expects && expects.immediate) {
          __queue.push([minfo, args, resolve, reject])
          if (__queue.length > 1) return
        }

        // Initialize or reset message sequence counter.
        if (!(bufferId in __sequence) || __sequence[bufferId] > 255) {
          __sequence[bufferId] = 0
        }

        // Send message frame.
        if (__debug >= 3) __log.info('<<', minfo.path, args)
        sendFrame(
          Codec.ARSDK_FRAME_TYPE_DATA, bufferId, __sequence[bufferId]++,
          Codec.Message.pack(featureId, classId, messageId, minfo.encode(args))
        )

        // Resolve now if we're not expecting a response.
        if (!expects) return resolve()
      })
      .then(results => results.map(mesg => {
        const minfo = __messages.resolve(mesg)

        mesg.path = minfo.path
        mesg.params = minfo.decode(mesg.args)

        return mesg
      }))
  }

  /**
   * @private
   * @param {*} frame 
   * @param {*} rinfo
   */
  const onPing = (frame, rinfo) => {
    sendFrame(frame.type, Codec.ARSDK_TRANSPORT_ID_PONG, frame.seq, frame.payload)
    if (__debug >= 3) __log.info('PING')
    __self.emit('ping')
  }

  /**
   * @private
   * @param {*} frame 
   * @param {*} rinfo
   */
  const onNavdata = (frame, rinfo) => {
    // Unpack and resolve message specification.
    const mesg = Codec.Message.unpack(frame.payload)
    const minfo = __messages.resolve(mesg)

    if (mesg.featureId !== 4 || mesg.classId !== 8 || mesg.messageId !== 4) {
      if (__debug >= 3) __log.info('MESSAGE >>', mesg)
    }

    // Ignore messages we don't know and can't decode.
    if (!minfo) {
      __log.info("Dropping Message:", mesg)
      return
    }

    // Annotate message and decode parameters.
    mesg.info = minfo
    mesg.path = minfo.path
    mesg.params = minfo.decode(mesg.args)

    __self.emit('navdata', mesg, rinfo)
  }

  /**
   * @private
   * @param {*} frame 
   * @param {*} rinfo
   */
  const onNavdataEvent = (frame, rinfo) => {
    // Immediately send ACK frame if required.
    const bufferId = Codec.ARSDK_TRANSPORT_ID_C2D_CMD_ACK
    if (!(bufferId in __sequence) || __sequence[bufferId] > 255) __sequence[bufferId] = 0

    sendFrame(
      Codec.ARSDK_FRAME_TYPE_ACKNOWLEDGE,
      frame.id + Codec.ARSDK_TRANSPORT_ID_ACKOFF,
      __sequence[bufferId]++,
      Buffer.alloc(1, frame.seq)
    )

    // Unpack message and get info
    const mesg = Codec.Message.unpack(frame.payload)
    const minfo = __messages.resolve(mesg)

    if (__debug >= 3) __log.info('EVENT >>', mesg)

    // Ignore messages we don't know and can't decode.
    if (!minfo) {
      __log.info("Dropping Event:", mesg)
      return
    }

    // Annotate message and decode parameters.
    mesg.info = minfo
    mesg.path = minfo.path
    mesg.params = minfo.decode(mesg.args)

    // If we're processing responses
    if (__queue.length > 0) {
      const [ minfoP, _1, resolve, _2 ] = __queue[0]

      // If this message is what we're expecting, then dequeue and resolve.
      if (mesg.match.apply(mesg, minfoP.expects.immediate)) {
        resolve(__responses.splice(0, __responses.length))
        __queue.shift()

        // Dequeue and send next message.
        if (__queue.length > 0) {
          const [ minfoN, argsN, resolveN, rejectN ] = __queue[0]
          sendCommand(minfoN, argsN, true).then(resolveN).catch(rejectN)
        }

        return // Don't process terminating event.
      } else {
        //   Otherwise push this event to response buffer, and continue
        // waiting for expected terminator message.
        __responses.push(mesg)
      }
    }

    // Always process navdata events
    __self.emit('navdata', mesg, rinfo)
  }

  /**
   * @private
   * @param {*} message 
   * @param {*} rinfo 
   */
  const onIncomingMessage = (message, rinfo) => {
    // Reset communications keep-alive timeout.
    clearTimeout(__keepalive)
    __keepalive = setTimeout(() => {
      __log.info("Keep-alive timeout, closing socket.")

      try {
        close()
      } catch (e) {
        // Ignore for now
        __log.error(e.errno)
      }
    }, __opts.keepalive || 1000 * 5)

    if (__debug >= 4) {
      __log.info(`RX: ${rinfo.address}:${rinfo.port} <-- `, HEXDUMP(message))
    }

    try {
      const frame = Codec.Frame.unpack(message)
      switch (frame.id) {
        case Codec.ARSDK_TRANSPORT_ID_PING:
          onPing(frame, rinfo)
          break

        case Codec.ARSDK_TRANSPORT_ID_D2C_CMD_NOACK:
          onNavdata(frame, rinfo)
          break

        case Codec.ARSDK_TRANSPORT_ID_D2C_CMD_WITHACK:
          onNavdataEvent(frame, rinfo)
          break

        default:
          if (__debug >= 1)
            __log.warn(`Unrecognised frame id (${frame.id}) --> `, HEXDUMP(message))
      }
    } catch (e) {
      __log.error(e)
    }
  }

  // Interface
  this.initialize = initialize.bind(this)
  this.sendCommand = sendCommand.bind(this)
  this.sendFrame = sendFrame.bind(this)

  /**
   * Close underlying transport and unregister event handlers.
   * 
   * @public
   */
  this.close = () => {
    if (__socket.close) __socket.close()
    __socket = null
  }
}
Connection.prototype = Object.create(EventEmitter.prototype)

module.exports = Connection
