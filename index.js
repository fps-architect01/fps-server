const http = require("http");
const express = require("express");
const { Server } = require("colyseus");
const { Room, Client } = require("colyseus");
const { Schema, MapSchema, type } = require("@colyseus/schema");

// O'yinchi holati
class Player extends Schema {}
type("number")(Player.prototype, "x");
type("number")(Player.prototype, "y");
type("number")(Player.prototype, "z");
type("number")(Player.prototype, "rotY");
type("number")(Player.prototype, "health");
type("string")(Player.prototype, "weapon");
type("number")(Player.prototype, "ammo");
type("boolean")(Player.prototype, "alive");

// Xona holati
class GameState extends Schema {}
type({ map: Player })(GameState.prototype, "players");
type("number")(GameState.prototype, "roundTime");

class FPSRoom extends Room {
  onCreate(options) {
    this.maxClients = 4;
    this.setState(new GameState());
    this.state.players = new MapSchema();
    this.state.roundTime = 180;

    // Har 50ms da holat yangilanadi
    this.setSimulationInterval((deltaTime) => this.update(deltaTime), 50);

    // O'yinchi harakati
    this.onMessage("move", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive) return;
      player.x = data.x;
      player.y = data.y;
      player.z = data.z;
      player.rotY = data.rotY;
    });

    // Otish
    this.onMessage("shoot", (client, data) => {
      const shooter = this.state.players.get(client.sessionId);
      if (!shooter || !shooter.alive || shooter.ammo <= 0) return;
      shooter.ammo -= 1;

      // Nishonga tegish tekshiruvi (soddalashtirilgan)
      this.state.players.forEach((target, id) => {
        if (id === client.sessionId || !target.alive) return;
        const dx = target.x - shooter.x;
        const dz = target.z - shooter.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 2.0) { // yaqin masofa
          target.health -= data.damage || 25;
          if (target.health <= 0) {
            target.alive = false;
            target.health = 0;
          }
        }
      });
    });

    // Qayta o'qlash
    this.onMessage("reload", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) player.ammo = 30;
    });

    // Qurol almashtirish
    this.onMessage("switchWeapon", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player) player.weapon = data.weapon;
    });
  }

  onJoin(client, options) {
    const player = new Player();
    player.x = Math.random() * 10 - 5;
    player.y = 0;
    player.z = Math.random() * 10 - 5;
    player.rotY = 0;
    player.health = 100;
    player.weapon = "ak47";
    player.ammo = 30;
    player.alive = true;
    this.state.players.set(client.sessionId, player);
    console.log(`${client.sessionId} kirdi. Jami: ${this.state.players.size}`);
  }

  onLeave(client) {
    this.state.players.delete(client.sessionId);
    console.log(`${client.sessionId} chiqdi. Jami: ${this.state.players.size}`);
  }

  update(deltaTime) {
    // Raund vaqti
    this.state.roundTime = Math.max(0, this.state.roundTime - deltaTime / 1000);
  }
}

const app = express();
const server = http.createServer(app);
const gameServer = new Server({ server });

gameServer.define("fps_room", FPSRoom);
gameServer.listen(process.env.PORT || 2567);
console.log("Server ishga tushdi");
