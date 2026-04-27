# wumpus.py - Wumpus World Environment

import random


class WumpusWorld:
    def __init__(self, rows, cols, num_pits=None):
        self.rows = rows
        self.cols = cols
        self.num_pits = num_pits or max(1, (rows * cols) // 5)

        # Agent starts at (0, 0) - bottom-left
        self.agent = (0, 0)
        self.alive = True
        self.gold_found = False
        self.arrow_used = False

        self.pits = set()
        self.wumpus = None
        self.gold = None

        self._place_hazards()

        # Cell knowledge: 'unknown', 'safe', 'pit', 'wumpus', 'visited'
        self.cell_status = {}
        for r in range(rows):
            for c in range(cols):
                self.cell_status[(r, c)] = "unknown"

        # Mark start as safe/visited
        self.cell_status[(0, 0)] = "visited"

        # Percepts KB: maps 'B_r_c' -> bool, 'S_r_c' -> bool
        self.percepts = {}

        # Log of agent's inference steps count
        self.inference_steps = 0

        # Record percepts at start
        self._record_percepts(0, 0)

    def _place_hazards(self):
        all_cells = [(r, c) for r in range(self.rows)
                     for c in range(self.cols) if (r, c) != (0, 0)]
        random.shuffle(all_cells)

        for i in range(min(self.num_pits, len(all_cells) - 2)):
            self.pits.add(all_cells[i])

        self.wumpus = all_cells[self.num_pits]
        self.gold = all_cells[self.num_pits + 1]

    def _adjacent(self, r, c):
        result = []
        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nr, nc = r + dr, c + dc
            if 0 <= nr < self.rows and 0 <= nc < self.cols:
                result.append((nr, nc))
        return result

    def _record_percepts(self, r, c):
        adj = self._adjacent(r, c)
        breeze = any(cell in self.pits for cell in adj)
        stench = any(cell == self.wumpus for cell in adj)
        self.percepts[f"B_{r}_{c}"] = breeze
        self.percepts[f"S_{r}_{c}"] = stench

    def get_state(self):
        """Return full world state as a serializable dict."""
        grid = []
        for r in range(self.rows - 1, -1, -1):  # top row first for display
            row = []
            for c in range(self.cols):
                cell = {
                    "r": r, "c": c,
                    "status": self.cell_status.get((r, c), "unknown"),
                    "is_agent": self.agent == (r, c),
                    "is_gold": self.gold == (r, c) and not self.gold_found,
                    "percepts": []
                }
                key_b = f"B_{r}_{c}"
                key_s = f"S_{r}_{c}"
                if self.percepts.get(key_b):
                    cell["percepts"].append("Breeze")
                if self.percepts.get(key_s):
                    cell["percepts"].append("Stench")
                row.append(cell)
            grid.append(row)

        ar, ac = self.agent
        current_percepts = []
        if self.percepts.get(f"B_{ar}_{ac}"):
            current_percepts.append("Breeze")
        if self.percepts.get(f"S_{ar}_{ac}"):
            current_percepts.append("Stench")

        return {
            "grid": grid,
            "agent": list(self.agent),
            "alive": self.alive,
            "gold_found": self.gold_found,
            "inference_steps": self.inference_steps,
            "current_percepts": current_percepts,
            "rows": self.rows,
            "cols": self.cols,
        }

    def move(self, direction):
        """
        Move agent in a direction. Returns a result dict with status and log.
        """
        if not self.alive:
            return {"ok": False, "message": "Agent is dead.", "log": []}

        r, c = self.agent
        dr, dc = {"up": (1, 0), "down": (-1, 0),
                  "left": (0, -1), "right": (0, 1)}.get(direction, (0, 0))
        nr, nc = r + dr, c + dc

        if not (0 <= nr < self.rows and 0 <= nc < self.cols):
            return {"ok": False, "message": "Can't move there (wall).", "log": []}

        self.agent = (nr, nc)
        log = [f"Agent moved {direction} to ({nr},{nc})."]

        # Check hazards
        if (nr, nc) in self.pits:
            self.alive = False
            self.cell_status[(nr, nc)] = "pit"
            log.append("Agent fell into a PIT! Game over.")
            return {"ok": True, "message": "Fell into pit!", "log": log, "dead": True}

        if (nr, nc) == self.wumpus:
            self.alive = False
            self.cell_status[(nr, nc)] = "wumpus"
            log.append("Agent encountered the WUMPUS! Game over.")
            return {"ok": True, "message": "Eaten by Wumpus!", "log": log, "dead": True}

        # Safe — record percepts and update status
        self._record_percepts(nr, nc)
        self.cell_status[(nr, nc)] = "visited"

        if (nr, nc) == self.gold:
            self.gold_found = True
            log.append("Agent found the GOLD! You win!")

        return {"ok": True, "message": "Moved.", "log": log, "dead": False}

    def infer_safe_cells(self, logic_module):
        """
        Use Resolution Refutation to mark cells as safe or dangerous.
        Updates cell_status for unvisited cells.
        Returns inference log.
        """
        from logic import build_kb_clauses, resolution_refutation

        kb_clauses = build_kb_clauses(self.percepts)
        log = []
        total_steps = 0

        for r in range(self.rows):
            for c in range(self.cols):
                if self.cell_status[(r, c)] != "unknown":
                    continue

                # Try to prove ¬P_r_c (no pit)
                proved_safe_pit, steps, count = resolution_refutation(
                    kb_clauses, f"NOT_P_{r}_{c}"
                )
                total_steps += count

                # Try to prove ¬W_r_c (no wumpus)
                proved_safe_wumpus, steps2, count2 = resolution_refutation(
                    kb_clauses, f"NOT_W_{r}_{c}"
                )
                total_steps += count2

                if proved_safe_pit and proved_safe_wumpus:
                    self.cell_status[(r, c)] = "safe"
                    log.append(f"Cell ({r},{c}) proven SAFE via resolution.")

        self.inference_steps += total_steps
        return log, total_steps
