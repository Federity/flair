import { Database } from "@db/sqlite";
import { hashFile, spinner } from "../lib/utils.ts";
import { branches, burns, metrics, weights } from "../lib/schema.ts";

class Store {
  path: string;
  constructor() {
    this.path = ".flair/store.db";
  }
  setup() {
    const db = new Database(this.path);

    db.prepare(branches).run();
    db.prepare(burns).run();
    db.prepare(metrics).run();
    db.prepare(weights).run();

    db.prepare(
      `
      INSERT INTO branches (branch_name) VALUES (?);
    `
    ).run("central");

    db.close();
  }
  getCurrentBranch() {
    const db = new Database(this.path);

    return db.sql`SELECT branch_id, branch_name from branches WHERE current = 1`[0];
  }

  createBranch(name: string) {
    const db = new Database(this.path);

    db.exec(`UPDATE branches
           SET current = 0
           WHERE current = 1;
  `);

    db.prepare(
      `
      INSERT INTO branches (branch_name) VALUES (?);
    `
    ).run(name);

    db.close();
  }

  getAllBranches() {
    const db = new Database(this.path);

    const branches = db.sql`SELECT branch_name from branches`;
    return branches.map((branch) => branch.branch_name);
  }

  hopBranch(branch: string) {
    const db = new Database(this.path);

    db.exec(`UPDATE branches
           SET current = 0
           WHERE current = 1;
  `);

    db.prepare(
      `UPDATE branches
     SET current = 1
     WHERE branch_name = ?;
    `
    ).run(branch);

    db.close();

    // TODO: Error for non-existing branch
  }

  getWeightSNO() {
    const db = new Database(this.path);
    const { weight_id } = db.sql`SELECT COUNT(*) as weight_id FROM weights`[0];
    return weight_id + 1;
  }

  async burnStore(description: string, burnHash: string, metrics: string) {
    const db = new Database(this.path);

    const { branch_id } =
      db.sql`SELECT branch_id from branches WHERE current = 1`[0];

    const burnIdQuery =
      db.sql`SELECT burn_id from burns ORDER BY burn_id DESC LIMIT 1`[0];
    const parentBurnId = burnIdQuery ? burnIdQuery.burn_id : null;

    const weightSNO = await this.getWeightSNO();
    const weightHash = await hashFile(burnHash);

    spinner.stop();
    spinner.start("Burning to timeline");

    db.prepare(
      `
      INSERT INTO weights (weights_hash, weights_file) VALUES (?, ?);
    `
    ).run(weightHash, `.flair/weights/${burnHash}.pth`);

    db.prepare(
      `
      INSERT INTO burns (burn_hash, description, parent_burn_id, branch_id, weights_id) VALUES (?, ?, ?, ?, ?);
    `
    ).run(burnHash, description, parentBurnId, branch_id, weightSNO);

    db.prepare(
      `
      INSERT INTO metrics (burn_hash, architecture) VALUES (?, ?);
    `
    ).run(burnHash, metrics);
  }

  getAllBurns() {
    const db = new Database(this.path);
    const { branch_id } = this.getCurrentBranch();
    return db.sql`SELECT burn_hash, description, author, branch_id, created_at from burns WHERE branch_id = ${branch_id}`;
  }
}

const store = new Store();

export default store;
