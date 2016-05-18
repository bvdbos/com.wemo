'use strict';

let devices;
let connectionTimeout = 7500;

function init(deviceList, callback) {
  devices = deviceList || [];

  connect();

  callback();
}

let connectTimeout;
function connect() {
  devices.forEach(deviceInfo => {
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
  Homey.app.disconnect(deviceInfo);
  module.exports.setUnavailable(deviceInfo, __('error.offline'));
}

function deleted(deviceInfo) {
  devices = devices.filter(device => device.id !== deviceInfo.id);
  disconnect(deviceInfo);
}

function pair(socket) {
  let listDeviceCallback;
  let noDeviceTimeout = setTimeout(() => listDeviceCallback && listDeviceCallback(null, []), 10000);
  const foundUDNList = [];

  const emit = (newDevices) => {
    if (newDevices.length) {
      if (noDeviceTimeout) {
        clearTimeout(noDeviceTimeout);
        noDeviceTimeout = null;
        listDeviceCallback(null, newDevices);
      } else {
        socket.emit('list_devices', newDevices)
      }
    }
  };
  
  const discover = () => {
    Homey.app.discover(deviceInfo => {
      if (deviceInfo.deviceType === Homey.app.DEVICE_TYPE.Motion &&
        devices.findIndex(knownDevice => knownDevice.UDN === deviceInfo.UDN) === -1 &&
        foundUDNList.indexOf(deviceInfo.UDN) === -1
      ) {
        clearTimeout(noDeviceTimeout);
        foundUDNList.push(deviceInfo.UDN);
        emit([{ name: deviceInfo.friendlyName, data: { id: deviceInfo.UDN } }]);
      }
    });
  };
  
  socket.on('list_devices', (data, callback) => {
    listDeviceCallback = callback
    discover();
  });

  socket.on('add_device', (newDevice) => {
    devices.push(newDevice.data);
  });

  socket.on('disconnect', () => {
    clearTimeout(noDeviceTimeout);
    connect();
  });
}

function getState(deviceInfo, callback) {
  waitForDevice(deviceInfo).then(device => {
    device.getBinaryState((err, result) => {
      if (err) {
        const self = this || {};
        Homey.app.retry.call(
          self,
          err => {
            disconnect(deviceInfo);
            callback(err);
          },
          getState.bind(self, deviceInfo, callback)
        );
      }
      callback(err, result !== '0')
    });
  }).catch(err => {
    callback(err);
  });
}

function waitForDevice(deviceInfo) {
  return new Promise(resolve => {
    if (!(Homey.app.clients[deviceInfo.id] && Homey.app.clients[deviceInfo.id].initialized)) {
      return createConnection(deviceInfo);
    } else {
      resolve(Homey.app.clients[deviceInfo.id]);
    }
  });
}

function createConnection(deviceInfo) {
  return Homey.app.getConnection(deviceInfo).then(device => {
    if (device.initialized) {
      return;
    }

    device.initialized = true;

    // TODO revise code below
    // Hacky way to check if the driver lost connection while polling
    let connectionLostTimeout;
    device.subscriptions._subscriptionCheckValue = device.subscriptions['urn:Belkin:service:basicevent:1'];
    device.subscriptions.__defineSetter__('urn:Belkin:service:basicevent:1', function (val) {
      this._subscriptionCheckValue = val;
      if (val === null) {
        if (device.callbackURL && !connectionLostTimeout) {
          connectionLostTimeout = setTimeout(() => {
            connectionLostTimeout = null;
            if (this._subscriptionCheckValue === null && device.callbackURL) { //Check if subscription is still null
              disconnect(deviceInfo);
            }
          }, 6500);
        }
      } else {
        module.exports.setAvailable(deviceInfo);
      }
    });
    device.subscriptions.__defineGetter__('urn:Belkin:service:basicevent:1', function () {
      return this._subscriptionCheckValue;
    });

    device.on('binaryState', value => {
      if (Homey.app.dedupeUpdate(device, 'alarm_motion', value)) {
        module.exports.realtime(deviceInfo, 'alarm_motion', value !== '0')
      }
    });

  }).catch(err => {
    return new Promise((resolve, reject) => {
      Homey.app.retry.call(self, deviceInfo, reject, () => resolve(createConnection.call(self, deviceInfo)));
    });
  });
}

const capabilities = {
  alarm_motion: {
    get: getState
  }
};

module.exports = {
  init,
  pair,
  capabilities,
  deleted
};