function joinRoom() {

    const username =
        document.getElementById("username").value;

    const room =
        document.getElementById("room").value;

    if(!username || !room){
        alert("Fill all fields");
        return;
    }

    localStorage.setItem("username", username);
    localStorage.setItem("room", room);

    window.location = "chat.html";
}
