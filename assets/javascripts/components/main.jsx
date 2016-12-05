import socketConstants from 'shared/socketConstants';
import physicsConfigModule from 'shared/physicsConfig';
const physicsConfig = physicsConfigModule(m);
import Gameloop from 'node-gameloop';
import FastPriorityQueue from 'fastpriorityqueue';
import MatterWorldWrap from 'shared/matter-world-wrap';
import MiscUtils from 'shared/miscUtils';

const ENGINE_PARAMS = physicsConfig.engineParams;
const MOVEMENT_FORCES = physicsConfig.movementForces;
const KEY_CODES = {
  'W': 'W'.charCodeAt(0),
  'A': 'A'.charCodeAt(0),
  'S': 'S'.charCodeAt(0),
  'D': 'D'.charCodeAt(0),
};

class Main extends React.Component {

  constructor(){
    super();
    this.gameCanvasRef = null;
    this.socket = null;
    this.state = {
      message: "",
      latency: 0,
      lagSimulationMs: 100
    };

    m.Engine.update = m.Common.chain(
        m.Engine.update,
        MatterWorldWrap(m).update
    );

    this.engine = m.Engine.create({ enableSleeping: false });
    this.engine.timing.delta = 1000/ENGINE_PARAMS.FPS;
    this.engine.timing.timeScale = ENGINE_PARAMS.TIME_SCALE; //default is 1
    this.engine.world.gravity.scale = ENGINE_PARAMS.GRAVITY; //default is 0.001
    this.engine.world.bounds.min = { x: 0, y: 0 };
    this.engine.world.bounds.max = { x: ENGINE_PARAMS.WIDTH, y: ENGINE_PARAMS.HEIGHT };

    this.renderer = null;

    this.gameLoopIntervalId = null;
    this.updateIntervalId = null;

    this.playerId = null;
    this.allBodies = {};
    this.playerBody = null;
    this.keyMap = {};
    this.lastMoveConfirmation = 0;
    this.pausePlayerCorrection = false;
    this.lastCorrection = null; //TODO: unused for now
    this.lastPlayerCorrection = null;
    this.lastDelta = this.engine.timing.delta;
    this.lastUpdateNum = 0;
    this.latestUpdate = null;
    this.timeOfLastMove = null;

    this.pausedBodiesById = {};


    //========== COMPONENT INSTANCE BINDERS ==========\\
    this.updateWorldToLatestGamestate = this.updateWorldToLatestGamestate.bind(this);
    this.gameLoop = this.gameLoop.bind(this);
    this.startGameLoop = this.startGameLoop.bind(this);
    this.pauseGameLoop = this.pauseGameLoop.bind(this);
    this.setRenderPropsPlayer = this.setRenderPropsPlayer.bind(this);
    this.setRenderPropsBoundary = this.setRenderPropsBoundary.bind(this);
    this.handleCollisions = this.handleCollisions.bind(this);
    this.tickEngine = this.tickEngine.bind(this);
    this.setLatencyCompensatedVelocity = this.setLatencyCompensatedVelocity.bind(this);

    m.Events.on(this.engine, "tick", this.handleCollisions);
  }

  componentDidMount() {
    this.socket = socketIO();
    this.socket.on(socketConstants.S_INITIALIZE, (data) => {
      this.setState({ message: data }, () => this.startGameLoop());
    });

    this.socket.on(socketConstants.S_PING_REQUEST, (data) => {
      setTimeout(() => { //TODO: timeout is for latency simulation
        this.socket.emit(socketConstants.C_PING_RESPONSE, { serverTimestamp: data.serverTimestamp });
      }, this.state.lagSimulationMs * 2);
    });

    this.socket.on(socketConstants.S_PING_NOTIFICATION, (data) => {
      this.setState({ latency: data.latency });
    });
    //TODO: remove lag simulation delays from non-ping-detection functions
    this.socket.on(socketConstants.S_GAME_UPDATE, (data) => {
      const { gameData, playerId, lastClientTimestamp } = data;
      this.playerId = playerId;
      setTimeout(()=>{this.latestUpdate = { //TODO: timeout is for latency simulation
        bodies: gameData.bodies,
        timestamp: gameData.timestamp,
        updateNum: gameData.updateNum,
        lastClientTimestamp: lastClientTimestamp,
        timeReceived: Date.now()
      }}, this.state.latency);
    });

    this.socket.on(socketConstants.S_MOVE_CONFIRMATION, (data) => {
      setTimeout(() => { //TODO: timeout is for latency simulation
        this.lastMoveConfirmation = Date.now();
        this.updateQueue = new FastPriorityQueue(timestampComparator);
      }, this.state.latency);
    });

    this.socket.emit(socketConstants.C_INITIALIZE);

    //Initialize renderer
    this.renderer = m.Render.create({
      engine: this.engine,
      element: this.gameCanvasRef,
      options: {
        width: ENGINE_PARAMS.WIDTH,
        height: ENGINE_PARAMS.HEIGHT,
        wireframes: false,
        showSleeping: false
      },
    });

    m.Render.run(this.renderer);

    window.onkeydown = function(e){
      this.keyMap[e.which] = true;
    }.bind(this);

    window.onkeyup = function(e){
       this.keyMap[e.which] = false;
    }.bind(this);

  }

  render() {
    return (
      <div className="main-container">
        <div ref={(r) => this.gameCanvasRef = r}></div>
        <div className="info-box">
          <div className="info-box-content">
            <p>Latency: {this.state.latency} ms</p>
          </div>
          <div className="info-box-content">
            <span>Lag simulation: </span>
            <input
              value={this.state.lagSimulationMs}
              onChange={(e) => this.setState({ lagSimulationMs: parseInt(e.target.value) })}
            />
          </div>
        </div>
      </div>
    );
  }

  handleCollisions(e) {
    const now = Date.now();
    e.collisionActive.forEach((pair) => {
      const { bodyA, bodyB } = pair;

      //Handle correction pausing
      if (bodyA.playerId === this.playerId && bodyB.label !== 'boundary') {
        this.pausedBodiesById[bodyB.id] = {
          body: bodyB,
          lastCollideTime: now
        };
      }
      else if (bodyB.playerId === this.playerId && bodyA.label !== 'boundary') {
        this.pausedBodiesById[bodyA.id] = {
          body: bodyA,
          lastCollideTime: now
        };
      }
    });
    e.collisionStart.forEach((pair) => {
      const { bodyA, bodyB } = pair;
      //Handle boundary bounce collisions
      physicsConfig.boundaryBounceHandler(bodyA, bodyB);
    });
  }

  updateWorldToLatestGamestate() {
    const { bodies, timestamp, lastClientTimestamp, timeReceived, updateNum } = this.latestUpdate;

    // If the new updateNum is lower, then the game was probably restarted, so clear the world
    //TODO: make this less hacky by issuing a game restart socket message
    if (updateNum < this.lastUpdateNum) {
      this.allBodies = {};
      this.playerBody = null;
      m.World.clear(this.engine.world, false);
    }
    this.lastUpdateNum = updateNum;

    const bodyTypes = [
      { bodyList: bodies.boundaryBodies, renderPropFunc: this.setRenderPropsBoundary },
      { bodyList: bodies.playerBodies, renderPropFunc: this.setRenderPropsPlayer },
      { bodyList: bodies.squareBodies, renderPropFunc: this.setRenderPropsSquare }
    ];
    let bodiesToAdd = [];
    let newValidBodyIds = [];
    _.each(bodyTypes, (bodyType) => {
      let { bodyList, renderPropFunc } = bodyType;
      _.each(bodyList, (unfilteredProps) => {
        const props = _.omit(unfilteredProps, ['parts']);
        newValidBodyIds.push(props.id);
        const body = m.Composite.get(this.engine.world, props.id, props.type);
        if (!_.isNull(body)) {
          //Body already exists
          renderPropFunc(props, body);
          if (this.playerBody && body.id === this.playerBody.id) {
            if (!this.pausePlayerCorrection) {
              this.lastPlayerCorrection = Date.now();
              m.Body.set(body, props);
            }
          }
          else if (!this.pausePlayerCorrection || _.isUndefined(this.pausedBodiesById[body.id])) {
            m.Body.set(body, props);
            this.setLatencyCompensatedVelocity(body);
          }
          else {
            console.log('body ' + body.id + ' is paused'); //XXX
          }
        }
        else {
          //Body needs to be created
          let newBody = m.Body.create(props);
          renderPropFunc(props, newBody);
          m.Body.set(newBody, props);
          bodiesToAdd.push(newBody);
          this.allBodies[props.id] = newBody;
          if (newBody.label === 'player' && newBody.playerId === this.playerId) {
            this.playerBody = newBody;
          }
          else {
            this.setLatencyCompensatedVelocity(newBody);
          }
        }

      });
    });
    m.World.add(this.engine.world, bodiesToAdd);

    //Remove old bodies that don't exist anymore
    _.each(_.keys(_.omit(this.allBodies, newValidBodyIds)), (idToDelete) => {
      m.World.remove(this.engine.world, this.allBodies[idToDelete]);
      delete this.allBodies[idToDelete];
    });

    this.lastCorrection = Date.now();
    this.latestUpdate = null;

    return true;
  }

  setLatencyCompensatedVelocity(body) {
    if (this.state.latency) {
      m.Body.setVelocity(body, {
        x: body.velocity.x / this.state.latency,
        y: body.velocity.y / this.state.latency
      });
    }
  }

  gameLoop(delta) {
    const NOW = Date.now();

    //Handle player movement
    let directions = [];
    if (!_.isNull(this.playerBody)) {
      if (this.keyMap[KEY_CODES['W']]) {
        m.Body.applyForce(this.playerBody, this.playerBody.position, MOVEMENT_FORCES.UP);
        directions.push('UP');
      } else if (this.keyMap[KEY_CODES['S']]) {
        m.Body.applyForce(this.playerBody, this.playerBody.position, MOVEMENT_FORCES.DOWN);
        directions.push('DOWN');
      }

      if (this.keyMap[KEY_CODES['A']]) {
        m.Body.applyForce(this.playerBody, this.playerBody.position, MOVEMENT_FORCES.LEFT);
        directions.push('LEFT');
      } else if (this.keyMap[KEY_CODES['D']]) {
        m.Body.applyForce(this.playerBody, this.playerBody.position, MOVEMENT_FORCES.RIGHT);
        directions.push('RIGHT');
      }
    }

    if (directions.length > 0) {
      this.pausePlayerCorrection = true;
      setTimeout(() => { //TODO: timeout is for latency simulation
        this.socket.emit(socketConstants.C_MOVE, {
          directions: directions,
          clientTimestamp: NOW
        });
      }, this.state.latency);
      this.timeOfLastMove = NOW;
    }
    else if (this.pausePlayerCorrection && this.timeOfLastMove !== null && NOW - this.timeOfLastMove > 4*this.state.latency) {
      this.pausePlayerCorrection = false;
    }

    //Update the world based on the latest server gamestate if available
    if (this.latestUpdate !== null) {
      m.Render.stop(this.renderer);

      //Unpause bodies that haven't collided with the player in awhile
      //TODO: non-player pausing is currently exhibiting weird behavior
      let bodyIdsToUnpause = [];
      _.each(this.pausedBodiesById, (pausedBody, id) => {
        if (NOW - pausedBody.lastCollideTime > this.state.latency*4) {
          console.log('unpausing ' + id); //XXX
          bodyIdsToUnpause.push(id);
        }
      });
      this.pausedBodiesById = _.omit(this.pausedBodiesById, bodyIdsToUnpause);

      this.updateWorldToLatestGamestate();

      /* Server gamestates are in the pastd. Before updating the world and fast forwarding, we need to
      remove any objects that have their correction paused
      (e.g. the player during moves, or things they have collided with recently)
      */
      if (this.pausePlayerCorrection) {
        m.World.remove(this.engine.world, this.playerBody);
      }
      else {
        //Unpause everything else since player correction is not paused.
        this.pausedBodiesById = {};
      }

      // //Unpause bodies that haven't collided with the player in awhile
      // //TODO: non-player pausing is currently exhibiting weird behavior
      // let bodyIdsToUnpause = [];
      // _.each(this.pausedBodiesById, (pausedBody, id) => {
      //   if (NOW - pausedBody.lastCollideTime > this.state.latency*4) {
      //     console.log('unpausing ' + id); //XXX
      //     bodyIdsToUnpause.push(id);
      //   }
      // });
      // this.pausedBodiesById = _.omit(this.pausedBodiesById, bodyIdsToUnpause);

      //Temporarily remove paused non-player bodies before fast-forwarding
      let tempRemovedBodies = [];
      _.each(this.pausedBodiesById, (pausedBody) => {
        tempRemovedBodies.push(pausedBody);
      });
      m.World.remove(this.engine.world, tempRemovedBodies);

      //Fast forward the engine by the number of ticks corresponding to double the current latency
      let iterations = Math.ceil((2*this.state.latency) / this.engine.timing.delta);
      for (let i = 0; i < iterations; i++) {
        this.tickEngine();
      }

      //Restore paused bodies back to the world
      if (this.pausePlayerCorrection) {
        m.World.add(this.engine.world, this.playerBody);
      }
      m.World.add(this.engine.world, tempRemovedBodies);

      m.Render.run(this.renderer);
    }

    //Tick the engine normally
    this.tickEngine();
  }

  tickEngine() {
    m.Events.trigger(this.engine, 'tick', {
      timestamp: this.engine.timing.timestamp,
      collisionStart: this.engine.pairs.collisionStart,
      collisionActive: this.engine.pairs.collisionActive
    });
    m.Engine.update(this.engine, this.engine.timing.delta);
    m.Events.trigger(this.engine, 'afterTick', { timestamp: this.engine.timing.timestamp });
  }

  startGameLoop() {
    this.gameLoopIntervalId = Gameloop.setGameLoop(this.gameLoop, 1000 / ENGINE_PARAMS.FPS);
  }

  pauseGameLoop() {
    Gameloop.clearGameLoop(this.gameLoopIntervalId);
  }

  setRenderPropsPlayer(props, body) {
    if (body.playerId === this.playerId) {
      props.render.fillStyle = 'green';
      props.render.strokeStyle = 'green';
      props.render.strokeWidth = '2px';
    } else {
      props.render.fillStyle = 'black';
      props.render.strokeStyle = 'black';
    }
  }

  setRenderPropsBoundary(props, body) {
    props.render.fillStyle = '#242424';
    props.render.strokeStyle = '#242424';
  }

  setRenderPropsSquare(props, body) {
    props.render.fillStyle = 'red';
    props.render.strokeStyle = 'red';
  }
}
export default Main;

function timestampComparator(a,b) {
  return a.updateNum < b.updateNum;
}
