import store from "./store.ts";
import { burnOptions } from "../lib/types.ts";
import { generateRandomHash, sanitizePythonPath } from "../lib/utils.ts";
import { spinner } from "../lib/utils.ts";
import { bruteFlairSearch } from "../lib/utils.ts";

class Flair {
  version: string;
  constructor() {
    this.version = "0.0.2";
  }
  initialize = async () => {
    try {
      const exists = await Deno.stat("./.flair");
      if (exists.isDirectory) {
        console.log("You have already flaired up");
        Deno.exit(0);
      }
    } catch (_) {
      //
    }
    try {
      await Deno.mkdir(".flair/weights", { recursive: true });
      store.setup();
    } catch (error) {
      console.log(error);
    }
  };
  runPythonScript = async (script: string, args: string[]) => {
    try {
      const process = new Deno.Command("python", {
        args: [script, ...args],
      });
      const { success, stdout } = await process.output();

      if (success) {
        spinner.stop();
        // console.log(new TextDecoder().decode(stdout));
        return new TextDecoder().decode(stdout);
      } else {
        console.log("error in successfully running python script:", stdout);
        Deno.exit(0);
      }
    } catch (error) {
      console.log("error in running python script");
      console.error(`Error: ${error}`);
      Deno.exit(0);
    }
  };

  burnWeights = async ({ path, model, description }: burnOptions) => {
    try {
      const hash = generateRandomHash();
      await bruteFlairSearch(0, `weights/${hash}.pth`);
      const weightPath = ".flair/weights/" + hash + ".pth";
      const modulePath = sanitizePythonPath(path as string);
      const burnScript = await Deno.open("burn.py", {
        write: true,
        create: true,
      });
      const metricScript = await Deno.open("metrics.py", {
        write: true,
        create: true,
      });
      await burnScript.write(
        new TextEncoder().encode(
          `import torch\nfrom ${modulePath} import ${model}\nprint(f"\\nModel:{${model}}")\ndef save_model_weights(${model}):\n\ttorch.save(model.state_dict(),"${weightPath}")\nsave_model_weights(${model})`
        )
      );
      await metricScript.write(
        new TextEncoder().encode(
          `import torch.nn as nn\nfrom ${modulePath} import ${model}\nclass ModelCapture:\n\tdef __init__(self, model):\n\t\tself.model=model\n\tdef get_architecture(self):\n\t\tarchitecture=[]\n\t\tfor name, layer in self.model.named_modules():\n\t\t\tif not isinstance(layer,nn.Sequential) and name:\n\t\t\t\tlayer_info={"name":name,"type":layer.__class__.__name__,"num_params":sum(p.numel() for p in layer.parameters())}\n\t\t\t\tif isinstance(layer,(nn.Linear,nn.Conv2d,nn.Conv3d)):\n\t\t\t\t\tlayer_info.update({"in_features":getattr(layer,"in_features",None),"out_features":getattr(layer,"out_features",None),"kernel_size":getattr(layer,"kernel_size",None),"stride":getattr(layer,"stride",None),"padding":getattr(layer,"padding",None),"dilation":getattr(layer,"dilation",None)})\n\t\t\t\telif isinstance(layer,(nn.RNN,nn.LSTM,nn.GRU)):\n\t\t\t\t\tlayer_info.update({"input_size":layer.input_size,"hidden_size":layer.hidden_size,"num_layers":layer.num_layers,"bidirectional":layer.bidirectional})\n\t\t\t\telif isinstance(layer,nn.Transformer):\n\t\t\t\t\tlayer_info.update({"num_layers":layer.encoder.layers[0].self_attn.num_heads,"d_model":layer.d_model})\n\t\t\t\telif isinstance(layer,(nn.BatchNorm1d,nn.BatchNorm2d)):\n\t\t\t\t\tlayer_info.update({"num_features":layer.num_features,"eps":layer.eps,"momentum":layer.momentum})\n\t\t\t\tif "discriminator" in name.lower() or "generator" in name.lower():\n\t\t\t\t\tlayer_info["role"]="GAN Component"\n\t\t\t\tarchitecture.append(layer_info)\n\t\tprint(architecture)\nmeta=ModelCapture(model)\nmeta.get_architecture()`
        )
      );
      burnScript.close();
      spinner.start("Serializing weights");
      await this.runPythonScript("burn.py", []);
      spinner.start("Capturing model metrics");
      const metrics = await this.runPythonScript("metrics.py", []);
      spinner.start("Generating hashes");
      await store.burnStore(description as string, hash, metrics);
      await Deno.remove("burn.py");
      await Deno.remove("metrics.py");
      spinner.stop();
    } catch (error) {
      console.error(`Error: ${error}`);
      Deno.exit(0);
    }
  };
}

const flair = new Flair();

export default flair;
