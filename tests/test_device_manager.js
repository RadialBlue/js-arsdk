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
  DeviceManager,
  NetworkConnector
} = require('../src')

const REMOTE_ADDR = process.env.REMOTE_ADDR
const REMOTE_PORT = process.env.REMOTE_PORT

const manager = new DeviceManager('js-arsdk')
manager.on('attached', uid => {
  console.info("Connection attached:", uid)
})

manager.on('detached', uid => {
  console.info("Connection detached:", uid)
})

manager.on('connecting', uid => {
  console.info("Connection starting:", uid)
})

manager.on('connected', async device => {
  console.info("Device connected:", device.uid)

  device.sendCommand('skyctrl.Settings.AllSettings')

  device.on('property:changed', (fId, mId, v) => {
    console.info(fId, mId, v)
    //console.info(JSON.stringify(device, null, 2))
  })

  device.on('feature:attached', feature => {
    console.info('Device feature attached:', feature)
  })

  device.on('feature:detached', uid => {
    console.info('Device feature detached:', uid)
  })
})

manager.on('disconnected', uid => {
  console.info("Disconnected:", uid)
  manager.shutdown()
  //manager.detach(uid)
})

manager.on('error', error => {
  console.error("ERROR: Device error:", error)
})

manager.attach(new NetworkConnector(REMOTE_ADDR, REMOTE_PORT))
