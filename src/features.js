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
const FEATURE_IDS = {
  0x00: 'common',
  0x01: 'ardrone3',
  0x04: 'skyctrl',
  0x85: 'generic',
  0x86: 'followme',
  0x87: 'wifi',
  0x88: 'rc',
  0x89: 'drone_manager',
  0x8a: 'mapper',
  0x8b: 'debug',
  0x8c: 'controller_info',
  0x8f: 'camera',
  0x90: 'animation',
  0x91: 'user_storage',
  0x92: 'rth',
  0x94: 'gimbal',
  0x95: 'battery',
  0x96: 'mediastore',
  0x97: 'precise_home',
}

const FEATURE_CLASSES = {
  0x01: ARDrone3,
  0x04: SkyController,
  0x89: DroneManager,
}

/**
 * @public
 * @class
 * 
 * @param {*} __uid 
 * @param {*} __device 
 */
function Feature (__fId, __device) {
  this.type = FEATURE_IDS[__fId]
  this.props = {}
}
/**
 * @public
 * @method Feature#toJSON
 * 
 * @returns {Object} JSON safe instance representation
 */
Feature.prototype.toJSON = function () {
  return Object.assign({ type: this.type }, this.props)
}

/**
 * @protected
 * @class
 * 
 * @param {*} __device 
 */
function ARDrone3 (__device) {
  Feature.call(this, 0x01, __device)

  __device.sendCommand('common.Common.AllStates')
  __device.sendCommand('common.Settings.AllSettings')
}
ARDrone3.prototype = Object.create(Feature.prototype)

/**
 * @protected
 * @class
 * 
 * @param {*} __device 
 */
function SkyController (__device) {
  Feature.call(this, 0x04, __device)

  __device.sendCommand('skyctrl.Common.AllStates')
  __device.sendCommand('skyctrl.Settings.AllSettings')
}
SkyController.prototype = Object.create(Feature.prototype)

/**
 * @protected
 * @class
 * 
 * @param {*} __device 
 */
function DroneManager (__device) {
  Feature.call(this, 0x89, __device)
  //__device.sendCommand('skyctrl.Settings.AllSettings')

  this.Connect = async (serial, key) => {
    key = key || ''
    return __device.sendCommand('drone_manager.commands.connect', { serial, key })
  }

  this.DiscoverDrones = async () => {  
    return __device.sendCommand('drone_manager.commands.discover_drones')
  }

  this.Forget = async (serial) => {
    return __device.sendCommand('drone_manager.commands.forget', { serial })
  }
}
DroneManager.prototype = Object.create(Feature.prototype)

// Module Exports
module.exports = {
  Feature,
  FEATURE_CLASSES,
}