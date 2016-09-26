class Main extends React.Component {

  constructor(){
    super();
    this.socket = null;
    this.state = {
      message: "",
    };
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
