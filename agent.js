// ============================================================
// ENVIRONMENT — grid state, hazard placement, percept generation
// ============================================================

const ENV = {
  rows: 4,
  cols: 4,
  grid: [],       // 2d array of cell objects
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
          r, c,
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
          this._neighbors(r, c).forEach(n => { this.grid[n.r][n.c].breeze = true; });
        }
        if (cell.hasWumpus) {
          this._neighbors(r, c).forEach(n => { this.grid[n.r][n.c].stench = true; });
        }
        if (cell.hasGold) {
          this.grid[r][c].glitter = true;
        }
      }
    }
  },

  _neighbors(r, c) {
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    return dirs
      .map(([dr, dc]) => ({ r: r + dr, c: c + dc }))
      .filter(n => n.r >= 0 && n.r < this.rows && n.c >= 0 && n.c < this.cols);
  },

  getCurrentPercepts() {
    const { r, c } = this.agentPos;
    const cell = this.grid[r][c];
    const percepts = [];
    if (cell.breeze)  percepts.push('Breeze');
    if (cell.stench)  percepts.push('Stench');
    if (cell.glitter) percepts.push('Glitter ✦ (Gold here!)');
    if (percepts.length === 0) percepts.push('None');
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
      return 'dead';
    }
    if (cell.hasGold) {
      this.gameOver = true;
      this.won = true;
      return 'won';
    }
    return 'alive';
  }
};