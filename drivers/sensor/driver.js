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

		// Check if all devices are available
		if (devices != null) {
			devices.forEach(function(device){
				Homey.log(device);
				Homey.app.check_availability(device, function(available) {
					if (available == true) module.exports.setAvailable( device, callback );
					if (available == false) module.exports.setUnavailable( device, __('error.unavailable'), callback );
				});
			});
		}

		//When a device is found
		Homey.app.foundEmitter.on('foundSensor', function (foundDevices){ //When a sensor is found
			
			devices.forEach(function(device){ //Loopt trough all registered devices

				for( var foundDevice in foundDevices ) { } //Create foundDevice to get the uuid

				if (device.id == foundDevices[foundDevice].uuid) {
					
					devices[ device.id ] = {
						"name": device.name,
						"ip": device.ip,
						"port": device.port
					}

					module.exports.setAvailable( device, callback ); //Set device available

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
			}
		}
	},
	
	pair: function( socket ) {
		socket.on( "search", function( data, callback ){
			Homey.log('Wemo pairing has started');
			Homey.log('Searching for devices');

			Homey.app.discover(); //Start discovering devices

			Homey.app.foundEmitter.on('foundSensor', function(foundDevices){
				Homey.log("FoundDevices: " + foundDevices);
				pairingDevices = foundDevices;
				callback(null, foundDevices);
			})

			/*var repeat = setTimeout(function() { 
			callback(false, "no-devices");
			}, 20000) //every 5 sec*/
		}),
		
		socket.on( "list_devices", function( data, callback ){
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

			devices_list.forEach(function(device){ //Get the device
				Homey.app.stateEmitter.on('new_state', function (state, sid) { //Start listening to events
					Homey.log("Found a new state", state);
					module.exports.realtime( device, 'alarm_motion', state ); //Emit the states realtime to Homey
				});
			});

			callback( null, devices_list );
			
			foundDevices = {};
		})
	}
	
}

module.exports = self;