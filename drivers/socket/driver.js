"use strict";

var devices 		= {};
var foundDevices 	= {};
var pairingDevices	= {};

//var devices contains:
/*var devices 		= {
	"uuid:fooUuid": { //uuid
		"name": fooName,
		"ip": 255.255.255.255,
		"port": 1234,
		"state": 0
	}
}*/
		
var self = {
	
	init: function( devices, callback ){ // we're ready
		Homey.log("The driver of Wemo Socket started");

		// Check if all devices are available 
		if (devices != null) {
			devices.forEach(function(device){
				Homey.log(device);

				Homey.app.ping(device.ip, function (available) { //Ping the device, to check availability
					if (available == false) { 
						module.exports.setUnavailable( device, __('error.unavailable'), callback );

						var pingInterval = setInterval( Homey.app.ping, 1000 * 60, device.ip, function (available) { //Ping again every minute
							if (available == true) {
								module.exports.setAvailable( device, callback );
								clearInterval(pingInterval); //Stop ping when found
								Homey.app.discover(); //Start discovering for this new device so it will get subscribed to the events
							}
						});
					}

					if (available == true) module.exports.setAvailable( device, callback );
				});
			});
		}

		callback();
	},
	
	capabilities: {
		onoff: {
			get: function( device, callback) {
				Homey.log("getting socket state");

				Homey.app.getState(device, function(state) {
					if (state == "time-out") {
						module.exports.setUnavailable( device, __('error.unavailable'), callback );
						
						Homey.app.check_availability(device, function(available) { //Start checking the availability
							if (available == true) module.exports.setAvailable( device, callback );
							if (available == false) module.exports.setUnavailable( device, __('error.unavailable'), callback );
						});
					}
					callback(null, state);
				});
			},
			set: function( device, state, callback ){
				Homey.log("setting socket state");
				Homey.app.setState(device, state, function(state) {
					Homey.log('Set state:', state);
					module.exports.realtime( device, 'onoff', state );
					callback(state) //New state
				});
			}
		}
	},
	
	pair: {
		search: function( callback, emit, data ){
			Homey.log('Wemo pairing has started');
			Homey.log('Searching for devices');

			Homey.app.discover(); //Start discovering devices

			Homey.app.foundEmitter.on('foundSocket', function(foundDevices){
				Homey.log("FoundDevices: " + foundDevices);
				pairingDevices = foundDevices;
				callback(foundDevices);
			})
		},
		
		list_devices: function( callback, emit, data) {
			Homey.log("List devices");

			var devices_list = [];

			for( var pairingDevice in pairingDevices ) {
				devices_list.push({
					name: pairingDevices[pairingDevice].name,
					data: {
						id: pairingDevices[pairingDevice].uuid, //'id' is the same as 'uuid'
						name: pairingDevices[pairingDevice].name,
						ip: pairingDevices[pairingDevice].ip,
						port: pairingDevices[pairingDevice].port
					}
				})
			}

			devices[ pairingDevices[pairingDevice].id ] = {
				"name": pairingDevices[pairingDevice].name,
				"ip": pairingDevices[pairingDevice].ip,
				"port": pairingDevices[pairingDevice].port
			}

			callback( devices_list );
			
			foundDevices = {};
		}
	}
	
}

module.exports = self;