'use strict';

const logger = require('homey-log').Log;
const Wemo = require('wemo-client');
const WemoClient = require('wemo-client/client');
const wemo = new Wemo();

function init() {
}

function getConnection(device) {
	return new Promise((resolve, reject) => {
		const UDN = device.UDN || device.id;

		if (!wemo._clients[UDN]) {
			const notFound = setTimeout(reject.bind(null, 'Could not find device', device), 5000);
			discover(deviceInfo => {
				if (deviceInfo.UDN === UDN) {
					clearTimeout(notFound);
					const client = wemo.client(deviceInfo);
					client.on('error', (err) => {
						if(client.disconnected || !wemo._clients[deviceInfo.UDN] || !client.callbackUrl){
							// Swallow errors of devices that have been disconnected by this app
							return;
						}
						console.log('[Wemo][Error]', err);

						// reapply listeners
						const dummyFunc = (() => null);
						Object.keys(WemoClient.EventServices).forEach(eventName => {
							if(client.listeners(eventName).length){
								client.once(eventName, dummyFunc);
								console.log('reapplied', eventName, 'listener');
								setTimeout(() => client.removeListener(eventName, dummyFunc), 1000);
							}
						});
					});
					resolve(client);
				}
			});
		} else {
			resolve(wemo._clients[UDN]);
		}
	})
}

function discover(callback) {
	const foundDevices = [];
	for (let i = 0; i < 10; i++) {
		setTimeout(
			wemo.discover(deviceInfo => {
					if (foundDevices.indexOf(deviceInfo.UDN) === -1) {
						foundDevices.push(deviceInfo.UDN);
						callback(deviceInfo);
					}
				}
			),
			i * 100
		);
	}
}

function disconnect(device) {
	device.callbackURL = null;
	const client = wemo._clients[device.UDN || device.id];
	if (client) {
		client.disconnected = true;
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
	if(!device){
		// FIXME check why device is undefined
		logger.captureException(new Error('device is undefined'), { extra: { arguments: [device, capabilityId, value]}});
		return true;
	}
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