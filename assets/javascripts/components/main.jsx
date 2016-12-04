import socketConstants from 'shared/socketConstants';
import physicsConfig from 'shared/physicsConfig';
import Gameloop from 'node-gameloop';
import FastPriorityQueue from 'fastpriorityqueue';
import MatterWorldWrap from 'shared/matter-world-wrap';
import MiscUtils from 'shared/miscUtils';

const LAG_SIMULATION_MS = 300;

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

    this.updateQueue = new FastPriorityQueue(timestampComparator);

    this.playerId = null;
    this.allBodies = {};
    this.playerBody = null;
    this.keyMap = {};
    this.lastMoveConfirmation = 0;
    this.pauseCorrection = false;
    this.lastCorrection = Date.now();
    this.lastPlayerCorrection = Date.now();
    this.lastDelta = this.engine.timing.delta;
    this.lastUpdateNum = 0;
    this.latestUpdate = null;
    this.timeOfLastMove = 0;

    //========== COMPONENT INSTANCE BINDERS ==========\\
    this.updateGame = this.updateGame.bind(this);
    this.gameLoop = this.gameLoop.bind(this);
    this.startGameLoop = this.startGameLoop.bind(this);
    this.pauseGameLoop = this.pauseGameLoop.bind(this);
    this.setRenderPropsPlayer = this.setRenderPropsPlayer.bind(this);
    this.setRenderPropsBoundary = this.setRenderPropsBoundary.bind(this);
  }

  componentDidMount() {
    this.socket = socketIO();
    this.socket.on(socketConstants.S_INITIALIZE, (data) => {
      this.setState({ message: data }, () => this.startGameLoop());
    });

    this.socket.on(socketConstants.S_PING_REQUEST, (data) => {
      setTimeout(() => {
        this.socket.emit(socketConstants.C_PING_RESPONSE, { serverTimestamp: data.serverTimestamp });
      }, LAG_SIMULATION_MS * 2);
    });

    this.socket.on(socketConstants.S_PING_NOTIFICATION, (data) => {
      this.setState({ latency: data.latency });
    });
    //TODO: remove lag simulation delays from non-ping-detection functions
    this.socket.on(socketConstants.S_GAME_UPDATE, (data) => {
      const { gameData, playerId, lastClientTimestamp } = data;
      this.playerId = playerId
      setTimeout(()=>{this.latestUpdate = {
        bodies: gameData.bodies,
        timestamp: gameData.timestamp,
        updateNum: gameData.updateNum,
        lastClientTimestamp: lastClientTimestamp,
        timeReceived: Date.now()
      }}, this.state.latency);
    });

    this.socket.on(socketConstants.S_MOVE_CONFIRMATION, (data) => {
      setTimeout(() => {
        // clearInterval(this.updateIntervalId);
        this.lastMoveConfirmation = Date.now();
        this.updateQueue = new FastPriorityQueue(timestampComparator);
        // this.pauseCorrection = false;
        // this.updateIntervalId = setInterval(this.updateGame, 1000/80);
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

    // this.updateIntervalId = setInterval(this.updateGame, 1000/80);

  }

  render() {
    return (
      <div className="main-container">
        <div ref={(r) => this.gameCanvasRef = r}></div>
        <div className="info-box">
          <div className="info-box-content">
            <p>Latency: {this.state.latency} ms</p>
          </div>
        </div>
      </div>
    );
  }

  updateGame(data) {
    // if(this.updateQueue.isEmpty()) {
    //   this.updateQueue.trim();
    //   return;
    // }
    // else if(this.updateQueue.size > 50) {
    //   this.updateQueue = new FastPriorityQueue(timestampComparator);
    //   return;
    // }
    if (this.latestUpdate === null) {
      return false;
    }
    // const { bodies, timestamp, lastClientTimestamp, timeReceived, updateNum } = this.updateQueue.poll();
    const { bodies, timestamp, lastClientTimestamp, timeReceived, updateNum } = this.latestUpdate;
    // console.log('LOCAL: ' + this.engine.timing.timestamp);
    // console.log('SERVER:' + timestamp);
    // console.log('DIFF:' + (this.engine.timing.timestamp - timestamp));
    //Update timestamp

    // this.pauseGameLoop(); //TODO: is this needed?
    // if (Date.now() - this.lastCorrection < 1000 && (this.pauseCorrection || timeReceived - this.lastMoveConfirmation < 2*LAG_SIMULATION_MS)) {
    // if (this.pauseCorrection) {
    //   this.startGameLoop(); //TODO: is this needed?
    //   return;
    // }

    //Rewind time if possible
    // clearInterval(this.updateIntervalId);

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
            if (!this.pauseCorrection) {
              this.lastPlayerCorrection = Date.now();
              m.Body.set(body, props);
            }
          }
          else {
            m.Body.set(body, props);
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
        }
      });
    });
    m.World.add(this.engine.world, bodiesToAdd);

    //Remove old bodies that don't exist anymore
    _.each(_.keys(_.omit(this.allBodies, newValidBodyIds)), (idToDelete) => {
      m.World.remove(this.engine.world, this.allBodies[idToDelete]);
      delete this.allBodies[idToDelete];
    });

    // m.Render.stop(this.renderer);
    // let iterations = Math.ceil((2*this.state.latency) / this.engine.timing.delta);
    // // let iterations = 1;
    // for (let i = 0; i < iterations; i++) {
    //   m.Events.trigger(this.engine, 'tick', { timestamp: this.engine.timing.timestamp });
    //   m.Engine.update(this.engine, this.engine.timing.delta);
    //   // m.Engine.update(this.engine, this.state.latency);
    //   m.Events.trigger(this.engine, 'afterTick', { timestamp: this.engine.timing.timestamp });
    // }
    // m.Render.run(this.renderer);
    this.lastCorrection = Date.now();
    // this.startGameLoop(); //TODO: is this needed?
    // this.updateIntervalId = setInterval(this.updateGame, 1000/80);
    this.latestUpdate = null;

    return true;

  }

  gameLoop(delta) {
    m.Events.trigger(this.engine, 'tick', { timestamp: this.engine.timing.timestamp });

    // let updateResult = this.updateGame();
    //Handle movement
    let directions = [];
    if (!_.isNull(this.playerBody)) {
      if (this.keyMap[KEY_CODES['W']]) {
        m.Body.applyForce(this.playerBody, this.playerBody.position, MOVEMENT_FORCES.up);
        directions.push('up');
      } else if (this.keyMap[KEY_CODES['S']]) {
        m.Body.applyForce(this.playerBody, this.playerBody.position, MOVEMENT_FORCES.down);
        directions.push('down');
      }

      if (this.keyMap[KEY_CODES['A']]) {
        m.Body.applyForce(this.playerBody, this.playerBody.position, MOVEMENT_FORCES.left);
        directions.push('left');
      } else if (this.keyMap[KEY_CODES['D']]) {
        m.Body.applyForce(this.playerBody, this.playerBody.position, MOVEMENT_FORCES.right);
        directions.push('right');
      }
    }

    if (directions.length > 0) {
      // setTimeout(() => { this.pausePlayerCorrection = false; }, 2 * LAG_SIMULATION_MS);
      this.pauseCorrection = true;
      console.log('paused player correction');
      setTimeout(() => {
        this.socket.emit(socketConstants.C_MOVE, {
          directions: directions,
          clientTimestamp: Date.now()
        });
      }, this.state.latency);
      this.timeOfLastMove = Date.now();
    }
    else if (this.pauseCorrection && Date.now() - this.timeOfLastMove > 4*this.state.latency) {
      console.log('unpaused player correction');
      this.pauseCorrection = false;
    }

    let updateResult = this.updateGame();
    // m.Engine.update(this.engine, this.engine.timing.delta, this.engine.timing.delta / this.lastDelta);
    if (updateResult) {
      m.Render.stop(this.renderer);
      let iterations = Math.ceil((2*this.state.latency) / this.engine.timing.delta);
      if (this.pauseCorrection) {
        m.World.remove(this.engine.world, this.playerBody);
      }
      for (let i = 0; i < iterations; i++) {
        m.Events.trigger(this.engine, 'tick', { timestamp: this.engine.timing.timestamp });
        m.Engine.update(this.engine, this.engine.timing.delta);
        // m.Engine.update(this.engine, this.state.latency);
        m.Events.trigger(this.engine, 'afterTick', { timestamp: this.engine.timing.timestamp });
      }
      if (this.pauseCorrection) {
        m.World.add(this.engine.world, this.playerBody);
      }
      m.Render.run(this.renderer);
    }
    m.Engine.update(this.engine, this.engine.timing.delta);
    this.lastDelta = this.engine.timing.delta;
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
