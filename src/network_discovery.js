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

const mdns = require('mdns-js')
mdns.excludeInterface('0.0.0.0')

/**
 * 
 * @param {*} opts 
 */
function DiscoveryManager (opts) {
  opts = opts || {}

  EventEmitter.call(this)

  const begin = (manager) => {
    const browser = mdns.createBrowser()
    browser.on('ready', () => {
      browser.discover()
    })

    browser.on('update', (data) => {
      console.log('data:', JSON.stringify(data, null, 2))
      console.log(data.addresses[0])
    })
  }

  // Export Public Interface
  this.begin = begin.bind(this)
}
DiscoveryManager.prototype = Object.create(EventEmitter.prototype)

module.exports = DiscoveryManager