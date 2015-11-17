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
		Homey.log("The driver of Wemo Sensor started");

		//Homey.app.listen_event(); //Start listening to incoming events

		Homey.app.foundEmitter.on('foundSensor', function (foundDevices){ //When a sensor is found
			
			devices.forEach(function(device){ //Loopt trough all registered devices

				for( var foundDevice in foundDevices ) { } //Create foundDevice to get the uuid

				if (device.id == foundDevices[foundDevice].uuid) {
					
					devices[ device.id ] = {
						"name": device.name,
						"ip": device.ip,
						"port": device.port
					}

					Homey.app.stateEmitter.on('new_state', function (state, sid) {
						Homey.log("Found a new state", state);

						module.exports.realtime( device, 'alarm_motion', state ); //Emit the states realtime to Homey
					});
				};
			});

		});

		callback();
	},
	
	capabilities: {
		alarm_motion: {
			get: function( device, callback ){
				Homey.log("getting sensor state");
				if (callback == "time-out") module.exports.setUnavailable( device, __('error.unavailable'), callback );

				Homey.app.getState(device, function(state) {
					Homey.log('get sensor state:', state);
					callback(null, state);
				});
			}
		}
	},
	
	pair: {
		search: function( callback, emit, data ){
			Homey.log('Wemo pairing has started');
			Homey.log('Searching for devices');

			Homey.app.discover(); //Start discovering devices

			Homey.app.foundEmitter.on('foundSensor', function(foundDevices){
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
		},
	}
	
}

module.exports = self;