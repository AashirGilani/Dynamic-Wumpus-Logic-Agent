# app.py - Flask Web Application for Wumpus Logic Agent

from flask import Flask, jsonify, request, render_template, session
import json
from wumpus import WumpusWorld
import logic

app = Flask(__name__)
app.secret_key = "wumpus_secret_key_2026"

# Store game state in memory (single-user demo)
game: WumpusWorld = None


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/new_game", methods=["POST"])
def new_game():
    global game
    data = request.get_json()
    rows = max(3, min(int(data.get("rows", 4)), 7))
    cols = max(3, min(int(data.get("cols", 4)), 7))
    game = WumpusWorld(rows, cols)
    return jsonify({"ok": True, "state": game.get_state()})


@app.route("/api/state", methods=["GET"])
def get_state():
    if game is None:
        return jsonify({"ok": False, "message": "No game started."})
    return jsonify({"ok": True, "state": game.get_state()})


@app.route("/api/move", methods=["POST"])
def move():
    global game
    if game is None:
        return jsonify({"ok": False, "message": "No game started."})
    data = request.get_json()
    direction = data.get("direction", "")
    result = game.move(direction)
    # After every move, run inference
    infer_log = []
    if result.get("ok") and not result.get("dead"):
        infer_log, steps = game.infer_safe_cells(logic)
    result["state"] = game.get_state()
    result["infer_log"] = infer_log
    return jsonify(result)


@app.route("/api/infer", methods=["POST"])
def infer():
    global game
    if game is None:
        return jsonify({"ok": False, "message": "No game started."})
    infer_log, steps = game.infer_safe_cells(logic)
    return jsonify({
        "ok": True,
        "infer_log": infer_log,
        "steps": steps,
        "state": game.get_state()
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)
