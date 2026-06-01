const socket = io();

const username = localStorage.getItem("username");
const room = localStorage.getItem("room");

socket.emit("joinRoom", {
username,
room
});

const messages = document.getElementById("messages");

socket.on("message", (data) => {

```
const div = document.createElement("div");

div.classList.add("message");

if(data.user === username){
    div.classList.add("me");
}else{
    div.classList.add("other");
}

div.innerHTML =
`<b>${data.user}</b><br>${data.text}`;

messages.appendChild(div);

messages.scrollTop = messages.scrollHeight;
```

});

function sendMessage(){

```
const input =
document.getElementById("messageInput");

const text = input.value.trim();

if(text === "") return;

socket.emit("chatMessage", text);

input.value = "";
```

}

