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
const os = require('os')
const net = require('net')
const dgram = require('dgram')
const promisify = require('util').promisify

const Connection = require('./connection')

/**
 *   Manages connecting to remote device via IP networking, handshaking and
 * Connection creation.
 * 
 * @class
 * @public
 * 
 * @param {string} [remoteAddr='192.168.53.1'] IP address of target network device
 * @param {uint16} [remotePort=44444] ARSDK TCP discovery port
 * @param {Object} [opts]
 * @param {boolean} [opts.debug=false] Enable debugging output
 * 
 * @example
 * 
 * const connector = new NetworkConnector('192.168.53.1', 44444, { debug: true })
 * connector.connect()
 *   .then(ch => { ... })
 *   .catch(error => { ... })
 */
function NetworkConnector (remoteAddr, remotePort, __opts) {
  if (arguments.length === 1 && typeof(remoteAddr) === 'object') {
    __opts = remoteAddr
    remoteAddr = undefined
  }

  remoteAddr = remoteAddr || '192.168.53.1'
  remotePort = remotePort || 44444
  __opts = Object.assign({ debug: process.env.ARNET_DEBUG }, __opts || {})

  const host = `${remoteAddr}:${remotePort}`
  const uid = `arnet://${host}`

  this.uid = uid

  /**
   * Initiate connection to remote network end-point. Resolves on
   * successful connection.
   * 
   * @method NetworkConnector#connect
   * @public
   * 
   * @param {string} [controller_type='js-arsdk']
   * @param {string} [controller_name=HOSTNAME]
   * 
   * @returns {Connection}
   */
  const connect = async (controllerType, controllerName, opts) => {
    opts = opts || {}
    opts = Object.assign(__opts, opts)

    controllerType = controllerType || 'js-arsdk'
    controllerName = controllerName || os.hostname()

    const __log = __opts.logger || console

    return new Promise(async (resolve, reject) => {
      if (process.env.ARNET_DEBUG >= 1) __log.info(`Attempting to connect to: ${host}`)
      const adv_sock = new net.Socket()

      adv_sock.on('error', (error) => reject(error))

      await promisify(adv_sock.connect.bind(adv_sock))(remotePort, remoteAddr)
      if (process.env.ARNET_DEBUG >= 1) __log.info(`Connection established to: ${host}`)

      if (process.env.ARNET_DEBUG >= 1) __log.info('Creating UDP control channel port...')
      const d2c_sock = dgram.createSocket('udp4')

      if (process.env.ARNET_DEBUG >= 1) __log.info('Binding UDP control channel port for D2C...')
      await promisify(d2c_sock.bind.bind(d2c_sock))()
      const d2c_addr = d2c_sock.address()
      const d2c_host = `${d2c_addr.address}:${d2c_addr.port}`
      if (process.env.ARNET_DEBUG >= 1) __log.info(`UDP control channel D2C listening on: ${d2c_host}`)

      if (process.env.ARNET_DEBUG >= 1) __log.info('Performing handshake with:', host)
      adv_sock.write(JSON.stringify({
        controllerType,
        controllerName,
        d2c_port: d2c_addr.port,
      }))

      if (process.env.ARNET_DEBUG >= 1) __log.info('Waiting for handshake response.')
      const response = await new Promise(resolve => adv_sock.once('data', resolve))
      try {
        const source = (response[response.length-1] === 0x00 ? response.slice(0, response.length-1) : response).toString('utf8')
        const params = JSON.parse(source)
        if (params.status !== 0) {
          __log.error("Handshake failure...", params)
          throw 'HANDSHAKE_FAILURE'
        }
        adv_sock.end()

        if (process.env.ARNET_DEBUG >= 1) __log.info('Handshake successful, creating device control channel.')

        const connection = new Connection(remoteAddr, params.c2d_port, d2c_sock, Object.assign(__opts, opts))
        await connection.initialize()

        return resolve(connection)
      } catch (e) {
        d2c_sock.close()
        adv_sock.end()
        return reject(e)
      }
    })
  }

  // Export Public Interface
  this.connect = connect.bind(this)
}

module.exports = NetworkConnector