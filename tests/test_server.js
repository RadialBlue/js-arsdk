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
const net = require('net')
const dgram = require('dgram')

const HEXDUMP = (buffer) => buffer.toString('hex').replace(/([0-9a-fA-F]{2})/g, '$1 ')

const dev_server = dgram.createSocket('udp4')
dev_server.bind(() => {
  dev_server.on('message', (data, rinfo) => {
    console.info('C2D:', rinfo, data)
  })

  const adv_server = net.createServer(connection => {
    console.info('MOCK - New connection')
  
    connection.on('data', (data) => {
      const req = JSON.parse(data.toString('utf8'))
  
      if (!('controllerType' in req && 'controllerName' in req && 'd2c_port' in req)) {
        console.error('ERROR: Invalid handshake:', req)
      }
  
      connection.write(JSON.stringify({
        status: 0,
        c2d_port: dev_server.address().port,
      }))
    })
  
    connection.on('end', () => {
      console.info('MOCK - Connection closed.')
    })
  })

  adv_server.on('error', error => console.error('ERROR:', error))
  adv_server.listen(44444)  
})
