'use strict';

let devices = [];
let connectionTimeout = 7500;

function init(deviceList, callback) {
  devices = deviceList || [];

  connect();

  callback();
}

let connectTimeout;
function connect() {
  const UDNList = [];
  devices.filter(deviceInfo => {
    if (UDNList.indexOf(deviceInfo.UDN) === -1) {
      UDNList.push(deviceInfo.UDN);
      return true;
    } else {
      return false;
    }
  }).forEach(deviceInfo => {
    if (!(Homey.app.clients[deviceInfo.id] && Homey.app.clients[deviceInfo.id].initialized)) {
      createConnection(deviceInfo);
    }
  });

  if (connectTimeout) {
    clearTimeout(connectTimeout);
  }
  connectTimeout = setTimeout(connect, connectionTimeout < 30000 ? connectionTimeout = connectionTimeout * 2 : connectionTimeout);
}

function disconnect(deviceInfo) {
  module.exports.setUnavailable(deviceInfo, __('error.offline'));
}

function deleted(deviceInfo) {
  devices = devices.filter(device => device.id !== deviceInfo.id);
  disconnect(deviceInfo);
}

function pair(socket) {
  let listDeviceCallback;
  const noDeviceTimeout = setTimeout(() => listDeviceCallback && listDeviceCallback(null, []), 5000);
  let newDevices = [];

  const getDeviceObject = (deviceInfo, UDN) => {
    return {
      name: deviceInfo.friendlyName,
      data: {
        id: `${UDN}:${deviceInfo.deviceId}`,
        UDN,
        deviceId: deviceInfo.deviceId
      }
    }
  };

  Object.keys(Homey.app.clients).forEach(clientKey => {
    const client = Homey.app.clients[clientKey];
    if (client && client.deviceType === Homey.app.DEVICE_TYPE.Bridge) {
      client.getEndDevices((err, endDevices) => {
        if (!err && endDevices) {
          devices = endDevices
            .filter(endDevice => !getEndDevice({ UDN: client.UDN, deviceId: endDevice.deviceId }))
            .map(endDevice => getDeviceObject(endDevice, client.UDN));
          if (devices.length) {
            clearTimeout(noDeviceTimeout);
            socket.emit('list_devices', devices);
          }
        }
      });
    }
  });

  Homey.app.discover(deviceInfo => {
    if (deviceInfo.deviceType === Homey.app.DEVICE_TYPE.Bridge) {
      const client = Homey.app.wemo.client(deviceInfo);
      client.getEndDevices((err, endDevices) => {
        devices = endDevices
          .filter(endDevice => !getEndDevice({ UDN: client.UDN, deviceId: endDevice.deviceId }))
          .map(endDevice => getDeviceObject(endDevice, client.UDN));
        if (devices.length) {
          clearTimeout(noDeviceTimeout);
          socket.emit('list_devices', devices);
        }
      });
    }
  });

  socket.on('list_devices', (data, callback) => {
    listDeviceCallback = callback;
  });

  socket.on('add_device', (newDevice) => {
    devices.push(newDevice.data);
    newDevices.push(newDevice.data);
  });

  socket.on('disconnect', () => {
    const UDNList = [];
    newDevices.filter(deviceInfo => {
      if (UDNList.indexOf(deviceInfo.UDN) === -1) {
        UDNList.push(deviceInfo.UDN);
        return true;
      } else {
        return false;
      }
    }).forEach(deviceInfo => {
      if (Homey.app.clients[deviceInfo.UDN] && Homey.app.clients[deviceInfo.UDN].initialized) {
        checkEndDevices(Homey.app.clients[deviceInfo.UDN]);
      } else {
        createConnection(deviceInfo);
      }
    });
  });
}

function getOnOff(deviceInfo, callback) {
  waitForDevice(deviceInfo).then(device => {
    device.getDeviceStatus(deviceInfo.deviceId, (err, result) => {
      if (err || result['10006'] === '') {
        const self = this || {};
        Homey.app.retry.call(
          self,
          err => {
            disconnect(deviceInfo);
            callback(err);
          },
          getOnOff.bind(self, deviceInfo, callback)
        );
      } else {
        callback(err, result['10006'] !== '0')
      }
    });
  }).catch(err => callback(err));
}

function setOnOff(deviceInfo, state, callback) {
  waitForDevice(deviceInfo).then(device => {
    device.setDeviceStatus(
      deviceInfo.deviceId,
      state ? 10008 : 10006,  // Because of a bug in the belkin bulbs we set the brightness value to turn on them on
      state ?
        device.status ? device.status['10008'].split(':')[0] + ':0' || '255:0' : '255:0' :
        '0',
      err => {
        if (err) {
          const self = this || {};
          Homey.app.retry.call(
            self,
            err => {
              disconnect(deviceInfo);
              callback(err);
            },
            setOnOff.bind(self, deviceInfo, state, callback)
          );
        } else {
          callback(null, state);
        }
      }
    );
  }).catch(err => callback(err));
}

function getDim(deviceInfo, callback) {
  waitForDevice(deviceInfo).then(device => {
    device.getDeviceStatus(deviceInfo.deviceId, (err, result) => {
      if (err) {
        const self = this || {};
        Homey.app.retry.call(
          self,
          err => {
            disconnect(deviceInfo);
            callback(err);
          },
          getDim.bind(self, deviceInfo, callback)
        );
      } else {
        callback(err, result['10008'].split(':')[0] / 255)
      }
    });
  }).catch(err => callback(err));
}

function setDim(deviceInfo, state, callback) {
  waitForDevice(deviceInfo).then(device => {
    device.setDeviceStatus(deviceInfo.deviceId, 10008, `${Math.round(state * 255)}:0`, err => {
      if (err) {
        const self = this || {};
        Homey.app.retry.call(
          self,
          err => {
            disconnect(deviceInfo);
            callback(err);
          },
          setDim.bind(self, deviceInfo, state, callback)
        );
      } else {
        callback(null, state);
      }
    });
  }).catch(err => callback(err));
}

function waitForDevice(deviceInfo) {
  return new Promise(resolve => {
    if (!(Homey.app.clients[deviceInfo.UDN] && Homey.app.clients[deviceInfo.UDN].initialized)) {
      return createConnection(deviceInfo);
    } else {
      resolve(Homey.app.clients[deviceInfo.UDN]);
    }
  });
}

function createConnection(deviceInfo) {
  const self = this || {};
  return Homey.app.getConnection(deviceInfo).then(device => {
    if (device.initialized) {
      return;
    }

    device.initialized = true;

    // TODO revise code below
    // Hacky way to check if the driver lost connection while polling
    let connectionLostTimeout;
    device.subscriptions.__defineSetter__('urn:Belkin:service:bridge:1', function (val) {
      this._subscriptionCheckValue = val;
      if (!device.callbackURL) { // callbackURL is manually deleted by app.js:disconnect when device is disconnected
        return;
      } else if (val === null) {
        if (val === null && device.callbackURL && !connectionLostTimeout) {
          connectionLostTimeout = setTimeout(() => {
            connectionLostTimeout = null;
            if (this._subscriptionCheckValue === null && device.callbackURL) { //Check if subscription is still null
              disconnect(device);
              devices
                .filter(knownDevice => knownDevice.UDN === device.UDN)
                .forEach(knownDevice => disconnect(knownDevice));
            }
          }, 6500);
        }
      } else {
        checkEndDevices(device);
      }
    });
    device.subscriptions.__defineGetter__('urn:Belkin:service:bridge:1', function () {
      return this._subscriptionCheckValue;
    });

    device.on('statusChange', (deviceId, capabilityId, value) => {
      const endDevice = getEndDevice({ UDN: device.UDN, deviceId });
      if (endDevice) {
        module.exports.setAvailable(endDevice);
        if (capabilityId === '10006' && Homey.app.dedupeUpdate(device, capabilityId, value)) {
          module.exports.realtime(endDevice, 'onoff', value !== '0');
        } else if (capabilityId === '10008') {
          if (Homey.app.dedupeUpdate(device, '10006', '1')) {
            module.exports.realtime(endDevice, 'onoff', true);
          }
          if (Homey.app.dedupeUpdate(device, capabilityId, value)) {
            module.exports.realtime(endDevice, 'dim', value.split(':')[0] / 255);
          }
        }
      }
    });

  }).catch(err => {
    return new Promise((resolve, reject) => {
      Homey.app.retry.call(self, deviceInfo, reject, () => resolve(createConnection.call(self, deviceInfo)));
    });
  });
}

function checkEndDevices(device) {
  device.getEndDevices((err, endDevices) => {
    if (!err && endDevices) {
      devices.forEach(endDevice => {
        const knownEndDevice = getEndDevice(Object.assign(endDevice, { UDN: device.UDN }));
        if (knownEndDevice) {
          getOnOff(knownEndDevice, err => !err && module.exports.setAvailable(knownEndDevice));
        }
      });
    }
  });
}

function getEndDevice(deviceInfo) {
  return devices.find(endDevice => deviceInfo.deviceId === endDevice.deviceId && deviceInfo.UDN === endDevice.UDN);
}

const capabilities = {
  onoff: {
    get: getOnOff,
    set: setOnOff
  },
  dim: {
    get: getDim,
    set: setDim
  }
};

module.exports = {
  init,
  pair,
  capabilities,
  deleted
};