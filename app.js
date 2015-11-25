"use strict";

var Express 		= require('express');
var Emitter         = require('events').EventEmitter;
var xml2js 			= require('xml2js');
var freeport		= require('freeport');
var bodyparser 		= require('body-parser');
var url 			= require('url');
var request 		= require('request');
var http 			= require('http');
var WeMo 			= new require('wemo');
var tcpp 			= require('tcp-ping');
var device          = {};
var possiblePorts 	= [49152, 49153, 49154, 49155]; //Most common port: 49153

var lock = false;
var local_ip; //Homeys local IP
var listen_port; //Homeys port where we can listen to events send by the sensor

var self = {
	init: function () {
		Homey.log("WeMo app started");

		Homey.app.discover(); //Start discovering all the devices

		self.foundEmitter	= new Emitter(); //used when device is found by discover
		self.stateEmitter	= new Emitter(); //used when state of the device is changed
	},

	getState: function ( device, callback ) {
		Homey.log("Getting the state");
		Homey.log(device);

		var ports;

		if (device != null) {

			if (device.tryAgain != true) ports = [device.port]; //First try with 1 port
			else ports = possiblePorts; //if second try --> use multiple ports

			Homey.log('ports', ports);
			ports.forEach(function(port) { //Try the ports that are listed in the port array
				Homey.log('port', port);
				var wemoSwitch = new WeMo(device.ip, port); //Fill in the IP and port which is found during discovery
				wemoSwitch.getBinaryState(function(err, result) {
		        	if (err) {
		        		Homey.log(err);

		        		if (device.tryAgain != true) { //Try again with all possible ports
		        			setTimeout(function(){ //After 3 seconds callback "time-out"
								console.log(callback);
								callback("time-out");	
							}, 3 * 1000); //3 sec

		        			Homey.app.getState({'id': device.id, 'name': device.name, 'ip': device.ip, 'tryAgain': true});
		        		}
		        	} else {
		        		Homey.log(result);
		        		if (result == 1) callback(true);
		        		if (result == 0) callback(false);
		        	}
		    	})
			})
		}
	},

	setState: function ( device, state, callback) {
		Homey.log("Setting the state");

		if (state == true ) state = 1;
		if (state == false) state = 0;

		if (device != null) {
			var ports = [device.port];
			ports.forEach(function(port) { //Try the ports that are listed in the port array
				var wemoSwitch = new WeMo(device.ip, port); //Fill in the IP and port which is found during discovery
				wemoSwitch.getBinaryState(function(err, result) { //Get the state
					if (err) console.error(err);
		        	wemoSwitch.setBinaryState(state, function(err, result) { // Switch the state
					    if (err) console.error(err);
					    wemoSwitch.getBinaryState(function(err, result) { //Check the state again
					        if (err) console.error(err);
					        Homey.log("result3: " + result); // 1
					        if (result == 1) callback(true);
		        			if (result == 0) callback(false);
					    });
					});
		    	});
			})
		}
	},

	discover: function ( options, callback ) {
		Homey.log("Starting with discovering devices");

		var again			= 0; //First time we try to find the devices
		var foundSocket 	= {};
		var foundSensor 	= {};

		var Client = require('node-ssdp').Client
	      , client = new Client({})

	    client.on('response', function (headers, statusCode, rinfo){
			//console.log("%j\n%s\n%j\n-----", headers, statusCode, rinfo);

			var location = url.parse(headers.LOCATION);
			var uuid = headers.USN;

			if (uuid.indexOf("Belkin") > 0){ //If found Belkin in the UUID (So found a Belkin Device)
			  	console.log("Found a Belkin Device")

			  	if (uuid.indexOf("Sensor") > 0){ //If found a Sensor
			  		console.log("It is a Sensor");

			  		foundSensor[ uuid ] = {
						"name": "WeMo Motion Sensor",
						"uuid": uuid,
						"ip": rinfo.address,
						"port": location.port
					};
					console.log(foundSensor);

					Homey.app.subscribe_event(location); //Subscribe to event

					self.foundEmitter.emit('foundSensor', foundSensor);
			  	}

			  	if (uuid.indexOf("Socket") > 0){ //If found a Socket
			  		console.log("It is a Socket");

			  		foundSocket [ uuid ] = {
						"name": "WeMo Socket",
						"uuid": uuid,
						"ip": rinfo.address,
						"port": location.port
					};
					console.log(foundSocket);

			  		self.foundEmitter.emit('foundSocket', foundSocket)
			  	}
		  	}

		});

		var repeat = setInterval(function() { 
			client.search('urn:Belkin:service:basicevent:1');
		    
		    lock = true;
		    again++;

			if (again == 3) { //run 3 times
				clearTimeout(repeat);
			}
		}, 5000) //every 5 sec

		client.search('urn:Belkin:service:basicevent:1'); //Search now
	},

	subscribe_event: function (location, callback) { //Subscribe to sensor event
		Homey.log("Subscribe to event");
		Homey.app.get_ip(null, function(ip) { //Get local IP of Homey
			Homey.app.find_freeport(null, function(port) { //Find a free port

				request.get(location.href, function(err, res, xml){
					xml2js.parseString(xml, function(err, json){
						device = { //Settings of the sensors
							ip: location.hostname,
							port: location.port
						};

						var subscribeoptions = {
							host: device.ip, //Ip of the sensor
							port: device.port, //port of the sensor
							path: '/upnp/event/basicevent1',
							method: 'SUBSCRIBE',
							headers: {
								'CALLBACK': '<http://' + ip +':' + port + '>',
								'NT': 'upnp:event',
						 		'TIMEOUT': 'Second-600' //10 minutes
							}
						};

						function subscribe() {
							Homey.log('subscribeoptions', subscribeoptions);

							var subscriptions = [];
							var sub_request = (function(d) { return http.request(subscribeoptions, function(res) {
								subscriptions[res.headers.sid] = d;
							})})(device);

							http.request(subscribeoptions, function(res) { 
								//Actually send the subscribe request
							}).end();

							sub_request.on('error', function (e) {
								console.log(e);
							});

							sub_request.end();
							Homey.log("Subscribed to the sensor event");
						}
						
						subscribe();
						var interval = setInterval(function() {subscribe();}, 1000 * 60 * 8); //Repeat every 8 minutes

						Homey.app.listen_event(); //We will start listen to the events from the sensor/driver.js
					});
				});
			});
		});
	},

	listen_event: function (options, callback) {
		Homey.log("Start listening to new events");
		var app = new Express();

		app.use(bodyparser.raw({type: 'text/xml'}));

        app.all('/', function(req, res) {
        	//console.log("HEADERS: %j", req.headers);
        	//console.log("BODY: %j", req.body);
        	//console.log("SID: %j", req.headers.sid);

        	var sid = req.headers.sid

			xml2js.parseString(req.body, function(err, json){
				if (err) {
					console.log(err);
				}
				
				console.log("EVENT: %j" , json);

				if (json['e:propertyset']['e:property'][0]['BinaryState'][0]) { //Find the BinaryState
					var state = json['e:propertyset']['e:property'][0]['BinaryState'][0];
					//Homey.log("STATE: %j", state);
					if (state == 1) self.stateEmitter.emit('new_state', true, sid); //Emit the state
	        		if (state == 0) self.stateEmitter.emit('new_state', false, sid); //Emit the state
				}
			});
        	res.send(200); //Send back that we received the event succesfully
        });

        app.listen(listen_port);
	},

	get_ip: function (options, callback) {
		Homey.log("Getting IP");
		Homey.manager('cloud').getLocalAddress(function( err, address){
            Homey.log( err, address );
            var address = address.split(":");
			address = address[0];
            local_ip = address;
            callback(address);
        });
	},

	find_freeport: function (options, callback) {
		Homey.log("Getting a freeport");
		freeport(function(err, port) {
		if (err) throw err
			if (port > 1024) { //Port needs to be higher then 1024 for Homey
				listen_port = port;
				console.log(port);
				callback(port);
			} else {
				console.log("Try again to find a port above 1024");
				Homey.app.findfreeport();
			}
		})
	},

	check_availability: function (device, callback){
		Homey.app.ping(device.ip, function (available) { //Ping the device, to check availability
			if (available == false) { 
				callback(false);

				var pingInterval = setInterval( Homey.app.ping, 1000 * 60, device.ip, function (available) { //Ping again every minute
					if (available == true) {
						callback(true);
						clearInterval(pingInterval); //Stop ping when found
						Homey.app.discover(); //Start discovering for this new device so it will get subscribed to the events
					}
				});
			}

			if (available == true) callback(true);
		});
	},

	ping: function (ip, callback) {
		tcpp.probe(ip, 49153, function(err, available) {
		    console.log(available); //Contains true or false
		    callback(available);
		});
	}
}

module.exports = self;