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

const ConnectionManager = require('./connection_manager.js')

const Device = require('./device.js')

/**
 * Emitted when a connector has been attached.
 * @event DeviceManager#attached
 * 
 * @property {string} uid
 * @property {Device} connection
 * 
 * @public
 */

/**
 * Emitted when a connector has been detached.
 * @event DeviceManager#detached
 * 
 * @property {string} uid
 * 
 * @public
 */

/**
 * Emitted when a connector is attempting to connect.
 * @event DeviceManager#connecting
 * 
 * @property {string} uid
 * 
 * @public
 */

/**
 * Emitted when a device has connected.
 * @event DeviceManager#connected
 * 
 * @property {string} uid
 * @property {Device} device
 * 
 * @public
 */

/**
 * Emitted when a device has disconnected.
 * @event DeviceManager#disconnected
 * 
 * @property {string} uid
 * 
 * @public
 */

/**
 * @class
 * @public
 * @implements EventEmitter
 * @implements ConnectionManager
 * 
 * @param {string} controllerType 
 * @param {string} controllerName 
 * @param {Object} opts 
 * 
 * @example
 * 
 * // Create a device manager instance for managing ARSDK devices
 * const manager = new DeviceManager('js-arsdk', os.hostname())
 * 
 * // Connect to 'connected' signal.
 * manager.on('connected', device => {
 *   device.sendCommand('common.Settings.AllSettings')
 *     .then(result => { console.info(result) })
 * })
 * 
 * // Connects to drone via an already paired SkyController
 * manager.attach(new NetworkConnector('192.168.53.1', 44444))
 */
function DeviceManager (controllerType, controllerName, __opts) {
  const __self = this

  EventEmitter.call(this)

  const __connman = new ConnectionManager(
    controllerType,
    controllerName,
    __opts
  )

  const __devices = {}

  __connman.on('connected', async (uid, channel) => {
    const device = new Device(uid, channel, __opts)

    __devices[uid] = device
    device.once('connected', () => __self.emit('connected', device))
  })

  __connman.on('disconnected', (uid) => {
    delete __devices[uid]
    __self.emit('disconnected', uid)
  })

  __connman.on('error', (error) => __self.emit('error', error))

  const inherited = ['attached', 'detached', 'connecting']
  inherited.forEach(
    ev => __connman.on(ev, uid => __self.emit(ev, uid))
  )

  // Expose Public Interface
  this.attach = __connman.attach
  this.detach = __connman.detach
  this.connect = __connman.connect
  this.disconnect = __connman.disconnect
  this.shutdown = __connman.shutdown
}
DeviceManager.prototype = Object.create(EventEmitter.prototype)

module.exports = DeviceManager