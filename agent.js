// ============================================================
// ENVIRONMENT — grid state, hazard placement, percept generation
// ============================================================

const ENV = {
  rows: 4,
  cols: 4,
  grid: [], // 2d array of cell objects
  agentPos: null, // {r, c}
  goldPos: null,
  wumpusPos: null,
  pits: [],
  gameOver: false,
  won: false,

  init(rows, cols) {
    this.rows = rows;
    this.cols = cols;
    this.grid = [];
    this.pits = [];
    this.gameOver = false;
    this.won = false;

    // build empty grid
    for (let r = 0; r < rows; r++) {
      this.grid[r] = [];
      for (let c = 0; c < cols; c++) {
        this.grid[r][c] = {
          r,
          c,
          hasPit: false,
          hasWumpus: false,
          hasGold: false,
          visited: false,
          safe: false,
          inferredDanger: false,
          breeze: false,
          stench: false,
          glitter: false,
        };
      }
    }

    // agent always starts at (rows-1, 0) — bottom-left
    this.agentPos = { r: rows - 1, c: 0 };
    this.grid[rows - 1][0].visited = true;
    this.grid[rows - 1][0].safe = true;

    this._placeHazards();
    this._computePercepts();
  },

  _placeHazards() {
    const total = this.rows * this.cols;
    const pitCount = Math.max(2, Math.floor(total * 0.15));
    const forbidden = new Set([`${this.rows - 1},0`]); // start cell always clear

    // place pits
    let placed = 0;
    while (placed < pitCount) {
      const r = Math.floor(Math.random() * this.rows);
      const c = Math.floor(Math.random() * this.cols);
      const key = `${r},${c}`;
      if (!forbidden.has(key)) {
        this.grid[r][c].hasPit = true;
        this.pits.push({ r, c });
        forbidden.add(key);
        placed++;
      }
    }

    // place wumpus
    let wr, wc;
    do {
      wr = Math.floor(Math.random() * this.rows);
      wc = Math.floor(Math.random() * this.cols);
    } while (forbidden.has(`${wr},${wc}`));
    this.grid[wr][wc].hasWumpus = true;
    this.wumpusPos = { r: wr, c: wc };
    forbidden.add(`${wr},${wc}`);

    // place gold
    let gr, gc;
    do {
      gr = Math.floor(Math.random() * this.rows);
      gc = Math.floor(Math.random() * this.cols);
    } while (forbidden.has(`${gr},${gc}`));
    this.grid[gr][gc].hasGold = true;
    this.goldPos = { r: gr, c: gc };
  },

  _computePercepts() {
    // for every cell adjacent to a pit → breeze
    // for every cell adjacent to wumpus → stench
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.grid[r][c].breeze = false;
        this.grid[r][c].stench = false;
        this.grid[r][c].glitter = false;
      }
    }
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (cell.hasPit) {
          this._neighbors(r, c).forEach((n) => {
            this.grid[n.r][n.c].breeze = true;
          });
        }
        if (cell.hasWumpus) {
          this._neighbors(r, c).forEach((n) => {
            this.grid[n.r][n.c].stench = true;
          });
        }
        if (cell.hasGold) {
          this.grid[r][c].glitter = true;
        }
      }
    }
  },

  _neighbors(r, c) {
    const dirs = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    return dirs
      .map(([dr, dc]) => ({ r: r + dr, c: c + dc }))
      .filter(
        (n) => n.r >= 0 && n.r < this.rows && n.c >= 0 && n.c < this.cols,
      );
  },

  getCurrentPercepts() {
    const { r, c } = this.agentPos;
    const cell = this.grid[r][c];
    const percepts = [];
    if (cell.breeze) percepts.push("Breeze");
    if (cell.stench) percepts.push("Stench");
    if (cell.glitter) percepts.push("Glitter ✦ (Gold here!)");
    if (percepts.length === 0) percepts.push("None");
    return percepts;
  },

  moveAgent(r, c) {
    this.agentPos = { r, c };
    const cell = this.grid[r][c];
    cell.visited = true;
    cell.safe = true;

    if (cell.hasPit || cell.hasWumpus) {
      this.gameOver = true;
      this.won = false;
      return "dead";
    }
    if (cell.hasGold) {
      this.gameOver = true;
      this.won = true;
      return "won";
    }
    return "alive";
  },
};
// ============================================================
// KNOWLEDGE BASE — propositional logic + resolution refutation
// ============================================================

const KB = {
  clauses: [], // array of arrays of strings (CNF clauses)
  inferenceSteps: 0,

  reset() {
    this.clauses = [];
    this.inferenceSteps = 0;
  },

  // TELL: add new clauses to KB from percepts at (r,c)
  tell(r, c, percepts, rows, cols) {
    const neighbors = ENV._neighbors(r, c);

    if (percepts.includes("Breeze")) {
      // B_r,c => at least one neighbor has a pit
      // CNF: P_n1 v P_n2 v P_n3 ...
      const pitClause = neighbors.map((n) => `P_${n.r}_${n.c}`);
      this._addClause(pitClause);

      // also: each neighbor pit implies breeze here (for completeness)
      neighbors.forEach((n) => {
        // -P_n v B_r,c  (already known true, so we just store pit possibility)
        this._addClause([`-B_${r}_${c}`, `P_${n.r}_${n.c}`]);
      });
    } else {
      // no breeze => no pits adjacent — add unit clause -P for each neighbor
      neighbors.forEach((n) => {
        this._addClause([`-P_${n.r}_${n.c}`]);
      });
    }

    if (percepts.includes("Stench")) {
      const wClause = neighbors.map((n) => `W_${n.r}_${n.c}`);
      this._addClause(wClause);
      neighbors.forEach((n) => {
        this._addClause([`-S_${r}_${c}`, `W_${n.r}_${n.c}`]);
      });
    } else {
      neighbors.forEach((n) => {
        this._addClause([`-W_${n.r}_${n.c}`]);
      });
    }

    // the current cell is safe
    this._addClause([`-P_${r}_${c}`]);
    this._addClause([`-W_${r}_${c}`]);
  },

  // ASK: is cell (r,c) proven safe via resolution refutation?
  // we try to prove: -P_r,c AND -W_r,c
  // method: add negation of query, try to derive empty clause
  ask(r, c) {
    const safeFromPit = this._resolve(`P_${r}_${c}`);
    const safeFromWumpus = this._resolve(`W_${r}_${c}`);
    return safeFromPit && safeFromWumpus;
  },

  // resolution refutation: assume literal is TRUE, try to get contradiction
  _resolve(literal) {
    // working set = KB clauses + {literal} (negation of what we want to prove false)
    let working = this.clauses.map((c) => [...c]);
    working.push([literal]); // add negation assumption

    const negLit = literal.startsWith("-") ? literal.slice(1) : `-${literal}`;

    for (let i = 0; i < working.length; i++) {
      for (let j = i + 1; j < working.length; j++) {
        this.inferenceSteps++;
        const resolvent = this._resolveTwo(working[i], working[j]);
        if (resolvent === null) continue; // no resolution possible
        if (resolvent.length === 0) return true; // empty clause = contradiction found
        // add resolvent if not already present
        if (!working.some((c) => this._clauseEquals(c, resolvent))) {
          working.push(resolvent);
        }
        // safety limit
        if (working.length > 500) break;
      }
    }
    return false;
  },

  // try to resolve two clauses on one complementary literal
  _resolveTwo(c1, c2) {
    for (const lit of c1) {
      const neg = lit.startsWith("-") ? lit.slice(1) : `-${lit}`;
      if (c2.includes(neg)) {
        // resolve on lit / neg
        const resolvent = [
          ...c1.filter((l) => l !== lit),
          ...c2.filter((l) => l !== neg),
        ];
        // remove duplicates
        return [...new Set(resolvent)];
      }
    }
    return null;
  },

  _addClause(clause) {
    const unique = [...new Set(clause)];
    if (!this.clauses.some((c) => this._clauseEquals(c, unique))) {
      this.clauses.push(unique);
    }
  },

  _clauseEquals(a, b) {
    if (a.length !== b.length) return false;
    const sa = [...a].sort().join(",");
    const sb = [...b].sort().join(",");
    return sa === sb;
  },

  getReadableClauses() {
    return this.clauses.slice(-12).map((c) => c.join(" ∨ "));
  },
};
