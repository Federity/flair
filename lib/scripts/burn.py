# !! This script is not an executable python file! 

import torch
from {modulePath} import {model}
print(f"\nModel:{model}")
def save_model_weights(model):
	torch.save(model.state_dict(),".flair/weights/{hash}.pth")
save_model_weights(model)