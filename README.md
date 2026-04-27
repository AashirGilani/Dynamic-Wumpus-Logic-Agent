# Wumpus Logic Agent

A web-based Knowledge-Based Agent that navigates a Wumpus World grid using **Propositional Logic** and **Resolution Refutation** to deduce safe cells.

---

## Features

- **Dynamic grid sizing** (3×3 up to 7×7), configurable at runtime
- **Random hazard placement** — Pits and a Wumpus placed randomly each game
- **Percept generation** — Breeze near pits, Stench near the Wumpus
- **Propositional Logic KB** — updated with biconditional rules after each move
- **Resolution Refutation Engine** — automatically converts KB to CNF and resolves clauses to prove `¬P` and `¬W` for unvisited cells
- **Real-time metrics** — inference step count and current percepts displayed live
- **Color-coded grid** — Green (Safe), Dark (Unknown), Red (Pit), Purple (Wumpus)

---

## Tech Stack

| Layer       | Technology                         |
| ----------- | ---------------------------------- |
| Backend     | Python 3, Flask                    |
| Logic       | Custom CNF + Resolution (logic.py) |
| Environment | Wumpus World (wumpus.py)           |
| Frontend    | HTML, CSS, Vanilla JS              |

---

## Project Structure

```
wumpus_agent/
├── app.py           # Flask routes (API endpoints)
├── logic.py         # CNF builder + Resolution Refutation
├── wumpus.py        # Wumpus World environment
├── requirements.txt
└── templates/
    └── index.html   # Web UI
```

---

## How to Run Locally

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Start the server
python app.py

# 3. Open in browser
http://localhost:5000
```

---

## How to Play

1. Set grid **Rows** and **Cols**, then click **New Game**
2. Use the **arrow buttons** (or keyboard arrow keys) to move the agent
3. After each move, the Resolution engine automatically runs and marks safe cells
4. Click **Run Inference** to manually trigger the logic engine
5. Avoid Pits (💨 Breeze = nearby pit) and the Wumpus (💀 Stench = nearby Wumpus)
6. Find the Gold 🪙 to win!

---

## Logic Overview

### CNF Conversion

Each breeze percept `B_r_c = True` adds the clause:

```
{P_adj1, P_adj2, ...}  (at least one adjacent pit)
```

Each `B_r_c = False` adds:

```
{NOT_P_adj}  for every adjacent cell (no pits nearby)
```

### Resolution Refutation

To prove a cell `(r,c)` is safe:

1. Add `NOT_P_r_c` (negated goal: "there IS a pit here") to KB clauses
2. Repeatedly resolve complementary literals between clause pairs
3. If the **empty clause ⊥** is derived → contradiction → cell is proven **safe**

---

## Deployment (Vercel)

This is a Flask app. For Vercel deployment:

1. Add a `vercel.json` routing Flask via a WSGI adapter
2. Or deploy to **Render** / **Railway** (native Flask support):
   ```
   railway up
   ```

---

## Author

Ali Aashir
