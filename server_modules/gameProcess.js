const path = require('path'),
  procConstants = require(path.resolve(__dirname, 'procConstants.js'));

let game;
let updateNum;

process.on('message', (message) => {
  console.log(message.message);
  switch(message.message) {
    case procConstants.P_START_GAME:
      initGame();
      break;
  }
});

function initGame(){
  clearInterval(sendUpdate);
  updateNum = 0;



  setInterval(sendUpdate, 500);
}

function sendUpdate() {
  const data = 'some game data ' + updateNum++;
  process.send({ message: procConstants.R_GAME_DATA, data: data });
}
