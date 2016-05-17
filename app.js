'use strict';
const Wemo = require('wemo-client');
const wemo = new Wemo();


function init() {
}

function getConnection(device) {
  return new Promise((resolve, reject) => {
    const UDN = device.UDN || device.id;

    if (!wemo._clients[UDN]) {
      const notFound = setTimeout(reject.bind(null, 'Could not find device'), 5000);
      discover(deviceInfo => {
        if (deviceInfo.UDN === UDN) {
          clearTimeout(notFound);
          resolve(wemo.client(deviceInfo));
        }
      });
    } else {
      device.UDN = UDN;
      resolve(wemo.client(device));
    }
  })
}

function discover(callback) {
  wemo.discover(deviceInfo => {
    callback(deviceInfo);
  });
}

function disconnect(device) {
  device.callbackURL = null;
  const client = wemo._clients[device.UDN || device.id];
  if (client) {
    client.callbackURL = null; //Remove callback url so listeners will automatically stop
    wemo._clients[client.UDN] = null; //Remove device from connected clients
  }
}

function retry(callback, func) {
  this.retries = this.retries !== undefined ? this.retries : 0;
  this.retries++;
  if (this.retries >= 3) {
    callback('Could not complete call to device');
    return false;
  } else if (this.retries === 2) {
    setTimeout(func, 5100);
  } else {
    setTimeout(func, 500 * this.retries);
  }
  return true;
}

function dedupeUpdate(device, capabilityId, value) {
  device.status = device.status || {};
  if (device.status[capabilityId] === undefined) {
    device.status[capabilityId] = value;
    return true; // Todo debug when we can ignore status updates during connection setup
  } else if (device.status[capabilityId] !== value) {
    device.status[capabilityId] = value;
    return true;
  } else {
    return false;
  }
}

module.exports = {
  init,
  discover,
  getConnection,
  disconnect,
  retry,
  dedupeUpdate,
  clients: wemo._clients,
  DEVICE_TYPE: Wemo.DEVICE_TYPE,
  wemo
};