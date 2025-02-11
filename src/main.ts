#!/usr/bin/env -S deno run --allow-run

import { Command } from "@cliffy/command";
import store from "./store.ts";
import { burnOptions } from "../lib/types.ts";
import flair from "./function.ts";
import { bruteFlairSearch } from "../lib/utils.ts";

const program = new Command();

program
  .name("flair")
  .description("Version control for federity")
  .option("-v, --version", "", {
    standalone: true,
    action: () => {
      console.log(flair.version);
    },
  })
  .action(() => console.log("Version control for federity"))
  .command("up")
  .action(() => flair.initialize())
  .command("branch")
  .option("-l, --list", "list all available branches", {
    standalone: true,
    action: () => {
      const branches = store.getAllBranches();
      for (const branch of branches) {
        const { branch_name } = store.getCurrentBranch();
        if (branch_name == branch) {
          console.log(branch + " <--");
        } else console.log(branch);
      }
    },
  })
  .action(() => {
    const { branch_name } = store.getCurrentBranch();
    console.log(`current: ${branch_name}`);
  })
  .command("create")
  .arguments("<name>")
  .action((_: void, branch: string) => {
    store.createBranch(branch);
    console.log("new branch created");
    const { branch_name } = store.getCurrentBranch();
    console.log(`current: ${branch_name}`);
  })
  .command("hop")
  .arguments("<name>")
  .action((_: void, branch: string) => {
    store.hopBranch(branch);
    const { branch_name } = store.getCurrentBranch();
    console.log(`current: ${branch_name}`);
  })
  .command("burn", "")
  .option("-p, --path [type:string]", "Path to module containing model", {
    required: true,
  })
  .option("-m, --model [type:string]", "Name of model instance", {
    required: true,
  })
  .option("-d, --description [type:string]", "Description", {
    required: true,
  })
  .group("The required flags to pass while burning")
  .action((options: burnOptions, _: void) => flair.burnWeights(options))
  .command("timeline", "")
  .action(() => {
    // const burns = store.getAllBurns().reverse();
    // console.log`\nBurn Timeline on branch: ${
    //   store.getCurrentBranch().branch_name
    // }\n`();
    // for (let i = 0; i < burns.length; i++) {
    //   console.log(
    //     `${burns[i].burn_hash} -- ${burns[i].author} -- ${burns[i].created_at}\n ${burns[i].description}` +
    //       `${i < burns.length - 1 ? "\n\n^\n|\n" : ""}`
    //   );
    // }
  })
  .command("wipe")
  .action(async () => {
    await bruteFlairSearch(0, "");
    await Deno.remove(".flair", { recursive: true });
  })
  .command("rollback")
  .action(() => {})
  .command("fetch")
  .action(() => {})
  .parse(Deno.args);
