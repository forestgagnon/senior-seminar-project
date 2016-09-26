const path = require('path'),
  procConstants = require(path.resolve(__dirname, 'procConstants.js'));

let game;

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
  let updateNum = 0;



  setInterval(sendUpdate.bind(null, updateNum), 500);
}

function sendUpdate(updateNum) {
  const data = 'some game data ' + updateNum++;
  process.send({ message: procConstants.R_GAME_DATA, data: data });
}
