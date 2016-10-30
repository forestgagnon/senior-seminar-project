import socketConstants from 'shared/socketConstants';
import physicsConfig from 'shared/physicsConfig';
import Gameloop from 'node-gameloop';
import FastPriorityQueue from 'fastpriorityqueue';

const ENGINE_PARAMS = physicsConfig.engineParams;

class Main extends React.Component {

  constructor(){
    super();
    this.gameCanvasRef = null;
    this.socket = null;
    this.state = {
      message: ""
    };

    this.engine = m.Engine.create({ enableSleeping: true });
    this.engine.timing.delta = 1000/ENGINE_PARAMS.FPS;
    this.engine.timing.timeScale = ENGINE_PARAMS.TIME_SCALE; //default is 1
    this.engine.world.gravity.scale = ENGINE_PARAMS.GRAVITY; //default is 0.001

    this.renderer = null;

    this.gameLoopIntervalId = null;

    this.updateQueue = new FastPriorityQueue(timestampComparator);

    this.playerId = null;
    this.allBodies = {};

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
      const { gameData, playerId } = data;
      this.playerId = playerId;
      this.updateQueue.add({
        timestamp: gameData.timestamp,
        playerBodies: gameData.playerBodies,
        boundaryBodies: gameData.boundaryBodies
      });
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

    setInterval(this.updateGame, 1000/80);

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
    if(this.updateQueue.isEmpty()) {
      this.updateQueue.trim();
      return;
    }
    else if(this.updateQueue.size > 50) {
      this.updateQueue = new FastPriorityQueue(timestampComparator)
      return;
    }
    const { playerBodies, boundaryBodies, timestamp } = this.updateQueue.poll();

    // console.log(this.engine.timing.timestamp);
    // console.log(timestamp);
    //Update timestamp
    if (Math.abs(timestamp - this.engine.timing.timestamp) > 0) {
      this.engine.timing.timestamp = timestamp;
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
          m.Body.set(body, props);
        }
        else {
          //Body needs to be created
          let newBody = m.Body.create(props);
          bodiesToAdd.push(newBody);
          this.allBodies[props.id] = newBody;
        }
      });
    });
    m.World.add(this.engine.world, bodiesToAdd);

    //Remove old bodies that don't exist anymore
    _.each(_.keys(_.omit(this.allBodies, newValidBodyIds)), (idToDelete) => {
      m.World.remove(this.engine.world, this.allBodies[idToDelete]);
      delete this.allBodies[idToDelete];
    });

  }

  gameLoop(delta) {
    m.Events.trigger(this.engine, 'tick', { timestamp: this.engine.timing.timestamp });
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
