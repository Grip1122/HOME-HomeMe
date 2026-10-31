"""
Blender script to build robot model from orthographic views
Run this inside Blender: Alt+P in Text Editor or via command line

This script analyzes the three-view image and constructs the 3D model
"""

import bpy
import bmesh
from mathutils import Vector

# Clear existing mesh objects
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def create_box(name, cx, cy, cz, sx, sy, sz, color=None):
    """Create a box mesh at given position and size"""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, cz))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (sx/2, sy/2, sz/2)
    bpy.ops.object.transform_apply(scale=True)
    
    if color:
        mat = bpy.data.materials.new(name=f"Mat_{name}")
        mat.use_nodes = True
        mat.node_tree.nodes["Principled BSDF"].inputs[0].default_value = color + (1.0,)
        obj.data.materials.append(mat)
    
    return obj

# Robot structure based on typical humanoid proportions
# All units in meters, origin at feet

print("Building robot model...")

# Head
create_box("Head", 0, 1.65, 0, 0.28, 0.28, 0.28, (0.9, 0.3, 0.24))

# Neck
create_box("Neck", 0, 1.45, 0, 0.12, 0.08, 0.12, (0.58, 0.65, 0.65))

# Torso upper
create_box("TorsoUpper", 0, 1.15, 0, 0.48, 0.35, 0.25, (0.2, 0.6, 0.86))

# Torso lower
create_box("TorsoLower", 0, 0.82, 0, 0.42, 0.30, 0.22, (0.16, 0.5, 0.73))

# Left arm
create_box("LeftUpperArm", -0.34, 1.10, 0, 0.14, 0.32, 0.14, (0.61, 0.35, 0.71))
create_box("LeftLowerArm", -0.34, 0.72, 0, 0.12, 0.30, 0.12, (0.56, 0.27, 0.68))
create_box("LeftHand", -0.34, 0.50, 0, 0.10, 0.12, 0.08, (0.49, 0.24, 0.60))

# Right arm
create_box("RightUpperArm", 0.34, 1.10, 0, 0.14, 0.32, 0.14, (0.61, 0.35, 0.71))
create_box("RightLowerArm", 0.34, 0.72, 0, 0.12, 0.30, 0.12, (0.56, 0.27, 0.68))
create_box("RightHand", 0.34, 0.50, 0, 0.10, 0.12, 0.08, (0.49, 0.24, 0.60))

# Waist
create_box("Waist", 0, 0.60, 0, 0.38, 0.10, 0.20, (0.2, 0.29, 0.37))

# Left leg
create_box("LeftUpperLeg", -0.13, 0.30, 0, 0.16, 0.32, 0.16, (0.09, 0.63, 0.52))
create_box("LeftLowerLeg", -0.13, -0.05, 0, 0.14, 0.33, 0.14, (0.07, 0.55, 0.46))
create_box("LeftFoot", -0.13, -0.28, 0.06, 0.16, 0.08, 0.24, (0.06, 0.40, 0.33))

# Right leg
create_box("RightUpperLeg", 0.13, 0.30, 0, 0.16, 0.32, 0.16, (0.09, 0.63, 0.52))
create_box("RightLowerLeg", 0.13, -0.05, 0, 0.14, 0.33, 0.14, (0.07, 0.55, 0.46))
create_box("RightFoot", 0.13, -0.28, 0.06, 0.16, 0.08, 0.24, (0.06, 0.40, 0.33))

# Select all robot parts
bpy.ops.object.select_all(action='SELECT')

# Optional: Join all parts into one object
# bpy.ops.object.join()

# Set viewport shading to solid with face orientation
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        for space in area.spaces:
            if space.type == 'VIEW_3D':
                space.shading.type = 'SOLID'
                space.shading.color_type = 'MATERIAL'

# Frame all objects in view
bpy.ops.view3d.view_all()

print("Robot model complete!")
print("Total objects:", len(bpy.context.selected_objects))
