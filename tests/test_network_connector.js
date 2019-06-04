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
const NetworkConnector = require('../src/connector')

async function tst () {
  // Test connect with custom address and port
  try {
    const connector1 = new NetworkConnector('localhost', 44443, { debug: true })
    const channel1 = await connector1.connect('type', 'name')
    channel1.on('error', error => console.error(error))
  } catch (e) { console.error('***', e) }
}

//tst()

const connector = new NetworkConnector({ debug: true })
connector.connect()
  .then(ch => {
    ch.on('error', error => console.error('CHANNEL:', error))
  })
  .catch(error => {
    console.error('CONNECTOR:', error)
  })
