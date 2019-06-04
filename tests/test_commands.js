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

const CommandDict = require('../src/commands.js')

const commands = new CommandDict()
commands.import.apply(commands,
    fs.readdirSync(path.join(__dirname, '../ext/arsdk-xml/xml'))
        .map(i => i.replace(/\.xml$/, ''))
  )
  .then(() => {
    commands.messages.forEach(minfo => {
      if (minfo.messageType === 'event') {
        console.info(minfo.path, minfo.event)
        console.info('  ', minfo.args)
        console.info()

      } else if (minfo.messageType === 'command') {
        console.info(minfo.path, minfo.bufferId === 10 ? 'NO_ACK' : 'ACK')
        console.info('  ', minfo.args)
        console.info()
      }
    })    
  })
