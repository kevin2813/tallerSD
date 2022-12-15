var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

// pagina inicial
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/index.html'); 
});

// carpeta de assets
app.use('/assets',express.static('assets'))

// escuchar en puerto definido en env o en el 8000
app.set('port', (process.env.PORT || 8000));
http.listen(app.get('port'), function(){
  console.log('Escuchando en el puerto ',app.get('port'));
});

var jugadores = {}; // diccionario de jugadores donde la llave es el id del socket
var balas = []; // arreglo con las balas a las que necesitamos hacer seguimiento
var index = 0; // index para asignar a los jugadores

// conecciones socket.io
io.on('connection', function(socket){
	// cuando un nuevo usuario se conecta
	socket.on('nuevo-jugador',function(estado){
    estado.id = index; // le asignamos un id
    index++;
		jugadores[socket.id] = estado; // guardamos los datos iniciales del jugador (estado inicial)
    // emite señal a todos, conteniendo la lista actualizada de jugadores
		io.emit('actualizar-jugadores',jugadores);
	})
  
  // desconecciones socket.io
  socket.on('disconnect',function(estado){
    if(jugadores.hasOwnProperty(socket.id))
      delete jugadores[socket.id]; // eliminar de nuestro diccionario al jugador que se va
    io.emit('actualizar-jugadores',jugadores); // avisar a todos que se actualizo la lista de jugadores
  }) 
  
  // cuando hay movimiento
  socket.on('mover-jugador',function(datos_posicion){
    if(jugadores[socket.id] == undefined) return;
    jugadores[socket.id].x = datos_posicion.x;  
    jugadores[socket.id].y = datos_posicion.y; 
    jugadores[socket.id].angulo = datos_posicion.angulo; 
    io.emit('actualizar-jugadores',jugadores);
  })
  
  // cuando hay disparos
  socket.on('disparo-bala',function(data){
    if(jugadores[socket.id] == undefined) return;
    var nueva_bala = data;
    data.padre_id = socket.id;
    balas.push(nueva_bala);
  });
})

// actualizamos frecuentemente la posicion de las balas (60 veces por frame en este caso) y enviamos la actualizacion
function ServerGameLoop(){
  for(var i=0;i<balas.length;i++){
    var bala = balas[i];
    bala.x += bala.vel_x; 
    bala.y += bala.vel_y; 
    
    // ver si va a colisionar
    var id_muerto = null;
    for(var id in jugadores){
      if(bala.padre_id != id){
        // que no sea mi propia bala la que me mate
        var dx = jugadores[id].x - bala.x; 
        var dy = jugadores[id].y - bala.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if(dist < 70){
          jugadores[id].vida -= 2;
          if(jugadores[id].vida <= 0){
            id_muerto = id;
          }
          io.emit('colision-jugador',id, jugadores[id].vida);
        }
      }
    }

    if(id_muerto){
      if(jugadores.hasOwnProperty(id_muerto))
        delete jugadores[id_muerto];
      io.emit('muerte-jugador',id_muerto);
    }
    
    // quita la bala si se sale de los limites
    if(bala.x < -10 || bala.x > 1290 || bala.y < -10 || bala.y > 730){
        balas.splice(i,1);
        i--;
    }
        
  }
  io.emit("balas-actualizacion",balas);
}

setInterval(ServerGameLoop, 16); 