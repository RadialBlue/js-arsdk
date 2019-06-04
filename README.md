# JS ARSDK

## Introduction

Pure JavaScript Node.js implementation of the ARSDK, for communicating with Parrot drones like the Parrot Bebop and Disco aircraft.

## Getting Started

Follow these instructions to start developing with Parrot based drones using Node.js in JavaScript!

#### 1. Installation

Create a Node.js project and then install the js-arsdk library.

```bash
npm install --save @radial.blue/js-arsdk
```

#### 2. Start Coding

Once you have your Node.js project setup, to create a device manager and connect to a device.

```javascript
import os from 'os'

import {
  DeviceManager,
  NetworkConnector,
} from '@radial.blue/js-arsdk'

// Create a device manager instance for managing ARSDK devices
const manager = new DeviceManager('js-arsdk', os.hostname())

// Connect to 'connected' signal.
manager.on('connected', (device) => {
  device.on('navdata', mesg => {
    console.info('RX:', JSON.stringify(mesg))
  })
})

// Connects to drone via an already paired SkyController
manager.attach(new NetworkConnector('192.168.53.1', 44444))
```

## Reference API Documentation

The API Reference documenation can be found [HERE](https://radialblue.github.io/js-arsdk/api/)

## More Examples

```javascript
throw 'NOT_IMPLEMENTED_YET'
```

## Support

If you'd like to support the development of this project, I accept
crypto :)

```json
{
  "BTC": null,
  "ETH": "0xef3b6dc2211a8E1626014bF230c4a794B18DDdD5",
  "LTC": null
}
```

## Authors

* [**Tom Swindell**](https://github.com/tswindell) - *Creator*