const pet_img = document.getElementById('pet-img');
const url = new URL(document.URL);
let ws;
function connectSocket() {
  ws = new WebSocket("wss://" + url.hostname);
  ws.onopen = () => {
    ws.send(window.pet_id);
  };

  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    switch (data.type) {
      case "stats":
        setStats(data.stats);
				pet_img.style.bottom = document.getElementById("stats").clientHeight + "px";
        break;
      case "seen":
				sayMessage(`YAY! ${data.username} is here!`);
				break;
    }
  };

  // Should attempt auto-reconnect here!
  ws.onclose = () => {
    setTimeout(connectSocket, 1000);
  };
}
connectSocket();

function setStats(stats) {
  let newHtml = "";
  for (let stat in stats) {
					newHtml += '<div>';
    newHtml += `<div>${stat}</div>`;
    newHtml += "<img src='/img/heart-filled.png'>".repeat(stats[stat]);
    newHtml += "<img src='/img/heart-empty.png'>".repeat(5 - stats[stat]);
					newHtml += '</div>';
  }
  document.getElementById("stats").innerHTML = newHtml;
}

const activities = [
				{img: "walking", speed: 1},
				{img: "running", speed: 5},
				{img: "sitting", speed: 0},
				{img: "sleeping", speed: 0}
];

let current_activity = activities[0];
function setActivity(activity) {
				current_activity = activity;
				document.getElementById('pet-img').src = `/img/${activity.img}.gif`;
}
setActivity(activities[0])
setInterval(() => setActivity(activities[Math.floor(Math.random() * activities.length)]), 10000);

let direction = 1;
function animate() {
				let current_left = parseInt(pet_img.style.left) || 0;
				let new_left = current_activity.speed * direction + current_left;
				if (new_left + pet_img.clientWidth > window.innerWidth) {
								direction = -1;
				} else if (new_left < 0) {
								direction = 1;
				}
				if (direction === -1 && current_activity.speed > 0) {
								pet_img.style.transform = 'scaleX(-1)';
				} else {
								pet_img.style.transform = 'scaleX(1)';
				}
				pet_img.style.left = ((current_activity.speed * direction) + current_left) + 'px';

				requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

let speaking = false;
let messages = [];
function sayMessage(message) {
messages.push(message);
}
