import socketConstants from 'shared/socketConstants';
import physicsConfig from 'shared/physicsConfig';
import Gameloop from 'node-gameloop';
import FastPriorityQueue from 'fastpriorityqueue';
import MatterWorldWrap from 'shared/matter-world-wrap';

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
      message: ""
    };

    m.Engine.update = m.Common.chain(
        m.Engine.update,
        MatterWorldWrap(m).update
    );

    this.engine = m.Engine.create({ enableSleeping: true });
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
    this.latency = 0;
    this.lastMoveConfirmation = 0;
    this.pauseCorrection = false;

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
    this.socket.on(socketConstants.S_GAME_UPDATE, (data) => {
      const { gameData, playerId, lastClientTimestamp } = data;
      this.playerId = playerId
      setTimeout(()=>{this.updateQueue.add({
        timestamp: gameData.timestamp,
        playerBodies: gameData.playerBodies,
        boundaryBodies: gameData.boundaryBodies,
        lastClientTimestamp: lastClientTimestamp,
        timeReceived: Date.now()
      })}, LAG_SIMULATION_MS);
    });

    this.socket.on(socketConstants.S_MOVE_CONFIRMATION, (data) => {
      setTimeout(() => {
        clearInterval(this.updateIntervalId);
        this.latency = Date.now() - data.lastClientTimestamp;
        this.lastMoveConfirmation = Date.now();
        setInterval(this.updateGame, 1000/80);
        this.pauseCorrection = false;
      }, LAG_SIMULATION_MS);
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

    this.updateIntervalId = setInterval(this.updateGame, 1000/80);

  }

  render() {
    return (
      <div className="main-container">
        <div ref={(r) => this.gameCanvasRef = r}></div>
        {this.state.message}
      </div>
    );
  }

  updateGame(data) {
    const now = Date.now();
    if(this.updateQueue.isEmpty()) {
      this.updateQueue.trim();
      return;
    }
    else if(this.updateQueue.size > 50) {
      this.updateQueue = new FastPriorityQueue(timestampComparator);
      return;
    }
    const { playerBodies, boundaryBodies, timestamp, lastClientTimestamp, timeReceived } = this.updateQueue.poll();
    // console.log('LOCAL: ' + this.engine.timing.timestamp);
    // console.log('SERVER:' + timestamp);
    // console.log('DIFF:' + (this.engine.timing.timestamp - timestamp));
    //Update timestamp

    this.pauseGameLoop();
    console.log(timeReceived, this.lastMoveConfirmation, timeReceived - this.lastMoveConfirmation);
    if (this.pauseCorrection || timeReceived - this.lastMoveConfirmation < 2*LAG_SIMULATION_MS) {
      this.startGameLoop();
      return;
    }

    const bodyTypes = [
      { bodyList: boundaryBodies, renderPropFunc: this.setRenderPropsBoundary },
      { bodyList: playerBodies, renderPropFunc: this.setRenderPropsPlayer }
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
              m.Body.set(body, props);
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

    this.startGameLoop();

  }

  gameLoop(delta) {
    m.Events.trigger(this.engine, 'tick', { timestamp: this.engine.timing.timestamp });

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

    if(directions.length > 0) {
      // setTimeout(() => { this.pausePlayerCorrection = false; }, 2 * LAG_SIMULATION_MS);
      this.pauseCorrection = true;
      setTimeout(() => {
        this.socket.emit(socketConstants.C_MOVE, {
          directions: directions,
          clientTimestamp: Date.now()
        });
      }, LAG_SIMULATION_MS);

    }

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
}
export default Main;

function timestampComparator(a,b) {
  return a.timestamp < b.timestamp;
}
