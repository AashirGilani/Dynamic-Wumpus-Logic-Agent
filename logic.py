# logic.py - Propositional Logic: CNF conversion + Resolution Refutation

def negate(literal):
    """Negate a literal string like 'P_1_2' -> 'NOT_P_1_2' and vice versa."""
    if literal.startswith("NOT_"):
        return literal[4:]
    return "NOT_" + literal


def resolve(ci, cj):
    """
    Try to resolve two clauses (sets of literals).
    Returns the resolvent if exactly one complementary pair exists, else None.
    """
    resolvents = []
    for lit in ci:
        neg = negate(lit)
        if neg in cj:
            # Produce resolvent: union minus the complementary pair
            resolvent = (ci - {lit}) | (cj - {neg})
            resolvents.append(frozenset(resolvent))
    return resolvents


def resolution_refutation(kb_clauses, goal_literal):
    """
    Resolution Refutation: try to prove `goal_literal` from kb_clauses.
    We negate the goal, add it to clauses, and try to derive the empty clause.

    Returns (proved: bool, steps: list of str, inference_count: int)
    """
    steps = []
    negated_goal = negate(goal_literal)
    clauses = set(frozenset(c) for c in kb_clauses)
    clauses.add(frozenset([negated_goal]))

    steps.append(f"Negated goal added: {{{negated_goal}}}")
    inference_count = 0

    while True:
        new_clauses = set()
        clause_list = list(clauses)

        found_empty = False
        for i in range(len(clause_list)):
            for j in range(i + 1, len(clause_list)):
                resolvents = resolve(clause_list[i], clause_list[j])
                for resolvent in resolvents:
                    inference_count += 1
                    if len(resolvent) == 0:
                        steps.append(
                            f"Step {inference_count}: Resolved {set(clause_list[i])} "
                            f"with {set(clause_list[j])} → ⊥ (contradiction!)"
                        )
                        return True, steps, inference_count
                    steps.append(
                        f"Step {inference_count}: Resolved {set(clause_list[i])} "
                        f"with {set(clause_list[j])} → {set(resolvent)}"
                    )
                    new_clauses.add(resolvent)

        if new_clauses.issubset(clauses):
            steps.append("No new clauses derived. Goal cannot be proven.")
            return False, steps, inference_count

        clauses = clauses | new_clauses

        # Safety cap to avoid infinite loops on large KBs
        if inference_count > 300:
            steps.append("Inference limit reached.")
            return False, steps, inference_count


def build_kb_clauses(percepts):
    """
    Given a dict of percepts { 'B_r_c': True/False, 'S_r_c': True/False, ... },
    build CNF clauses for the KB.

    Each Breeze percept B_r_c <=> P_adj1 v P_adj2 v ...
    expands to two implications converted to CNF.
    """
    clauses = []
    for key, val in percepts.items():
        parts = key.split("_")
        ptype = parts[0]   # B or S
        r, c = int(parts[1]), int(parts[2])

        # Build adjacents
        adj = [(r-1, c), (r+1, c), (r, c-1), (r, c+1)]
        hazard_prefix = "P" if ptype == "B" else "W"
        adj_lits = [f"{hazard_prefix}_{ar}_{ac}" for ar, ac in adj]

        if val:
            # B_r_c is True: at least one adjacent has pit
            # Biconditional left->right: ¬B ∨ P_adj1 ∨ P_adj2 ∨ ...
            clauses.append(set(adj_lits))
            # right->left: for each adj: ¬P_adj ∨ B  (we already know B=True so skip)
        else:
            # B_r_c is False: none of the adjacent cells have a pit
            # ¬B => ¬P for each adj
            for lit in adj_lits:
                clauses.append({negate(lit)})

    return clauses
