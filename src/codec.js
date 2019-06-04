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

// CONSTANTS
const ARSDK_FRAME_HEADER_SIZE = 7
const ARSDK_COMMAND_HEADER_SIZE = 4

/**
 * @namespace Codec
 * @public
 */
const Constants = {
  /**
   * @public
   * @memberof Codec
   */
  ARSDK_FRAME_TYPE_ACKNOWLEDGE: 0x01,
  /**
   * @public
   * @memberof Codec
   */
  ARSDK_FRAME_TYPE_DATA: 0x02,
  /**
   * @public
   * @memberof Codec
   */
  ARSDK_FRAME_TYPE_LOW_LATENCY_DATA: 0x03,
  /**
   * @public
   * @memberof Codec
   */
  ARSDK_FRAME_TYPE_ACKNOWLEDGE_DATA: 0x04,

  /**
   * @public
   * @memberof Codec
   */
  ARSDK_TRANSPORT_ID_MAX: 256,

  /**
   * @public
   * @memberof Codec
   */
  ARSDK_TRANSPORT_ID_PING: 0x00,
  /**
   * @public
   * @memberof Codec
   */
  ARSDK_TRANSPORT_ID_PONG: 0x01,

  /**
   * @public
   * @memberof Codec
   */
  ARSDK_TRANSPORT_ID_C2D_CMD_NOACK: 0x0a,
  /**
   * @public
   * @memberof Codec
   */
  ARSDK_TRANSPORT_ID_C2D_CMD_WITHACK: 0x0b,
  /**
   * @public
   * @memberof Codec
   */
  ARSDK_TRANSPORT_ID_C2D_CMD_HIGHPRIO: 0x0c,

  /**
   * @public
   * @memberof Codec
   */
  ARSDK_TRANSPORT_ID_D2C_CMD_NOACK: 127,
  /**
   * @public
   * @memberof Codec
   */
  ARSDK_TRANSPORT_ID_D2C_CMD_WITHACK: 126,

  /**
   * @public
   * @memberof Codec
   */
  ARSDK_TRANSPORT_ID_ACKOFF: (256 / 2),

  /**
   * @public
   * @memberof Codec
   */
  ARSDK_TRANSPORT_ID_C2D_CMD_ACK: 126 + (256 / 2),
  /**
   * @public
   * @memberof Codec
   */
  ARSDK_TRANSPORT_ID_D2C_CMD_ACK: 11 + (256 / 2),
  /**
   * @public
   * @memberof Codec
   */
  ARSDK_TRANSPORT_ID_D2C_CMD_HIGHPRIO_ACK: 12 + (256 / 2),
}

/**
 * @typedef {Object} Codec.ProtocolFrame
 * @public
 * 
 * @property {enum} type 
 * @property {enum} id ARNET Protocol Transport ID
 * @property {uint8} seq Sequence counter.
 * @property {Buffer} data
 */

/**
 * 
 * ARNET Protocol Frame serializing and deserializing.
 * 
 * @module Frame
 * @public
 * 
 */
const Frame = {
  /**
   * Pack ARNET Protocol Frame using provided parameters.
   * 
   * @function pack
   * @public
   * 
   * @param {uint8} type 
   * @param {uint8} id 
   * @param {uint8} seq 
   * @param {Buffer} data
   * 
   * @returns {Buffer}
   */
  pack (type, id, seq, data) {
    const buffer = Buffer.alloc(ARSDK_FRAME_HEADER_SIZE + data.length)

    let offset = buffer.writeUInt8(type)
    offset = buffer.writeUInt8(id, offset)
    offset = buffer.writeUInt8(seq, offset)
    offset = buffer.writeUInt32LE(ARSDK_FRAME_HEADER_SIZE + data.length, offset)
  
    data.copy(buffer, offset)
    return buffer  
  },

  /**
   * Unpack ARNET Protocol Frame using provided parameters.
   * 
   * @function module:Frame.upack
   * @public
   * 
   * @param {Buffer} buffer - ARNetwork frame to unpack
   * 
   * @returns {Codec.ProtocolFrame}
   */
  unpack (buffer) {
    if (buffer.length < ARSDK_FRAME_HEADER_SIZE) {
      throw 'ARSDK_INVALID_FRAME_SIZE'
    }

    const frame = {
      type: buffer.readUInt8(0),
      id: buffer.readUInt8(1),
      seq: buffer.readUInt8(2),
      payload: buffer.slice(ARSDK_FRAME_HEADER_SIZE)
    }
    return frame  
  }
}

/**
 * 
 * ARNetwork protocol messaging serializing and deserializing functions.
 * 
 * @module Message
 * @public
 */
const Message = {
  /**
   * Pack ARNet message header and args using provided arguments
   * 
   * @function module:Message.pack
   * @public
   * 
   * @param {uint8} featureId 
   * @param {uint8} classId
   * @param {uint16} messageId 
   * @param {Buffer} args
   * 
   * @returns {Buffer}
   */
  pack (featureId, classId, messageId, args) {
    args = args || Buffer.alloc(0)
    const buffer = Buffer.alloc(ARSDK_COMMAND_HEADER_SIZE + args.length)
  
    let offset = buffer.writeUInt8(featureId)
    offset = buffer.writeUInt8(classId, offset)
    offset = buffer.writeUInt16LE(messageId, offset)
  
    args.copy(buffer, offset)
    return buffer  
  },

  /**
   * Unpack ARNet message header and args from Buffer.
   * 
   * @function module:Message.unpack
   * @public
   * 
   * @param {Buffer} buffer 
   * 
   * @returns {ProtocolMessage}
   */
  unpack (buffer) {
    const command = {
      featureId: buffer.readUInt8(0),
      classId: buffer.readUInt8(1),
      messageId: buffer.readUInt16LE(2),
      args: buffer.slice(ARSDK_COMMAND_HEADER_SIZE),
    }

    /** @public */
    command.match = (fId, cId, mId) => {
      return fId === command.featureId &&
             cId === command.classId &&
             mId === command.messageId
    }

    return command  
  }
}

module.exports = Object.assign(Constants, { Frame, Message })
