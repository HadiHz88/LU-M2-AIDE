# =====================================================
#  PyTorch Image Classification with Transfer Learning and Fine Tuning
# =====================================================

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
import torchvision
import torchvision.transforms as transforms
import matplotlib.pyplot as plt
import numpy as np
from sklearn.metrics import confusion_matrix, ConfusionMatrixDisplay

# -----------------------------------------------------
# 1. Device setup
# -----------------------------------------------------
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("Using device:", device)

# -----------------------------------------------------
# 2. Data transforms (augmentation)
# -----------------------------------------------------
# - Training: heavy augmentation
# - Validation: only resize & normalize

print("Data transforms")
transform_train = transforms.Compose([
    transforms.RandomHorizontalFlip(),
    transforms.RandomRotation(15), # rotate -15 degrees to + 15 degrees
    transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
    transforms.ToTensor(),
    transforms.Normalize((0.5,), (0.5,))
])

transform_val = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize((0.5,), (0.5,))
])

# -----------------------------------------------------
# 3. Load dataset (CIFAR-10)
# -----------------------------------------------------
print("Prepraing Dataset")
train_dataset = torchvision.datasets.CIFAR10(
    root="./data", train=True, download=True, transform=transform_train)

val_dataset = torchvision.datasets.CIFAR10(
    root="./data", train=False, download=True, transform=transform_val)

# Dataloaders (num_workers=0 avoids multiprocessing crash on Windows)
print("Prepraing Dataloaders")
train_loader = DataLoader(train_dataset, batch_size=64, shuffle=True, num_workers=0)
val_loader = DataLoader(val_dataset, batch_size=64, shuffle=False, num_workers=0)

# Class labels
classes = train_dataset.classes
print("Classes:", classes)

# -----------------------------------------------------
# 4. Load pretrained model (ResNet18) and modify head
# -----------------------------------------------------
print("Loading Network")
#load from internet
#model = torchvision.models.resnet18(pretrained=True)

model = torchvision.models.resnet18(weights=None)
#loading learnable parameters 
#In PyTorch, the learnable parameters (i.e. weights and biases) of an torch.nn.Module model are contained 
#in the model’s parameters (accessed with model.parameters()).
#A state_dict is simply a Python dictionary object that maps each layer to its parameter tensor.
local_model_path = r"D:\Teaching\UL\AI\Lab\resnetModel\resnet18-f37072fd.pth"
state_dict = torch.load(local_model_path, map_location=device)
model.load_state_dict(state_dict)

print("Freeing layers")
# Freeze feature extractor (optional: students can unfreeze for fine-tuning)
for param in model.parameters():
    param.requires_grad = False #none of the original ResNet layers will update during training.

print("Modify Netork")
# Replace final fully connected layer with classifier for 10 classes
model.fc = nn.Sequential(
    nn.Dropout(0.5),                     # Regularization
    nn.Linear(model.fc.in_features, 10)  # CIFAR-10 has 10 classes
)
# Note: replacing the final fully connected (fc) layer with a new one after the freezing loop, 
# so its parameters are trainable by default (requires_grad=True).




"""
# in case you want to unfreez other layers to fine tune them:
# Freeze all
for param in model.parameters():
    param.requires_grad = False

# Unfreeze last ResNet block (example layer4)
for param in model.layer4.parameters():
    param.requires_grad = True
    
"""
model = model.to(device)

# -----------------------------------------------------
# 5. Define loss function and optimizer
# -----------------------------------------------------
print("Loss, optimizer")
criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.fc.parameters(), lr=0.001)

# -----------------------------------------------------
# 6. Training & validation loops
# -----------------------------------------------------
print("Start training")
num_epochs = 2
best_acc = 0.0

train_acc_history, val_acc_history = [], []


for epoch in range(num_epochs):
    print(f"\nEpoch {epoch+1}/{num_epochs}")
    print("Training phase Epoch", epoch)
    # Training phase
    model.train()
    correct, total, train_loss = 0, 0, 0
    for i, data in enumerate(train_loader, 0): 
        print("epoch", epoch, " batch", i)
        images, labels = data
        
        images = images.to(device)
        labels = labels.to(device)
        
    #for images, labels in train_loader:
        #images, labels = images.to(device), labels.to(device)

        # Forward
        outputs = model(images)
        loss = criterion(outputs, labels)

        # Backward + optimize
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        # Stats
        _, preds = torch.max(outputs, 1)
        correct += (preds == labels).sum().item()
        total += labels.size(0)
        train_loss += loss.item()

    train_acc = correct / total
    train_acc_history.append(train_acc)

    # Validation phase
    print("Validation phase - Epoch", epoch)
    model.eval()# is called to set the model to evaluation mode, which disables dropout and batch normalization updates, ensuring consistent behavior during inference.
    correct, total, val_loss = 0, 0, 0
    with torch.no_grad():
        for images, labels in val_loader:
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            loss = criterion(outputs, labels)

            _, preds = torch.max(outputs, 1)
            correct += (preds == labels).sum().item()
            total += labels.size(0)
            val_loss += loss.item()

    val_acc = correct / total
    val_acc_history.append(val_acc)

    print(f"Train Acc: {train_acc:.4f}, Val Acc: {val_acc:.4f}")

    # Save best model checkpoint
    if val_acc > best_acc:
        best_acc = val_acc
        torch.save(model.state_dict(), "best_model.pth")
        print("Saved new best model!")


# -----------------------------------------------------
# 7. Plot accuracy curves
# -----------------------------------------------------
print("Plot accuracy curves")
plt.plot(train_acc_history, label="Train Acc")
plt.plot(val_acc_history, label="Val Acc")
plt.xlabel("Epoch")
plt.ylabel("Accuracy")
plt.legend()
plt.title("Training vs Validation Accuracy")
plt.show()

# -----------------------------------------------------
# 8. Evaluate with confusion matrix
# -----------------------------------------------------
print("confusion matrix")
model.load_state_dict(torch.load("best_model.pth"))  # load best checkpoint
model.eval()

all_preds, all_labels = [], []
with torch.no_grad():
    for images, labels in val_loader:
        images, labels = images.to(device), labels.to(device)
        outputs = model(images)
        _, preds = torch.max(outputs, 1)
        all_preds.extend(preds.cpu().numpy())
        all_labels.extend(labels.cpu().numpy())

cm = confusion_matrix(all_labels, all_preds)
disp = ConfusionMatrixDisplay(cm, display_labels=classes)
disp.plot(xticks_rotation=45)
plt.show()

print("Finished training! Best Val Accuracy:", best_acc)
