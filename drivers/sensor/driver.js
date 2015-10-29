"use strict";

var devices 		= {};
var foundDevices 	= {};
var pairingDevices	= {};

//var devices contains:
/*var devices 		= {
	"uuid:sdsdfsdds": { //uuid
		"name": blasdf,
		"ip": 255.255.255.255,
		"port": 1234,
		"state": 
	}
}*/
		
var self = {
	
	init: function( devices, callback ){ // we're ready
		Homey.log("The driver of Wemo Sensor started");

		Homey.app.discover(); //Start discovering devices
		//setInterval( function() {Homey.app.findEndDevices();}, 5000)

		Homey.app.listen_event(); //Start listening to incoming events

		Homey.log('devices', devices);

		Homey.app.foundEmitter.on('foundSensor', function (foundDevices){
			Homey.log("FoundDevices: " + foundDevices);
			devices.forEach(function(device){ //Loopt trough all registered devices
				for( var foundDevice in foundDevices ) { } //Create foundDevice to get the uuid
					Homey.log("New device added1, this is now the list:", devices)
					if (device.id == foundDevices[foundDevice].uuid) {
						//getState(device, function(state) { //Get state
							devices[ device.id ] = {
								"name": device.name,
								"ip": device.ip
							}
						//});

						Homey.log("New device added2, this is now the list:", devices)

						Homey.app.getState(); //Start checking the state of the sensor

						Homey.log("New device added3, this is now the list:", devices)

						Homey.app.stateEmitter.on('new_state', function (state, sid) {
							Homey.log("Found a new state", state);
							Homey.log("For the device with this sid:", sid);

							module.exports.realtime( device, 'alarm_motion', state );
						});
					};
			});

		});

		callback();
	},
	
	name: {
		set: function( device, name, callback ) {
			// A Wemo device does not have a name
		}
	},
	
	capabilities: {
		alarm_motion: {
			get: function( device, callback ){
				Homey.log("get alarm state");

				Homey.app.getState(device, function(state) {
					Homey.log('state', state);
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
					}
				})
			}

			devices[ pairingDevices[pairingDevice].id ] = {
				"name": pairingDevices[pairingDevice].name,
				"ip": pairingDevices[pairingDevice].ip,
			}

			callback( devices_list );
			
			foundDevices = {};
		},

		add_device: function( callback, emit, data ) {
			//
		},
	}
	
}

module.exports = self;