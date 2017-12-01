// Express
var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/',function(req, res) {
	res.sendFile(__dirname + '/client/index.html');
});
app.use('/client',express.static(__dirname + '/client'));
// listen to server: 80
serv.listen(process.env.PORT || 80);
console.log("Server started.");

var SOCKET_LIST = {};

// All components will share these
var Component = function(){
	var self = {
		x:600,
		y:600,
		spdX:0,
		spdY:0,
		id:"",
	}
	self.update = function(){
		self.updatePosition();
	}
	self.updatePosition = function(){
		if(self.x > 1175){
			self.x = 1175;
		}
		if(self.x < 323){
			self.x = 323;
		}
		if(self.y > 810){
			self.y = 810;
		}
		if(self.y < 329){
			self.y = 329;
		}
		self.x += self.spdX;
		self.y += self.spdY;
	}
	self.getDistance = function(pt){
		return Math.sqrt(Math.pow(self.x-pt.x,2) + Math.pow(self.y-pt.y,2));
	}
	return self;
}

var Player = function(id){
	var self = Component();
	self.id = id;
	self.number = "" + Math.floor(10 * Math.random());
	self.pressingRight = false;
	self.pressingLeft = false;
	self.pressingUp = false;
	self.pressingDown = false;
	self.pressingAttack = false;
	self.pressingSpace = false;
	self.mouseAngle = 0;
	self.maxSpd = 10;
	self.hp = 15;
	self.hpMax = 15;
	self.charge = 0;
	self.chargeMax = 15;
	self.score = 0;
	self.canShoot = true;
	self.canTrap = true;
	self.delayShooting = 5;
	self.delayTraps = 20;

	var super_update = self.update;
	self.update = function(){
		self.updateSpd();
		self.updateAttackDelay();
		super_update();

		if(self.pressingAttack && self.canShoot){
			self.shootBullet(self.mouseAngle);
			for(var i in Player.list)
				self.layTrap(self.x + Math.random() * 30 - 15, self.y + Math.random() * 30 - 15);
			self.x += Math.cos(self.mouseAngle/180*Math.PI) * 10;
			self.y += Math.sin(self.mouseAngle/180*Math.PI) * 10;
		}
		if(self.pressingSpace && self.canTrap){
			self.layTrap(self.x, self.y);
		}
		if(self.pressingSpace){
			self.layMilk(self.x, self.y);
		}
	}
	self.shootBullet = function(angle){
		self.canShoot = false;
		self.delayShooting = 5;
		var b = Bullet(self.id,angle);
		b.x = self.x;
		b.y = self.y;
	}

	self.layTrap = function(x, y){
		self.canTrap = false;
		self.delayTraps = 20;
		var t = Trap(self.id,x,y);
		t.x = self.x;
		t.y = self.y;
	}

	self.layMilk = function(x, y){
		var m = Milk(self.id);
	}

	self.updateSpd = function(){
		if(self.pressingRight)
			self.spdX = self.maxSpd;
		else if(self.pressingLeft)
			self.spdX = -self.maxSpd;
		else
			self.spdX = 0;

		if(self.pressingUp)
			self.spdY = -self.maxSpd;
		else if(self.pressingDown)
			self.spdY = self.maxSpd;
		else
			self.spdY = 0;
	}

	self.updateAttackDelay = function(){
		self.delayShooting -= 1;
		self.delayTraps -= 1;

		if(self.delayShooting == 0){
			self.canShoot = true;
		}
		if(self.delayTraps == 0){
			self.canTrap = true;
		}
	}

	self.getInitPack = function(){
		return {
			id:self.id,
			x:self.x,
			y:self.y,
			number:self.number,
			hp:self.hp,
			hpMax:self.hpMax,
			charge:self.hp,
			chargeMax:self.chargeMax,
			score:self.score,
		};
	}
	self.getUpdatePack = function(){
		return {
			id:self.id,
			x:self.x,
			y:self.y,
			hp:self.hp,
			charge:self.charge,
			score:self.score,
		}
	}

	Player.list[id] = self;

	initPack.player.push(self.getInitPack());
	return self;
}
Player.list = {};
Player.onConnect = function(socket){
	var player = Player(socket.id);
	socket.on('keyPress',function(data){
		if(data.inputId === 'left')
			player.pressingLeft = data.state;
		else if(data.inputId === 'right')
			player.pressingRight = data.state;
		else if(data.inputId === 'up')
			player.pressingUp = data.state;
		else if(data.inputId === 'down')
			player.pressingDown = data.state;
		else if(data.inputId === 'space')
			player.pressingSpace = data.state;
		else if(data.inputId === 'attack')
			player.pressingAttack = data.state;
		else if(data.inputId === 'mouseAngle')
			player.mouseAngle = data.state;
	});

	socket.emit('init',{
		selfId:socket.id,
		player:Player.getAllInitPack(),
		bullet:Bullet.getAllInitPack(),
	})
}
Player.getAllInitPack = function(){
	var players = [];
	for(var i in Player.list)
		players.push(Player.list[i].getInitPack());
	return players;
}

Player.onDisconnect = function(socket){
	delete Player.list[socket.id];
	removePack.player.push(socket.id);
}
Player.update = function(){
	var pack = [];
	for(var i in Player.list){
		var player = Player.list[i];
		player.update();
		pack.push(player.getUpdatePack());
	}
	return pack;
}

var Bullet = function(parent,angle){
	var self = Component();
	self.id = Math.random();
	self.spdX = -Math.cos(angle/180*Math.PI) * 10;
	self.spdY = -Math.sin(angle/180*Math.PI) * 10;
	self.parent = parent;
	self.timer = 0;
	self.toRemove = false;
	var super_update = self.update;
	self.update = function(){
		if(self.timer++ > 100)
			self.toRemove = true;
		super_update();

		for(var i in Player.list){
			var p = Player.list[i];
			if(self.getDistance(p) < 32 && self.parent !== p.id){
				p.hp -= 1;

				if(p.hp <= 0){
					var shooter = Player.list[self.parent];
					if(shooter)
						shooter.score += 1;
					p.hp = p.hpMax;
					p.x = Math.random() * 500;
					p.y = Math.random() * 500;
				}
				self.toRemove = true;
			}
		}
	}
	self.getInitPack = function(){
		return {
			id:self.id,
			x:self.x,
			y:self.y,
		};
	}
	self.getUpdatePack = function(){
		return {
			id:self.id,
			x:self.x,
			y:self.y,
		};
	}

	Bullet.list[self.id] = self;
	initPack.bullet.push(self.getInitPack());
	return self;
}
Bullet.list = {};

Bullet.update = function(){
	var pack = [];
	for(var i in Bullet.list){
		var bullet = Bullet.list[i];
		bullet.update();
		if(bullet.toRemove){
			delete Bullet.list[i];
			removePack.bullet.push(bullet.id);
		} else
			pack.push(bullet.getUpdatePack());
	}
	return pack;
}

Bullet.getAllInitPack = function(){
	var bullets = [];
	for(var i in Bullet.list)
		bullets.push(Bullet.list[i].getInitPack());
	return bullets;
}

var Trap = function(parent,x,y){
	var self = Component();
	self.x = x;
	self.y = y;
	self.id = Math.random();
	self.parent = parent;
	self.timer = 0;
	self.toRemove = false;
	var super_update = self.update;
	self.update = function(){
		if(self.timer++ > 100)
			self.toRemove = true;
		super_update();

		for(var i in Player.list){
			var p = Player.list[i];
			if(self.getDistance(p) < 32 && self.parent !== p.id){
				p.hp -= 5;
				if(p.hp <= 0){
					var shooter = Player.list[self.parent];
					if(shooter)
						shooter.score += 1;
					p.hp = p.hpMax;
					p.x = Math.random() * 500;
					p.y = Math.random() * 500;
				}
				self.toRemove = true;
			}
		}
	}
	self.getInitPack = function(){
		return {
			id:self.id,
			x:self.x,
			y:self.y,
		};
	}
	self.getUpdatePack = function(){
		return {
			id:self.id,
			x:self.x,
			y:self.y,
		};
	}

	Trap.list[self.id] = self;
	initPack.trap.push(self.getInitPack());
	return self;
}
Trap.list = {};

Trap.update = function(){
	var pack = [];
	for(var i in Trap.list){
		var trap = Trap.list[i];
		trap.update();
		if(trap.toRemove){
			delete Trap.list[i];
			removePack.trap.push(trap.id);
		} else
			pack.push(trap.getUpdatePack());
	}
	return pack;
}

Trap.getAllInitPack = function(){
	var traps = [];
	for(var i in Trap.list)
		traps.push(Trap.list[i].getInitPack());
	return traps;
}

var Milk = function(){
	var self = Component();
	self.x = Math.random() * 842 + 300;
	self.y = Math.random() * 486 + 300;
	self.id = Math.random();
	self.timer = 0;
	self.toRemove = false;
	var super_update = self.update;
	self.update = function(){
		if(self.timer++ > 100)
			self.toRemove = true;
		super_update();

		for(var i in Player.list){
			var p = Player.list[i];
			if(self.getDistance(p) < 32 && self.parent !== p.id){
				if(p.charge < p.chargeMax)
					p.charge += 1;
				self.toRemove = true;
			}
		}
	}
	self.getInitPack = function(){
		return {
			id:self.id,
			x:self.x,
			y:self.y,
		};
	}
	self.getUpdatePack = function(){
		return {
			id:self.id,
			x:self.x,
			y:self.y,
		};
	}

	Milk.list[self.id] = self;
	initPack.milk.push(self.getInitPack());
	return self;
}
Milk.list = {};

Milk.update = function(){
	var pack = [];
	for(var i in Milk.list){
		var milk = Milk.list[i];
		milk.update();
		if(milk.toRemove){
			delete Milk.list[i];
			removePack.milk.push(milk.id);
		} else

			pack.push(milk.getUpdatePack());
	}
	return pack;
}

Milk.getAllInitPack = function(){
	var milks = [];
	for(var i in Milk.list)
		milks.push(Milk.list[i].getInitPack());
	return milks;
}

var DEBUG = true;
var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket){
	socket.id = Math.random();
	SOCKET_LIST[socket.id] = socket;

	socket.on('play',function(){
		Player.onConnect(socket);
	});
	socket.on('disconnect',function(){
		delete SOCKET_LIST[socket.id];
		Player.onDisconnect(socket);
	});
	socket.on('sendMsgToServer',function(playerName, message){
		for(var i in SOCKET_LIST){
			SOCKET_LIST[i].emit('addToChat',playerName + ': ' + message);
		}
	});
	socket.on('evalServer',function(data){
		if(!DEBUG)
			return;
		var res = eval(data);
		socket.emit('evalAnswer',res);
	});
});

var initPack = {player:[],bullet:[],trap:[],milk:[]};
var removePack = {player:[],bullet:[],trap:[],milk:[]};

setInterval(function(){
	var pack = {
		player:Player.update(),
		bullet:Bullet.update(),
		trap:Trap.update(),
		milk:Milk.update(),
	}

	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('init',initPack);
		socket.emit('update',pack);
		socket.emit('remove',removePack);
	}
	initPack.player = [];
	initPack.bullet = [];
	initPack.trap = [];
	initPack.milk = [];
	removePack.player = [];
	removePack.bullet = [];
	removePack.trap = [];
	removePack.milk = [];

},1000/25);
