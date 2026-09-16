/* net.js —— WebSocket 客户端封装 */
const Net = (() => {
  let ws = null;
  let handlers = {};
  let myId = null;
  let myRoom = "default";

  function on(type, fn) { handlers[type] = fn; }

  function connect(name, room, ok, fail) {
    myRoom = room || "default";
    const proto = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${proto}://${location.host}/ws`);
    ws.onopen = () => {
      send({ t: "join", name, room: myRoom });
    };
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.t === "joined") {
        myId = msg.id;
        myRoom = msg.room;
        if (ok) ok();
      }
      if (msg.t === "error") {
        if (fail) fail(msg.msg);
      }
      const h = handlers[msg.t];
      if (h) h(msg);
    };
    ws.onclose = () => {
      const h = handlers["_close"];
      if (h) h();
    };
    ws.onerror = () => {
      const h = handlers["_error"];
      if (h) h();
    };
  }

  function send(obj) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
  }

  return { connect, on, send, get id() { return myId; }, get room() { return myRoom; } };
})();
