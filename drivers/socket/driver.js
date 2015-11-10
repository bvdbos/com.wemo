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
		Homey.log("The driver of Wemo Socket started");

		/*Homey.app.discover(); //Start discovering devices

		Homey.app.foundEmitter.on('foundSocket', function(foundDevices){
			devices_data_objects.forEach(function(devices_data_object){ //Loopt trough all registered devices
				for( var foundDevice in foundDevices ) { } //Create foundDevice to get the uuid
					if (devices_data_object.id == foundDevices[foundDevice].uuid) {
						//getState(devices_data_object, function(state) { //Get state
							devices[ devices_data_object.id ] = {
								"name": devices_data_object.name,
								"ip": devices_data_object.ip
							}
						//});
						Homey.log("New device added, this is now the list:", devices)
					};
			});

		}); */

		callback();
	},
	
	name: {
		set: function( device, name, callback ) {
			// A Wemo device does not have a name
		}
	},
	
	capabilities: {
		onoff: {
			get: function( device, callback) {
				Homey.app.getState(device, function(state) {
					callback(state)
				});
			},
			set: function( device, state, callback ){
				Homey.app.setState(device, state, function(state) {
					Homey.log('realtime', state);
					Homey.log('device', device);
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
					}
				})
			}

			/*devices[ pairingDevices[pairingDevice].id ] = {
				"name": pairingDevices[pairingDevice].name,
				"ip": pairingDevices[pairingDevice].ip,
			}*/

			callback( devices_list );
			
			foundDevices = {};
		},

		add_device: function( callback, emit, data ) {
			//
		},
	}
	
}

module.exports = self;