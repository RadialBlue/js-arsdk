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

/**
 * @private
 */
const sleep = (delay) => new Promise((resolve, reject) => setTimeout(resolve, delay))

/**
 * Emitted when a new connector has been attached to this instance
 * @event ConnectionManager#attached
 * 
 * @property {string} uid
 * 
 * @public
 */
/**
 * Emitted when a connector has been detached from this instance.
 * @event ConnectionManager#detached

 * @property {string} uid
 * 
 * @public
 */
/**
 * Emitted when a connector has began connecting to a remote device.
 * @event ConnectionManager#connecting
 * 
 * @property {string} uid
 * 
 * @public
 */
/**
 * Emitted when a device has connected.
 * @event ConnectionManager#connected
 * 
 * @property {string} uid
 * @property {Channel} channel
 * 
 * @public
 */
/**
 * Emitted when a device has disconnected.
 * @event ConnectionManager#disconnected
 * 
 * @property {string} uid
 * 
 * @public
 */
/**
 * Emitted when an error has occured
 * @event ConnectionManager#error
 * 
 * @property {Error} error
 * 
 * @public
 */


/**
 * Creates a new ARSDK ConnectionManager instance for managing connections
 * to ARSDK based protocol devices.
 * 
 * @class
 * @implements EventEmitter
 * @public
 * 
 * @param {string} [controllerType="js-arsdk"] Controller type to declare when connecting
 * @param {string} [controllerName=HOSTNAME] Controller name to declare when connecting
 * @param {Object} [opts]
 * @param {Logger} [opts.logger] Custom logger instance
 * 
 * @example
 * 
 * const manager = new ConnectionManager('js-arsdk', 'MyController')
 * 
 * manager.on('connected', (uid, connection) => { ... })
 * manager.on('disconnected', (uid) => { ... })
 * manager.on('error', (error) => { ... })
 * 
 * manager.attach(new NetworkConnector('192.168.53.1', 44444))
 * 
 */
function ConnectionManager (controllerType, controllerName, __opts) {
  EventEmitter.call(this)

  const __self = this
  const __log = __opts && __opts.logger || console

  const __connectors = {}
  const __connections = {}

  /**
   * Attach a device protocol connector to this manager for managing
   * device connectivity.
   * 
   * @method ConnectionManager#attach
   * @public
   * 
   * @param {ConnectorInterface} connector
   * @param {Object} [opts]
   * @param {boolean} [opts.autoconnect=true] Automatically connect
   * @param {boolean} [opts.reconnect=true] Enable/Disable auto-reconnects
   * 
   * @returns {Promise}
   */
  const attach = (connector, opts) => {
    opts = Object.assign({
      autoconnect: true,
      reconnect: true,
      logger: __log,
    }, opts || {})

    __connectors[connector.uid] = [connector, opts]
    this.emit('attached', connector.uid)

    if (opts.autoconnect) return connect(connector.uid)
    return null
  }

  const __onClose = uid => () => {
    const [ _, opts ] = __connectors[uid]
    const [ connection, onClose] = __connections[uid]

    connection.off('closed', onClose)

    delete __connections[uid]
    __self.emit('disconnected', uid)

    if (opts.reconnect) setTimeout(() => connect(uid), 1000)
  }

  /**
   * 
   * @method ConnectionManager#connect
   * @public
   * 
   * @param {string} uid 
   * 
   * @returns {MessageChannel}
   */
  const connect = async (uid) => {
    if (uid in __connections) return
    if (!(uid in __connectors)) return

    const [ connector, opts ] = __connectors[uid]

    this.emit('connecting', uid)
    try {
      const connection = await connector.connect(controllerType, controllerName, opts)
      const onClose = __onClose(uid)
      connection.on('closed', onClose)

      __connections[uid] = [connection, onClose]
      this.emit('connected', uid, connection)

      return connection
    } catch (error) {
      __log.error(error)
      if (opts.reconnect) setTimeout(() => connect(uid), 2000)
    }
  }

  /**
   * @method ConnectionManager#disconnect
   * @public
   * 
   * @param {string} uid
   * 
   * @returns {boolean}
   */
  const disconnect = async (uid) => {
    if (!(uid in __connections)) return
    const [ connection, _ ] = __connections[uid]
    connection.close()
  }

  /**
   * Detach a device protocol connector from this manager and disconnect from the
   * device if it's connected.
   * @method ConnectionManager#detach
   * @public
   * 
   * @param {string} uid 
   * @param {Object} [opts]
   * @param {boolean} [opts.disconnect=true]
   * 
   * @returns {Promise}
   */
  const detach = async (uid, opts) => {
    opts = Object.assign({  disconnect: true  }, opts || {})

    if (!(uid in __connectors)) return

    if (opts.disconnect && uid in __connections) {
      await disconnect(uid)
    }

    delete __connectors[uid]
    this.emit('detached', uid)
  }

  /**
   * Shutdown this manager and close all managed connections.
   * @method ConnectionManager#shutdown
   * @public
   * 
   * @param {Object} [opts] Opts for {@link ConnectionManager#detach}
   */
  const shutdown = async (opts) => {
    await Promise.all(Object.keys(__connectors).map(() => detach(opts)))
  }

  // Expose Public Interface
  this.attach = attach.bind(this)
  this.detach = detach.bind(this)

  this.connect = connect.bind(this)
  this.disconnect = disconnect.bind(this)

  this.shutdown = shutdown.bind(this)
}

ConnectionManager.prototype = Object.create(EventEmitter.prototype)

module.exports = ConnectionManager