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

const {
  Feature,
  FEATURE_CLASSES,
} = require('./features')

/**
 * Emitted when the connection has been closed.
 * @public
 * @event Device#connected
 */

/**
 * Emitted when the connection has been closed.
 * @public
 * @event Device#disconnected
 */

/**
 * Emitted when the connection has been closed.
 * @public
 * @event Device#message
 * @param {Message} message
 * @param {RemoteInfo} remote
 */

/**
 * Emitted when the connection has been closed.
 * @public
 * @event Device#feature:attached
 * 
 * @param {string} featureId
 * @param {Feature} feature
 */

/**
 * Emitted when the connection has been closed.
 * @public
 * @event Device#property:changed
 * 
 * @param {string} featureId
 * @param {string} property
 * @param {*} value
 */


/**
 * This class handles sending and recieving commands from ARNet based
 * devices. It serves as a nice abstraction layer removing the underlying
 * protocol architecture, and providing an easy to use interface for
 * communicating with Parrot devices.
 * 
 * @class Device
 * @public
 * 
 * @param {string} uid 
 * @param {Connection} connection 
 * @param {Object} [opts]
 * @param {Logger} [opts.logger] Custom logger instance
 * 
 */
function Device (__uid, __connection, __opts) {
  __opts = __opts || {}
  EventEmitter.call(this)

  const __self = this
  const __log = __opts.logger || console

  const __features = {}

  let __is_connected = false
  let __is_ready = false

  /** @private */
  const onFeatureMessage = (fId, cId, mId, mesg, feature) => {
    const minfo = mesg.info

    if (minfo.messageType === 'event' && minfo.event.type) {
      if (minfo.event.type === 'LIST_ITEM') {
        // Process list initiator
        if (mesg.params.list_flags === 0x01) feature.props[mID] = []

        feature.props[mId].push(mesg.params)

        // Process list terminator
        if (mesg.params.list_flags === 0x02) {
          __self.emit('property:changed', fId, mId, feature.props[mId])
        }
      }
      if (minfo.event.type === 'MAP_ITEM') {
        const key = minfo.event.key

        // Process map initiator
        if (mesg.params.list_flags === 0x01) feature.props[mId] = {}

        feature.props[mId][mesg.params[key]] = mesg.params

        // Process map terminator
        if (mesg.params.list_flags === 0x02) {
          __self.emit('property:changed', fId, mId, feature.props[mId])
        }
      }
    } else {
      feature.props[mId] = mesg.params
      __self.emit('property:changed', fId, mId, mesg.params)
    }
  }

  /** @private */
  const onProjectMessage = (fId, cId, mId, mesg, feature) =>{
    const prop = [cId, mId.replace(/Changed$/, '')].join('.')
    feature.props[prop] = mesg.params
    __self.emit('property:changed', fId, prop, mesg.params)
  }

  /**
   * Handle incoming navdata messages, detect connected features, parse
   * messages and notify next layer with annotated messages.
   * 
   * @private
   * @param {*} mesg 
   * @param {*} rinfo 
   */
  const onNavdata = async (mesg, rinfo) => {
    // If we're in disconnected state, mark as connected and emit.
    if (!__is_connected) {
      __is_connected = true
      __self.emit('connected')
    }

    // Get feature, class, and message id strings.
    const [fId, cId, mId] = mesg.path.split('.')

    // Start detecting plugin features.
    let feature
    if (!(fId in __features)) {
      if (mesg.featureId in FEATURE_CLASSES) {
        feature = new (FEATURE_CLASSES[mesg.featureId])(__self)
      } else {
        feature = new Feature(mesg.featureId, __self)
      }

      __features[fId] = feature
      __self.emit('feature:attached', fId, feature)
    } else {
      feature = __features[fId]
    }

    // Process navdata message project if legacy or feature if in new format.
    const onMessage = (mesg.info.isProject ? onProjectMessage : onFeatureMessage)
    onMessage(fId, cId, mId, mesg, feature)

    // Notify navdata received
    __self.emit('message', mesg, rinfo)
  }

  /**
   * Unique ID for this connection.
   * @name uid
   * @type {string}
   * @public
   * @memberof! Device#
   */
  this.uid = __uid

  /**
   * Attached features associated with this device and connection.
   * @name features
   * @type {Array<Feature>}
   * @public
   * @memberof! Device#
   */
  this.features = __features

  /**
   * The underlying transport connection.
   * @name connection
   * @type {Connection}
   * @public
   * @memberof! Device#
   */
  this.connection = __connection

  /**
   * Send a command and if a response is expected, return response.
   * @public
   * @method Device#sendCommand
   * 
   * @param {string} path
   * @param {Object} params
   * @param {Object} [opts]
   */
  this.sendCommand = __connection.sendCommand

  /**
   * @public
   * @method Device#toJSON
   */
  this.toJSON = () => ({
    uid: __uid,
    features: __features,
  })

  // Listen to connection events.
  __connection.on('navdata', onNavdata)
  __connection.on('closed', () => __self.emit('disconnected'))
}
Device.prototype = Object.create(EventEmitter.prototype)

module.exports = Device