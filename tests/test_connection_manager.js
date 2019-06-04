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
const {
  ConnectionManager,
  NetworkConnector
} = require('../src')

const REMOTE_ADDR = process.env.REMOTE_ADDR
const REMOTE_PORT = process.env.REMOTE_PORT

const manager = new ConnectionManager('radial-gcstation')

manager.on('attached', uid => {
  console.info("Device attached:", uid)
})

manager.on('connecting', uid => {
  console.info("Device connecting:", uid)
})

manager.on('connected', (uid, channel) => {
  console.info("Device connected:", uid)

  channel.on('navdata', message => {
    console.info(message)
  })
})

manager.on('disconnected', uid => {
  console.info("Device disconnected:", uid)
})

manager.on('detached', uid => {
  console.info("Device detached:", uid)
})

manager.on('error', error => {
  console.error("ERROR: Device error:", error)
})

manager.attach(new NetworkConnector(REMOTE_ADDR, REMOTE_PORT, { debug: true }))
