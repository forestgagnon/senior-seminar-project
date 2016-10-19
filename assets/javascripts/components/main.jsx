import socketConstants from 'shared/socketConstants';
import physicsConfig from 'shared/physicsConfig';
import gameloop from 'node-gameloop';

const engineParams = physicsConfig.engineParams;

class Main extends React.Component {

  constructor(){
    super();
    this.gameCanvasRef = null;
    this.socket = null;
    this.state = {
      message: ""
    };

    this.engine = m.Engine.create();
    this.engine.timing.delta = 1000/engineParams.FPS;
    this.engine.timing.timeScale = engineParams.TIME_SCALE; //default is 1
    this.engine.world.gravity.scale = engineParams.GRAVITY; //default is 0.001

    this.renderer = null;

    this.gameLoopIntervalId = null;

    //========== COMPONENT INSTANCE BINDERS ==========\\
    this.updateGame = this.updateGame.bind(this);
    this.gameLoop = this.gameLoop.bind(this);
    this.startGameLoop = this.startGameLoop.bind(this);
    this.pauseGameLoop = this.pauseGameLoop.bind(this);
  }

  componentDidMount() {
    this.socket = socketIO();
    this.socket.on(socketConstants.S_INITIALIZE, (data) => {
      this.setState({ message: data }, () => this.startGameLoop());
    });
    this.socket.on(socketConstants.S_GAME_UPDATE, (data) => {
      this.pauseGameLoop();
      console.log(data.bodies);
      this.updateGame(data);
      this.startGameLoop();
    });
    this.socket.emit(socketConstants.C_INITIALIZE);

    //Initialize renderer
    this.renderer = m.Render.create({
      engine: this.engine,
      element: this.gameCanvasRef,
      options: {
        width: engineParams.WIDTH,
        height: engineParams.HEIGHT,
        wireframes: false,
      },
    });

    m.Render.run(this.renderer);

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
    const { bodies, timestamp } = data;
    let bodiesToAdd = [];
    _.each(bodies, (unfilteredProps) => {
      const props = _.omit(unfilteredProps, ['parts']);
      const body = m.Composite.get(this.engine.world, props.id, props.type);
      if (!_.isNull(body)) {
        //Body already exists
        m.Body.set(body, props);
      }
      else {
        //Body needs to be created
        bodiesToAdd.push(m.Body.create(props));
      }
    });
    m.World.add(this.engine.world, bodiesToAdd);


    console.log(this.engine.timing.timestamp);
    console.log(timestamp);
    //Update timestamp
    if (Math.abs(timestamp - this.engine.timing.timestamp) > 100) {
      this.engine.timing.timestamp = timestamp;
    }
  }

  gameLoop(delta) {
    m.Events.trigger(this.engine, 'tick', { timestamp: this.engine.timing.timestamp });
    m.Engine.update(this.engine, this.engine.timing.delta);
    m.Events.trigger(this.engine, 'afterTick', { timestamp: this.engine.timing.timestamp });
  }

  startGameLoop() {
    this.gameLoopIntervalId = gameloop.setGameLoop(this.gameLoop, 1000 / engineParams.FPS);
  }

  pauseGameLoop() {
    gameloop.clearGameLoop(this.gameLoopIntervalId);
  }
}
export default Main;
