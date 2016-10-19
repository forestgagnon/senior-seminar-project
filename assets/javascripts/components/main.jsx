import socketConstants from 'shared/socketConstants';
import physicsConfig from 'shared/physicsConfig';

const engineParams = physicsConfig.engineParams;

class Main extends React.Component {

  constructor(){
    super();
    this.socket = null;
    this.state = {
      message: ""
    };

    this.engine = m.Engine.create();
    this.engine.timing.delta = 1000/engineParams.FPS;
    this.engine.timing.timeScale = engineParams.TIME_SCALE; //default is 1
    this.engine.world.gravity.scale = engineParams.GRAVITY; //default is 0.001
  }

  componentDidMount() {
    this.socket = socketIO();
    this.socket.on(socketConstants.S_INITIALIZE, (data) => {
      this.setState({ message: data });
    });
    this.socket.on(socketConstants.S_GAME_UPDATE, (data) => {
      console.log(data.bodies);
      console.log(data.timestamp);
    });
    this.socket.emit(socketConstants.C_INITIALIZE);
  }

  render() {
    return (
      <div className="main-container">
        {this.state.message}
      </div>
    );
  }
}
export default Main;
