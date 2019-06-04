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
const fs = require('fs')
const path = require('path')
const xml2js = require('xml2js')

const Codec = require('./codec.js')

const ARNET_XML_PATH = path.join(__dirname, '../ext/arsdk-xml/xml')

/**
 * Decode message buffer into parameters.
 * 
 * @private
 * 
 * @param {Command} command 
 * @param {Buffer} message
 * 
 * @returns {Object}
 */
const decode = (info) => (message) => {
  const params = {}

  let offset = 0
  info.args.forEach(arg => {
    switch (arg.type) {
    case 'u8':
      params[arg.name] = message.readUInt8(offset)
      offset += 1
      break

    case 'u16':
      params[arg.name] = message.readUInt16LE(offset)
      offset += 2
      break

    case 'u32':
      params[arg.name] = message.readUInt32LE(offset)
      offset += 4
      break

    case 'u64':
      //params[arg.name] = message.readBigUInt64LE(offset)
      offset += 8
      break

    case 'i8':
      params[arg.name] = message.readUInt8(offset)
      offset += 1
      break

    case 'i16':
      params[arg.name] = message.readInt16LE(offset)
      offset += 2
      break

    case 'i32':
        params[arg.name] = message.readInt32LE(offset)
        offset += 4
      break

    case 'i64':
        //params[arg.name] = message.readBigInt64LE(offset)
        offset += 8
      break

    case 'float':
        params[arg.name] = message.readFloatLE(offset)
        offset += 4
      break

    case 'double':
        params[arg.name] = message.readDoubleLE(offset)
        offset += 8
      break

    case 'string':
      const end = message.indexOf(0x00, offset)
      params[arg.name] = message.slice(offset, end).toString('utf8')
      offset += (end - offset) + 1
      break

    case 'enum':
      if (arg.enum) {
        params[arg.name] = arg.enum[message.readInt32LE(offset)]
      } else {
        params[arg.name] = message.readInt32LE(offset)
      }

      offset += 4
      break

    default:
      console.warn("Unrecognised argument type:", arg.type)
    }
  })

  return params
}

/**
 * Encode parameters into message buffer.
 * 
 * @private
 * 
 * @param {Command} command 
 * @param {Object} params 
 * 
 * @returns {Buffer}
 */
const encode = (info) => (params) => {
  const buffer = Buffer.alloc(256)

  let offset = 0
  info.args.forEach(arg => {
    switch (arg.type) {
    case 'u8':
      buffer.writeUInt8(params[arg.name], offset)
      offset += 1
      break

    case 'u16':
      buffer.writeUInt16LE(params[arg.name], offset)
      offset += 2
      break

    case 'u32':
      buffer.writeUInt32LE(params[arg.name], offset)
      offset += 4
      break

    case 'u64':
      //buffer.writeBigUInt64LE(params[arg.name], offset)
      offset += 8
      break

    case 'i8':
      buffer.writeInt8(params[arg.name], offset)
      offset += 1
      break

    case 'i16':
      buffer.writeInt16LE(params[arg.name], offset)
      offset += 2
      break

    case 'i32':
      buffer.writeInt32LE(params[arg.name], offset)
      offset += 4
      break

    case 'i64':
      //buffer.writeBigInt64LE(params[arg.name], offset)
      offset += 8
      break

    case 'float':
      buffer.writeFloatLE(params[arg.name], offset)
      offset += 4
      break

    case 'double':
      buffer.writeDoubleLE(params[arg.name], offset)
      offset += 8
      break

    case 'string':
      buffer.write(params[arg.name], offset)
      offset += params[arg.name].length

      buffer.writeUInt8(0x00, offset)
      offset += 1
      break

    case 'enum':
      buffer.writeInt32LE(params[arg.name], offset)
      offset += 4
      break

    default:
      console.warn("Unrecognised argument type:", arg.type)
    }
  })

  return buffer.slice(0, offset)
}

/**
 * ARNet Message Dictionary
 * 
 * @class
 * @protected
 */
function CommandDict () {
  const __features = []
  const __messages = []

  /**
   * 
   * @param {*} id 
   * @param {*} name 
   */
  const getFeature = (id, name) => {
    if (!(name in __features)) {
      __features[name] = {
        featureId: parseInt(id),
        featureName: name,
        enums: {},
        messages: {},
      }
    }
    return __features[name]
  }

  /**
   * 
   * @param {*} argElem 
   */
  const parse_arg = (featureInfo) => (elem) => {
    const { name, type } = elem.$
    const arg = { name, type }

    // Project XML format
    if (type === 'enum') {
      arg.enum = elem.enum.map(enumElem => enumElem.$.name)
    }

    // Feature XML format.
    if (type.startsWith('enum:')) {
      const enumName = type.slice(5)
      arg.type = 'enum'
      arg.enum = featureInfo.enums[enumName]
    }

    if (type.startsWith('bitfield:')) {
      const [ _, bType, bName ] = type.split(':')
      arg.type = bType
      arg.bitfield = bName
    }

    return arg
  }

  /**
   * 
   * @param {*} expects 
   */
  const parse_expects = (expects) => {
    if (expects.immediate) {
      const immediate = expects.immediate[0].trim()
      const [ _, fId, cId, mId ] = immediate.match(/^#([0-9]*)-([0-9]*)-?([0-9]*)?/)
      return { immediate: [
          fId, mId ? cId : 0, mId ? mId : cId
        ].map(i => parseInt(i))
      }

    } else if (expects.delayed) {
      const delayed = expects.delayed[0].trim()
      const [ _, fId, cId, mId ] = delayed.match(/^#([0-9]*)-([0-9]*)-?([0-9]*)?/)
      return { delayed: [
          fId, mId ? cId : 0, mId ? mId : cId
        ].map(i => parseInt(i))
      }
    }
  }

  /**
   * 
   * @param {*} featureInfo 
   */
  const parse_event = (featureInfo) => (elem) => {
    const { id: messageId, name: messageName, type: eventType, content } = elem.$
    const classId = 0

    // Create message object.
    const message = {
      featureId: featureInfo.featureId, classId, messageId, messageName, messageType: 'event',
      path: [featureInfo.featureName, 'events', messageName].join('.'),
    }

    // Add event specific fields.
    message.event = { }

    if (eventType) {
      message.event.type = eventType

      if (eventType.startsWith('MAP_ITEM:')) {
        const [ type, key ] = eventType.split(':')
        message.event.type = type
        message.event.key = key
      }
    }

    if (content) message.event.content = content

    // Parse message arguments.
    message.args = (elem.arg || []).map(parse_arg(featureInfo))

    // Add message to featureInfo and global message dictionary.
    featureInfo.messages[messageName] = message
    __messages.push(message)
  }

  /**
   * 
   * @param {*} featureInfo 
   */
  const parse_command = (featureInfo) => (elem) => {
    const { id: messageId, name: messageName, buffer } = elem.$
    const classId = 0

    // Create message object.
    const message = {
      featureId: featureInfo.featureId, classId, messageId, messageName, messageType: 'command',
      path: [featureInfo.featureName, 'commands', messageName].join('.'),
    }

    // Add command specific fields.
    message.bufferId = buffer === "NON_ACK" ?
        Codec.ARSDK_TRANSPORT_ID_C2D_CMD_NOACK :
        Codec.ARSDK_TRANSPORT_ID_C2D_CMD_WITHACK

    // Parse message arguments.
    message.args = (elem.arg || []).map(parse_arg(featureInfo))

    // Parse message expectations.
    if ('expectations' in elem) {
      message.expects = parse_expects(elem.expectations[0])
    }

    featureInfo.messages[messageName] = message
    __messages.push(message)
  }

  /**
   * 
   * @param {*} feature 
   */
  const parse_feature = (feature) => {
    const { id: featureId, name: featureName } = feature.$

    // Get feature dictionary entry
    const featureInfo = getFeature(featureId, featureName)

    // Parse enumerations
    if (feature.enums && feature.enums[0].enum) {
      feature.enums[0].enum.forEach(elem => {
        featureInfo.enums[elem.$.name] = elem.value.map(vElement => vElement.$.name)
      })
    }

    // Parse event messages
    if (feature.msgs && feature.msgs[0].evt) {
      feature.msgs[0].evt.forEach(parse_event(featureInfo))
    }

    // Parse command messages
    if (feature.msgs && feature.msgs[0].cmd) {
      feature.msgs[0].cmd.forEach(parse_command(featureInfo))
    }

    console.info("FEATURE:", featureName.padStart(16), '-', feature._.trim())
  }

  /**
   * 
   * @param {*} project 
   */
  const parse_project = (project) => {
    // Unpack project attributes
    const { id: featureId, name: featureName } = project.$

    // Get feature dictionary entry
    const featureInfo = getFeature(featureId, featureName)
    featureInfo.isProject = true
    
    // Iterate through declared project classes.
    project.class.forEach(classElement => {
      const { id: classId, name: className } = classElement.$

      // Iterate through declared commands.
      classElement.cmd.forEach(elem => {
        const { id: messageId, name: messageName, buffer } = elem.$

        const message = {
          featureId, classId, messageId, messageName, messageType: 'command',
          path: [featureName, className, messageName].join('.'),
        }

        message.bufferId = buffer === "NON_ACK" ?
            Codec.ARSDK_TRANSPORT_ID_C2D_CMD_NOACK :
            Codec.ARSDK_TRANSPORT_ID_C2D_CMD_WITHACK

        // Parse message arguments
        message.args = (elem.arg || []).map(parse_arg(featureInfo))

        // Parse message expectations.
        if ('expectations' in elem) {
          message.expects = parse_expects(elem.expectations[0])
        }

        // Add message object to dictionaries.
        featureInfo.messages[messageName] = message
        __messages.push(message)
      })
    })

    console.info("PROJECT:", featureName.padStart(16), '-', project._.trim())
  }

  /**
   * 
   * @param {Array<String>|...String} modules
   */
  const _import = async function (modules) {
    if (!(modules instanceof Array)) {
      modules = Array.prototype.slice.call(arguments)
    }

    return Promise.all(
        modules.map(module => new Promise((resolve, reject) => {
          fs.readFile(path.join(ARNET_XML_PATH, module + '.xml'), (error, data) => {
            if (error) return reject(error)

            const parser = new xml2js.Parser()

            parser.parseString(data, (error, result) => {
              if (error) return reject(error)

              // XXX - Get parse functions to return messages, add decode/encode, then
              if ('feature' in result) {
                parse_feature(result.feature)
                return resolve()
              }
              if ('project' in result) {
                parse_project(result.project)
                return resolve()
              }

              return reject('Malformed XML, missing "feature" or "project" root element.')
            })
          })
        })
      ))
      .then(() => {
        __messages.forEach(m => {
          m.featureId = parseInt(m.featureId)
          m.classId = parseInt(m.classId)
          m.messageId = parseInt(m.messageId)
          m.decode = decode(m)
          m.encode = encode(m)
        })
      })
  }

  /**
   * 
   * @param {*} pId 
   * @param {*} cId 
   * @param {*} mId 
   */
  const resolve = function (pId, cId, mId) {
    if (arguments.length === 1 && typeof(pId) === 'object') {
      const mesg = pId
      pId = mesg.featureId
      cId = mesg.classId
      mId = mesg.messageId
    }

    if (!isNaN(pId) && !isNaN(cId) && !isNaN(mId)) {
      return __messages.find(m => (
        m.featureId === parseInt(pId) &&
        m.classId === parseInt(cId) &&
        m.messageId === parseInt(mId)
      ))
    }

    if (typeof(pId) === 'string') {
      return __messages.find(m => m.path === pId)
    }
  }

  // Export Public Interface
  this.messages = __messages

  this.import = _import.bind(this)
  this.resolve = resolve.bind(this)
}

module.exports = CommandDict