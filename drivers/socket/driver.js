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

		callback();
	},
	
	capabilities: {
		onoff: {
			get: function( device, callback) {
				Homey.log("getting socket state");

				Homey.app.getState(device, function(state) {
					Homey.log('device', device);
					if (state == "time-out") Homey.log("Foo");
					if (state == "time-out") module.exports.setUnavailable( device, __('error.unavailable'), callback );
					callback(state)
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